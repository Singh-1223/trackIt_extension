import type { ObjectId } from "mongodb";

// --- Extension-mirrored interfaces ---

export interface Task {
  id: string;
  groupId: string;
  title: string;
  order: number;
}

export interface TaskGroup {
  id: string;
  name: string;
  order: number;
}

export interface DayEntry {
  date: string;
  taskId: string;
  done: boolean;
  comment: string;
  updatedAt: number;
}

export interface SubTask {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  done: boolean;
  priority?: number;
  subTasks: SubTask[];
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  heading: string;
  description: string;
  groupId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface NoteGroup {
  id: string;
  name: string;
  order: number;
}

export type ReflectionDate =
  | { precision: "day"; year: number; month: number; day: number }
  | { precision: "month"; year: number; month: number }
  | { precision: "year"; year: number }
  | { precision: "unknown" };

export interface ReflectionCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

export interface Reflection {
  id: string;
  categoryId?: string;
  title: string;
  content: string;
  date: ReflectionDate;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Habit {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: number;
}

export interface HabitEntry {
  habitId: string;
  date: string;
  done: boolean;
}

// --- Snapshot interfaces for history immutability ---

export interface SnapshotTask {
  id: string;
  groupId: string;
  title: string;
  order: number;
}

export interface SnapshotGroup {
  id: string;
  name: string;
  order: number;
}

export interface DailySnapshot {
  date: string;
  tasks: SnapshotTask[];
  groups: SnapshotGroup[];
}

export interface TrackItStore {
  groups: TaskGroup[];
  tasks: Task[];
  entries: DayEntry[];
  snapshots: DailySnapshot[];
  todos: Todo[];
  notes: Note[];
  noteGroups?: NoteGroup[];
  reflections?: Reflection[];
  reflectionCategories?: ReflectionCategory[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  schemaVersion: number;
  updatedAt: number;
}

// --- Sync metadata (stored in chrome.storage.local on the extension side) ---

export interface SyncMetadata {
  lastSyncedAt: number;
  lastSyncedStoreHash: string;
  pendingPush: boolean;
  migrationComplete: boolean;
}

// --- MongoDB document schema ---

export interface UserStoreDocument {
  _id: ObjectId;
  userId: string;
  store: TrackItStore;
  createdAt: Date;
  updatedAt: Date;
}

// --- Store validation constants ---

export const STORE_VALIDATION = {
  requiredFields: [
    "groups",
    "tasks",
    "entries",
    "todos",
    "notes",
    "habits",
    "habitEntries",
    "snapshots",
    "schemaVersion",
  ] as const,

  maxPayloadSize: 5_242_880, // 5 MB

  fieldTypes: {
    groups: "array",
    tasks: "array",
    entries: "array",
    todos: "array",
    notes: "array",
    noteGroups: "array",
    reflections: "array",
    reflectionCategories: "array",
    habits: "array",
    habitEntries: "array",
    snapshots: "array",
    schemaVersion: "number",
    updatedAt: "number",
  } as const,
} satisfies StoreValidation;

export interface StoreValidation {
  requiredFields: readonly string[];
  maxPayloadSize: number;
  fieldTypes: Record<string, "array" | "number">;
}
