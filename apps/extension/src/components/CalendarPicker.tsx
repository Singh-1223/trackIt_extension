import { useState, useCallback, useMemo } from "react";
import { getMonthGrid, isDateDisabled } from "../lib/calendarUtils";
import type { DayCell } from "../lib/calendarUtils";

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
  const initialDate = useMemo(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);

  // Reset view when visibility changes with a new selectedDate
  // Using a key-based approach: parent should remount or we track visibility
  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const handleDayClick = useCallback(
    (cell: DayCell) => {
      const disabled = isDateDisabled(cell.date, mode, otherDate);
      if (disabled) return;
      onSelect(cell.date);
    },
    [mode, otherDate, onSelect]
  );

  if (!visible) return null;

  return (
    <div
      style={styles.overlay}
      onClick={onDismiss}
      role="presentation"
    >
      <div
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Calendar picker"
      >
        {/* Header with month/year and navigation */}
        <div style={styles.header}>
          <button
            type="button"
            style={styles.navButton}
            onClick={goToPrevMonth}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span style={styles.monthLabel}>
            {grid.monthName} {grid.year}
          </span>
          <button
            type="button"
            style={styles.navButton}
            onClick={goToNextMonth}
            aria-label="Next month"
          >
            ›
          </button>
          <button
            type="button"
            style={styles.closeButton}
            onClick={onDismiss}
            aria-label="Close calendar"
          >
            ×
          </button>
        </div>

        {/* Day-of-week headers */}
        <div style={styles.grid}>
          {DAY_HEADERS.map((day) => (
            <div key={day} style={styles.dayHeader}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {grid.days.map((week, weekIdx) => (
          <div key={weekIdx} style={styles.grid}>
            {week.map((cell) => {
              const disabled = isDateDisabled(cell.date, mode, otherDate);
              const isSelected = cell.date === selectedDate;
              const cellStyle = getCellStyle(cell, isSelected, disabled);

              return (
                <button
                  key={cell.date}
                  type="button"
                  style={cellStyle}
                  onClick={() => handleDayClick(cell)}
                  disabled={disabled}
                  aria-label={cell.date}
                  aria-selected={isSelected}
                  aria-disabled={disabled}
                >
                  {cell.dayOfMonth}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function getCellStyle(
  cell: DayCell,
  isSelected: boolean,
  disabled: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    ...styles.dayCell,
  };

  if (!cell.isCurrentMonth) {
    base.color = "var(--ink-soft, #5f4d43)";
    base.opacity = 0.5;
  }

  if (cell.isToday && !isSelected) {
    base.border = "2px solid var(--accent, #b9552f)";
    base.padding = "0";
  }

  if (isSelected) {
    base.background = "var(--accent, #b9552f)";
    base.color = "#fff";
    base.fontWeight = 700;
    base.border = "2px solid var(--accent-strong, #8e3e21)";
    base.padding = "0";
  }

  if (disabled) {
    base.opacity = 0.3;
    base.cursor = "not-allowed";
    base.pointerEvents = "none";
  }

  return base;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  card: {
    background: "var(--surface-strong, #fffaf2)",
    border: "1px solid var(--border, rgba(74, 46, 33, 0.12))",
    borderRadius: "var(--radius-md, 18px)",
    padding: "16px",
    boxShadow: "0 18px 50px rgba(79, 49, 34, 0.14)",
    minWidth: "280px",
    maxWidth: "320px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  },
  navButton: {
    background: "none",
    border: "1px solid var(--border, rgba(74, 46, 33, 0.12))",
    borderRadius: "8px",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "1.1rem",
    color: "var(--ink, #231814)",
    transition: "background 0.12s ease",
  },
  monthLabel: {
    flex: 1,
    textAlign: "center" as const,
    fontWeight: 700,
    fontSize: "0.92rem",
    color: "var(--ink, #231814)",
  },
  closeButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1.3rem",
    color: "var(--ink-soft, #5f4d43)",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    marginLeft: "4px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "2px",
  },
  dayHeader: {
    textAlign: "center" as const,
    fontSize: "0.7rem",
    fontWeight: 700,
    color: "var(--ink-soft, #5f4d43)",
    padding: "4px 0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  dayCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    aspectRatio: "1",
    border: "1px solid transparent",
    borderRadius: "8px",
    background: "none",
    cursor: "pointer",
    fontSize: "0.82rem",
    fontWeight: 500,
    color: "var(--ink, #231814)",
    padding: "1px",
    transition: "background 0.12s ease, transform 0.08s ease",
  },
};
