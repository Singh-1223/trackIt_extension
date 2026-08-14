import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { HabitView } from "../../components/HabitView";
import { useStoreContext } from "../../hooks/StoreContext";
import { generateId } from "../../lib/utils";
import { colors, fontSize, radius, shadow, spacing, TOP_PADDING } from "../../theme";
import type { Habit } from "../../types/index";

export default function HabitsScreen() {
  const { store, loading, save } = useStoreContext();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const [formError, setFormError] = useState("");

  if (loading || !store) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Loading…</Text>
      </View>
    );
  }

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) { setFormError("Habit name is required."); return; }
    const hasDateRange = startDate || endDate;
    const hasTarget = targetCount.trim() !== "";
    if (!hasDateRange && !hasTarget) { setFormError("Provide either a date range or a target count."); return; }
    if (hasDateRange) {
      if (!startDate || !endDate) { setFormError("Provide both start and end dates."); return; }
      if (startDate > endDate) { setFormError("Start date must be before end date."); return; }
    }
    if (hasTarget) {
      const n = parseInt(targetCount, 10);
      if (isNaN(n) || n < 1) { setFormError("Target count must be a positive number."); return; }
    }
    const newHabit: Habit = {
      id: generateId("habit"),
      name: trimmed,
      ...(hasDateRange ? { startDate, endDate } : {}),
      ...(hasTarget && !hasDateRange ? { targetCount: parseInt(targetCount, 10) } : {}),
      createdAt: Date.now(),
    };
    save({ ...store!, habits: [...(store!.habits ?? []), newHabit] });
    setName(""); setStartDate(""); setEndDate(""); setTargetCount(""); setFormError("");
    setShowAdd(false);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Build-Up</Text>
            <Text style={s.sub}>Track streaks and build consistent habits over time.</Text>
          </View>
          <TouchableOpacity style={s.addIconBtn} onPress={() => setShowAdd(true)}>
            <Text style={s.addIconText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>
      <HabitView store={store} onSave={save} hideAddForm />
      <View style={{ height: spacing.xxl }} />

      {/* Add Habit Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Habit</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.input} placeholder="Habit name…" placeholderTextColor={colors.inkSoft} value={name} onChangeText={setName} />
            <View style={s.dateRow}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Start (YYYY-MM-DD)" placeholderTextColor={colors.inkSoft} value={startDate} onChangeText={setStartDate} />
              <TextInput style={[s.input, { flex: 1 }]} placeholder="End (YYYY-MM-DD)" placeholderTextColor={colors.inkSoft} value={endDate} onChangeText={setEndDate} />
            </View>
            <TextInput style={s.input} placeholder="Target count (optional, e.g. 51)" placeholderTextColor={colors.inkSoft} value={targetCount} onChangeText={setTargetCount} keyboardType="numeric" />
            {formError ? <Text style={s.errorText}>{formError}</Text> : null}
            <TouchableOpacity style={s.btnPrimary} onPress={handleAdd}>
              <Text style={s.btnPrimaryText}>Add Habit</Text>
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
  dateRow: { flexDirection: "row", gap: spacing.xs },
  errorText: { fontSize: fontSize.xs, color: colors.danger, marginBottom: spacing.xs },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing.sm + 2, alignItems: "center", marginTop: spacing.xs },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
});
