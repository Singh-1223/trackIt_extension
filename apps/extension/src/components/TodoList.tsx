import { useState } from "react";
import type { SubTask, Todo } from "../types/index";
import { generateId } from "../lib/utils";
import { repackPriorities, sortedTodos } from "../lib/store";

interface TodoListProps {
  todos: Todo[];
  onSave: (updated: Todo[]) => Promise<void>;
  compact?: boolean;
  today: string;
}

function dueBadgeClass(dueDate: string, today: string): string {
  if (!dueDate) return "";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due-today";
  return "";
}

function formatDue(dueDate: string, today: string): string {
  if (!dueDate) return "";
  if (dueDate === today) return "Today";
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

function formatCreatedAt(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(ms));
}

function allSubTasksDone(todo: Todo): boolean {
  return todo.subTasks.length > 0 && todo.subTasks.every((s) => s.done);
}

export function TodoList({ todos, onSave, compact = false, today }: TodoListProps) {
  const { pending, done } = sortedTodos(todos);

  // Add form state
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addDue, setAddDue] = useState("");

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editPriority, setEditPriority] = useState<number | "">("");

  // Subtask add form state (keyed by todo id)
  const [subAddTitle, setSubAddTitle] = useState<Record<string, string>>({});
  const [subAddDue, setSubAddDue] = useState<Record<string, string>>({});

  function startEdit(todo: Todo) {
    setEditId(todo.id);
    setEditTitle(todo.title);
    setEditDesc(todo.description);
    setEditDue(todo.dueDate);
    setEditPriority(todo.priority ?? "");
  }

  function cancelEdit() {
    setEditId(null);
    setEditTitle("");
    setEditDesc("");
    setEditDue("");
    setEditPriority("");
  }

  async function handleAdd() {
    const title = addTitle.trim();
    if (!title) return;
    const newTodo: Todo = {
      id: generateId("todo"),
      title,
      description: addDesc.trim(),
      dueDate: addDue,
      done: false,
      subTasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await onSave([...todos, newTodo]);
    setAddTitle("");
    setAddDesc("");
    setAddDue("");
  }

  async function handleSaveEdit() {
    if (!editId || !editTitle.trim()) return;
    const priority = editPriority === "" ? undefined : Number(editPriority);
    await onSave(
      todos.map((t) =>
        t.id === editId
          ? { ...t, title: editTitle.trim(), description: editDesc.trim(), dueDate: editDue, priority, updatedAt: Date.now() }
          : t
      )
    );
    cancelEdit();
  }

  async function handleToggleDone(todo: Todo) {
    const nowDone = !todo.done;
    const updated = todos.map((t) => {
      if (t.id !== todo.id) return t;
      const subTasks = nowDone
        ? t.subTasks.map((s) => ({ ...s, done: true, updatedAt: Date.now() }))
        : t.subTasks;
      return { ...t, done: nowDone, subTasks, updatedAt: Date.now() };
    });
    // Repack priorities after marking done so remaining todos shift up
    await onSave(repackPriorities(updated));
  }

  async function handleToggleSubTask(todo: Todo, subId: string) {
    const updatedSubTasks = todo.subTasks.map((s) =>
      s.id === subId ? { ...s, done: !s.done, updatedAt: Date.now() } : s
    );
    // Auto-complete parent if all subtasks are now done
    const allDone = updatedSubTasks.length > 0 && updatedSubTasks.every((s) => s.done);
    await onSave(
      todos.map((t) =>
        t.id === todo.id
          ? { ...t, subTasks: updatedSubTasks, done: allDone ? true : t.done, updatedAt: Date.now() }
          : t
      )
    );
  }

  async function handleAddSubTask(todo: Todo) {
    const title = (subAddTitle[todo.id] ?? "").trim();
    if (!title) return;
    const newSub: SubTask = {
      id: generateId("sub"),
      title,
      dueDate: subAddDue[todo.id] ?? "",
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await onSave(
      todos.map((t) =>
        t.id === todo.id ? { ...t, subTasks: [...t.subTasks, newSub], updatedAt: Date.now() } : t
      )
    );
    setSubAddTitle((prev) => ({ ...prev, [todo.id]: "" }));
    setSubAddDue((prev) => ({ ...prev, [todo.id]: "" }));
  }

  async function handleDeleteSubTask(todo: Todo, subId: string) {
    await onSave(
      todos.map((t) =>
        t.id === todo.id
          ? { ...t, subTasks: t.subTasks.filter((s) => s.id !== subId), updatedAt: Date.now() }
          : t
      )
    );
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this to-do?")) return;
    await onSave(todos.filter((t) => t.id !== id));
  }

  const displayPending = pending;

  function renderSubTasks(todo: Todo, isDoneSection = false) {
    if (todo.subTasks.length === 0 && (compact || isDoneSection)) return null;

    return (
      <details className="subtask-details" open={!compact && todo.subTasks.length > 0}>
        <summary className="subtask-summary">
          <span className="subtask-chevron" aria-hidden="true" />
          <span className="subtask-summary-label">
            Sub-tasks
            {todo.subTasks.length > 0 && (
              <span className="subtask-count-badge">
                {todo.subTasks.filter((s) => s.done).length}/{todo.subTasks.length}
              </span>
            )}
          </span>
        </summary>

        <div className="subtask-list">
          {todo.subTasks.map((sub) => (
            <div key={sub.id} className={`subtask-row${sub.done ? " is-done" : ""}`}>
              <input
                type="checkbox"
                className="todo-checkbox"
                checked={sub.done}
                onChange={() => void handleToggleSubTask(todo, sub.id)}
                aria-label={`Mark subtask "${sub.title}" ${sub.done ? "pending" : "done"}`}
              />
              <div className="todo-content">
                <div className="todo-title-row">
                  <span className="todo-title" style={{ fontSize: "0.88rem" }}>{sub.title}</span>
                  {sub.dueDate && (
                    <span className={`todo-due-badge ${dueBadgeClass(sub.dueDate, today)}`}>
                      {formatDue(sub.dueDate, today)}
                    </span>
                  )}
                </div>
              </div>
              {!compact && !isDoneSection && (
                <button
                  type="button"
                  className="button button-danger"
                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  onClick={() => void handleDeleteSubTask(todo, sub.id)}
                  aria-label="Delete subtask"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Add subtask form — only in edit mode (non-compact, non-done) */}
          {!compact && !isDoneSection && editId === todo.id && (
            <div className="subtask-add-row">
              <input
                className="add-task-input"
                placeholder="New sub-task…"
                value={subAddTitle[todo.id] ?? ""}
                onChange={(e) => setSubAddTitle((prev) => ({ ...prev, [todo.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") void handleAddSubTask(todo); }}
                style={{ flex: 1, fontSize: "0.85rem" }}
              />
              <input
                type="date"
                value={subAddDue[todo.id] ?? ""}
                onChange={(e) => setSubAddDue((prev) => ({ ...prev, [todo.id]: e.target.value }))}
                title="Due date (optional)"
                style={{ fontSize: "0.82rem" }}
              />
              <button
                type="button"
                className="button button-secondary"
                style={{ padding: "5px 10px", fontSize: "0.78rem" }}
                onClick={() => void handleAddSubTask(todo)}
              >
                Add
              </button>
            </div>
          )}
        </div>
      </details>
    );
  }

  function renderCompactSubTasks(todo: Todo) {
    if (todo.subTasks.length === 0) return null;
    return (
      <details className="subtask-details">
        <summary className="subtask-summary">
          <span className="subtask-chevron" aria-hidden="true" />
          <span className="subtask-summary-label">
            Sub-tasks
            <span className="subtask-count-badge">
              {todo.subTasks.filter((s) => s.done).length}/{todo.subTasks.length}
            </span>
          </span>
        </summary>
        <div className="subtask-list">
          {todo.subTasks.map((sub) => (
            <div key={sub.id} className={`subtask-row${sub.done ? " is-done" : ""}`}>
              <input
                type="checkbox"
                className="todo-checkbox"
                checked={sub.done}
                onChange={() => void handleToggleSubTask(todo, sub.id)}
                aria-label={`Mark subtask "${sub.title}" ${sub.done ? "pending" : "done"}`}
              />
              <div className="todo-content">
                <div className="todo-title-row">
                  <span className="todo-title" style={{ fontSize: "0.88rem" }}>{sub.title}</span>
                  {sub.dueDate && (
                    <span className={`todo-due-badge ${dueBadgeClass(sub.dueDate, today)}`}>
                      {formatDue(sub.dueDate, today)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <div>
      {/* Pending section */}
      {pending.length === 0 ? (
        !compact && <div className="empty" style={{ marginBottom: 12 }}>No pending to-dos. Add one below.</div>
      ) : (
        <div className="todo-list" style={{ marginBottom: 8 }}>
          {displayPending.map((todo) => (
            <div key={todo.id} className="todo-card">
              {editId === todo.id && !compact ? (
                <div className="todo-edit-form">
                  <input
                    className="add-task-input"
                    value={editTitle}
                    autoFocus
                    placeholder="Title"
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSaveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={editDesc}
                    rows={2}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                  <div className="todo-add-row">
                    <input
                      type="date"
                      value={editDue}
                      onChange={(e) => setEditDue(e.target.value)}
                    />
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value === "" ? "" : Number(e.target.value))}
                      className="priority-select"
                      title="Priority (optional)"
                    >
                      <option value="">No priority</option>
                      <option value="1">P1 — Critical</option>
                      <option value="2">P2 — High</option>
                      <option value="3">P3 — Medium</option>
                      <option value="4">P4 — Low</option>
                      <option value="5">P5 — Someday</option>
                    </select>
                    <button type="button" className="button button-primary" style={{ padding: "7px 14px", fontSize: "0.82rem" }} onClick={() => void handleSaveEdit()}>Save</button>
                    <button type="button" className="button button-secondary" style={{ padding: "7px 14px", fontSize: "0.82rem" }} onClick={cancelEdit}>Cancel</button>
                  </div>
                  {renderSubTasks(todo)}
                </div>
              ) : (
                <>
                  <div className="todo-card-row">
                    <div className="todo-card-left">
                      <input
                        type="checkbox"
                        className="todo-checkbox"
                        checked={false}
                        onChange={() => void handleToggleDone(todo)}
                        aria-label={`Mark "${todo.title}" done`}
                      />
                      <span className="todo-title">{todo.title}</span>
                    </div>
                    <div className="todo-card-right">
                      {todo.priority != null && (
                        <span className={`priority-badge priority-badge-${todo.priority}`}>P{todo.priority}</span>
                      )}
                      {todo.dueDate && (
                        <span className={`todo-due-badge ${dueBadgeClass(todo.dueDate, today)}`}>
                          {formatDue(todo.dueDate, today)}
                        </span>
                      )}
                      {!compact && (
                        <>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                            onClick={() => startEdit(todo)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button button-danger"
                            style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                            onClick={() => void handleDelete(todo.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {(!compact && todo.description) && (
                    <p className="todo-description" style={{ paddingLeft: 26 }}>{todo.description}</p>
                  )}
                  <p className="todo-created-at" style={{ paddingLeft: 26 }}>Added {formatCreatedAt(todo.createdAt)}</p>
                  <div style={{ paddingLeft: 26 }}>
                    {compact ? renderCompactSubTasks(todo) : renderSubTasks(todo)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Done section */}
      {!compact && done.length > 0 && (
        <details className="todo-done-details">
          <summary>Done <span className="todo-count-badge">{done.length}</span></summary>
          <div className="todo-list" style={{ marginTop: 8 }}>
            {done.map((todo) => (
              <div key={todo.id} className="todo-card is-done">
                <div className="todo-card-row">
                  <div className="todo-card-left">
                    <input
                      type="checkbox"
                      className="todo-checkbox"
                      checked={true}
                      onChange={() => void handleToggleDone(todo)}
                      aria-label={`Mark "${todo.title}" pending`}
                    />
                    <span className="todo-title">{todo.title}</span>
                  </div>
                  <div className="todo-card-right">
                    {todo.priority != null && (
                      <span className={`priority-badge priority-badge-${todo.priority}`}>P{todo.priority}</span>
                    )}
                    {todo.dueDate && (
                      <span className="todo-due-badge">{formatDue(todo.dueDate, today)}</span>
                    )}
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                      onClick={() => void handleToggleDone(todo)}
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      className="button button-danger"
                      style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                      onClick={() => void handleDelete(todo.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {todo.description && (
                  <p className="todo-description" style={{ paddingLeft: 26 }}>{todo.description}</p>
                )}
                <p className="todo-created-at" style={{ paddingLeft: 26 }}>Added {formatCreatedAt(todo.createdAt)}</p>
                <div style={{ paddingLeft: 26 }}>{renderSubTasks(todo, true)}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add form */}
      {!compact && (
        <div className="todo-add-form">
          <div className="todo-add-row">
            <input
              className="add-task-input"
              placeholder="New to-do title…"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
              style={{ flex: 1 }}
            />
            <input
              type="date"
              value={addDue}
              onChange={(e) => setAddDue(e.target.value)}
              title="Due date (optional)"
            />
            <button
              type="button"
              className="button button-primary"
              onClick={() => void handleAdd()}
            >
              Add
            </button>
          </div>
          <textarea
            placeholder="Description (optional)"
            value={addDesc}
            rows={2}
            onChange={(e) => setAddDesc(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
