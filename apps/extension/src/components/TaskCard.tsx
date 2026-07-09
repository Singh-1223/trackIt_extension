import { useState } from "react";
import type { DayEntry, Task } from "../types/index";

interface TaskCardProps {
  task: Task;
  entry: DayEntry | undefined;
  onUpdate: (patch: { done: boolean; comment: string }) => void;
  commentPlaceholder?: string;
}

export function TaskCard({ task, entry, onUpdate, commentPlaceholder = "Note for today…" }: TaskCardProps) {
  const [showComment, setShowComment] = useState(false);
  const done = entry?.done ?? false;
  const comment = entry?.comment ?? "";

  return (
    <div>
      <div className={`task-check-row${done ? " is-done" : ""}`}>
        <input
          type="checkbox"
          id={`chk-${task.id}`}
          className="task-check-checkbox"
          checked={done}
          onChange={(e) => onUpdate({ done: e.target.checked, comment })}
        />
        <label htmlFor={`chk-${task.id}`} className="task-check-label">
          {task.title}
        </label>
        <button
          type="button"
          className={`task-check-comment-btn${comment ? " has-comment" : ""}`}
          aria-label={showComment ? "Hide note" : "Add note"}
          title={comment || "Add a note for today"}
          onClick={() => setShowComment((v) => !v)}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 2.5l2 2-7 7-2.5.5.5-2.5 7-7z" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M10 4l2 2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {showComment && (
        <div className="task-comment-area">
          <textarea
            placeholder={commentPlaceholder}
            value={comment}
            rows={2}
            onChange={(e) => onUpdate({ done, comment: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
