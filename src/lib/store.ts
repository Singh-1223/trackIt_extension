import type { DayEntry, Habit, HabitEntry, Note, Task, TaskGroup, Todo, TrackItStore } from "../types/index";
import { pruneOldEntries } from "./utils";

const STORAGE_KEY = "trackit.store";
const SCHEMA_VERSION = 1;

function buildDefaultStore(): TrackItStore {
  const groups: TaskGroup[] = [
    { id: "grp-daily", name: "Daily Goals", order: 0 },
    { id: "grp-habits", name: "Habits", order: 1 }
  ];

  const tasks: Task[] = [
    { id: "task-1", groupId: "grp-daily", title: "Deep work block — 2 hrs", order: 0 },
    { id: "task-2", groupId: "grp-daily", title: "Review priorities for tomorrow", order: 1 },
    { id: "task-3", groupId: "grp-habits", title: "Morning workout / walk", order: 0 },
    { id: "task-4", groupId: "grp-habits", title: "Read 20 pages", order: 1 },
    { id: "task-5", groupId: "grp-habits", title: "Reflect + journal — 5 min", order: 2 }
  ];

  return { groups, tasks, entries: [], todos: [], notes: [], habits: [], habitEntries: [], schemaVersion: SCHEMA_VERSION };
}

function chromeGet(key: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      const err = chrome.runtime.lastError;
      if (err) { reject(new Error(err.message)); return; }
      resolve(result);
    });
  });
}

function chromeSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const err = chrome.runtime.lastError;
      if (err) { reject(new Error(err.message)); return; }
      resolve();
    });
  });
}

export async function getStore(): Promise<TrackItStore> {
  const result = await chromeGet(STORAGE_KEY);
  const raw = result[STORAGE_KEY];

  if (!raw || typeof raw !== "object" || !(raw as TrackItStore).schemaVersion) {
    const defaultStore = buildDefaultStore();
    await chromeSet({ [STORAGE_KEY]: defaultStore });
    return defaultStore;
  }

  const stored = raw as TrackItStore;
  // Migrate: add todos array if missing (existing installs before this feature)
  if (!Array.isArray(stored.todos)) {
    const migrated = { ...stored, todos: [] };
    await chromeSet({ [STORAGE_KEY]: migrated });
    return migrated;
  }
  // Migrate: add notes array if missing
  if (!Array.isArray(stored.notes)) {
    const migrated = { ...stored, notes: [] };
    await chromeSet({ [STORAGE_KEY]: migrated });
    return migrated;
  }
  // Migrate: add habits/habitEntries arrays if missing
  if (!Array.isArray(stored.habits) || !Array.isArray(stored.habitEntries)) {
    const migrated = {
      ...stored,
      habits: Array.isArray(stored.habits) ? stored.habits : [],
      habitEntries: Array.isArray(stored.habitEntries) ? stored.habitEntries : []
    };
    await chromeSet({ [STORAGE_KEY]: migrated });
    return migrated;
  }
  // Migrate: add subTasks array to todos that are missing it
  if (stored.todos.some((t) => !Array.isArray((t as Todo).subTasks))) {
    const migrated = {
      ...stored,
      todos: stored.todos.map((t) =>
        Array.isArray((t as Todo).subTasks) ? t : { ...t, subTasks: [] }
      )
    };
    await chromeSet({ [STORAGE_KEY]: migrated });
    return migrated;
  }

  return stored;
}

export async function saveStore(store: TrackItStore): Promise<void> {
  const pruned: TrackItStore = {
    ...store,
    entries: pruneOldEntries(store.entries, 90)
  };
  await chromeSet({ [STORAGE_KEY]: pruned });
}

export function findEntry(entries: DayEntry[], date: string, taskId: string): DayEntry | undefined {
  return entries.find((e) => e.date === date && e.taskId === taskId);
}

export function upsertEntry(
  entries: DayEntry[],
  patch: Omit<DayEntry, "updatedAt">
): DayEntry[] {
  const idx = entries.findIndex((e) => e.date === patch.date && e.taskId === patch.taskId);
  const updated: DayEntry = { ...patch, updatedAt: Date.now() };
  if (idx === -1) return [...entries, updated];
  return entries.map((e, i) => (i === idx ? updated : e));
}

export function openOptionsPage(): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.openOptionsPage(() => resolve());
  });
}

export function sortedTodos(todos: Todo[]): { pending: Todo[]; done: Todo[] } {
  const pending = todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.createdAt - b.createdAt;
    });
  const done = todos
    .filter((t) => t.done)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return { pending, done };
}

// After marking a todo done, compact the priorities of remaining pending todos
// so they stay consecutive (e.g. P1, P2, P3 → if P1 done → P2 becomes P1, P3 becomes P2)
export function repackPriorities(todos: Todo[]): Todo[] {
  const pending = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  // Sort pending by current priority (unprioritized last)
  const withPriority = pending.filter((t) => t.priority != null).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  const withoutPriority = pending.filter((t) => t.priority == null);

  // Reassign consecutive priorities starting from 1
  const repacked = withPriority.map((t, i) => ({ ...t, priority: i + 1 }));

  return [...repacked, ...withoutPriority, ...done];
}

export function upsertHabitEntry(
  entries: HabitEntry[],
  patch: HabitEntry
): HabitEntry[] {
  const idx = entries.findIndex((e) => e.habitId === patch.habitId && e.date === patch.date);
  if (idx === -1) return [...entries, patch];
  return entries.map((e, i) => (i === idx ? patch : e));
}

export function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
