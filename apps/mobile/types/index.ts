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
  startDate?: string;
  endDate?: string;
  targetCount?: number;
  createdAt: number;
}

export interface HabitEntry {
  habitId: string;
  date: string;
  done: boolean;
}

export interface BookNote {
  id: string;
  text: string;
  createdAt: number;
}

export type BookStatus = "reading" | "toread" | "completed";

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  status: BookStatus;
  notes: BookNote[];
  createdAt: number;
  updatedAt: number;
}

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
  habits: Habit[];
  habitEntries: HabitEntry[];
  books: Book[];
  schemaVersion: number;
  updatedAt: number;
}
