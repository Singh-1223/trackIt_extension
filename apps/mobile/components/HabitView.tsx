import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { computeDayCount } from "../lib/calendarUtils";
import { getDatesInRange, upsertHabitEntry } from "../lib/store";
import { generateId, getTodayString } from "../lib/utils";
import { colors, fontSize, radius, spacing } from "../theme";
import type { Habit, TrackItStore } from "../types/index";
import { CalendarPicker } from "./CalendarPicker";
import { DatePickerTrigger } from "./DatePickerTrigger";

interface HabitViewProps {
  store: TrackItStore;
  onSave: (updated: TrackItStore) => void;
  compact?: boolean;
  hideAddForm?: boolean;
}

const TODAY = getTodayString();

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(2000, m - 1, d)
  );
}

function isExpired(habit: Habit): boolean {
  return !!habit.endDate && habit.endDate < TODAY;
}

function habitLabel(habit: Habit): string {
  if (habit.startDate && habit.endDate) {
    const dates = getDatesInRange(habit.startDate, habit.endDate);
    return `${shortDate(habit.startDate)} – ${shortDate(habit.endDate)} · ${dates.length} day${dates.length === 1 ? "" : "s"}`;
  }
  if (habit.targetCount) {
    return `Target: ${habit.targetCount} times`;
  }
  return "";
}

