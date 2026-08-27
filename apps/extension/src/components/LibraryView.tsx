import { useState } from "react";
import { generateId } from "../lib/utils";
import type { Book, BookNote, BookStatus, TrackItStore } from "../types/index";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface LibraryViewProps {
  store: TrackItStore;
  onSave: (updated: TrackItStore) => void;
  compact?: boolean;
}

const STATUS_LABELS: Record<BookStatus, string> = {
  reading: "Currently Reading",
  toread: "To Read",
  completed: "Completed",
};

const STATUS_ORDER: BookStatus[] = ["reading", "toread", "completed"];

const STATUS_DOT: Record<BookStatus, string> = {
  reading: "lib-dot--reading",
  toread: "lib-dot--toread",
  completed: "lib-dot--completed",
};

function NoteRow({
  note,
  onSave,
  onDelete,
}: {
  note: BookNote;
  onSave: (updated: BookNote) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);

  function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave({ ...note, text: trimmed });
    setEditing(false);
  }

  function cancel() {
    setText(note.text);
    setEditing(false);
  }

  const preview = note.text.length > 80 ? note.text.slice(0, 80).trimEnd() + "…" : note.text;

  return (
    <details className="lib-note-details">
      <summary className="lib-note-summary">
        <span className="buildup-habit-chevron" aria-hidden="true" />
        <span className="lib-note-preview">{preview}</span>
        <div className="lib-note-actions">
          <button type="button" className="lib-note-action" title="Edit note"
            onClick={(e) => { e.preventDefault(); setEditing((v) => !v); }}>✎</button>
          <button type="button" className="lib-note-action lib-note-action--del" title="Delete note"
            onClick={(e) => { e.preventDefault(); onDelete(note.id); }}>✕</button>
        </div>
      </summary>

      <div className="lib-note-body">
        {editing ? (
          <>
            <textarea
              className="lib-note-input"
              value={text}
              rows={4}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
                if (e.key === "Escape") cancel();
              }}
            />
            <div className="lib-note-edit-actions">
              <button type="button" className="button button-primary" style={{ fontSize: "0.78rem", padding: "5px 14px" }} onClick={save}>Save</button>
              <button type="button" className="button button-secondary" style={{ fontSize: "0.78rem", padding: "5px 14px" }} onClick={cancel}>Cancel</button>
            </div>
          </>
        ) : (
          <p className="lib-note-full"><MarkdownRenderer content={note.text} /></p>
        )}
      </div>
    </details>
  );
}

