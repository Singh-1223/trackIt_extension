import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useRef, useState } from "react";
import { fetchStore, pushStore } from "../lib/api";
import { hasUserModifications, loadLocalStore, saveLocalStore } from "../lib/store";
import type { SyncStatus } from "../components/SyncStatusIndicator";
import type { TrackItStore } from "../types/index";

export function useStore() {
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [store, setStore] = useState<TrackItStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const initialized = useRef(false);

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
        // Mirror extension logic: if local is default/unmodified, always prefer remote
        const localHasData = hasUserModifications(local);
        const remoteHasData = hasUserModifications(remote);
        console.log("[useStore] localHasData:", localHasData, "remoteHasData:", remoteHasData, "local.tasks:", local.tasks?.length);

        let winner: TrackItStore;
        if (!localHasData && remoteHasData) {
          // Fresh install or local is default — remote has real data, use it
          winner = remote;
        } else if (localHasData && !remoteHasData) {
          // Local has real data, remote is empty — push local up
          winner = local;
        } else if (!localHasData && !remoteHasData) {
          // Both are default, nothing to do
          winner = local;
        } else {
          // Both have real data — prefer whichever has more content (tasks + entries + todos).
          // Fall back to remote on a tie: remote timestamp is always trustworthy, local's
          // may have been inflated by migrate() on a previous install.
          const localRichness = (local.tasks?.length ?? 0) + (local.entries?.length ?? 0) + (local.todos?.length ?? 0);
          const remoteRichness = (remote.tasks?.length ?? 0) + (remote.entries?.length ?? 0) + (remote.todos?.length ?? 0);
          if (localRichness !== remoteRichness) {
            winner = localRichness > remoteRichness ? local : remote;
          } else {
            // Same richness — trust the timestamp, but remote wins ties
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
  }, [isSignedIn]); // re-runs when Clerk auth becomes ready

  function save(updated: TrackItStore) {
    const withTimestamp: TrackItStore = { ...updated, updatedAt: Date.now() };
    setStore(withTimestamp);

    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await saveLocalStore(withTimestamp);
        const token = await getTokenRef.current();
        if (token) {
          setSyncStatus("pushing");
          await pushStore(token, withTimestamp);
          setSyncStatus("idle");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
        setSyncStatus("error");
      }
    });
  }

  return { store, loading, error, syncStatus, save };
}
