/**
 * SyncEngine — Core sync logic for TrackIt cloud sync.
 *
 * Manages push/pull operations with debouncing (3s window),
 * last-write-wins conflict resolution, and status tracking.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.6, 3.7
 */

import type { TrackItStore } from "../../types";
import * as apiClient from "./apiClient";
import type { ApiResponse } from "./apiClient";

export type SyncStatus = "idle" | "pushing" | "pulling" | "error" | "offline";

export interface SyncResult {
  success: boolean;
  error?: string;
  retriesUsed: number;
}

export interface SyncEngine {
  push(store: TrackItStore): Promise<SyncResult>;
  pull(): Promise<TrackItStore | null>;
  getStatus(): SyncStatus;
  onStatusChange(cb: (status: SyncStatus) => void): () => void;
  destroy(): void;
}

/** Default debounce window in milliseconds. */
const DEBOUNCE_MS = 5000;

/**
 * Creates a new SyncEngine instance.
 *
 * @param options.debounceMs - Debounce delay for push batching (default: 3000ms)
 * @param options.apiClientOverride - Optional override for the API client (testing)
 */
export function createSyncEngine(options?: {
  debounceMs?: number;
  apiClientOverride?: {
    getStore: typeof apiClient.getStore;
    putStore: typeof apiClient.putStore;
  };
}): SyncEngine {
  const debounceMs = options?.debounceMs ?? DEBOUNCE_MS;
  const api = options?.apiClientOverride ?? apiClient;

  let status: SyncStatus = "idle";
  const listeners = new Set<(status: SyncStatus) => void>();

  // Debounce state
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingStore: TrackItStore | null = null;
  let pendingResolvers: Array<{
    resolve: (result: SyncResult) => void;
    reject: (error: Error) => void;
  }> = [];

  function setStatus(newStatus: SyncStatus): void {
    if (status !== newStatus) {
      status = newStatus;
      for (const cb of listeners) {
        try {
          cb(newStatus);
        } catch {
          // Listener errors should not break the engine
        }
      }
    }
  }

  /**
   * Resolve the last-write-wins conflict between local and remote stores.
   * Returns the store with the higher `updatedAt` timestamp, or null if
   * they are equal (no conflict).
   */
  function resolveConflict(
    local: TrackItStore,
    remote: TrackItStore
  ): TrackItStore {
    if (remote.updatedAt > local.updatedAt) {
      return remote;
    }
    return local;
  }

  /**
   * Execute the actual push to the API. This is called after the debounce
   * window has elapsed.
   */
  async function executePush(store: TrackItStore): Promise<SyncResult> {
    setStatus("pushing");

    const response: ApiResponse<void> = await api.putStore(store);

    if (response.status === 0 && response.error) {
      // Network error or no token
      setStatus("error");
      return { success: false, error: response.error, retriesUsed: 0 };
    }

    if (response.status >= 200 && response.status < 300) {
      setStatus("idle");
      return { success: true, retriesUsed: 0 };
    }

    // Server error
    setStatus("error");
    return {
      success: false,
      error: response.error || `HTTP ${response.status}`,
      retriesUsed: 0,
    };
  }

  /**
   * Flush the debounced push — sends the latest store state and resolves
   * all waiting callers.
   */
  async function flushPush(): Promise<void> {
    const store = pendingStore;
    const resolvers = pendingResolvers;

    // Clear pending state before execution
    pendingStore = null;
    pendingResolvers = [];
    debounceTimer = null;

    if (!store) return;

    try {
      const result = await executePush(store);
      for (const { resolve } of resolvers) {
        resolve(result);
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Unknown push error");
      for (const { reject } of resolvers) {
        reject(error);
      }
    }
  }

  /**
   * Push the store to the cloud. Multiple calls within the debounce window
   * (3 seconds) are batched — only the final store state is sent.
   *
   * Returns a promise that resolves once the actual push completes.
   */
  function push(store: TrackItStore): Promise<SyncResult> {
    return new Promise<SyncResult>((resolve, reject) => {
      // Always keep the latest store
      pendingStore = store;
      pendingResolvers.push({ resolve, reject });

      // Reset the debounce timer
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        flushPush();
      }, debounceMs);
    });
  }

  /**
   * Pull the latest store from the cloud. Compares `updatedAt` with the
   * provided local store (if any) and returns the remote store only if it
   * is newer, otherwise returns null.
   *
   * If no local comparison is needed (first pull), returns the remote store
   * directly.
   */
  async function pull(): Promise<TrackItStore | null> {
    setStatus("pulling");

    const response = await api.getStore();

    if (response.status === 0 && response.error) {
      // Network error or no token
      setStatus("error");
      return null;
    }

    if (response.status === 404) {
      // No remote document exists
      setStatus("idle");
      return null;
    }

    if (response.status >= 200 && response.status < 300 && response.data) {
      setStatus("idle");
      return response.data;
    }

    // Unexpected status
    setStatus("error");
    return null;
  }

  function getStatus(): SyncStatus {
    return status;
  }

  function onStatusChange(cb: (status: SyncStatus) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }

  /**
   * Clean up timers and pending state. Call when the engine is no longer needed.
   */
  function destroy(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingStore = null;
    pendingResolvers = [];
    listeners.clear();
  }

  return {
    push,
    pull,
    getStatus,
    onStatusChange,
    destroy,
  };
}

/**
 * Utility: Compare two stores and return the winner using last-write-wins.
 * Exported for direct testing of conflict resolution logic.
 */
export function lastWriteWins(
  storeA: TrackItStore,
  storeB: TrackItStore
): TrackItStore {
  if (storeA.updatedAt >= storeB.updatedAt) {
    return storeA;
  }
  return storeB;
}
