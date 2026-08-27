import { useState } from "react";
import type { Note } from "../types/index";
import { generateId } from "../lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface NotesListProps {
  notes: Note[];
  onSave: (updated: Note[]) => Promise<void>;
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(ms));
}

export function NotesList({ notes, onSave }: NotesListProps) {
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);

  const [addHeading, setAddHeading] = useState("");
  const [addDesc, setAddDesc] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editHeading, setEditHeading] = useState("");
  const [editDesc, setEditDesc] = useState("");

  function startEdit(note: Note) {
    setEditId(note.id);
    setEditHeading(note.heading);
    setEditDesc(note.description);
  }

  function cancelEdit() {
    setEditId(null);
    setEditHeading("");
    setEditDesc("");
  }

  async function handleAdd() {
    const heading = addHeading.trim();
    if (!heading) return;
    const note: Note = {
      id: generateId("note"),
      heading,
      description: addDesc.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await onSave([...notes, note]);
    setAddHeading("");
    setAddDesc("");
  }

  async function handleSaveEdit() {
    if (!editId || !editHeading.trim()) return;
    await onSave(
      notes.map((n) =>
        n.id === editId
          ? { ...n, heading: editHeading.trim(), description: editDesc.trim(), updatedAt: Date.now() }
          : n
      )
    );
    cancelEdit();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this note?")) return;
    await onSave(notes.filter((n) => n.id !== id));
  }

  return (
    <div>
      {sorted.length === 0 ? (
        <div className="empty" style={{ marginBottom: 12 }}>No notes yet. Add one below.</div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          {sorted.map((note) => (
            <details key={note.id} className="todo-done-details" style={{ marginBottom: 8 }}>
              <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 500 }}>{note.heading}</span>
                <span className="todo-created-at" style={{ marginLeft: "auto", flexShrink: 0 }}>
                  {formatDate(note.updatedAt)}
                </span>
              </summary>

              <div style={{ padding: "10px 4px 4px" }}>
                {editId === note.id ? (
                  <div className="todo-edit-form">
                    <input
                      className="add-task-input"
                      value={editHeading}
                      autoFocus
                      placeholder="Heading"
                      onChange={(e) => setEditHeading(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={editDesc}
                      rows={4}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                    <div className="todo-add-row">
                      <button
                        type="button"
                        className="button button-primary"
                        style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                        onClick={() => void handleSaveEdit()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {note.description && (
                      <div style={{ marginBottom: 10 }}>
                        <MarkdownRenderer content={note.description} />
                      </div>
                    )}
                    {!note.description && (
                      <p className="muted" style={{ fontSize: "0.82rem", marginBottom: 10 }}>No description.</p>
                    )}
                    <div className="todo-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                        onClick={() => startEdit(note)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button button-danger"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                        onClick={() => void handleDelete(note.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="todo-add-form">
        <div className="todo-add-row">
          <input
            className="add-task-input"
            placeholder="Note heading…"
            value={addHeading}
            onChange={(e) => setAddHeading(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
            style={{ flex: 1 }}
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
          rows={3}
          onChange={(e) => setAddDesc(e.target.value)}
        />
      </div>
    </div>
  );
}
