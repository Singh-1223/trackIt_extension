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

export interface TrackItStore {
  groups: TaskGroup[];
  tasks: Task[];
  entries: DayEntry[];
  todos: Todo[];
  notes: Note[];
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
    "schemaVersion",
  ] as const,

  maxPayloadSize: 5_242_880, // 5 MB

  fieldTypes: {
    groups: "array",
    tasks: "array",
    entries: "array",
    todos: "array",
    notes: "array",
    habits: "array",
    habitEntries: "array",
    schemaVersion: "number",
    updatedAt: "number",
  } as const,
} satisfies StoreValidation;

export interface StoreValidation {
  requiredFields: readonly string[];
  maxPayloadSize: number;
  fieldTypes: Record<string, "array" | "number">;
}
