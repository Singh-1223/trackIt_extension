import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NotesList } from "../../components/NotesList";
import { useStoreContext } from "../../hooks/StoreContext";
import { generateId } from "../../lib/utils";
import { colors, fontSize, radius, shadow, spacing, TOP_PADDING } from "../../theme";
import type { Note } from "../../types/index";

export default function NotesScreen() {
  const { store, loading, save } = useStoreContext();
  const [showAdd, setShowAdd] = useState(false);
  const [heading, setHeading] = useState("");
  const [description, setDescription] = useState("");

  if (loading || !store) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Loading…</Text>
      </View>
    );
  }

  function handleAdd() {
    const h = heading.trim();
    if (!h) return;
    const newNote: Note = {
      id: generateId("note"),
      heading: h,
      description: description.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    save({ ...store!, notes: [...store!.notes, newNote] });
    setHeading(""); setDescription("");
    setShowAdd(false);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Notes</Text>
            <Text style={s.sub}>Save thoughts, references, and quick notes.</Text>
          </View>
          <TouchableOpacity style={s.addIconBtn} onPress={() => setShowAdd(true)}>
            <Text style={s.addIconText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>
      <NotesList
        notes={store.notes}
        onSave={(updated) => save({ ...store, notes: updated })}
        hideAddForm
      />
      <View style={{ height: spacing.xxl }} />

      {/* Add Note Modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Note</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)} accessibilityLabel="Close add note">
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.input} placeholder="Heading…" placeholderTextColor={colors.inkSoft} value={heading} onChangeText={setHeading} />
            <TextInput style={[s.input, s.textarea]} placeholder="Description (optional)" placeholderTextColor={colors.inkSoft} value={description} onChangeText={setDescription} multiline scrollEnabled />
            <TouchableOpacity style={s.btnPrimary} onPress={handleAdd}>
              <Text style={s.btnPrimaryText}>Add Note</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  addIconBtn: { backgroundColor: colors.accent, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  addIconText: { color: colors.white, fontSize: 22, fontWeight: "700", marginTop: -1 },
  muted: { fontSize: fontSize.sm, color: colors.inkSoft },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.lg },
  modalContent: { backgroundColor: colors.surfaceStrong, borderRadius: radius.lg, padding: spacing.lg, maxHeight: "100%", ...shadow },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  modalClose: { fontSize: 20, color: colors.inkSoft, padding: spacing.xs },
  input: { backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, fontSize: fontSize.base, color: colors.ink, marginBottom: spacing.sm },
  textarea: { minHeight: 160, maxHeight: 360, textAlignVertical: "top" },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing.sm + 2, alignItems: "center", marginTop: spacing.xs },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
});
