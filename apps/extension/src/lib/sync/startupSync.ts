/**
 * useStartupSync — React hook that runs on mount to synchronize local
 * and remote stores when the extension opens (popup or options page).
 *
 * Flow:
 * 1. Check if user is authenticated
 * 2. If authenticated, pull remote store via syncEngine.pull()
 * 3. Get local store via getStore()
 * 4. Compare timestamps using last-write-wins logic
 * 5. If remote is newer → save remote to local (saveStore)
 * 6. If local is newer → push local to cloud (syncEngine.push)
 * 7. Handle errors gracefully (just use local data)
 *
 * Requirements: 3.2, 3.8, 1.9
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthContext } from "../auth/AuthProvider";
import { getStore, saveStore } from "../store";
import { createSyncEngine, lastWriteWins, type SyncEngine } from "./syncEngine";
import { getSyncMetadata, setSyncMetadata } from "./offlineQueue";
import { hasUserModifications } from "./migration";
import type { TrackItStore } from "../../types";

export type StartupSyncStatus =
  | "idle"
  | "syncing"
  | "synced"
  | "offline"
  | "error";

export interface StartupSyncResult {
  /** Current status of the startup sync operation */
  status: StartupSyncStatus;
  /** The resolved store after sync (local or remote winner) */
  store: TrackItStore | null;
  /** Whether a conflict was detected and resolved via last-write-wins */
  conflictResolved: boolean;
  /** Error message if sync failed (local data is still used) */
  error: string | null;
}

/**
 * Hook that performs startup sync when the extension opens.
 *
 * @param options.syncEngine - Optional SyncEngine override (for testing)
 * @param options.enabled - Whether sync should run (default: true)
 */
export function useStartupSync(options?: {
  syncEngine?: SyncEngine;
  enabled?: boolean;
}): StartupSyncResult {
  const { isSignedIn, isLoading, getToken } = useAuthContext();
  const enabled = options?.enabled ?? true;

  const [status, setStatus] = useState<StartupSyncStatus>("idle");
  const [store, setStore] = useState<TrackItStore | null>(null);
  const [conflictResolved, setConflictResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRun = useRef(false);
  const engineRef = useRef<SyncEngine | null>(options?.syncEngine ?? null);

  const performSync = useCallback(async () => {
    // Validate token is available
    const token = await getToken();
    if (!token) {
      // No valid token — fall back to local data
      const localStore = await getStore();
      setStore(localStore);
      setStatus("idle");
      return;
    }

    setStatus("syncing");

    // Create sync engine if not provided
    if (!engineRef.current) {
      engineRef.current = createSyncEngine();
    }
    const engine = engineRef.current;

    try {
      // Pull remote store
      const remoteStore = await engine.pull();

      // Get local store
      const localStore = await getStore();

      if (!remoteStore) {
        // No remote store or pull failed — use local data
        // If engine status is 'error', we're likely offline
        const engineStatus = engine.getStatus();
        if (engineStatus === "error") {
          setStore(localStore);
          setStatus("offline");
          return;
        }

        // No remote document exists (404) — push local to cloud
        await engine.push(localStore);
        setStore(localStore);
        setStatus("synced");
        return;
      }

      // Both stores exist — check for conflict scenario (Requirement 3.8)
      const syncMeta = await getSyncMetadata();
      const lastSyncedAt = syncMeta.lastSyncedAt;

      const localChangedSinceLastSync = localStore.updatedAt !== lastSyncedAt;
      const remoteChangedSinceLastSync = remoteStore.updatedAt !== lastSyncedAt;
      const bothChanged =
        lastSyncedAt > 0 &&
        localChangedSinceLastSync &&
        remoteChangedSinceLastSync &&
        localStore.updatedAt !== remoteStore.updatedAt;

      // If local store is just the default (no user modifications), always prefer remote.
      // This handles the case of a fresh install where buildDefaultStore() sets
      // updatedAt to Date.now() which would incorrectly win over older real data.
      const localIsDefault = !hasUserModifications(localStore);
      const remoteIsDefault = !hasUserModifications(remoteStore);
      
      let winner: TrackItStore;
      if (localIsDefault && !remoteIsDefault) {
        // Fresh local install, remote has real data — use remote
        winner = remoteStore;
      } else if (!localIsDefault && remoteIsDefault) {
        // Local has real data, remote is default/empty — use local and push to cloud
        winner = localStore;
      } else {
        // Both have real data (or both are default) — apply last-write-wins
        winner = lastWriteWins(localStore, remoteStore);
      }

      if (winner === remoteStore) {
        // Remote is newer — write directly to local storage without triggering sync push
        await new Promise<void>((resolve, reject) => {
          chrome.storage.local.set({ "trackit.store": remoteStore }, () => {
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message));
            else resolve();
          });
        });
        setStore(remoteStore);
      } else {
        // Local is newer — push local to cloud
        await engine.push(localStore);
        setStore(localStore);
      }

      // Update sync metadata
      await setSyncMetadata({
        lastSyncedAt: winner.updatedAt,
        pendingPush: false,
      });

      if (bothChanged) {
        setConflictResolved(true);
      }

      setStatus("synced");
    } catch (err) {
      // Handle pull failure gracefully: show local data with offline indicator
      try {
        const localStore = await getStore();
        setStore(localStore);
      } catch {
        // Even local store failed — nothing we can do
      }
      setError(
        err instanceof Error ? err.message : "Sync failed"
      );
      setStatus("offline");
    }
  }, [getToken]);

  useEffect(() => {
    // Don't run until auth loading completes
    if (isLoading) return;
    // Don't run if disabled
    if (!enabled) return;
    // Only run once per mount
    if (hasRun.current) return;

    if (isSignedIn) {
      hasRun.current = true;
      void performSync();
    } else {
      // Not signed in — just load local store
      hasRun.current = true;
      void getStore().then((localStore) => {
        setStore(localStore);
        setStatus("idle");
      });
    }
  }, [isSignedIn, isLoading, enabled, performSync]);

  // Cleanup engine on unmount if we created it
  useEffect(() => {
    return () => {
      if (!options?.syncEngine && engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [options?.syncEngine]);

  return { status, store, conflictResolved, error };
}
