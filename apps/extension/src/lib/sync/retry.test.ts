import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  calculateBackoffDelay,
  retryWithBackoff,
  markPendingPush,
  getSyncMetadata,
  OnlineRetryManager,
} from "./retry";

// --- Mock chrome.storage.local ---
const localStore: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get(
        keys: string[],
        callback: (items: Record<string, unknown>) => void
      ) {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in localStore) {
            result[key] = localStore[key];
          }
        }
        callback(result);
      },
      set(items: Record<string, unknown>, callback: () => void) {
        Object.assign(localStore, items);
        callback();
      },
    },
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

function clearLocalStore() {
  for (const key of Object.keys(localStore)) {
    delete localStore[key];
  }
}

describe("retry", () => {
  beforeEach(() => {
    clearLocalStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("calculateBackoffDelay", () => {
    it("returns 1000ms for attempt 1", () => {
      expect(calculateBackoffDelay(1)).toBe(1000);
    });

    it("returns 2000ms for attempt 2", () => {
      expect(calculateBackoffDelay(2)).toBe(2000);
    });

    it("returns 4000ms for attempt 3", () => {
      expect(calculateBackoffDelay(3)).toBe(4000);
    });

    it("uses custom base delay", () => {
      expect(calculateBackoffDelay(1, 500)).toBe(500);
      expect(calculateBackoffDelay(2, 500)).toBe(1000);
      expect(calculateBackoffDelay(3, 500)).toBe(2000);
    });
  });

  describe("retryWithBackoff", () => {
    it("returns success on first attempt if operation succeeds", async () => {
      const op = vi.fn().mockResolvedValue("data");

      const result = await retryWithBackoff(op);

      expect(result).toEqual({
        success: true,
        data: "data",
        retriesUsed: 0,
      });
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and succeeds on second attempt", async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce("recovered");

      const promise = retryWithBackoff(op);

      // Advance past the 1s delay after first failure
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toEqual({
        success: true,
        data: "recovered",
        retriesUsed: 1,
      });
      expect(op).toHaveBeenCalledTimes(2);
    });

    it("retries with exponential backoff delays", async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValueOnce("success");

      const promise = retryWithBackoff(op);

      // After first failure, wait 1s (1000 * 2^0)
      await vi.advanceTimersByTimeAsync(1000);
      expect(op).toHaveBeenCalledTimes(2);

      // After second failure, wait 2s (1000 * 2^1)
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toEqual({
        success: true,
        data: "success",
        retriesUsed: 2,
      });
      expect(op).toHaveBeenCalledTimes(3);
    });

    it("returns failure after all retries exhausted", async () => {
      const op = vi.fn().mockRejectedValue(new Error("persistent failure"));

      const promise = retryWithBackoff(op);

      // 1s after first failure
      await vi.advanceTimersByTimeAsync(1000);
      // 2s after second failure
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toEqual({
        success: false,
        error: "persistent failure",
        retriesUsed: 3,
      });
      expect(op).toHaveBeenCalledTimes(3);
    });

    it("never exceeds maxRetries attempts", async () => {
      const op = vi.fn().mockRejectedValue(new Error("always fails"));

      const promise = retryWithBackoff(op, { maxRetries: 2, baseDelayMs: 100 });

      // 100ms after first failure
      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;

      expect(result.retriesUsed).toBe(2);
      expect(op).toHaveBeenCalledTimes(2);
    });

    it("uses custom config", async () => {
      const op = vi.fn().mockRejectedValue(new Error("fail"));

      const promise = retryWithBackoff(op, {
        maxRetries: 1,
        baseDelayMs: 500,
      });

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.retriesUsed).toBe(1);
      expect(op).toHaveBeenCalledTimes(1);
    });
  });

  describe("markPendingPush", () => {
    it("sets pendingPush to true in sync metadata", async () => {
      await markPendingPush(true);

      const metadata = localStore["trackit.sync_metadata"] as Record<
        string,
        unknown
      >;
      expect(metadata.pendingPush).toBe(true);
    });

    it("sets pendingPush to false in sync metadata", async () => {
      localStore["trackit.sync_metadata"] = {
        lastSyncedAt: 100,
        lastSyncedStoreHash: "abc",
        pendingPush: true,
        migrationComplete: false,
      };

      await markPendingPush(false);

      const metadata = localStore["trackit.sync_metadata"] as Record<
        string,
        unknown
      >;
      expect(metadata.pendingPush).toBe(false);
    });

    it("preserves other metadata fields", async () => {
      localStore["trackit.sync_metadata"] = {
        lastSyncedAt: 999,
        lastSyncedStoreHash: "hash123",
        pendingPush: false,
        migrationComplete: true,
      };

      await markPendingPush(true);

      const metadata = localStore["trackit.sync_metadata"] as Record<
        string,
        unknown
      >;
      expect(metadata.lastSyncedAt).toBe(999);
      expect(metadata.lastSyncedStoreHash).toBe("hash123");
      expect(metadata.migrationComplete).toBe(true);
    });
  });

  describe("getSyncMetadata", () => {
    it("returns default metadata when none exists", async () => {
      const metadata = await getSyncMetadata();
      expect(metadata).toEqual({
        lastSyncedAt: 0,
        lastSyncedStoreHash: "",
        pendingPush: false,
        migrationComplete: false,
      });
    });

    it("returns stored metadata", async () => {
      localStore["trackit.sync_metadata"] = {
        lastSyncedAt: 1234,
        lastSyncedStoreHash: "xyz",
        pendingPush: true,
        migrationComplete: true,
      };

      const metadata = await getSyncMetadata();
      expect(metadata).toEqual({
        lastSyncedAt: 1234,
        lastSyncedStoreHash: "xyz",
        pendingPush: true,
        migrationComplete: true,
      });
    });
  });

  describe("OnlineRetryManager", () => {
    it("calls push function when online event fires with pending push", async () => {
      // Stub Math.random to eliminate jitter delay
      vi.spyOn(Math, "random").mockReturnValue(0);

      const pushFn = vi.fn().mockResolvedValue(undefined);
      const manager = new OnlineRetryManager();

      localStore["trackit.sync_metadata"] = {
        lastSyncedAt: 0,
        lastSyncedStoreHash: "",
        pendingPush: true,
        migrationComplete: false,
      };

      manager.start(pushFn);

      // Simulate online event
      window.dispatchEvent(new Event("online"));

      // Advance past the jitter delay (0ms because random = 0)
      await vi.advanceTimersByTimeAsync(0);

      // Allow microtasks to flush
      await vi.advanceTimersByTimeAsync(0);

      expect(pushFn).toHaveBeenCalledTimes(1);

      manager.stop();
    });

    it("does not call push when no pending push exists", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const pushFn = vi.fn().mockResolvedValue(undefined);
      const manager = new OnlineRetryManager();

      localStore["trackit.sync_metadata"] = {
        lastSyncedAt: 0,
        lastSyncedStoreHash: "",
        pendingPush: false,
        migrationComplete: false,
      };

      manager.start(pushFn);

      window.dispatchEvent(new Event("online"));

      await vi.advanceTimersByTimeAsync(100);

      expect(pushFn).not.toHaveBeenCalled();

      manager.stop();
    });

    it("stops listening after stop is called", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const pushFn = vi.fn().mockResolvedValue(undefined);
      const manager = new OnlineRetryManager();

      localStore["trackit.sync_metadata"] = {
        lastSyncedAt: 0,
        lastSyncedStoreHash: "",
        pendingPush: true,
        migrationComplete: false,
      };

      manager.start(pushFn);
      manager.stop();

      window.dispatchEvent(new Event("online"));

      await vi.advanceTimersByTimeAsync(100);

      expect(pushFn).not.toHaveBeenCalled();
    });
  });
});
