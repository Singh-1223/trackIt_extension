import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { TaskManager } from "../../components/TaskManager";
import { useStoreContext } from "../../hooks/StoreContext";
import { generateId } from "../../lib/utils";
import { colors, fontSize, radius, shadow, spacing, TOP_PADDING } from "../../theme";
import type { TaskGroup } from "../../types/index";

export default function ManageScreen() {
  const { store, loading, save } = useStoreContext();
  const [showAdd, setShowAdd] = useState(false);
  const [groupName, setGroupName] = useState("");

  if (loading || !store) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Loading…</Text>
      </View>
    );
  }

  function handleAddGroup() {
    const name = groupName.trim();
    if (!name) return;
    const newGroup: TaskGroup = { id: generateId("grp"), name, order: store!.groups.length };
    save({ ...store!, groups: [...store!.groups, newGroup] });
    setGroupName("");
    setShowAdd(false);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Manage Tasks</Text>
            <Text style={s.sub}>Add, rename, reorder, and delete task groups and tasks.</Text>
          </View>
          <TouchableOpacity style={s.addIconBtn} onPress={() => setShowAdd(true)}>
            <Text style={s.addIconText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TaskManager store={store} onSave={save} />
      <View style={{ height: spacing.xxl }} />

      {/* Add Group Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Group</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.input} placeholder="Group name…" placeholderTextColor={colors.inkSoft} value={groupName} onChangeText={setGroupName} autoFocus />
            <TouchableOpacity style={s.btnPrimary} onPress={handleAddGroup}>
              <Text style={s.btnPrimaryText}>Add Group</Text>
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
  addIconBtn: { backgroundColor: colors.accent, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  addIconText: { color: colors.white, fontSize: 22, fontWeight: "700", marginTop: -1 },
  muted: { fontSize: fontSize.sm, color: colors.inkSoft },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.lg },
  modalContent: { backgroundColor: colors.surfaceStrong, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  modalClose: { fontSize: 20, color: colors.inkSoft, padding: spacing.xs },
  input: { backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, fontSize: fontSize.base, color: colors.ink, marginBottom: spacing.sm },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing.sm + 2, alignItems: "center", marginTop: spacing.xs },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
});
