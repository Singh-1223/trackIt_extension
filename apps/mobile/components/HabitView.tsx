import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getDatesInRange, upsertHabitEntry } from "../lib/store";
import { generateId, getTodayString } from "../lib/utils";
import { colors, fontSize, radius, spacing } from "../theme";
import type { Habit, TrackItStore } from "../types/index";

interface HabitViewProps {
  store: TrackItStore;
  onSave: (updated: TrackItStore) => void;
  compact?: boolean;
}

const TODAY = getTodayString();

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(2000, m - 1, d)
  );
}

function rangeLabel(habit: Habit): string {
  const dates = getDatesInRange(habit.startDate, habit.endDate);
  return `${shortDate(habit.startDate)} – ${shortDate(habit.endDate)} · ${dates.length} day${dates.length === 1 ? "" : "s"}`;
}

export function HabitView({ store, onSave, compact = false }: HabitViewProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState("");

  const habits = [...(store.habits ?? [])].sort((a, b) => a.createdAt - b.createdAt);

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) { setFormError("Habit name is required."); return; }
    if (!startDate || !endDate) { setFormError("Both dates required (YYYY-MM-DD)."); return; }
    if (startDate > endDate) { setFormError("Start must be before end date."); return; }
    const newHabit: Habit = {
      id: generateId("habit"),
      name: trimmed,
      startDate,
      endDate,
      createdAt: Date.now(),
    };
    onSave({ ...store, habits: [...(store.habits ?? []), newHabit] });
    setName("");
    setStartDate("");
    setEndDate("");
    setFormError("");
  }

  function handleDelete(habitId: string) {
    Alert.alert("Delete habit", "Delete this habit and all its progress?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          onSave({
            ...store,
            habits: store.habits.filter((h) => h.id !== habitId),
            habitEntries: store.habitEntries.filter((e) => e.habitId !== habitId),
          }),
      },
    ]);
  }

  function handleToggle(habitId: string, date: string, current: boolean) {
    if (date > TODAY) return;
    const updated = upsertHabitEntry(store.habitEntries ?? [], { habitId, date, done: !current });
    onSave({ ...store, habitEntries: updated });
  }

  if (habits.length === 0) {
    return (
      <View>
        {!compact && (
          <View style={s.addForm}>
            <TextInput
              style={s.input}
              placeholder="Habit name…"
              placeholderTextColor={colors.inkSoft}
              value={name}
              onChangeText={setName}
            />
            <View style={s.dateRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Start (YYYY-MM-DD)"
                placeholderTextColor={colors.inkSoft}
                value={startDate}
                onChangeText={setStartDate}
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="End (YYYY-MM-DD)"
                placeholderTextColor={colors.inkSoft}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
            {formError ? <Text style={s.error}>{formError}</Text> : null}
            <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
              <Text style={s.addBtnText}>Add Habit</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={s.empty}>
          {compact ? "No habits yet." : "No habits yet. Add one above."}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {!compact && (
        <View style={s.addForm}>
          <TextInput
            style={s.input}
            placeholder="Habit name…"
            placeholderTextColor={colors.inkSoft}
            value={name}
            onChangeText={setName}
          />
          <View style={s.dateRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Start (YYYY-MM-DD)"
              placeholderTextColor={colors.inkSoft}
              value={startDate}
              onChangeText={setStartDate}
            />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="End (YYYY-MM-DD)"
              placeholderTextColor={colors.inkSoft}
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
          {formError ? <Text style={s.error}>{formError}</Text> : null}
          <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
            <Text style={s.addBtnText}>Add Habit</Text>
          </TouchableOpacity>
        </View>
      )}

      {habits.map((habit) => {
        const dates = getDatesInRange(habit.startDate, habit.endDate);
        const doneSet = new Set(
          (store.habitEntries ?? [])
            .filter((e) => e.habitId === habit.id && e.done)
            .map((e) => e.date)
        );
        const doneCount = doneSet.size;
        const total = dates.length;
        const progress = total > 0 ? doneCount / total : 0;

        return (
          <View key={habit.id} style={s.habitCard}>
            <View style={s.habitHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.habitName}>{habit.name}</Text>
                <Text style={s.habitRange}>{rangeLabel(habit)}</Text>
              </View>
              {!compact && (
                <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(habit.id)}>
                  <Text style={s.delBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.gridScroll}>
              <View style={s.grid}>
                {dates.map((date, idx) => {
                  const done = doneSet.has(date);
                  const isToday = date === TODAY;
                  const isFuture = date > TODAY;
                  return (
                    <TouchableOpacity
                      key={date}
                      style={[
                        s.dayCell,
                        done && s.dayCellDone,
                        isToday && s.dayCellToday,
                        isFuture && s.dayCellFuture,
                      ]}
                      onPress={() => handleToggle(habit.id, date, done)}
                      disabled={isFuture}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dayNum, done && s.dayNumDone, isFuture && s.dayNumFuture]}>
                        {idx + 1}
                      </Text>
                      <Text style={[s.dayDate, isFuture && s.dayNumFuture]}>{shortDate(date)}</Text>
                      {done && <Text style={s.dayCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={s.progressRow}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={s.progressLabel}>{doneCount} / {total} days done</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  addForm: { marginBottom: spacing.lg },
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
  dateRow: { flexDirection: "row", gap: spacing.xs },
  error: { fontSize: fontSize.xs, color: colors.danger, marginBottom: spacing.xs },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  addBtnText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  empty: { fontSize: fontSize.sm, color: colors.inkSoft, marginTop: spacing.sm },
  habitCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  habitHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.sm },
  habitName: { fontSize: fontSize.md, fontWeight: "700", color: colors.ink },
  habitRange: { fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 2 },
  delBtn: { backgroundColor: colors.dangerBg, borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  delBtnText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: "600" },
  gridScroll: { marginBottom: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  dayCell: {
    width: 52,
    height: 60,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  dayCellDone: { backgroundColor: colors.success, borderColor: colors.success },
  dayCellToday: { borderWidth: 2, borderColor: colors.accent },
  dayCellFuture: { opacity: 0.35 },
  dayNum: { fontSize: fontSize.xs, fontWeight: "700", color: colors.ink },
  dayNumDone: { color: colors.white },
  dayNumFuture: { color: colors.inkSoft },
  dayDate: { fontSize: 9, color: colors.inkSoft, marginTop: 1 },
  dayCheck: { fontSize: 12, color: colors.white, fontWeight: "700" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: 6, backgroundColor: colors.success, borderRadius: 3 },
  progressLabel: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "600" },
});
