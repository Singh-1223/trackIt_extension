import type { TrackItStore, SyncMetadata } from "../../types/index";

const SYNC_META_KEY = "trackit.sync_meta";
const PENDING_STORE_KEY = "trackit.pending_store";

// --- chrome.storage.local helpers ---

function chromeLocalGet(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(result);
    });
  });
}

function chromeLocalSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}

// --- SyncMetadata helpers ---

const DEFAULT_SYNC_META: SyncMetadata = {
  lastSyncedAt: 0,
  lastSyncedStoreHash: "",
  pendingPush: false,
  migrationComplete: false,
};

export async function getSyncMetadata(): Promise<SyncMetadata> {
  const result = await chromeLocalGet([SYNC_META_KEY]);
  const raw = result[SYNC_META_KEY];
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SYNC_META };
  }
  return raw as SyncMetadata;
}

export async function setSyncMetadata(meta: Partial<SyncMetadata>): Promise<void> {
  const current = await getSyncMetadata();
  const updated = { ...current, ...meta };
  await chromeLocalSet({ [SYNC_META_KEY]: updated });
}

// --- Offline Queue ---

/**
 * Enqueue a store for push when network becomes available.
 * Sets pendingPush: true and stores the latest store state so it
 * survives extension restarts.
 */
export async function enqueueOfflinePush(store: TrackItStore): Promise<void> {
  await chromeLocalSet({ [PENDING_STORE_KEY]: store });
  await setSyncMetadata({ pendingPush: true });
}

/**
 * Retrieve the pending store that was queued for push.
 * Returns null if there is nothing queued.
 */
export async function getPendingStore(): Promise<TrackItStore | null> {
  const meta = await getSyncMetadata();
  if (!meta.pendingPush) {
    return null;
  }
  const result = await chromeLocalGet([PENDING_STORE_KEY]);
  const raw = result[PENDING_STORE_KEY];
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return raw as TrackItStore;
}

/**
 * Clear the offline queue after a successful push.
 * Sets pendingPush: false and removes the stored pending store.
 */
export async function clearOfflineQueue(): Promise<void> {
  await setSyncMetadata({ pendingPush: false });
  await chromeLocalSet({ [PENDING_STORE_KEY]: undefined });
}

/**
 * Flush the offline queue by pushing the pending store using the provided
 * push function. Returns true if the flush succeeded (or there was nothing
 * to flush), false if the push failed.
 */
export async function flushOfflineQueue(
  pushFn: (store: TrackItStore) => Promise<{ success: boolean }>
): Promise<boolean> {
  const pendingStore = await getPendingStore();
  if (!pendingStore) {
    return true; // Nothing to flush
  }

  const result = await pushFn(pendingStore);
  if (result.success) {
    await clearOfflineQueue();
    return true;
  }
  return false;
}

// --- Online event listener ---

type PushFn = (store: TrackItStore) => Promise<{ success: boolean }>;

let onlineHandler: (() => void) | null = null;

/**
 * Start listening for the browser `online` event.
 * When connectivity is restored, automatically flush the offline queue.
 */
export function startOnlineListener(pushFn: PushFn): void {
  // Remove any existing listener to avoid duplicates
  stopOnlineListener();

  onlineHandler = () => {
    flushOfflineQueue(pushFn);
  };

  if (typeof globalThis !== "undefined" && typeof globalThis.addEventListener === "function") {
    globalThis.addEventListener("online", onlineHandler);
  }
}

/**
 * Stop listening for the `online` event.
 */
export function stopOnlineListener(): void {
  if (onlineHandler && typeof globalThis !== "undefined" && typeof globalThis.removeEventListener === "function") {
    globalThis.removeEventListener("online", onlineHandler);
    onlineHandler = null;
  }
}
