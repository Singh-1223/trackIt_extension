import type { DayEntry, Task, TaskGroup } from "../types/index";
import { TaskCard } from "./TaskCard";

interface GroupSectionProps {
  group: TaskGroup;
  tasks: Task[];
  entries: DayEntry[];
  onUpdate: (taskId: string, patch: { done: boolean; comment: string }) => void;
}

export function GroupSection({ group, tasks, entries, onUpdate }: GroupSectionProps) {
  const doneCount = tasks.filter((t) => entries.find((e) => e.taskId === t.id)?.done).length;

  return (
    <details className="group-accordion">
      <summary className="group-accordion-summary">
        <span className="group-accordion-chevron" aria-hidden="true" />
        <span className="group-accordion-name">{group.name}</span>
        <span className="group-progress-badge">{doneCount} / {tasks.length}</span>
      </summary>
      <div className="group-task-list">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            entry={entries.find((e) => e.taskId === task.id)}
            onUpdate={(patch) => onUpdate(task.id, patch)}
          />
        ))}
        {tasks.length === 0 && (
          <p className="muted" style={{ fontSize: "0.85rem", margin: "4px 0" }}>
            No tasks in this group yet.
          </p>
        )}
      </div>
    </details>
  );
}
