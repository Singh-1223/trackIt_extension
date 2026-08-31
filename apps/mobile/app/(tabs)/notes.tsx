import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NotesList } from "../../components/NotesList";
import { useStoreContext } from "../../hooks/StoreContext";
import { generateId } from "../../lib/utils";
import { colors, fontSize, radius, shadow, spacing, TOP_PADDING } from "../../theme";
import type { Note, NoteGroup } from "../../types/index";

export default function NotesScreen() {
  const { store, loading, save } = useStoreContext();
  const [showAdd, setShowAdd] = useState(false);
  const [heading, setHeading] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState("");
  const [showGroups, setShowGroups] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameGroupName, setRenameGroupName] = useState("");

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
      groupId: groupId || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    save({ ...store!, notes: [...store!.notes, newNote] });
    setHeading(""); setDescription(""); setGroupId("");
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
          <View style={s.headerActions}><TouchableOpacity style={s.groupIconBtn} onPress={() => setShowGroups(true)}><Text style={s.groupIconText}>☷</Text></TouchableOpacity><TouchableOpacity style={s.addIconBtn} onPress={() => setShowAdd(true)}>
            <Text style={s.addIconText}>＋</Text>
          </TouchableOpacity></View>
        </View>
      </View>
      <NotesList
        notes={store.notes}
        groups={store.noteGroups ?? []}
        onSave={(updated) => save({ ...store, notes: updated })}
        onGroupsSave={(updated) => save({ ...store, noteGroups: updated })}
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
            <GroupPicker groups={store.noteGroups ?? []} value={groupId} onChange={setGroupId} />
            <TextInput style={[s.input, s.textarea]} placeholder="Description (optional)" placeholderTextColor={colors.inkSoft} value={description} onChangeText={setDescription} multiline scrollEnabled />
            <TouchableOpacity style={s.btnPrimary} onPress={handleAdd}>
              <Text style={s.btnPrimaryText}>Add Note</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={showGroups} animationType="slide" transparent onRequestClose={() => setShowGroups(false)}><View style={s.modalOverlay}><View style={s.modalContent}><View style={s.modalHeader}><Text style={s.modalTitle}>Note groups</Text><TouchableOpacity onPress={() => setShowGroups(false)}><Text style={s.modalClose}>✕</Text></TouchableOpacity></View><View style={s.groupAddRow}><TextInput style={[s.input, { flex: 1 }]} placeholder="New group…" placeholderTextColor={colors.inkSoft} value={groupName} onChangeText={setGroupName} /><TouchableOpacity style={s.smallPrimary} onPress={() => { const name = groupName.trim(); if (!name) return; const group: NoteGroup = { id: generateId("ngrp"), name, order: (store.noteGroups ?? []).length }; save({ ...store, noteGroups: [...(store.noteGroups ?? []), group] }); setGroupName(""); }}><Text style={s.smallPrimaryText}>Add</Text></TouchableOpacity></View><ScrollView>{(store.noteGroups ?? []).map((group) => <View key={group.id} style={s.groupRow}>{renamingGroupId === group.id ? <><TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={renameGroupName} onChangeText={setRenameGroupName} autoFocus /><TouchableOpacity onPress={() => { const name = renameGroupName.trim(); if (!name) return; save({ ...store, noteGroups: (store.noteGroups ?? []).map((item) => item.id === group.id ? { ...item, name } : item) }); setRenamingGroupId(null); }}><Text style={s.groupRename}>Save</Text></TouchableOpacity><TouchableOpacity onPress={() => setRenamingGroupId(null)}><Text style={s.groupDelete}>Cancel</Text></TouchableOpacity></> : <><Text style={s.groupRowText}>{group.name}</Text><View style={s.groupActions}><TouchableOpacity accessibilityLabel={`Rename ${group.name}`} style={s.groupActionIcon} onPress={() => { setRenamingGroupId(group.id); setRenameGroupName(group.name); }}><Text style={s.groupRename}>✎</Text></TouchableOpacity><TouchableOpacity accessibilityLabel={`Delete ${group.name}`} style={s.groupActionIcon} onPress={() => Alert.alert("Delete note group", `Delete “${group.name}”? Its notes will move to Unsorted.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => save({ ...store, notes: store.notes.map((note) => note.groupId === group.id ? { ...note, groupId: undefined } : note), noteGroups: (store.noteGroups ?? []).filter((item) => item.id !== group.id) }) }])}><Text style={s.groupDelete}>🗑</Text></TouchableOpacity></View></>}</View>)}</ScrollView></View></View></Modal>
    </ScrollView>
  );
}

function GroupPicker({ groups, value, onChange }: { groups: NoteGroup[]; value: string; onChange: (value: string) => void }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupPicker}><TouchableOpacity style={[s.groupChip, !value && s.groupChipActive]} onPress={() => onChange("")}><Text style={[s.groupChipText, !value && s.groupChipTextActive]}>Unsorted</Text></TouchableOpacity>{groups.map((group) => <TouchableOpacity key={group.id} style={[s.groupChip, value === group.id && s.groupChipActive]} onPress={() => onChange(group.id)}><Text style={[s.groupChipText, value === group.id && s.groupChipTextActive]}>{group.name}</Text></TouchableOpacity>)}</ScrollView>; }

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
  headerActions: { flexDirection: "row", gap: spacing.sm },
  groupIconBtn: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }, groupIconText: { color: colors.accentStrong, fontSize: 20 },
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
  groupPicker: { marginBottom: spacing.sm }, groupChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: spacing.sm, paddingVertical: 6, marginRight: spacing.xs }, groupChipActive: { backgroundColor: colors.accent, borderColor: colors.accent }, groupChipText: { color: colors.inkSoft, fontSize: fontSize.xs, fontWeight: "700" }, groupChipTextActive: { color: colors.white }, groupAddRow: { flexDirection: "row", gap: spacing.xs }, smallPrimary: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, height: 42 }, smallPrimaryText: { color: colors.white, fontWeight: "700" }, groupRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, groupRowText: { color: colors.ink, fontSize: fontSize.base, flex: 1 }, groupActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, groupActionIcon: { padding: spacing.xs }, groupRename: { color: colors.accentStrong, fontWeight: "700", fontSize: 18 }, groupDelete: { color: colors.danger, fontWeight: "700", fontSize: 16 },
  textarea: { minHeight: 160, maxHeight: 360, textAlignVertical: "top" },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing.sm + 2, alignItems: "center", marginTop: spacing.xs },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
});
