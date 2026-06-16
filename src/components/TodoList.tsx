import { useState } from "react";
import type { Todo } from "../types/index";
import { generateId } from "../lib/utils";
import { sortedTodos } from "../lib/store";

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

  function startEdit(todo: Todo) {
    setEditId(todo.id);
    setEditTitle(todo.title);
    setEditDesc(todo.description);
    setEditDue(todo.dueDate);
  }

  function cancelEdit() {
    setEditId(null);
    setEditTitle("");
    setEditDesc("");
    setEditDue("");
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
    await onSave(
      todos.map((t) =>
        t.id === editId
          ? { ...t, title: editTitle.trim(), description: editDesc.trim(), dueDate: editDue, updatedAt: Date.now() }
          : t
      )
    );
    cancelEdit();
  }

  async function handleToggleDone(todo: Todo) {
    await onSave(
      todos.map((t) =>
        t.id === todo.id ? { ...t, done: !t.done, updatedAt: Date.now() } : t
      )
    );
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this to-do?")) return;
    await onSave(todos.filter((t) => t.id !== id));
  }

  const displayPending = compact ? pending.slice(0, 5) : pending;
  const hasMore = compact && pending.length > 5;

  return (
    <div>
      {/* Pending section */}
      {pending.length === 0 ? (
        !compact && <div className="empty" style={{ marginBottom: 12 }}>No pending to-dos. Add one below.</div>
      ) : (
        <div className="todo-list" style={{ marginBottom: 8 }}>
          {displayPending.map((todo) => (
            <div key={todo.id} className="todo-row">
              <input
                type="checkbox"
                className="todo-checkbox"
                checked={false}
                onChange={() => void handleToggleDone(todo)}
                aria-label={`Mark "${todo.title}" done`}
              />

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
                    <button type="button" className="button button-primary" style={{ padding: "7px 14px", fontSize: "0.82rem" }} onClick={() => void handleSaveEdit()}>Save</button>
                    <button type="button" className="button button-secondary" style={{ padding: "7px 14px", fontSize: "0.82rem" }} onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="todo-content">
                  <div className="todo-title-row">
                    <span className="todo-title">{todo.title}</span>
                    {todo.dueDate && (
                      <span className={`todo-due-badge ${dueBadgeClass(todo.dueDate, today)}`}>
                        {formatDue(todo.dueDate, today)}
                      </span>
                    )}
                  </div>
                  {!compact && todo.description && (
                    <p className="todo-description">{todo.description}</p>
                  )}
                  <p className="todo-created-at">Added {formatCreatedAt(todo.createdAt)}</p>
                </div>
              )}

              {!compact && editId !== todo.id && (
                <div className="todo-actions">
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <p className="muted" style={{ fontSize: "0.82rem", padding: "2px 0 6px" }}>
          +{pending.length - 5} more — open options to see all
        </p>
      )}

      {/* Done section */}
      {!compact && done.length > 0 && (
        <details className="todo-done-details">
          <summary>Done <span className="todo-count-badge">{done.length}</span></summary>
          <div className="todo-list" style={{ marginTop: 8 }}>
            {done.map((todo) => (
              <div key={todo.id} className="todo-row is-done">
                <input
                  type="checkbox"
                  className="todo-checkbox"
                  checked={true}
                  onChange={() => void handleToggleDone(todo)}
                  aria-label={`Mark "${todo.title}" pending`}
                />
                <div className="todo-content">
                  <div className="todo-title-row">
                    <span className="todo-title">{todo.title}</span>
                    {todo.dueDate && (
                      <span className="todo-due-badge">{formatDue(todo.dueDate, today)}</span>
                    )}
                  </div>
                  {todo.description && (
                    <p className="todo-description">{todo.description}</p>
                  )}
                  <p className="todo-created-at">Added {formatCreatedAt(todo.createdAt)}</p>
                </div>
                <div className="todo-actions">
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
