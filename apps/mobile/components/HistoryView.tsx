import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatDateLabel, getLastNDays, getTodayString } from "../lib/utils";
import { colors, fontSize, radius, spacing } from "../theme";
import type { TrackItStore } from "../types/index";

type FilterRange = "7" | "30" | "all";

interface HistoryViewProps {
  store: TrackItStore;
}

export function HistoryView({ store }: HistoryViewProps) {
  const [range, setRange] = useState<FilterRange>("7");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days: string[] =
    range === "all"
      ? [...new Set(store.entries.map((e) => e.date))].sort().reverse()
      : getLastNDays(Number(range));

  const today = getTodayString();

  function getTotalTasks(date: string): number {
    if (date === today) return store.tasks.length;
    const snapshot = store.snapshots?.find((s) => s.date === date);
    return snapshot ? snapshot.tasks.length : store.tasks.length;
  }

  function getDoneCount(date: string): number {
    return store.entries.filter((e) => e.date === date && e.done).length;
  }

  return (
    <View>
      <View style={s.filterRow}>
        {(["7", "30", "all"] as FilterRange[]).map((r) => (
          <TouchableOpacity
            key={r}
            style={[s.filterBtn, range === r && s.filterBtnActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[s.filterBtnText, range === r && s.filterBtnTextActive]}>
              {r === "7" ? "7 days" : r === "30" ? "30 days" : "All time"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {days.length === 0 ? (
        <Text style={s.empty}>No history yet. Start checking off tasks today.</Text>
      ) : (
        <>
          <View style={s.grid}>
            {days.map((date) => {
              const doneCount = getDoneCount(date);
              const totalTasks = getTotalTasks(date);
              const isSelected = selectedDate === date;
              let dotColor: string = colors.border;
              if (doneCount === totalTasks && totalTasks > 0) dotColor = colors.success;
              else if (doneCount > 0) dotColor = colors.accentWarm;

              return (
                <TouchableOpacity
                  key={date}
                  style={[s.dayCell, isSelected && s.dayCellSelected]}
                  onPress={() => setSelectedDate(isSelected ? null : date)}
                >
                  <Text style={s.dayLabel}>{date.slice(5)}</Text>
                  <Text style={s.dayCount}>{doneCount}/{totalTasks}</Text>
                  <View style={[s.dot, { backgroundColor: dotColor }]} />
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDate && (() => {
            const snapshot = store.snapshots?.find((s) => s.date === selectedDate);
            const useSnapshot = snapshot && selectedDate !== today;
            const tasksSource = useSnapshot ? snapshot.tasks : store.tasks;
            const groupsSource = useSnapshot ? snapshot.groups : store.groups;
            const sortedGroups = [...groupsSource].sort((a, b) => a.order - b.order);

            return (
              <View style={s.detailPanel}>
                <Text style={s.detailTitle}>{formatDateLabel(selectedDate)}</Text>
                {sortedGroups.map((group) => {
                  const groupTasks = tasksSource
                    .filter((t) => t.groupId === group.id)
                    .sort((a, b) => a.order - b.order);
                  if (groupTasks.length === 0) return null;
                  return (
                    <View key={group.id} style={s.detailGroup}>
                      <Text style={s.detailGroupLabel}>{group.name}</Text>
                      {groupTasks.map((task) => {
                        const entry = store.entries.find(
                          (e) => e.date === selectedDate && e.taskId === task.id
                        );
                        return (
                          <View key={task.id} style={s.detailRow}>
                            <Text style={entry?.done ? s.detailDone : s.detailMiss}>
                              {entry?.done ? "✓" : "○"}
                            </Text>
                            <View style={{ flex: 1 }}>
                              <Text selectable style={s.detailTask}>{task.title}</Text>
                              {entry?.comment ? (
                                <Text selectable style={s.detailComment}>{entry.comment}</Text>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  filterBtn: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  filterBtnActive: { backgroundColor: colors.accent },
  filterBtnText: { fontSize: fontSize.sm, color: colors.inkSoft, fontWeight: "600" },
  filterBtnTextActive: { color: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  dayCell: {
    width: 58,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    alignItems: "center",
  },
  dayCellSelected: { borderColor: colors.accent, borderWidth: 2 },
  dayLabel: { fontSize: fontSize.xs, fontWeight: "700", color: colors.ink },
  dayCount: { fontSize: 10, color: colors.inkSoft, marginTop: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  empty: { fontSize: fontSize.sm, color: colors.inkSoft },
  detailPanel: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  detailTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.ink, marginBottom: spacing.sm },
  detailGroup: { marginBottom: spacing.sm },
  detailGroupLabel: { fontSize: fontSize.sm, fontWeight: "700", color: colors.inkSoft, marginBottom: spacing.xs, textTransform: "uppercase", letterSpacing: 0.5 },
  detailRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingVertical: 3 },
  detailDone: { fontSize: fontSize.sm, color: colors.success, fontWeight: "700", width: 16 },
  detailMiss: { fontSize: fontSize.sm, color: colors.inkSoft, width: 16 },
  detailTask: { fontSize: fontSize.base, color: colors.ink },
  detailComment: { fontSize: fontSize.sm, color: colors.inkSoft, marginTop: 2, fontStyle: "italic", lineHeight: 19 },
});
