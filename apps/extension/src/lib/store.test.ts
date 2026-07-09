import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// --- Mock chrome.storage.local ---

const localStore: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get(keys: string[], callback: (items: Record<string, unknown>) => void) {
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
    session: {
      get(_keys: string[], callback: (items: Record<string, unknown>) => void) {
        callback({});
      },
      set(_items: Record<string, unknown>, callback: () => void) {
        callback();
      },
      remove(_key: string, callback: () => void) {
        callback();
      },
    },
  },
  runtime: {
    lastError: undefined as { message: string } | undefined,
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

// --- Mock tokenManager ---

const mockGetToken = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
vi.mock("./auth/tokenManager", () => ({
  getToken: (...args: unknown[]) => mockGetToken(...(args as [])),
}));

// --- Mock syncEngineInstance ---

const mockPush = vi.fn().mockResolvedValue({ success: true, retriesUsed: 0 });
const mockSyncEngine = {
  push: mockPush,
  pull: vi.fn(),
  getStatus: vi.fn().mockReturnValue("idle"),
  onStatusChange: vi.fn().mockReturnValue(() => {}),
  destroy: vi.fn(),
};

vi.mock("./sync/syncEngineInstance", () => ({
  getSyncEngine: () => mockSyncEngine,
}));

// Import after mocks
import { saveStore } from "./store";
import type { TrackItStore } from "../types";

const STORAGE_KEY = "trackit.store";

function clearLocalStore() {
  for (const key of Object.keys(localStore)) {
    delete localStore[key];
  }
}

function makeStore(overrides: Partial<TrackItStore> = {}): TrackItStore {
  return {
    groups: [],
    tasks: [],
    entries: [],
    todos: [],
    notes: [],
    habits: [],
    habitEntries: [],
    schemaVersion: 1,
    updatedAt: 0,
    ...overrides,
  };
}

describe("saveStore", () => {
  beforeEach(() => {
    clearLocalStore();
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets updatedAt to Date.now() on every save", async () => {
    const now = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const store = makeStore({ updatedAt: 1000 });
    await saveStore(store);

    const saved = localStore[STORAGE_KEY] as TrackItStore;
    expect(saved.updatedAt).toBe(now);
  });

  it("persists the store to chrome.storage.local", async () => {
    const store = makeStore({ groups: [{ id: "g1", name: "Test", order: 0 }] });
    await saveStore(store);

    const saved = localStore[STORAGE_KEY] as TrackItStore;
    expect(saved.groups).toEqual([{ id: "g1", name: "Test", order: 0 }]);
  });

  it("triggers sync push when user is authenticated", async () => {
    mockGetToken.mockResolvedValue("valid-token");

    const store = makeStore();
    await saveStore(store);

    // Allow the fire-and-forget promise chain to resolve
    await new Promise((r) => setTimeout(r, 0));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ schemaVersion: 1 })
    );
  });

  it("does NOT trigger sync push when user is not authenticated", async () => {
    mockGetToken.mockResolvedValue(null);

    const store = makeStore();
    await saveStore(store);

    // Allow the fire-and-forget promise chain to resolve
    await new Promise((r) => setTimeout(r, 0));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not block local write if sync push fails", async () => {
    mockGetToken.mockResolvedValue("token");
    mockPush.mockRejectedValue(new Error("network error"));

    const store = makeStore();

    // saveStore should resolve without throwing
    await expect(saveStore(store)).resolves.toBeUndefined();

    // Local write should have succeeded
    const saved = localStore[STORAGE_KEY] as TrackItStore;
    expect(saved).toBeDefined();
    expect(saved.schemaVersion).toBe(1);
  });

  it("does not block local write if getToken throws", async () => {
    mockGetToken.mockRejectedValue(new Error("session error"));

    const store = makeStore();

    // saveStore should still resolve
    await expect(saveStore(store)).resolves.toBeUndefined();

    // Local write still succeeded
    const saved = localStore[STORAGE_KEY] as TrackItStore;
    expect(saved).toBeDefined();
  });

  it("passes the pruned store (with updated updatedAt) to sync push", async () => {
    const now = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    mockGetToken.mockResolvedValue("token");

    const store = makeStore({ updatedAt: 999 });
    await saveStore(store);

    await new Promise((r) => setTimeout(r, 0));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: now })
    );
  });
});
