import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  formatDateISO,
  getMonthGrid,
  isDateDisabled,
} from "../lib/calendarUtils";
import { colors, fontSize, radius, spacing } from "../theme";

export interface CalendarPickerProps {
  visible: boolean;
  selectedDate: string | null;
  mode: "start" | "end";
  otherDate: string | null;
  onSelect: (date: string) => void;
  onDismiss: () => void;
}

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CalendarPicker({
  visible,
  selectedDate,
  mode,
  otherDate,
  onSelect,
  onDismiss,
}: CalendarPickerProps) {
  const initialDate = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());

  // Reset to correct month when modal opens with a new selectedDate
  React.useEffect(() => {
    if (visible) {
      const d = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  }, [visible, selectedDate]);

  const grid = getMonthGrid(year, month);

  const goToPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleDayPress = (date: string) => {
    if (isDateDisabled(date, mode, otherDate)) return;
    onSelect(date);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <TouchableOpacity activeOpacity={1} style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {grid.monthName} {grid.year}
            </Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={styles.weekRow}>
            {DAY_HEADERS.map((day) => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          {grid.days.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((cell) => {
                const disabled = isDateDisabled(cell.date, mode, otherDate);
                const isSelected = cell.date === selectedDate;
                const isToday = cell.isToday;

                return (
                  <TouchableOpacity
                    key={cell.date}
                    style={[
                      styles.dayCell,
                      isSelected && styles.selectedDay,
                      isToday && !isSelected && styles.todayDay,
                      (!cell.isCurrentMonth || disabled) && styles.disabledDay,
                    ]}
                    onPress={() => handleDayPress(cell.date)}
                    disabled={disabled || !cell.isCurrentMonth}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.selectedDayText,
                        (!cell.isCurrentMonth || disabled) && styles.disabledDayText,
                      ]}
                    >
                      {cell.dayOfMonth}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    width: 320,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  navButton: {
    padding: spacing.sm,
  },
  navText: {
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  monthTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.ink,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    fontSize: fontSize.xl,
    color: colors.inkSoft,
  },
  weekRow: {
    flexDirection: "row",
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  dayHeaderText: {
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    fontWeight: "600",
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xs,
    margin: 1,
  },
  dayText: {
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  selectedDay: {
    backgroundColor: colors.accent,
  },
  selectedDayText: {
    color: colors.white,
    fontWeight: "600",
  },
  todayDay: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  disabledDay: {
    opacity: 0.3,
  },
  disabledDayText: {
    color: colors.inkSoft,
  },
});
