import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getSyncMetadata,
  setSyncMetadata,
  enqueueOfflinePush,
  getPendingStore,
  clearOfflineQueue,
  flushOfflineQueue,
  startOnlineListener,
  stopOnlineListener,
} from "./offlineQueue";
import type { TrackItStore } from "../../types/index";

// --- Mock chrome.storage.local ---
const mockStorage: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get(keys: string[], callback: (items: Record<string, unknown>) => void) {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in mockStorage) {
            result[key] = mockStorage[key];
          }
        }
        callback(result);
      },
      set(items: Record<string, unknown>, callback: () => void) {
        for (const [key, value] of Object.entries(items)) {
          if (value === undefined) {
            delete mockStorage[key];
          } else {
            mockStorage[key] = value;
          }
        }
        callback();
      },
      remove(keys: string | string[], callback: () => void) {
        const keyArr = Array.isArray(keys) ? keys : [keys];
        for (const key of keyArr) {
          delete mockStorage[key];
        }
        callback();
      },
    },
    session: {
      get(_keys: string[], callback: (items: Record<string, unknown>) => void) { callback({}); },
      set(_items: Record<string, unknown>, callback: () => void) { callback(); },
      remove(_keys: string | string[], callback: () => void) { callback(); },
    },
    onChanged: {
      addListener() {},
      removeListener() {},
    },
  },
  runtime: {
    lastError: undefined as { message: string } | undefined,
    openOptionsPage(callback: () => void) { callback(); },
  },
};

