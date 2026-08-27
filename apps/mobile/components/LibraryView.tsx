import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { generateId } from "../lib/utils";
import { colors, fontSize, radius, spacing } from "../theme";
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

const STATUS_DOT_COLOR: Record<BookStatus, string> = {
  reading: colors.accent,
  toread: colors.inkSoft,
  completed: colors.success,
};

// ── NoteRow ──────────────────────────────────────────────────────────────────

function NoteRow({
  note,
  compact,
  bookTitle,
  onSave,
  onDelete,
}: {
  note: BookNote;
  compact: boolean;
  bookTitle: string;
  onSave: (updated: BookNote) => void;
  onDelete: (id: string) => void;
}) {
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editText, setEditText] = useState(note.text);

  const preview = note.text.length > 80 ? note.text.slice(0, 80).trimEnd() + "…" : note.text;

  function saveEdit() {
    const trimmed = editText.trim();
    if (!trimmed) return;
    onSave({ ...note, text: trimmed });
    setShowEditModal(false);
  }

  return (
    <View style={s.noteCard}>
      <TouchableOpacity
        style={s.noteSummary}
        onPress={() => setShowViewModal(true)}
        activeOpacity={0.75}
      >
        <Text style={s.notePreview} numberOfLines={1}>{preview}</Text>
        {!compact && (
          <View style={s.noteActions}>
            <TouchableOpacity
              style={s.noteActionBtn}
              onPress={() => { setEditText(note.text); setShowEditModal(true); }}
            >
              <Text style={s.noteActionText}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.noteActionBtn}
              onPress={() => onDelete(note.id)}
            >
              <Text style={[s.noteActionText, { color: colors.danger }]}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {/* View Note Modal */}
      <Modal visible={showViewModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { flex: 1, marginVertical: "5%" }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { flex: 1 }]} numberOfLines={1}>{bookTitle}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                {!compact && (
                  <TouchableOpacity onPress={() => { setShowViewModal(false); setEditText(note.text); setShowEditModal(true); }} style={{ padding: spacing.xs }}>
                    <Text style={{ fontSize: 18, color: colors.ink }}>✎</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowViewModal(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }}>
              <MarkdownRenderer content={note.text} selectable />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Note Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Note</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.modalInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholderTextColor={colors.inkSoft}
            />
            <TouchableOpacity style={s.btnPrimary} onPress={saveEdit}>
              <Text style={s.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── BookCard ─────────────────────────────────────────────────────────────────

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
  const [open, setOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState(book.title);
  const [editAuthor, setEditAuthor] = useState(book.author);
  const [editDesc, setEditDesc] = useState(book.description);
  const [editStatus, setEditStatus] = useState<BookStatus>(book.status);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState("");

  function saveBookEdit() {
    const t = editTitle.trim();
    if (!t) return;
    onSave({ ...book, title: t, author: editAuthor.trim(), description: editDesc.trim(), status: editStatus, updatedAt: Date.now() });
    setShowEditModal(false);
  }

  function openEditModal() {
    setEditTitle(book.title);
    setEditAuthor(book.author);
    setEditDesc(book.description);
    setEditStatus(book.status);
    setShowEditModal(true);
  }

  function addNote() {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    const newNote: BookNote = { id: generateId("bnote"), text: trimmed, createdAt: Date.now() };
    onSave({ ...book, notes: [...book.notes, newNote], updatedAt: Date.now() });
    setNoteText("");
  }

  function saveNote(updated: BookNote) {
    onSave({ ...book, notes: book.notes.map((n) => n.id === updated.id ? updated : n), updatedAt: Date.now() });
  }

  function deleteNote(noteId: string) {
    Alert.alert("Delete note", "Delete this note?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () =>
        onSave({ ...book, notes: book.notes.filter((n) => n.id !== noteId), updatedAt: Date.now() })
      },
    ]);
  }

  function handleDelete() {
    Alert.alert("Delete book", "Delete this book and all its notes?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(book.id) },
    ]);
  }

  return (
    <View style={s.bookCard}>
      {/* Header row — always visible */}
      <TouchableOpacity style={s.bookSummary} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <View style={[s.statusDot, { backgroundColor: STATUS_DOT_COLOR[book.status] }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.bookTitle}>{book.title}</Text>
          {book.author ? <Text style={s.bookAuthor}>by {book.author}</Text> : null}
        </View>
        <View style={s.bookSummaryRight}>
          <Text style={s.noteBadge}>{book.notes.length} note{book.notes.length === 1 ? "" : "s"}</Text>
          <Text style={s.chevron}>{open ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {/* Expanded body */}
      {open && (
        <View style={s.bookBody}>
          {book.description ? <Text selectable style={s.bookDesc}>{book.description}</Text> : null}
          {!compact && (
            <View style={s.bookMeta}>
              <View style={[s.statusDot, { backgroundColor: STATUS_DOT_COLOR[book.status] }]} />
              <Text style={s.bookStatusText}>{STATUS_LABELS[book.status]}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={s.btnSecondarySmall} onPress={openEditModal}>
                <Text style={s.btnSecondarySmallText}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnDangerSmall} onPress={handleDelete}>
                <Text style={s.btnDangerSmallText}>🗑</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Notes */}
          <View style={s.notesSection}>
            <View style={s.notesSectionHeader}>
              <Text style={s.sectionLabel}>Notes ({book.notes.length})</Text>
              {!compact && (
                <TouchableOpacity style={s.addNoteBtn} onPress={() => setShowAddNote(true)}>
                  <Text style={s.addNoteBtnText}>＋ Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {book.notes.length === 0 && (
              <Text style={s.emptyText}>No notes yet.{!compact ? " Tap + Add to start." : ""}</Text>
            )}
            {book.notes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                compact={compact}
                bookTitle={book.title}
                onSave={saveNote}
                onDelete={deleteNote}
              />
            ))}
          </View>

          {/* Add Note Modal */}
          <Modal visible={showAddNote} animationType="slide" transparent>
            <View style={s.modalOverlay}>
              <View style={s.modalContent}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Add Note</Text>
                  <TouchableOpacity onPress={() => setShowAddNote(false)}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={s.modalInput}
                  placeholder="Write a note or learning…"
                  placeholderTextColor={colors.inkSoft}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  autoFocus
                />
                <TouchableOpacity style={s.btnPrimary} onPress={() => { addNote(); setShowAddNote(false); }}>
                  <Text style={s.btnPrimaryText}>Add Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Edit Book Modal */}
          <Modal visible={showEditModal} animationType="slide" transparent>
            <View style={s.modalOverlay}>
              <View style={s.modalContent}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Edit Book</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <TextInput style={s.input} placeholder="Title" placeholderTextColor={colors.inkSoft} value={editTitle} onChangeText={setEditTitle} />
                <TextInput style={s.input} placeholder="Author" placeholderTextColor={colors.inkSoft} value={editAuthor} onChangeText={setEditAuthor} />
                <TextInput style={[s.input, { minHeight: 60 }]} placeholder="Description" placeholderTextColor={colors.inkSoft} value={editDesc} onChangeText={setEditDesc} multiline />
                <View style={s.statusPicker}>
                  {STATUS_ORDER.map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[s.statusChip, editStatus === st && s.statusChipActive]}
                      onPress={() => setEditStatus(st)}
                    >
                      <Text style={[s.statusChipText, editStatus === st && s.statusChipTextActive]}>
                        {STATUS_LABELS[st]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.btnPrimary} onPress={saveBookEdit}>
                  <Text style={s.btnPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}

// ── LibraryView ───────────────────────────────────────────────────────────────

export function LibraryView({ store, onSave, compact = false }: LibraryViewProps) {
  const books = [...(store.books ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);
  const currentlyReading = books.filter((b) => b.status === "reading");

  function handleBookSave(updated: Book) {
    onSave({ ...store, books: (store.books ?? []).map((b) => b.id === updated.id ? updated : b) });
  }

  function handleDelete(bookId: string) {
    onSave({ ...store, books: (store.books ?? []).filter((b) => b.id !== bookId) });
  }

  // Compact: only currently-reading books, no add form
  if (compact) {
    if (currentlyReading.length === 0) {
      return <Text style={s.emptyText}>No books currently reading.</Text>;
    }
    return (
      <View>
        {currentlyReading.map((book) => (
          <BookCard key={book.id} book={book} compact={true} onSave={handleBookSave} onDelete={handleDelete} />
        ))}
      </View>
    );
  }

  return (
    <View>
      {/* Shelves */}
      {books.length === 0 ? (
        <Text style={s.emptyText}>No books yet. Tap + to add one.</Text>
      ) : (
        STATUS_ORDER.map((st) => {
          const shelf = books.filter((b) => b.status === st);
          if (shelf.length === 0) return null;
          return (
            <View key={st} style={s.shelf}>
              <View style={s.shelfHeader}>
                <Text style={s.shelfLabel}>{STATUS_LABELS[st]}</Text>
                <View style={s.shelfBadge}>
                  <Text style={s.shelfBadgeText}>{shelf.length}</Text>
                </View>
              </View>
              {shelf.map((book) => (
                <BookCard key={book.id} book={book} compact={false} onSave={handleBookSave} onDelete={handleDelete} />
              ))}
            </View>
          );
        })
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Add form
  addForm: { marginBottom: spacing.lg },
  addFormRow: { flexDirection: "row", gap: spacing.xs },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: fontSize.base,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  statusPicker: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xs },
  statusChip: {
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  statusChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  statusChipText: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "600" },
  statusChipTextActive: { color: colors.white },
  errorText: { fontSize: fontSize.xs, color: colors.danger, marginBottom: spacing.xs },

  // Shelf
  shelf: { marginBottom: spacing.lg },
  shelfHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  shelfLabel: { fontSize: fontSize.xs, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 },
  shelfBadge: { backgroundColor: colors.border, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 1 },
  shelfBadgeText: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "700" },

  // Book card
  bookCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  bookSummary: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  bookSummaryRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  statusDot: { width: 9, height: 9, borderRadius: 99, flexShrink: 0 },
  bookTitle: { fontSize: fontSize.md, fontWeight: "800", color: colors.ink },
  bookAuthor: { fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 2 },
  noteBadge: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "600" },
  chevron: { fontSize: fontSize.xs, color: colors.inkSoft },

  // Book body
  bookBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
  bookDesc: { fontSize: fontSize.sm, color: colors.inkSoft, lineHeight: 20, marginBottom: spacing.sm },
  bookMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  bookStatusText: { fontSize: fontSize.xs, color: colors.inkSoft },

  // Book edit form
  bookEditForm: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  editActions: { flexDirection: "row", gap: spacing.xs },

  // Notes section
  notesSection: { gap: spacing.xs },
  notesSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 },
  addNoteBtn: { backgroundColor: colors.accent, borderRadius: radius.xs, paddingVertical: 4, paddingHorizontal: spacing.sm },
  addNoteBtnText: { color: colors.white, fontSize: fontSize.xs, fontWeight: "700" },
  emptyText: { fontSize: fontSize.sm, color: colors.inkSoft, marginTop: spacing.xs },
  noteAddForm: { gap: spacing.xs, marginTop: spacing.xs },

  // Note card
  noteCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  noteSummary: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.sm },
  noteChevron: { fontSize: 9, color: colors.inkSoft },
  notePreview: { flex: 1, fontSize: fontSize.sm, color: colors.ink },
  noteActions: { flexDirection: "row", gap: 2 },
  noteActionBtn: { padding: 4 },
  noteActionText: { fontSize: fontSize.sm, color: colors.inkSoft },
  noteBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.sm },
  noteFullText: { fontSize: fontSize.base, color: colors.ink, lineHeight: 22 },
  noteEditInput: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.ink,
    minHeight: 80,
    marginBottom: spacing.xs,
  },
  noteEditActions: { flexDirection: "row", gap: spacing.xs, justifyContent: "flex-end" },

  // Buttons
  btnPrimary: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  btnSecondary: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  btnSecondaryText: { color: colors.ink, fontWeight: "600", fontSize: fontSize.sm },
  btnSecondarySmall: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  btnSecondarySmallText: { color: colors.ink, fontSize: fontSize.xs, fontWeight: "600" },
  btnDangerSmall: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  btnDangerSmallText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: "600" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  modalClose: { fontSize: 20, color: colors.inkSoft, padding: spacing.xs },
  modalInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: fontSize.base,
    color: colors.ink,
    minHeight: 120,
    marginBottom: spacing.sm,
    textAlignVertical: "top",
  },
});
