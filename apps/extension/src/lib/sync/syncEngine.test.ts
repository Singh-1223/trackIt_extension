import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSyncEngine,
  lastWriteWins,
  type SyncEngine,
  type SyncStatus,
} from "./syncEngine";
import type { TrackItStore } from "../../types";
import type { ApiResponse } from "./apiClient";

function makeStore(overrides?: Partial<TrackItStore>): TrackItStore {
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

function createMockApiClient() {
  return {
    getStore: vi.fn<() => Promise<ApiResponse<TrackItStore>>>(),
    putStore: vi.fn<(store: TrackItStore) => Promise<ApiResponse<void>>>(),
  };
}

describe("SyncEngine", () => {
  let engine: SyncEngine;
  let mockApi: ReturnType<typeof createMockApiClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockApi = createMockApiClient();
    engine = createSyncEngine({
      debounceMs: 3000,
      apiClientOverride: mockApi,
    });
  });

  afterEach(() => {
    engine.destroy();
    vi.useRealTimers();
  });

  describe("push", () => {
    it("should debounce and send only the last store after 3s", async () => {
      mockApi.putStore.mockResolvedValue({ status: 200 });

      const store1 = makeStore({ updatedAt: 1000 });
      const store2 = makeStore({ updatedAt: 2000 });
      const store3 = makeStore({ updatedAt: 3000 });

      // Fire three pushes rapidly
      const p1 = engine.push(store1);
      const p2 = engine.push(store2);
      const p3 = engine.push(store3);

      // No API call yet
      expect(mockApi.putStore).not.toHaveBeenCalled();

      // Advance past debounce window
      await vi.advanceTimersByTimeAsync(3000);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      // Only one API call with the last store
      expect(mockApi.putStore).toHaveBeenCalledTimes(1);
      expect(mockApi.putStore).toHaveBeenCalledWith(store3);

      // All promises resolve with the same result
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(true);
    });

    it("should reset debounce timer on each push call", async () => {
      mockApi.putStore.mockResolvedValue({ status: 200 });

      const store1 = makeStore({ updatedAt: 1000 });
      const store2 = makeStore({ updatedAt: 2000 });

      engine.push(store1);

      // Advance 2 seconds (not yet at 3s)
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockApi.putStore).not.toHaveBeenCalled();

      // Push again — resets the timer
      const p2 = engine.push(store2);

      // Advance another 2 seconds (total 4s from first push, but only 2s from second)
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockApi.putStore).not.toHaveBeenCalled();

      // Advance the remaining 1 second
      await vi.advanceTimersByTimeAsync(1000);

      const result = await p2;
      expect(mockApi.putStore).toHaveBeenCalledTimes(1);
      expect(mockApi.putStore).toHaveBeenCalledWith(store2);
      expect(result.success).toBe(true);
    });

    it("should set status to 'pushing' during push and 'idle' on success", async () => {
      const statuses: SyncStatus[] = [];
      engine.onStatusChange((s) => statuses.push(s));

      mockApi.putStore.mockResolvedValue({ status: 200 });

      const store = makeStore();
      engine.push(store);

      await vi.advanceTimersByTimeAsync(3000);
      // Wait for the push promise to settle
      await vi.advanceTimersByTimeAsync(0);

      expect(statuses).toContain("pushing");
      expect(statuses).toContain("idle");
      expect(engine.getStatus()).toBe("idle");
    });

    it("should set status to 'error' on push failure", async () => {
      mockApi.putStore.mockResolvedValue({
        status: 0,
        error: "Network error",
      });

      const store = makeStore();
      const promise = engine.push(store);

      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(engine.getStatus()).toBe("error");
    });

    it("should handle server error responses", async () => {
      mockApi.putStore.mockResolvedValue({
        status: 500,
        error: "Internal Server Error",
      });

      const store = makeStore();
      const promise = engine.push(store);

      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Internal Server Error");
      expect(engine.getStatus()).toBe("error");
    });
  });

  describe("pull", () => {
    it("should return remote store on success", async () => {
      const remoteStore = makeStore({ updatedAt: 5000 });
      mockApi.getStore.mockResolvedValue({ status: 200, data: remoteStore });

      const result = await engine.pull();

      expect(result).toEqual(remoteStore);
      expect(engine.getStatus()).toBe("idle");
    });

    it("should return null when no remote document exists (404)", async () => {
      mockApi.getStore.mockResolvedValue({ status: 404 });

      const result = await engine.pull();

      expect(result).toBeNull();
      expect(engine.getStatus()).toBe("idle");
    });

    it("should return null and set error on network failure", async () => {
      mockApi.getStore.mockResolvedValue({
        status: 0,
        error: "Network error",
      });

      const result = await engine.pull();

      expect(result).toBeNull();
      expect(engine.getStatus()).toBe("error");
    });

    it("should set status to 'pulling' during pull", async () => {
      const statuses: SyncStatus[] = [];
      engine.onStatusChange((s) => statuses.push(s));

      mockApi.getStore.mockResolvedValue({
        status: 200,
        data: makeStore(),
      });

      await engine.pull();

      expect(statuses[0]).toBe("pulling");
    });
  });

  describe("onStatusChange", () => {
    it("should notify subscribers when status changes", async () => {
      const cb = vi.fn();
      engine.onStatusChange(cb);

      mockApi.getStore.mockResolvedValue({
        status: 200,
        data: makeStore(),
      });

      await engine.pull();

      expect(cb).toHaveBeenCalledWith("pulling");
      expect(cb).toHaveBeenCalledWith("idle");
    });

    it("should return an unsubscribe function", async () => {
      const cb = vi.fn();
      const unsubscribe = engine.onStatusChange(cb);

      unsubscribe();

      mockApi.getStore.mockResolvedValue({
        status: 200,
        data: makeStore(),
      });

      await engine.pull();

      expect(cb).not.toHaveBeenCalled();
    });

    it("should not break if a listener throws", async () => {
      const badCb = vi.fn(() => {
        throw new Error("listener error");
      });
      const goodCb = vi.fn();

      engine.onStatusChange(badCb);
      engine.onStatusChange(goodCb);

      mockApi.getStore.mockResolvedValue({
        status: 200,
        data: makeStore(),
      });

      await engine.pull();

      expect(goodCb).toHaveBeenCalled();
    });
  });

  describe("getStatus", () => {
    it("should return 'idle' initially", () => {
      expect(engine.getStatus()).toBe("idle");
    });
  });

  describe("destroy", () => {
    it("should cancel pending debounced push", async () => {
      mockApi.putStore.mockResolvedValue({ status: 200 });

      engine.push(makeStore());
      engine.destroy();

      await vi.advanceTimersByTimeAsync(5000);

      expect(mockApi.putStore).not.toHaveBeenCalled();
    });
  });
});

describe("lastWriteWins", () => {
  it("should return the store with the higher updatedAt", () => {
    const older = makeStore({ updatedAt: 1000 });
    const newer = makeStore({ updatedAt: 2000 });

    expect(lastWriteWins(older, newer)).toBe(newer);
    expect(lastWriteWins(newer, older)).toBe(newer);
  });

  it("should return the first store when timestamps are equal", () => {
    const storeA = makeStore({ updatedAt: 1000 });
    const storeB = makeStore({ updatedAt: 1000 });

    expect(lastWriteWins(storeA, storeB)).toBe(storeA);
  });
});
