import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DayEntry, HabitEntry, Note, Todo, TrackItStore } from "../types/index";
import { pruneOldEntries } from "./utils";

const STORAGE_KEY = "trackit.store";
const SCHEMA_VERSION = 1;

export function buildDefaultStore(): TrackItStore {
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
    schemaVersion: SCHEMA_VERSION,
    updatedAt: 0,
  };
}

function migrate(raw: TrackItStore): TrackItStore {
  let s = { ...raw };
  if (!Array.isArray(s.todos)) s = { ...s, todos: [] };
  if (!Array.isArray(s.notes)) s = { ...s, notes: [] };
  if (!Array.isArray(s.habits)) s = { ...s, habits: [] };
  if (!Array.isArray(s.habitEntries)) s = { ...s, habitEntries: [] };
  if (s.todos.some((t) => !Array.isArray((t as Todo).subTasks))) {
    s = { ...s, todos: s.todos.map((t) => (Array.isArray((t as Todo).subTasks) ? t : { ...t, subTasks: [] })) };
  }
  // Do NOT stamp updatedAt here — a missing/zero timestamp means "never written by user",
  // which lets the sync logic correctly prefer remote data over a fresh local store.
  return s;
}

export async function loadLocalStore(): Promise<TrackItStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultStore();
    const parsed = JSON.parse(raw) as TrackItStore;
    return migrate(parsed);
  } catch {
    return buildDefaultStore();
  }
}

export async function saveLocalStore(store: TrackItStore): Promise<void> {
  const pruned: TrackItStore = { ...store, entries: pruneOldEntries(store.entries, 90) };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
}

export function findEntry(entries: DayEntry[], date: string, taskId: string): DayEntry | undefined {
  return entries.find((e) => e.date === date && e.taskId === taskId);
}

export function upsertEntry(entries: DayEntry[], patch: Omit<DayEntry, "updatedAt">): DayEntry[] {
  const idx = entries.findIndex((e) => e.date === patch.date && e.taskId === patch.taskId);
  const updated: DayEntry = { ...patch, updatedAt: Date.now() };
  if (idx === -1) return [...entries, updated];
  return entries.map((e, i) => (i === idx ? updated : e));
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
  const done = todos.filter((t) => t.done).sort((a, b) => b.updatedAt - a.updatedAt);
  return { pending, done };
}

export function repackPriorities(todos: Todo[]): Todo[] {
  const pending = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);
  const withPriority = pending
    .filter((t) => t.priority != null)
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  const withoutPriority = pending.filter((t) => t.priority == null);
  const repacked = withPriority.map((t, i) => ({ ...t, priority: i + 1 }));
  return [...repacked, ...withoutPriority, ...done];
}

export function upsertHabitEntry(entries: HabitEntry[], patch: HabitEntry): HabitEntry[] {
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

export function hasUserModifications(store: TrackItStore): boolean {
  if (store.entries.length > 0) return true;
  if (store.todos.length > 0) return true;
  if (store.notes.length > 0) return true;
  if (store.habits.length > 0) return true;
  if (store.habitEntries.length > 0) return true;

  const defaultGroupIds = new Set(["grp-daily", "grp-habits"]);
  if (store.groups.length !== 2) return true;
  if (!store.groups.every((g) => defaultGroupIds.has(g.id))) return true;

  const defaultTaskIds = new Set(["task-1", "task-2", "task-3", "task-4", "task-5"]);
  if (store.tasks.length !== 5) return true;
  if (!store.tasks.every((t) => defaultTaskIds.has(t.id))) return true;

  return false;
}

export function mergeStores(local: TrackItStore, remote: TrackItStore): TrackItStore {
  return (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? remote : local;
}

export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

export function sortedNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}
