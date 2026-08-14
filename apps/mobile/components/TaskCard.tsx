import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors, fontSize, radius, spacing } from "../theme";
import type { DayEntry, Task } from "../types/index";

interface TaskCardProps {
  task: Task;
  entry: DayEntry | undefined;
  onUpdate: (patch: { done: boolean; comment: string }) => void;
  commentPlaceholder?: string;
}

export function TaskCard({ task, entry, onUpdate, commentPlaceholder = "Note for today…" }: TaskCardProps) {
  const [showComment, setShowComment] = useState(false);
  const done = entry?.done ?? false;
  const comment = entry?.comment ?? "";

  return (
    <View>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.checkbox, done && styles.checkboxDone]}
          onPress={() => onUpdate({ done: !done, comment })}
          activeOpacity={0.7}
        >
          {done && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        <Text
          style={[styles.label, done && styles.labelDone]}
          onPress={() => onUpdate({ done: !done, comment })}
        >
          {task.title}
        </Text>

        <TouchableOpacity
          style={[styles.commentBtn, comment ? styles.commentBtnActive : null]}
          onPress={() => setShowComment((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={[styles.commentBtnText, comment ? styles.commentBtnTextActive : null]}>✎</Text>
        </TouchableOpacity>
      </View>

      {showComment && (
        <TextInput
          style={styles.commentInput}
          placeholder={commentPlaceholder}
          placeholderTextColor={colors.inkSoft}
          value={comment}
          multiline
          numberOfLines={2}
          onChangeText={(text) => onUpdate({ done, comment: text })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  label: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.ink,
    fontWeight: "500",
  },
  labelDone: {
    color: colors.inkSoft,
    textDecorationLine: "line-through",
  },
  commentBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  commentBtnActive: {
    backgroundColor: colors.accentWarm + "33",
  },
  commentBtnText: {
    fontSize: 13,
    color: colors.inkSoft,
  },
  commentBtnTextActive: {
    color: colors.accent,
  },
  commentInput: {
    marginTop: spacing.xs,
    marginLeft: 30,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: fontSize.base,
    color: colors.ink,
    minHeight: 56,
    textAlignVertical: "top",
  },
});