// Install mock
(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

function createTestStore(overrides?: Partial<TrackItStore>): TrackItStore {
  return {
    groups: [],
    tasks: [],
    entries: [],
    todos: [],
    notes: [],
    habits: [],
    habitEntries: [],
    schemaVersion: 1,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("offlineQueue", () => {
  beforeEach(() => {
    // Clear storage between tests
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    chromeMock.runtime.lastError = undefined;
  });

  afterEach(() => {
    stopOnlineListener();
  });

  describe("getSyncMetadata", () => {
    it("returns default metadata when nothing is stored", async () => {
      const meta = await getSyncMetadata();
      expect(meta).toEqual({
        lastSyncedAt: 0,
        lastSyncedStoreHash: "",
        pendingPush: false,
        migrationComplete: false,
      });
    });

    it("returns stored metadata", async () => {
      mockStorage["trackit.sync_meta"] = {
        lastSyncedAt: 1000,
        lastSyncedStoreHash: "abc123",
        pendingPush: true,
        migrationComplete: true,
      };
      const meta = await getSyncMetadata();
      expect(meta.lastSyncedAt).toBe(1000);
      expect(meta.lastSyncedStoreHash).toBe("abc123");
      expect(meta.pendingPush).toBe(true);
      expect(meta.migrationComplete).toBe(true);
    });
  });

  describe("setSyncMetadata", () => {
    it("merges partial updates into existing metadata", async () => {
      await setSyncMetadata({ pendingPush: true });
      const meta = await getSyncMetadata();
      expect(meta.pendingPush).toBe(true);
      expect(meta.lastSyncedAt).toBe(0); // default preserved
    });

    it("overwrites specific fields without affecting others", async () => {
      await setSyncMetadata({ lastSyncedAt: 500, migrationComplete: true });
      await setSyncMetadata({ pendingPush: true });
      const meta = await getSyncMetadata();
      expect(meta.lastSyncedAt).toBe(500);
      expect(meta.migrationComplete).toBe(true);
      expect(meta.pendingPush).toBe(true);
    });
  });

  describe("enqueueOfflinePush", () => {
    it("stores the pending store and sets pendingPush to true", async () => {
      const store = createTestStore({ updatedAt: 12345 });
      await enqueueOfflinePush(store);

      const meta = await getSyncMetadata();
      expect(meta.pendingPush).toBe(true);

      const pending = mockStorage["trackit.pending_store"] as TrackItStore;
      expect(pending.updatedAt).toBe(12345);
    });

    it("overwrites previously queued store with latest state", async () => {
      const store1 = createTestStore({ updatedAt: 100 });
      const store2 = createTestStore({ updatedAt: 200 });

      await enqueueOfflinePush(store1);
      await enqueueOfflinePush(store2);

      const pending = mockStorage["trackit.pending_store"] as TrackItStore;
      expect(pending.updatedAt).toBe(200);
    });
  });

  describe("getPendingStore", () => {
    it("returns null when pendingPush is false", async () => {
      const result = await getPendingStore();
      expect(result).toBeNull();
    });

    it("returns null when pendingPush is true but no store is stored", async () => {
      await setSyncMetadata({ pendingPush: true });
      const result = await getPendingStore();
      expect(result).toBeNull();
    });

    it("returns the stored pending store when pendingPush is true", async () => {
      const store = createTestStore({ updatedAt: 999 });
      await enqueueOfflinePush(store);

      const result = await getPendingStore();
      expect(result).not.toBeNull();
      expect(result!.updatedAt).toBe(999);
    });
  });

  describe("clearOfflineQueue", () => {
    it("sets pendingPush to false and removes pending store", async () => {
      const store = createTestStore();
      await enqueueOfflinePush(store);

      await clearOfflineQueue();

      const meta = await getSyncMetadata();
      expect(meta.pendingPush).toBe(false);
      expect(mockStorage["trackit.pending_store"]).toBeUndefined();
    });
  });

  describe("flushOfflineQueue", () => {
    it("returns true when there is nothing to flush", async () => {
      const pushFn = vi.fn();
      const result = await flushOfflineQueue(pushFn);
      expect(result).toBe(true);
      expect(pushFn).not.toHaveBeenCalled();
    });

    it("calls pushFn with the pending store and clears queue on success", async () => {
      const store = createTestStore({ updatedAt: 555 });
      await enqueueOfflinePush(store);

      const pushFn = vi.fn().mockResolvedValue({ success: true });
      const result = await flushOfflineQueue(pushFn);

      expect(result).toBe(true);
      expect(pushFn).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: 555 }));

      const meta = await getSyncMetadata();
      expect(meta.pendingPush).toBe(false);
    });

    it("returns false and keeps queue when push fails", async () => {
      const store = createTestStore({ updatedAt: 777 });
      await enqueueOfflinePush(store);

      const pushFn = vi.fn().mockResolvedValue({ success: false });
      const result = await flushOfflineQueue(pushFn);

      expect(result).toBe(false);

      const meta = await getSyncMetadata();
      expect(meta.pendingPush).toBe(true);
    });
  });

  describe("startOnlineListener / stopOnlineListener", () => {
    it("flushes offline queue when online event fires", async () => {
      const store = createTestStore({ updatedAt: 888 });
      await enqueueOfflinePush(store);

      const pushFn = vi.fn().mockResolvedValue({ success: true });
      startOnlineListener(pushFn);

      // Simulate online event
      globalThis.dispatchEvent(new Event("online"));

      // Give the async flush time to complete
      await new Promise((r) => setTimeout(r, 50));

      expect(pushFn).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: 888 }));
    });

    it("does not flush after stopOnlineListener is called", async () => {
      const store = createTestStore();
      await enqueueOfflinePush(store);

      const pushFn = vi.fn().mockResolvedValue({ success: true });
      startOnlineListener(pushFn);
      stopOnlineListener();

      globalThis.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 50));

      expect(pushFn).not.toHaveBeenCalled();
    });

    it("replaces previous listener when called multiple times", async () => {
      const store = createTestStore();
      await enqueueOfflinePush(store);

      const pushFn1 = vi.fn().mockResolvedValue({ success: true });
      const pushFn2 = vi.fn().mockResolvedValue({ success: true });

      startOnlineListener(pushFn1);
      startOnlineListener(pushFn2);

      globalThis.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 50));

      expect(pushFn1).not.toHaveBeenCalled();
      expect(pushFn2).toHaveBeenCalled();
    });
  });

  describe("persistence across restarts", () => {
    it("offline queue data survives between getSyncMetadata calls (simulating restart)", async () => {
      const store = createTestStore({ updatedAt: 1234 });
      await enqueueOfflinePush(store);

      // Simulate restart by reading fresh — the mock storage retains data
      const meta = await getSyncMetadata();
      expect(meta.pendingPush).toBe(true);

      const pending = await getPendingStore();
      expect(pending).not.toBeNull();
      expect(pending!.updatedAt).toBe(1234);
    });
  });
});