function BookCard({
  book,
  compact,
  onSave,
  onDelete,
}: {
  book: Book;
  compact: boolean;
  onSave: (updated: Book) => void;
  onDelete: (id: string) => void;
}) {
  const [noteText, setNoteText] = useState("");
  const [editingBook, setEditingBook] = useState(false);
  const [editTitle, setEditTitle] = useState(book.title);
  const [editAuthor, setEditAuthor] = useState(book.author);
  const [editDesc, setEditDesc] = useState(book.description);
  const [editStatus, setEditStatus] = useState<BookStatus>(book.status);

  function addNote() {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    const newNote: BookNote = { id: generateId("bnote"), text: trimmed, createdAt: Date.now() };
    onSave({ ...book, notes: [...book.notes, newNote], updatedAt: Date.now() });
    setNoteText("");
  }

  function saveBookEdit() {
    const t = editTitle.trim();
    if (!t) return;
    onSave({ ...book, title: t, author: editAuthor.trim(), description: editDesc.trim(), status: editStatus, updatedAt: Date.now() });
    setEditingBook(false);
  }

  function cancelBookEdit() {
    setEditTitle(book.title);
    setEditAuthor(book.author);
    setEditDesc(book.description);
    setEditStatus(book.status);
    setEditingBook(false);
  }

  function saveNote(updated: BookNote) {
    onSave({ ...book, notes: book.notes.map((n) => n.id === updated.id ? updated : n), updatedAt: Date.now() });
  }

  function deleteNote(noteId: string) {
    onSave({ ...book, notes: book.notes.filter((n) => n.id !== noteId), updatedAt: Date.now() });
  }

  return (
    <details className="lib-book">
      <summary className="lib-book-summary">
        <span className="buildup-habit-chevron" aria-hidden="true" />
        <div className="lib-book-summary-content">
          <div className="lib-book-title-row">
            <span className={`lib-dot ${STATUS_DOT[book.status]}`} />
            <span className="lib-book-title">{book.title}</span>
            {book.author && <span className="lib-book-author">by {book.author}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="lib-book-notebadge">{book.notes.length} note{book.notes.length === 1 ? "" : "s"}</span>
            {!compact && (
              <>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                  onClick={(e) => { e.preventDefault(); setEditingBook((v) => !v); }}
                >
                  {editingBook ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                  onClick={(e) => { e.preventDefault(); onDelete(book.id); }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </summary>

      <div className="lib-book-body">
        {editingBook && !compact ? (
          <div className="lib-book-edit-form">
            <input
              className="add-task-input"
              placeholder="Book title…"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <input
              className="add-task-input"
              placeholder="Author"
              value={editAuthor}
              onChange={(e) => setEditAuthor(e.target.value)}
            />
            <textarea
              className="lib-desc-input"
              placeholder="Description"
              value={editDesc}
              rows={2}
              onChange={(e) => setEditDesc(e.target.value)}
            />
            <div className="lib-status-picker" style={{ marginBottom: 8 }}>
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`button ${s === editStatus ? "button-primary" : "button-secondary"}`}
                  style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  onClick={() => setEditStatus(s)}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="button button-primary" style={{ fontSize: "0.82rem", padding: "6px 16px" }} onClick={saveBookEdit}>Save</button>
              <button type="button" className="button button-secondary" style={{ fontSize: "0.82rem", padding: "6px 16px" }} onClick={cancelBookEdit}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {book.description && <p className="lib-book-desc">{book.description}</p>}
            {!compact && (
              <div className="lib-book-status-row">
                <span className="lib-label">Status:</span>
                <span className={`lib-dot ${STATUS_DOT[book.status]}`} style={{ marginRight: 4 }} />
                <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>{STATUS_LABELS[book.status]}</span>
              </div>
            )}
          </>
        )}

        <div className="lib-notes">
          <p className="lib-label">Notes ({book.notes.length})</p>
          {book.notes.length === 0 && (
            <p className="lib-empty-notes">No notes yet.{!compact ? " Add your first learning below." : ""}</p>
          )}
          {book.notes.map((note) =>
            compact ? (
              <div key={note.id} className="lib-note">
                <MarkdownRenderer content={note.text} />
              </div>
            ) : (
              <NoteRow key={note.id} note={note} onSave={saveNote} onDelete={deleteNote} />
            )
          )}

          {!compact && (
            <div className="lib-note-form">
              <textarea
                className="lib-note-input"
                placeholder="Add a note or learning… (Cmd+Enter to save)"
                value={noteText}
                rows={2}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
              />
              <button
                type="button"
                className="button button-primary"
                style={{ alignSelf: "flex-end", fontSize: "0.82rem", padding: "7px 16px" }}
                onClick={addNote}
              >
                Add Note
              </button>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

export function LibraryView({ store, onSave, compact = false }: LibraryViewProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<BookStatus>("toread");
  const [formError, setFormError] = useState("");

  const books = [...(store.books ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);

  function handleAddBook() {
    const t = title.trim();
    if (!t) { setFormError("Book title is required."); return; }
    const newBook: Book = {
      id: generateId("book"),
      title: t,
      author: author.trim(),
      description: description.trim(),
      status,
      notes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSave({ ...store, books: [newBook, ...(store.books ?? [])] });
    setTitle("");
    setAuthor("");
    setDescription("");
    setStatus("toread");
    setFormError("");
  }

  function handleBookSave(updated: Book) {
    onSave({ ...store, books: (store.books ?? []).map((b) => b.id === updated.id ? updated : b) });
  }

  function handleDelete(bookId: string) {
    if (!window.confirm("Delete this book and all its notes?")) return;
    onSave({ ...store, books: (store.books ?? []).filter((b) => b.id !== bookId) });
  }

  const currentlyReading = books.filter((b) => b.status === "reading");

  if (compact) {
    if (currentlyReading.length === 0) {
      return <div className="empty" style={{ marginTop: 12 }}>No books currently reading.</div>;
    }
    return (
      <div className="lib-wrap lib-wrap--compact">
        {currentlyReading.map((book) => (
          <BookCard key={book.id} book={book} compact={true} onSave={handleBookSave} onDelete={handleDelete} />
        ))}
      </div>
    );
  }

  return (
    <div className="lib-wrap">
      <div className="lib-add-form">
        <div className="lib-form-row">
          <input
            className="add-task-input"
            placeholder="Book title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddBook(); }}
            style={{ flex: 2 }}
          />
          <input
            className="add-task-input"
            placeholder="Author (optional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <textarea
          className="lib-desc-input"
          placeholder="Short description (optional)"
          value={description}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="lib-form-bottom">
          <div className="lib-status-picker">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                className={`button ${s === status ? "button-primary" : "button-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "6px 14px" }}
                onClick={() => setStatus(s)}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="button button-primary"
            style={{ padding: "9px 20px", fontSize: "0.88rem" }}
            onClick={handleAddBook}
          >
            Add Book
          </button>
        </div>
        {formError && <p className="message message-error" style={{ margin: "4px 0 0" }}>{formError}</p>}
      </div>

      {books.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>No books yet. Add one above.</div>
      ) : (
        STATUS_ORDER.map((s) => {
          const shelf = books.filter((b) => b.status === s);
          if (shelf.length === 0) return null;
          return (
            <div key={s} className="lib-shelf">
              <p className="lib-shelf-label">{STATUS_LABELS[s]} <span className="lib-shelf-count">{shelf.length}</span></p>
              <div className="lib-book-list">
                {shelf.map((book) => (
                  <BookCard key={book.id} book={book} compact={false} onSave={handleBookSave} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
