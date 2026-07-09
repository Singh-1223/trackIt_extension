import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

// --- Mock apiClient ---
vi.mock("./apiClient", () => ({
  getStore: vi.fn(),
  putStore: vi.fn(),
}));

import * as apiClient from "./apiClient";
import {
  runMigration,
  hasUserModifications,
  getMigrationStatus,
  onMigrationStatusChange,
} from "./migration";
import { setSyncMetadata } from "./offlineQueue";

const mockedGetStore = vi.mocked(apiClient.getStore);
const mockedPutStore = vi.mocked(apiClient.putStore);

function createDefaultStore(): TrackItStore {
  return {
    groups: [
      { id: "grp-daily", name: "Daily Goals", order: 0 },
      { id: "grp-habits", name: "Habits", order: 1 },
    ],
    tasks: [
      { id: "task-1", groupId: "grp-daily", title: "Deep work block — 2 hrs", order: 0 },
      { id: "task-2", groupId: "grp-daily", title: "Review priorities for tomorrow", order: 1 },
      { id: "task-3", groupId: "grp-habits", title: "Morning workout / walk", order: 0 },
      { id: "task-4", groupId: "grp-habits", title: "Read 20 pages", order: 1 },
      { id: "task-5", groupId: "grp-habits", title: "Reflect + journal — 5 min", order: 2 },
    ],
    entries: [],
    todos: [],
    notes: [],
    habits: [],
    habitEntries: [],
    schemaVersion: 1,
    updatedAt: 1000,
  };
}