function HabitCard({
  habit,
  store,
  compact,
  onSave,
  onToggle,
  onDelete,
}: {
  habit: Habit;
  store: TrackItStore;
  compact: boolean;
  onSave: (updated: TrackItStore) => void;
  onToggle: (habitId: string, date: string, current: boolean) => void;
  onDelete: (habitId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const isCountMode = !habit.endDate && !!habit.targetCount;

  // Count mode uses synthetic keys "count-0", "count-1", … stored as HabitEntries
  const doneSet = new Set(
    (store.habitEntries ?? [])
      .filter((e) => e.habitId === habit.id && e.done)
      .map((e) => e.date)
  );

  const doneCount = doneSet.size;

  let total = 0;
  let dates: string[] = [];
  if (!isCountMode && habit.startDate && habit.endDate) {
    dates = getDatesInRange(habit.startDate, habit.endDate);
    total = dates.length;
  } else if (isCountMode) {
    total = habit.targetCount!;
  }

  // For count mode, filledCount = highest contiguous block from index 0
  const filledCount = isCountMode
    ? (() => {
        let n = 0;
        while (n < total && doneSet.has(`count-${n}`)) n++;
        return n;
      })()
    : doneCount;

  const progress = total > 0 ? filledCount / total : 0;

  const rows: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    rows.push(dates.slice(i, i + 7));
  }

  const expired = isExpired(habit);
  const statusLabel = isCountMode
    ? `${filledCount} / ${total}`
    : `${doneCount} / ${total} days done`;

  return (
    <View style={s.habitCard}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={s.habitName}>{habit.name}</Text>
            <Text style={s.habitRange}>{habitLabel(habit)}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Text style={s.statusBadge}>{statusLabel}</Text>
            <Text style={s.chevron}>{open ? "▲" : "▼"}</Text>
            {!compact && (
              <TouchableOpacity style={s.delBtn} onPress={() => onDelete(habit.id)}>
                <Text style={s.delBtnText}>🗑</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <View style={s.summaryProgress}>
        <View style={[s.summaryProgressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>

      {open && (
        <>
          {isCountMode ? (
            <CountGrid
              habitId={habit.id}
              target={total}
              filledCount={filledCount}
              onTap={(index) => {
                // Tapping filled box N → unfill N..end; tapping empty box N → fill 0..N
                const newFilled = index < filledCount ? index : index + 1;
                const entries = (store.habitEntries ?? []).filter(
                  (e) => e.habitId !== habit.id
                );
                const next = Array.from({ length: newFilled }, (_, i) => ({
                  habitId: habit.id,
                  date: `count-${i}`,
                  done: true,
                }));
                onSave({ ...store, habitEntries: [...entries, ...next] });
              }}
            />
          ) : (
            <View style={s.grid}>
              {rows.map((row, rowIdx) => (
                <View key={rowIdx} style={s.gridRow}>
                  {row.map((date, idx) => {
                    const dayNum = rowIdx * 7 + idx + 1;
                    const done = doneSet.has(date);
                    const isToday = date === TODAY;
                    const isFuture = date > TODAY;
                    return (
                      <TouchableOpacity
                        key={date}
                        style={[
                          s.dayCell,
                          done && s.dayCellDone,
                          isToday && !done && s.dayCellToday,
                          isFuture && s.dayCellFuture,
                        ]}
                        onPress={() => onToggle(habit.id, date, done)}
                        disabled={isFuture}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.dayNum, done ? s.dayNumDone : isFuture ? s.dayNumFuture : isToday ? s.dayNumToday : null]}>
                          {dayNum}
                        </Text>
                        <Text style={[s.dayDate, done ? s.dayDateDone : isFuture ? s.dayDateFuture : null]}>
                          {shortDate(date)}
                        </Text>
                        {done && <Text style={s.dayCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          <View style={s.progressRow}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
            </View>
            <Text style={s.progressLabel}>{statusLabel}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function CountGrid({
  habitId,
  target,
  filledCount,
  onTap,
}: {
  habitId: string;
  target: number;
  filledCount: number;
  onTap: (index: number) => void;
}) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text style={[s.habitRange, { marginBottom: spacing.xs }]}>
        Tap a box to fill up to it, tap a filled box to unfill from it
      </Text>
      <View style={s.countGrid}>
        {Array.from({ length: target }, (_, i) => {
          const filled = i < filledCount;
          return (
            <TouchableOpacity
              key={i}
              style={[s.countCell, filled && s.countCellDone]}
              onPress={() => onTap(i)}
              activeOpacity={0.7}
            />
          );
        })}
      </View>
    </View>
  );
}

export function HabitView({ store, onSave, compact = false, hideAddForm = false }: HabitViewProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const [formError, setFormError] = useState("");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Newest first
  const allHabits = [...(store.habits ?? [])].sort((a, b) => b.createdAt - a.createdAt);

  // Active = no endDate OR endDate >= today
  const activeHabits = allHabits.filter((h) => !isExpired(h));
  // Expired = endDate passed
  const expiredHabits = allHabits.filter((h) => isExpired(h));

  // In compact mode only show active; in full view active only (expired shown separately below)
  const visibleHabits = activeHabits;

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) { setFormError("Habit name is required."); return; }

    const hasDateRange = startDate || endDate;
    const hasTarget = targetCount.trim() !== "";

    if (!hasDateRange && !hasTarget) {
      setFormError("Provide either a date range or a target count.");
      return;
    }
    if (hasDateRange) {
      if (!startDate || !endDate) { setFormError("Provide both start and end dates, or leave both empty."); return; }
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
    onSave({ ...store, habits: [...(store.habits ?? []), newHabit] });
    setName("");
    setStartDate("");
    setEndDate("");
    setTargetCount("");
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

  const addForm = !compact && !hideAddForm && (
    <View style={s.addForm}>
      <TextInput
        style={s.input}
        placeholder="Habit name…"
        placeholderTextColor={colors.inkSoft}
        value={name}
        onChangeText={setName}
      />
      <View style={s.dateRow}>
        <View style={{ flex: 1 }}>
          <DatePickerTrigger
            label="Start date (optional)"
            value={startDate || null}
            onPress={() => setShowStartPicker(true)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DatePickerTrigger
            label="End date (optional)"
            value={endDate || null}
            onPress={() => setShowEndPicker(true)}
          />
        </View>
      </View>
      {startDate && endDate && (
        <Text style={s.dayCountLabel}>{computeDayCount(startDate, endDate)} days</Text>
      )}
      <CalendarPicker
        visible={showStartPicker}
        selectedDate={startDate || null}
        mode="start"
        otherDate={endDate || null}
        onSelect={(date) => {
          setStartDate(date);
          setShowStartPicker(false);
          if (endDate && date > endDate) {
            setEndDate("");
          }
        }}
        onDismiss={() => setShowStartPicker(false)}
      />
      <CalendarPicker
        visible={showEndPicker}
        selectedDate={endDate || null}
        mode="end"
        otherDate={startDate || null}
        onSelect={(date) => {
          setEndDate(date);
          setShowEndPicker(false);
        }}
        onDismiss={() => setShowEndPicker(false)}
      />
      <TextInput
        style={s.input}
        placeholder="Target count (optional, e.g. 51)"
        placeholderTextColor={colors.inkSoft}
        value={targetCount}
        onChangeText={setTargetCount}
        keyboardType="numeric"
      />
      {formError ? <Text style={s.error}>{formError}</Text> : null}
      <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
        <Text style={s.addBtnText}>Add Habit</Text>
      </TouchableOpacity>
    </View>
  );

  if (visibleHabits.length === 0 && expiredHabits.length === 0) {
    return (
      <View>
        {addForm}
        <Text style={s.empty}>
          {compact ? "No active habits." : "No habits yet. Add one above."}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {addForm}

      {activeHabits.length === 0 && !compact && (
        <Text style={s.empty}>No active habits.</Text>
      )}

      {visibleHabits.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          store={store}
          compact={compact}
          onSave={onSave}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ))}

      {!compact && expiredHabits.length > 0 && (
        <View style={s.sectionHeader}>
          <Text style={s.sectionHeaderText}>Completed / Expired</Text>
        </View>
      )}
      {!compact && expiredHabits.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          store={store}
          compact={false}
          onSave={onSave}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ))}
    </View>
  );
}

const CELL_SIZE = 46;

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
  dayCountLabel: { fontSize: fontSize.xs, color: colors.inkSoft, marginBottom: spacing.xs },
  error: { fontSize: fontSize.xs, color: colors.danger, marginBottom: spacing.xs },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  addBtnText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  empty: { fontSize: fontSize.sm, color: colors.inkSoft, marginTop: spacing.sm },
  sectionHeader: { marginTop: spacing.md, marginBottom: spacing.xs },
  sectionHeaderText: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  habitCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  habitCardCompact: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  habitHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.xs },
  habitName: { fontSize: fontSize.md, fontWeight: "800", color: colors.ink },
  habitRange: { fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 2 },
  statusBadge: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "600" },
  chevron: { fontSize: fontSize.xs, color: colors.inkSoft, marginLeft: 4 },
  delBtn: { backgroundColor: colors.dangerBg, borderRadius: radius.xs, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  delBtnText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: "600" },
  summaryProgress: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 2,
  },
  summaryProgressFill: {
    height: 3,
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  grid: { marginVertical: spacing.sm, gap: 5 },
  gridRow: { flexDirection: "row", gap: 5 },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE + 10,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.successBg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
  },
  dayCellDone: { backgroundColor: colors.success, borderColor: colors.success },
  dayCellToday: { borderWidth: 2, borderColor: colors.accent },
  dayCellFuture: { backgroundColor: colors.bg, borderColor: colors.border, opacity: 0.6 },
  dayNum: { fontSize: fontSize.sm, fontWeight: "700", color: colors.success },
  dayNumDone: { color: colors.white },
  dayNumFuture: { color: colors.inkSoft },
  dayNumToday: { color: colors.accent, fontWeight: "800" },
  dayDate: { fontSize: 9, color: colors.success, marginTop: 1, opacity: 0.8 },
  dayDateDone: { color: colors.white, opacity: 0.75 },
  dayDateFuture: { color: colors.inkSoft },
  dayCheck: { fontSize: 12, color: colors.white, fontWeight: "700", marginTop: 1 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  progressTrack: {
    flex: 1,
    height: 7,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: 7, backgroundColor: colors.success, borderRadius: 4 },
  progressLabel: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "600" },
  countGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: spacing.sm },
  countCell: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  countCellDone: { backgroundColor: colors.success, borderColor: colors.success },
  countToggleBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
  },
  countToggleBtnText: { color: colors.white, fontSize: fontSize.xs, fontWeight: "700" },
});
