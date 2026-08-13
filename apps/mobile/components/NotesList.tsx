import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { generateId } from "../lib/utils";
import { colors, fontSize, radius, spacing } from "../theme";
import type { Note } from "../types/index";

interface NotesListProps {
  notes: Note[];
  onSave: (updated: Note[]) => void;
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

export function NotesList({ notes, onSave }: NotesListProps) {
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);

  const [addHeading, setAddHeading] = useState("");
  const [addDesc, setAddDesc] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editHeading, setEditHeading] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startEdit(note: Note) {
    setEditId(note.id);
    setEditHeading(note.heading);
    setEditDesc(note.description);
    setExpandedIds((prev) => new Set([...prev, note.id]));
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
          ? { ...n, heading: editHeading.trim(), description: editDesc.trim(), updatedAt: Date.now() }
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
      {sorted.length === 0 && (
        <Text style={s.empty}>No notes yet. Add one below.</Text>
      )}

      {sorted.map((note) => {
        const isExpanded = expandedIds.has(note.id);
        const isEditing = editId === note.id;

        return (
          <View key={note.id} style={s.noteCard}>
            <TouchableOpacity style={s.noteHeader} onPress={() => toggleExpanded(note.id)}>
              <Text style={s.noteChevron}>{isExpanded ? "▾" : "▸"}</Text>
              <Text style={s.noteHeading} numberOfLines={isExpanded ? undefined : 1}>
                {note.heading}
              </Text>
              <Text style={s.noteDate}>{formatDate(note.updatedAt)}</Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={s.noteBody}>
                {isEditing ? (
                  <View>
                    <TextInput
                      style={s.input}
                      value={editHeading}
                      onChangeText={setEditHeading}
                      placeholder="Heading"
                      placeholderTextColor={colors.inkSoft}
                      autoFocus
                    />
                    <TextInput
                      style={[s.input, s.textarea]}
                      value={editDesc}
                      onChangeText={setEditDesc}
                      placeholder="Description (optional)"
                      placeholderTextColor={colors.inkSoft}
                      multiline
                      numberOfLines={4}
                    />
                    <View style={s.actionRow}>
                      <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit}>
                        <Text style={s.saveBtnText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.cancelBtn} onPress={cancelEdit}>
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View>
                    {note.description ? (
                      <Text style={s.noteDesc}>{note.description}</Text>
                    ) : (
                      <Text style={s.empty}>No description.</Text>
                    )}
                    <View style={s.actionRow}>
                      <TouchableOpacity style={s.editBtn} onPress={() => startEdit(note)}>
                        <Text style={s.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(note.id)}>
                        <Text style={s.delBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

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
    </View>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: fontSize.sm, color: colors.inkSoft, marginBottom: spacing.sm },
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
  noteDesc: { fontSize: fontSize.sm, color: colors.ink, lineHeight: 20, paddingVertical: spacing.xs },
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
  textarea: { minHeight: 72, textAlignVertical: "top" },
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
});