function createModifiedStore(): TrackItStore {
  return {
    ...createDefaultStore(),
    todos: [
      {
        id: "todo-1",
        title: "My custom todo",
        description: "",
        dueDate: "2024-01-01",
        done: false,
        subTasks: [],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ],
    updatedAt: 2000,
  };
}

describe("migration", () => {
  beforeEach(() => {
    // Clear storage between tests
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    chromeMock.runtime.lastError = undefined;
    vi.clearAllMocks();
  });

  describe("hasUserModifications", () => {
    it("returns false for a default store", () => {
      const store = createDefaultStore();
      expect(hasUserModifications(store)).toBe(false);
    });

    it("returns true when entries exist", () => {
      const store = createDefaultStore();
      store.entries = [{ date: "2024-01-01", taskId: "task-1", done: true, comment: "", updatedAt: 1000 }];
      expect(hasUserModifications(store)).toBe(true);
    });

    it("returns true when todos exist", () => {
      const store = createModifiedStore();
      expect(hasUserModifications(store)).toBe(true);
    });

    it("returns true when notes exist", () => {
      const store = createDefaultStore();
      store.notes = [{ id: "n-1", heading: "Note", description: "test", createdAt: 1000, updatedAt: 1000 }];
      expect(hasUserModifications(store)).toBe(true);
    });

    it("returns true when habits exist", () => {
      const store = createDefaultStore();
      store.habits = [{ id: "h-1", name: "Workout", startDate: "2024-01-01", endDate: "2024-12-31", createdAt: 1000 }];
      expect(hasUserModifications(store)).toBe(true);
    });

    it("returns true when groups differ from default", () => {
      const store = createDefaultStore();
      store.groups = [{ id: "custom-group", name: "Custom", order: 0 }];
      expect(hasUserModifications(store)).toBe(true);
    });

    it("returns true when tasks differ from default", () => {
      const store = createDefaultStore();
      store.tasks = [{ id: "custom-task", groupId: "grp-daily", title: "Custom", order: 0 }];
      expect(hasUserModifications(store)).toBe(true);
    });

    it("returns true when habitEntries exist", () => {
      const store = createDefaultStore();
      store.habitEntries = [{ habitId: "h-1", date: "2024-01-01", done: true }];
      expect(hasUserModifications(store)).toBe(true);
    });
  });

  describe("runMigration", () => {
    it("skips migration if migrationComplete is already true", async () => {
      await setSyncMetadata({ migrationComplete: true });

      const result = await runMigration();

      expect(result.status).toBe("success");
      expect(result.message).toBe("Migration already complete");
      expect(mockedGetStore).not.toHaveBeenCalled();
    });

    it("uploads local store to cloud when no remote and local has modifications", async () => {
      // Set up local store with modifications
      const localStore = createModifiedStore();
      mockStorage["trackit.store"] = localStore;

      mockedGetStore.mockResolvedValue({ status: 404, error: "Not found" });
      mockedPutStore.mockResolvedValue({ status: 200 });

      const result = await runMigration();

      expect(result.status).toBe("success");
      expect(result.message).toBe("Local data synced to cloud");
      expect(mockedPutStore).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: 2000 }));

      // Verify migrationComplete is set
      const meta = mockStorage["trackit.sync_meta"] as { migrationComplete: boolean };
      expect(meta.migrationComplete).toBe(true);
    });

    it("creates empty document on API when no remote and local is default", async () => {
      const defaultStore = createDefaultStore();
      mockStorage["trackit.store"] = defaultStore;

      mockedGetStore.mockResolvedValue({ status: 404, error: "Not found" });
      mockedPutStore.mockResolvedValue({ status: 200 });

      const result = await runMigration();

      expect(result.status).toBe("success");
      expect(result.message).toBe("Empty document created on cloud");
      expect(mockedPutStore).toHaveBeenCalled();

      const meta = mockStorage["trackit.sync_meta"] as { migrationComplete: boolean };
      expect(meta.migrationComplete).toBe(true);
    });

    it("pulls remote store and replaces local cache when remote exists", async () => {
      const localStore = createDefaultStore();
      mockStorage["trackit.store"] = localStore;

      const remoteStore: TrackItStore = {
        ...createDefaultStore(),
        todos: [
          {
            id: "remote-todo",
            title: "Remote todo",
            description: "",
            dueDate: "",
            done: false,
            subTasks: [],
            createdAt: 3000,
            updatedAt: 3000,
          },
        ],
        updatedAt: 5000,
      };

      mockedGetStore.mockResolvedValue({ status: 200, data: remoteStore });

      const result = await runMigration();

      expect(result.status).toBe("success");
      expect(result.message).toBe("Cloud data synced to local");

      // Verify local store was replaced with remote
      const stored = mockStorage["trackit.store"] as TrackItStore;
      expect(stored.updatedAt).toBe(5000);
      expect(stored.todos).toHaveLength(1);
      expect(stored.todos[0].id).toBe("remote-todo");

      const meta = mockStorage["trackit.sync_meta"] as { migrationComplete: boolean };
      expect(meta.migrationComplete).toBe(true);
    });

    it("returns error when network fails on GET", async () => {
      mockedGetStore.mockResolvedValue({ status: 0, error: "Network error" });

      const result = await runMigration();

      expect(result.status).toBe("error");
      expect(result.message).toBe("Network error");
    });

    it("returns error when PUT fails after 404", async () => {
      const localStore = createModifiedStore();
      mockStorage["trackit.store"] = localStore;

      mockedGetStore.mockResolvedValue({ status: 404, error: "Not found" });
      mockedPutStore.mockResolvedValue({ status: 500, error: "Server error" });

      const result = await runMigration();

      expect(result.status).toBe("error");
      expect(result.message).toBe("Server error");

      // Verify migrationComplete is NOT set
      const meta = mockStorage["trackit.sync_meta"] as { migrationComplete?: boolean } | undefined;
      expect(meta?.migrationComplete).toBeFalsy();
    });

    it("returns error on unexpected status codes", async () => {
      mockedGetStore.mockResolvedValue({ status: 500, error: "Internal server error" });

      const result = await runMigration();

      expect(result.status).toBe("error");
      expect(result.message).toBe("Internal server error");
    });

    it("handles exceptions during migration", async () => {
      mockedGetStore.mockRejectedValue(new Error("Unexpected crash"));

      const result = await runMigration();

      expect(result.status).toBe("error");
      expect(result.message).toBe("Unexpected crash");
    });
  });

  describe("migration status tracking", () => {
    it("transitions through in-progress → success on successful migration", async () => {
      const remoteStore = createDefaultStore();
      mockStorage["trackit.store"] = createDefaultStore();
      mockedGetStore.mockResolvedValue({ status: 200, data: remoteStore });

      const statuses: string[] = [];
      const unsub = onMigrationStatusChange((status) => statuses.push(status));

      await runMigration();

      unsub();

      expect(statuses).toContain("in-progress");
      expect(statuses).toContain("success");
      expect(getMigrationStatus()).toBe("success");
    });

    it("transitions through in-progress → error on failed migration", async () => {
      mockedGetStore.mockResolvedValue({ status: 0, error: "Network error" });

      const statuses: string[] = [];
      const unsub = onMigrationStatusChange((status) => statuses.push(status));

      await runMigration();

      unsub();

      expect(statuses).toContain("in-progress");
      expect(statuses).toContain("error");
      expect(getMigrationStatus()).toBe("error");
    });

    it("does not emit in-progress when migration is already complete", async () => {
      await setSyncMetadata({ migrationComplete: true });

      const statuses: string[] = [];
      const unsub = onMigrationStatusChange((status) => statuses.push(status));

      await runMigration();

      unsub();

      expect(statuses).not.toContain("in-progress");
    });
  });
});
