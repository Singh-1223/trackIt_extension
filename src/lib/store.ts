import type { DayEntry, Note, Task, TaskGroup, Todo, TrackItStore } from "../types/index";
import { pruneOldEntries } from "./utils";

const STORAGE_KEY = "trackit.store";
const SCHEMA_VERSION = 1;

function buildDefaultStore(): TrackItStore {
  const groups: TaskGroup[] = [
    { id: "grp-interview", name: "Interview Prep", order: 0 },
    { id: "grp-habits", name: "Daily Habits", order: 1 }
  ];

  const tasks: Task[] = [
    { id: "task-dsa", groupId: "grp-interview", title: "DSA: 2 problems — 1 easy + 1 medium", order: 0 },
    { id: "task-fe", groupId: "grp-interview", title: "Frontend: Machine coding / theory block", order: 1 },
    { id: "task-be", groupId: "grp-interview", title: "Backend: Java/Spring — theory + build", order: 2 },
    { id: "task-sd", groupId: "grp-interview", title: "System Design: 1 HLD or LLD timed session", order: 3 },
    { id: "task-ai", groupId: "grp-interview", title: "AI: Read + hands-on portfolio", order: 4 },
    { id: "task-workout", groupId: "grp-habits", title: "Morning workout / walk", order: 0 },
    { id: "task-read", groupId: "grp-habits", title: "Read 20 pages", order: 1 },
    { id: "task-journal", groupId: "grp-habits", title: "Reflect + journal — 5 min", order: 2 }
  ];

  return { groups, tasks, entries: [], todos: [], notes: [], schemaVersion: SCHEMA_VERSION };
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
