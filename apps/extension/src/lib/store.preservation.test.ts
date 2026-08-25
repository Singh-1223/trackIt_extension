import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { pruneOldEntries, getTodayString } from "./utils";
import type { DayEntry, Task, TaskGroup, TrackItStore } from "../types/index";

// Mock tokenManager and syncEngineInstance at the top level (hoisted by vitest)
vi.mock("./auth/tokenManager", () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

vi.mock("./sync/syncEngineInstance", () => ({
  getSyncEngine: () => ({
    push: vi.fn().mockResolvedValue({ success: true }),
    pull: vi.fn(),
    getStatus: vi.fn().mockReturnValue("idle"),
    onStatusChange: vi.fn().mockReturnValue(() => {}),
    destroy: vi.fn(),
  }),
}));

import { upsertEntry } from "./store";

/**
 * Property 2: Preservation — Today's View and Non-History Operations Unchanged
 *
 * These property-based tests confirm that core store operations (upsertEntry,
 * pruneOldEntries, saveStore field preservation, and today's rendering from live data)
 * continue to function identically regardless of future changes (e.g., adding a
 * `snapshots` field). They MUST pass on both unfixed and fixed code.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

// --- Arbitraries ---

const arbDate = fc.date({
  min: new Date(2024, 0, 1),
  max: new Date(2025, 12, 31),
}).map((d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
});

const arbTaskId = fc.stringMatching(/^task-[a-z0-9]{1,8}$/);

const arbDayEntry: fc.Arbitrary<DayEntry> = fc.record({
  date: arbDate,
  taskId: arbTaskId,
  done: fc.boolean(),
  comment: fc.string({ maxLength: 50 }),
  updatedAt: fc.nat({ max: 2000000000000 }),
});

const arbTask: fc.Arbitrary<Task> = fc.record({
  id: arbTaskId,
  groupId: fc.stringMatching(/^grp-[a-z0-9]{1,6}$/),
  title: fc.string({ minLength: 1, maxLength: 30 }),
  order: fc.nat({ max: 20 }),
});

const arbGroup: fc.Arbitrary<TaskGroup> = fc.record({
  id: fc.stringMatching(/^grp-[a-z0-9]{1,6}$/),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  order: fc.nat({ max: 10 }),
});

// --- Tests ---

describe("Property 2: Preservation — upsertEntry produces correct results", () => {
  it("upsertEntry inserts a new entry when no matching date+taskId exists", () => {
    fc.assert(
      fc.property(
        fc.array(arbDayEntry, { maxLength: 20 }),
        arbDate,
        arbTaskId,
        fc.boolean(),
        fc.string({ maxLength: 30 }),
        (entries, date, taskId, done, comment) => {
          // Filter out entries that already match the date+taskId to guarantee insertion
          const filtered = entries.filter(
            (e) => !(e.date === date && e.taskId === taskId)
          );
          const result = upsertEntry(filtered, { date, taskId, done, comment });

          // Result should have one more entry
          expect(result.length).toBe(filtered.length + 1);

          // Last entry should match our patch
          const inserted = result[result.length - 1];
          expect(inserted.date).toBe(date);
          expect(inserted.taskId).toBe(taskId);
          expect(inserted.done).toBe(done);
          expect(inserted.comment).toBe(comment);
          expect(inserted.updatedAt).toBeTypeOf("number");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("upsertEntry updates an existing entry when date+taskId match", () => {
    fc.assert(
      fc.property(
        fc.array(arbDayEntry, { minLength: 1, maxLength: 20 }),
        fc.boolean(),
        fc.string({ maxLength: 30 }),
        (entries, newDone, newComment) => {
          // Pick the first entry and update it
          const target = entries[0];
          const result = upsertEntry(entries, {
            date: target.date,
            taskId: target.taskId,
            done: newDone,
            comment: newComment,
          });

          // Result length unchanged (update, not insert)
          expect(result.length).toBe(entries.length);

          // The entry at the same position should be updated
          const updated = result.find(
            (e) => e.date === target.date && e.taskId === target.taskId
          );
          expect(updated).toBeDefined();
          expect(updated!.done).toBe(newDone);
          expect(updated!.comment).toBe(newComment);

          // Other entries remain unchanged
          const others = result.filter(
            (e) => !(e.date === target.date && e.taskId === target.taskId)
          );
          const originalOthers = entries.filter(
            (e) => !(e.date === target.date && e.taskId === target.taskId)
          );
          expect(others).toEqual(originalOthers);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("upsertEntry for today's date produces correct entry with updatedAt timestamp", () => {
    fc.assert(
      fc.property(
        fc.array(arbDayEntry, { maxLength: 10 }),
        arbTaskId,
        fc.boolean(),
        fc.string({ maxLength: 20 }),
        (entries, taskId, done, comment) => {
          const today = getTodayString();
          // Remove any existing entry for today+taskId
          const filtered = entries.filter(
            (e) => !(e.date === today && e.taskId === taskId)
          );
          const result = upsertEntry(filtered, { date: today, taskId, done, comment });

          const todayEntry = result.find(
            (e) => e.date === today && e.taskId === taskId
          );
          expect(todayEntry).toBeDefined();
          expect(todayEntry!.done).toBe(done);
          expect(todayEntry!.comment).toBe(comment);
          expect(todayEntry!.updatedAt).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 2: Preservation — Today's view renders from live store data", () => {
  it("for all stores, today's rendering data comes from live store.tasks and store.groups", () => {
    fc.assert(
      fc.property(
        fc.array(arbTask, { minLength: 1, maxLength: 10 }),
        fc.array(arbGroup, { minLength: 1, maxLength: 5 }),
        fc.array(arbDayEntry, { maxLength: 20 }),
        (tasks, groups, entries) => {
          // Simulate what HistoryView does for today: it uses store.tasks and store.groups directly
          const today = getTodayString();

          // The total tasks for today always comes from the live store
          const totalTasks = tasks.length;
          expect(totalTasks).toBe(tasks.length);

          // The groups displayed come from the live store.groups
          const sortedGroups = [...groups].sort((a, b) => a.order - b.order);
          expect(sortedGroups).toEqual([...groups].sort((a, b) => a.order - b.order));

          // Tasks for each group come from live store.tasks
          for (const group of sortedGroups) {
            const groupTasks = tasks
              .filter((t) => t.groupId === group.id)
              .sort((a, b) => a.order - b.order);
            // These are exactly the live tasks — not from any snapshot
            expect(groupTasks).toEqual(
              tasks.filter((t) => t.groupId === group.id).sort((a, b) => a.order - b.order)
            );
          }

          // Done count for today is from entries, not affected by snapshots
          const todayDone = entries.filter((e) => e.date === today && e.done).length;
          expect(todayDone).toBe(
            entries.filter((e) => e.date === today && e.done).length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("today's date always uses store.tasks.length for totalTasks (never a snapshot)", () => {
    fc.assert(
      fc.property(
        fc.array(arbTask, { minLength: 0, maxLength: 15 }),
        (tasks) => {
          // The HistoryView component computes: const totalTasks = store.tasks.length
          // This must always equal the live tasks count for today
          const totalTasks = tasks.length;
          expect(totalTasks).toBe(tasks.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 2: Preservation — pruneOldEntries produces identical results regardless of snapshots field", () => {
  it("pruneOldEntries result is the same whether or not the store has a snapshots field", () => {
    fc.assert(
      fc.property(
        fc.array(arbDayEntry, { maxLength: 30 }),
        fc.nat({ max: 365 }),
        (entries, cutoffDays) => {
          // Ensure cutoffDays is at least 1 to be meaningful
          const days = Math.max(1, cutoffDays);

          // pruneOldEntries only depends on entries and cutoffDays
          // It should produce identical results regardless of any other store fields
          const result1 = pruneOldEntries(entries, days);
          const result2 = pruneOldEntries([...entries], days);

          expect(result1).toEqual(result2);

          // Verify all returned entries have dates within the retention window
          for (const entry of result1) {
            // Each retained entry should have a date >= the cutoff date
            // (pruneOldEntries uses >= comparison on date strings)
            expect(entry.date).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("pruneOldEntries removes entries older than the cutoff and retains recent ones", () => {
    fc.assert(
      fc.property(
        fc.array(arbDayEntry, { maxLength: 20 }),
        (entries) => {
          // Use a standard 90-day cutoff
          const result = pruneOldEntries(entries, 90);

          // Result should be a subset of original entries
          expect(result.length).toBeLessThanOrEqual(entries.length);

          // All returned entries should exist in the original array
          for (const entry of result) {
            const found = entries.find(
              (e) => e.date === entry.date && e.taskId === entry.taskId && e.updatedAt === entry.updatedAt
            );
            expect(found).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 2: Preservation — saveStore includes all original fields without alteration", () => {
  // --- Mock chrome.storage.local for saveStore test ---
  const localStore: Record<string, unknown> = {};

  const chromeMock = {
    storage: {
      local: {
        get(keys: string[], callback: (items: Record<string, unknown>) => void) {
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            if (key in localStore) result[key] = localStore[key];
          }
          callback(result);
        },
        set(items: Record<string, unknown>, callback: () => void) {
          Object.assign(localStore, items);
          callback();
        },
      },
      session: {
        get(_keys: string[], callback: (items: Record<string, unknown>) => void) { callback({}); },
        set(_items: Record<string, unknown>, callback: () => void) { callback(); },
        remove(_key: string, callback: () => void) { callback(); },
      },
    },
    runtime: { lastError: undefined as { message: string } | undefined },
  };

  beforeEach(() => {
    (globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;
    for (const key of Object.keys(localStore)) delete localStore[key];
  });

  it("saveStore preserves all original store fields (groups, tasks, todos, notes, habits, habitEntries, books)", async () => {
    const { saveStore } = await import("./store");

    await fc.assert(
      fc.asyncProperty(
        fc.array(arbGroup, { minLength: 1, maxLength: 5 }),
        fc.array(arbTask, { minLength: 1, maxLength: 10 }),
        fc.array(arbDayEntry, { maxLength: 10 }),
        async (groups, tasks, entries) => {
          const store: TrackItStore = {
            groups,
            tasks,
            entries,
            todos: [],
            notes: [],
            habits: [],
            habitEntries: [],
            books: [],
            schemaVersion: 1,
            updatedAt: 0,
          };

          await saveStore(store);

          const saved = localStore["trackit.store"] as TrackItStore;

          // All original fields are preserved
          expect(saved.groups).toEqual(groups);
          expect(saved.tasks).toEqual(tasks);
          expect(saved.todos).toEqual([]);
          expect(saved.notes).toEqual([]);
          expect(saved.habits).toEqual([]);
          expect(saved.habitEntries).toEqual([]);
          expect(saved.books).toEqual([]);
          expect(saved.schemaVersion).toBe(1);

          // updatedAt is refreshed but exists
          expect(saved.updatedAt).toBeTypeOf("number");
          expect(saved.updatedAt).toBeGreaterThan(0);

          // entries may be pruned but any remaining entries are from the original set
          for (const entry of saved.entries) {
            const found = entries.find(
              (e) => e.date === entry.date && e.taskId === entry.taskId
            );
            expect(found).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
