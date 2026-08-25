import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { formatDateHuman } from "../lib/calendarUtils";
import { colors, fontSize, radius, spacing } from "../theme";

export interface DatePickerTriggerProps {
  label: string;
  value: string | null;
  onPress: () => void;
}

export function DatePickerTrigger({ label, value, onPress }: DatePickerTriggerProps) {
  return (
    <TouchableOpacity style={styles.trigger} onPress={onPress} activeOpacity={0.7}>
      <Text style={value ? styles.valueText : styles.placeholderText}>
        {value ? formatDateHuman(value) : label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  valueText: {
    fontSize: fontSize.base,
    color: colors.ink,
  },
  placeholderText: {
    fontSize: fontSize.base,
    color: colors.inkSoft,
  },
});
