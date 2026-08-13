import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useRef, useState } from "react";
import { fetchStore, pushStore } from "../lib/api";
import { hasUserModifications, loadLocalStore, saveLocalStore } from "../lib/store";
import type { SyncStatus } from "../components/SyncStatusIndicator";
import type { TrackItStore } from "../types/index";

// Local writes are immediate. API push is debounced: rapid changes (e.g. typing a
// comment) collapse into a single request fired after the user pauses for this long.
const PUSH_DEBOUNCE_MS = 5000;

export function useStore() {
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [store, setStore] = useState<TrackItStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const initialized = useRef(false);

  // Debounce state for API pushes
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStore = useRef<TrackItStore | null>(null);

  async function flushPush(storeToFlush: TrackItStore) {
    const token = await getTokenRef.current();
    if (!token) return;
    setSyncStatus("pushing");
    try {
      await pushStore(token, storeToFlush);
      setSyncStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
      setSyncStatus("error");
    }
  }

  // Flush any pending push on unmount so no write is silently dropped
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      if (pendingStore.current) {
        void flushPush(pendingStore.current);
        pendingStore.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Wait until Clerk has confirmed a signed-in session before attempting remote sync.
    // Without this guard, getToken() returns null on first render and remote data is never fetched.
    if (!isSignedIn) return;
    if (initialized.current) return;
    initialized.current = true;

    async function load() {
      try {
        console.log("[useStore] loading local store...");
        const local = await loadLocalStore();
        console.log("[useStore] local store loaded, updatedAt:", local.updatedAt);
        setStore(local);
        setLoading(false);

        const token = await getTokenRef.current();
        console.log("[useStore] got token:", token ? "yes" : "null");
        if (!token) return;
        setSyncStatus("pulling");
        const remote = await fetchStore(token);
        console.log("[useStore] remote store:", remote ? "received" : "null");
        if (remote) {
          console.log("[useStore] local updatedAt:", local.updatedAt, "remote updatedAt:", remote.updatedAt);
          console.log("[useStore] remote groups:", remote.groups?.length, "tasks:", remote.tasks?.length, "entries:", remote.entries?.length);
        }
        if (!remote) {
          setSyncStatus("pushing");
          await pushStore(token, local);
          setSyncStatus("idle");
          return;
        }
        const localHasData = hasUserModifications(local);
        const remoteHasData = hasUserModifications(remote);
        console.log("[useStore] localHasData:", localHasData, "remoteHasData:", remoteHasData, "local.tasks:", local.tasks?.length);

        let winner: TrackItStore;
        if (!localHasData && remoteHasData) {
          winner = remote;
        } else if (localHasData && !remoteHasData) {
          winner = local;
        } else if (!localHasData && !remoteHasData) {
          winner = local;
        } else {
          const localRichness = (local.tasks?.length ?? 0) + (local.entries?.length ?? 0) + (local.todos?.length ?? 0);
          const remoteRichness = (remote.tasks?.length ?? 0) + (remote.entries?.length ?? 0) + (remote.todos?.length ?? 0);
          if (localRichness !== remoteRichness) {
            winner = localRichness > remoteRichness ? local : remote;
          } else {
            winner = local.updatedAt > remote.updatedAt ? local : remote;
          }
        }

        if (winner !== local) {
          console.log("[useStore] applying remote store");
          setStore(winner);
          await saveLocalStore(winner);
        }
        setSyncStatus("idle");
      } catch (e) {
        console.log("[useStore] error:", e);
        setError(e instanceof Error ? e.message : "Failed to load store.");
        setSyncStatus("error");
        setLoading(false);
      }
    }

    void load();
  }, [isSignedIn]);

  function save(updated: TrackItStore) {
    const withTimestamp: TrackItStore = { ...updated, updatedAt: Date.now() };
    setStore(withTimestamp);

    // Always write locally immediately — fast, no network cost
    void saveLocalStore(withTimestamp);

    // Debounce the API push: reset the timer on every call, keep only the latest store.
    // This collapses rapid changes (comment typing, habit toggles) into one API call.
    pendingStore.current = withTimestamp;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      const s = pendingStore.current;
      pendingStore.current = null;
      if (s) void flushPush(s);
    }, PUSH_DEBOUNCE_MS);
  }

  return { store, loading, error, syncStatus, save };
}
