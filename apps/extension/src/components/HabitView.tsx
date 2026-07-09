import { useState } from "react";
import { getDatesInRange, upsertHabitEntry } from "../lib/store";
import { formatDateLabel, generateId, getTodayString } from "../lib/utils";
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
    if (!startDate || !endDate) { setFormError("Both start and end dates are required."); return; }
    if (startDate > endDate) { setFormError("Start date must be before end date."); return; }
    const newHabit: Habit = {
      id: generateId("habit"),
      name: trimmed,
      startDate,
      endDate,
      createdAt: Date.now()
    };
    onSave({ ...store, habits: [...(store.habits ?? []), newHabit] });
    setName("");
    setStartDate("");
    setEndDate("");
    setFormError("");
  }

  function handleDelete(habitId: string) {
    if (!window.confirm("Delete this habit and all its progress?")) return;
    onSave({
      ...store,
      habits: store.habits.filter((h) => h.id !== habitId),
      habitEntries: store.habitEntries.filter((e) => e.habitId !== habitId)
    });
  }

  function handleToggle(habitId: string, date: string, current: boolean) {
    const updated = upsertHabitEntry(store.habitEntries ?? [], {
      habitId,
      date,
      done: !current
    });
    onSave({ ...store, habitEntries: updated });
  }

  return (
    <div className={compact ? "buildup-wrap buildup-wrap--compact" : "buildup-wrap"}>
      {/* Add form — full view only */}
      {!compact && (
        <div className="buildup-add-form">
        <input
          className="add-task-input"
          placeholder="Habit name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <div className="buildup-date-row">
          <div className="buildup-date-field">
            <label>From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="buildup-date-field">
            <label>To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="button button-primary"
            style={{ alignSelf: "flex-end", padding: "9px 16px", fontSize: "0.88rem", flexShrink: 0 }}
            onClick={handleAdd}
          >
            Add
          </button>
        </div>
        {formError && <p className="message message-error" style={{ margin: "4px 0 0" }}>{formError}</p>}
      </div>
      )}

      {/* Habits list */}
      {habits.length === 0 ? (
        <div className="empty" style={{ marginTop: 12 }}>{compact ? "No habits yet. Open full view to add one." : "No habits yet. Add one above to start building streaks."}</div>
      ) : (
        <div className="buildup-list">
          {habits.map((habit) => {
            const dates = getDatesInRange(habit.startDate, habit.endDate);
            const doneSet = new Set(
              (store.habitEntries ?? [])
                .filter((e) => e.habitId === habit.id && e.done)
                .map((e) => e.date)
            );
            const doneCount = doneSet.size;
            const total = dates.length;
            const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

            return (
              <div key={habit.id} className="buildup-habit">
                <div className="buildup-habit-header">
                  <div>
                    <span className="buildup-habit-name">{habit.name}</span>
                    <span className="buildup-habit-range">{rangeLabel(habit)}</span>
                  </div>
                  <button
                    type="button"
                    className="button button-danger"
                    style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                    onClick={() => handleDelete(habit.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="buildup-grid">
                  {dates.map((date, idx) => {
                    const done = doneSet.has(date);
                    const isToday = date === TODAY;
                    const isFuture = date > TODAY;
                    return (
                      <button
                        key={date}
                        type="button"
                        title={formatDateLabel(date)}
                        className={[
                          "buildup-day",
                          done ? "is-done" : "",
                          isToday ? "is-today" : "",
                          isFuture ? "is-future" : ""
                        ].filter(Boolean).join(" ")}
                        onClick={() => handleToggle(habit.id, date, done)}
                      >
                        <span className="buildup-day-num">{idx + 1}</span>
                        <span className="buildup-day-date">{shortDate(date)}</span>
                        {done && (
                          <svg className="buildup-day-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 8l3.5 3.5L13 5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="buildup-footer">
                  <div className="buildup-progress-bar">
                    <div className="buildup-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="buildup-progress-label">{doneCount} / {total} days done</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
