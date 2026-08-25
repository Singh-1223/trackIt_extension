import React from "react";
import { formatDateHuman } from "../lib/calendarUtils";

export interface DatePickerTriggerProps {
  label: string;
  value: string | null;
  onClick: () => void;
}

export const DatePickerTrigger = React.forwardRef<
  HTMLButtonElement,
  DatePickerTriggerProps
>(function DatePickerTrigger({ label, value, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "7px 10px",
        fontSize: "0.88rem",
        fontFamily: "inherit",
        border: "1px solid var(--border, #ccc)",
        borderRadius: "6px",
        background: "var(--input-bg, #fff)",
        color: value ? "var(--text, #1a1a1a)" : "var(--text-muted, #888)",
        textAlign: "left",
        cursor: "pointer",
        outline: "none",
        lineHeight: 1.4,
      }}
    >
      {value ? formatDateHuman(value) : label}
    </button>
  );
});
