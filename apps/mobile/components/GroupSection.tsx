import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TaskCard } from "./TaskCard";
import { colors, fontSize, radius, spacing } from "../theme";
import type { DayEntry, Task, TaskGroup } from "../types/index";

interface GroupSectionProps {
  group: TaskGroup;
  tasks: Task[];
  entries: DayEntry[];
  onUpdate: (taskId: string, patch: { done: boolean; comment: string }) => void;
  commentPlaceholder?: string;
}

export function GroupSection({ group, tasks, entries, onUpdate, commentPlaceholder }: GroupSectionProps) {
  const [open, setOpen] = useState(true);
  const doneCount = tasks.filter((t) => entries.find((e) => e.taskId === t.id)?.done).length;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
        <Text style={styles.name}>{group.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{doneCount} / {tasks.length}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={styles.taskList}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              entry={entries.find((e) => e.taskId === task.id)}
              onUpdate={(patch) => onUpdate(task.id, patch)}
              commentPlaceholder={commentPlaceholder}
            />
          ))}
          {tasks.length === 0 && (
            <Text style={styles.empty}>No tasks in this group yet.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  chevron: {
    fontSize: fontSize.base,
    color: colors.inkSoft,
    width: 14,
  },
  name: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.ink,
  },
  badge: {
    backgroundColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    fontWeight: "600",
  },
  taskList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  empty: {
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    paddingVertical: spacing.xs,
  },
});
