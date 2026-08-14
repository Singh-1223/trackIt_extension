import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LibraryView } from "../../components/LibraryView";
import { useStoreContext } from "../../hooks/StoreContext";
import { generateId } from "../../lib/utils";
import { colors, fontSize, radius, shadow, spacing, TOP_PADDING } from "../../theme";
import type { Book, BookStatus } from "../../types/index";

const STATUS_LABELS: Record<BookStatus, string> = {
  reading: "Currently Reading",
  toread: "To Read",
  completed: "Completed",
};
const STATUS_ORDER: BookStatus[] = ["reading", "toread", "completed"];

export default function LibraryScreen() {
  const { store, loading, save } = useStoreContext();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<BookStatus>("toread");
  const [formError, setFormError] = useState("");

  if (loading || !store) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Loading…</Text>
      </View>
    );
  }

  function handleAdd() {
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
    save({ ...store!, books: [newBook, ...(store!.books ?? [])] });
    setTitle("");
    setAuthor("");
    setDescription("");
    setStatus("toread");
    setFormError("");
    setShowAdd(false);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Library</Text>
            <Text style={s.sub}>Track books, keep notes and learnings.</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={s.addBtnText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>
      <LibraryView store={store} onSave={save} />
      <View style={{ height: spacing.xxl }} />

      {/* Add Book Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Book</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.input}
              placeholder="Book title…"
              placeholderTextColor={colors.inkSoft}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={s.input}
              placeholder="Author"
              placeholderTextColor={colors.inkSoft}
              value={author}
              onChangeText={setAuthor}
            />
            <TextInput
              style={[s.input, { minHeight: 70 }]}
              placeholder="Short description (optional)"
              placeholderTextColor={colors.inkSoft}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <View style={s.statusPicker}>
              {STATUS_ORDER.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[s.statusChip, status === st && s.statusChipActive]}
                  onPress={() => setStatus(st)}
                >
                  <Text style={[s.statusChipText, status === st && s.statusChipTextActive]}>
                    {STATUS_LABELS[st]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {formError ? <Text style={s.errorText}>{formError}</Text> : null}
            <TouchableOpacity style={s.btnPrimary} onPress={handleAdd}>
              <Text style={s.btnPrimaryText}>Add Book</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: TOP_PADDING },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  sub: { fontSize: fontSize.sm, color: colors.inkSoft },
  addBtn: {
    backgroundColor: colors.accent,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: colors.white, fontSize: 22, fontWeight: "700", marginTop: -1 },
  muted: { fontSize: fontSize.sm, color: colors.inkSoft },

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
    ...shadow,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  modalClose: { fontSize: 20, color: colors.inkSoft, padding: spacing.xs },

  // Form
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: fontSize.base,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  statusPicker: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  statusChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  statusChipText: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "600" },
  statusChipTextActive: { color: colors.white },
  errorText: { fontSize: fontSize.xs, color: colors.danger, marginBottom: spacing.xs },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
});
