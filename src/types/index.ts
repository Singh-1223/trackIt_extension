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

export interface Todo {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  done: boolean;
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

export interface TrackItStore {
  groups: TaskGroup[];
  tasks: Task[];
  entries: DayEntry[];
  todos: Todo[];
  notes: Note[];
  schemaVersion: number;
}
