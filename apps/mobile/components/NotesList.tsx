import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { generateId } from "../lib/utils";
import { colors, fontSize, radius, spacing } from "../theme";
import type { Note, NoteGroup } from "../types/index";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface NotesListProps {
  notes: Note[];
  onSave: (updated: Note[]) => void;
  groups?: NoteGroup[];
  onGroupsSave?: (updated: NoteGroup[]) => void;
  hideAddForm?: boolean;
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}) {
  const [showView, setShowView] = useState(false);

  return (
    <View style={s.noteCard}>
      <TouchableOpacity style={s.noteHeader} onPress={() => setShowView(true)}>
        <Text style={s.noteHeading} numberOfLines={1}>
          {note.heading}
        </Text>
        <Text style={s.noteDate}>{formatDate(note.updatedAt)}</Text>
      </TouchableOpacity>

      {/* View Note Modal */}
      <Modal visible={showView} animationType="slide" transparent onRequestClose={() => setShowView(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { flex: 1, marginVertical: "5%" }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{note.heading}</Text>
              <TouchableOpacity onPress={() => setShowView(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }}>
              {note.description ? (
                <MarkdownRenderer content={note.description} selectable />
              ) : (
                <Text style={s.empty}>No description.</Text>
              )}
            </ScrollView>
            <View style={[s.actionRow, { marginTop: spacing.md }]}>
              <TouchableOpacity style={s.editBtn} onPress={() => { setShowView(false); onEdit(note); }}>
                <Text style={s.editBtnText}>✎ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.delBtn} onPress={() => { setShowView(false); onDelete(note.id); }}>
                <Text style={s.delBtnText}>🗑 Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NoteGroupAccordion({
  name,
  notes,
  onEdit,
  onDelete,
}: {
  name: string;
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.noteGroup}>
      <TouchableOpacity style={s.noteGroupHeader} onPress={() => setOpen((value) => !value)} activeOpacity={0.75}>
        <Text style={s.groupChevron}>{open ? "⌄" : "›"}</Text>
        <Text style={s.noteGroupName}>{name}</Text>
        <View style={s.noteGroupCount}><Text style={s.noteGroupCountText}>{notes.length}</Text></View>
      </TouchableOpacity>
      {open && (
        <View style={s.noteGroupBody}>
          {notes.length === 0 ? <Text style={s.groupEmpty}>No notes in this group yet.</Text> : notes.map((note) => (
            <NoteCard key={note.id} note={note} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </View>
      )}
    </View>
  );
}

export function NotesList({ notes, onSave, groups = [], hideAddForm = false }: NotesListProps) {
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  const orderedGroups = [...groups].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const [addHeading, setAddHeading] = useState("");
  const [addDesc, setAddDesc] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editHeading, setEditHeading] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  function startEdit(note: Note) {
    setEditId(note.id);
    setEditHeading(note.heading);
    setEditDesc(note.description);
    setEditGroupId(note.groupId ?? "");
  }

  function cancelEdit() {
    setEditId(null);
  }

  function handleAdd() {
    const heading = addHeading.trim();
    if (!heading) return;
    const note: Note = {
      id: generateId("note"),
      heading,
      description: addDesc.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSave([...notes, note]);
    setAddHeading("");
    setAddDesc("");
  }

  function handleSaveEdit() {
    if (!editId || !editHeading.trim()) return;
    onSave(
      notes.map((n) =>
        n.id === editId
          ? { ...n, heading: editHeading.trim(), description: editDesc.trim(), groupId: editGroupId || undefined, updatedAt: Date.now() }
          : n
      )
    );
    cancelEdit();
  }

  function handleDelete(id: string) {
    Alert.alert("Delete note", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onSave(notes.filter((n) => n.id !== id)) },
    ]);
  }

  return (
    <View>
      {sorted.length === 0 && <Text style={s.empty}>No notes yet. Add one below.</Text>}
      {orderedGroups.map((group) => (
        <NoteGroupAccordion
          key={group.id}
          name={group.name}
          notes={sorted.filter((note) => note.groupId === group.id)}
          onEdit={startEdit}
          onDelete={handleDelete}
        />
      ))}
      {(sorted.some((note) => !note.groupId) || orderedGroups.length === 0) && (
        <NoteGroupAccordion
          name="Unsorted"
          notes={sorted.filter((note) => !note.groupId)}
          onEdit={startEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Edit Note Modal */}
      <Modal visible={editId !== null} animationType="slide" transparent onRequestClose={cancelEdit}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Note</Text>
              <TouchableOpacity onPress={cancelEdit} accessibilityLabel="Close edit note">
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.input} value={editHeading} onChangeText={setEditHeading} placeholder="Heading" placeholderTextColor={colors.inkSoft} autoFocus />
            <Text style={s.groupLabel}>Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupPicker}>
              <TouchableOpacity style={[s.groupChip, !editGroupId && s.groupChipActive]} onPress={() => setEditGroupId("")}><Text style={[s.groupChipText, !editGroupId && s.groupChipTextActive]}>Unsorted</Text></TouchableOpacity>
              {groups.map((group) => <TouchableOpacity key={group.id} style={[s.groupChip, editGroupId === group.id && s.groupChipActive]} onPress={() => setEditGroupId(group.id)}><Text style={[s.groupChipText, editGroupId === group.id && s.groupChipTextActive]}>{group.name}</Text></TouchableOpacity>)}
            </ScrollView>
            <TextInput style={[s.input, s.textarea]} value={editDesc} onChangeText={setEditDesc} placeholder="Description (optional)" placeholderTextColor={colors.inkSoft} multiline scrollEnabled />
            <TouchableOpacity style={s.primaryBtn} onPress={handleSaveEdit}>
              <Text style={s.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {!hideAddForm && (
        <View style={s.addForm}>
          <TextInput
            style={s.input}
            placeholder="Note heading…"
            placeholderTextColor={colors.inkSoft}
            value={addHeading}
            onChangeText={setAddHeading}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TextInput
            style={[s.input, s.textarea]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.inkSoft}
            value={addDesc}
            onChangeText={setAddDesc}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity style={s.primaryBtn} onPress={handleAdd}>
            <Text style={s.primaryBtnText}>Add Note</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: fontSize.sm, color: colors.inkSoft, marginBottom: spacing.sm },
  noteGroup: { backgroundColor: colors.surfaceStrong, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, overflow: "hidden" },
  noteGroupHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.xs },
  groupChevron: { width: 16, fontSize: 22, lineHeight: 20, color: colors.inkSoft, textAlign: "center" },
  noteGroupName: { flex: 1, fontSize: fontSize.base, fontWeight: "800", color: colors.ink },
  noteGroupCount: { minWidth: 24, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: colors.bg, alignItems: "center" },
  noteGroupCountText: { color: colors.inkSoft, fontWeight: "700", fontSize: fontSize.xs },
  noteGroupBody: { padding: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  groupEmpty: { color: colors.inkSoft, fontSize: fontSize.sm, paddingTop: spacing.sm },
  noteCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm + 2,
    gap: spacing.xs,
  },
  noteChevron: { fontSize: 13, color: colors.inkSoft, width: 14 },
  noteHeading: { flex: 1, fontSize: fontSize.base, fontWeight: "600", color: colors.ink },
  noteDate: { fontSize: fontSize.xs, color: colors.inkSoft, flexShrink: 0 },
  noteBody: { padding: spacing.sm, paddingTop: 0, borderTopWidth: 1, borderTopColor: colors.border },
  noteDesc: { fontSize: fontSize.base, color: colors.ink, lineHeight: 22, paddingVertical: spacing.xs },
  actionRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  editBtn: { backgroundColor: colors.border, borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  editBtnText: { fontSize: fontSize.xs, color: colors.ink, fontWeight: "600" },
  delBtn: { backgroundColor: colors.dangerBg, borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  delBtnText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: "600" },
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
  textarea: { minHeight: 160, maxHeight: 360, textAlignVertical: "top" },
  groupLabel: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "700", marginBottom: spacing.xs },
  groupPicker: { marginBottom: spacing.sm },
  groupChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: spacing.sm, paddingVertical: 6, marginRight: spacing.xs },
  groupChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  groupChipText: { color: colors.inkSoft, fontSize: fontSize.xs, fontWeight: "700" },
  groupChipTextActive: { color: colors.white },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  saveBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: "700" },
  cancelBtn: { backgroundColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  cancelBtnText: { color: colors.inkSoft, fontSize: fontSize.sm },
  addForm: { marginTop: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.lg },
  modalContent: { backgroundColor: colors.surfaceStrong, borderRadius: radius.lg, padding: spacing.lg, maxHeight: "100%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  modalClose: { fontSize: 20, color: colors.inkSoft, padding: spacing.xs },
});
