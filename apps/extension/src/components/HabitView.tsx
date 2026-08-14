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
  const doneSet = new Set(
    (store.habitEntries ?? [])
      .filter((e) => e.habitId === habit.id && e.done)
      .map((e) => e.date)
  );

  const isCountMode = !habit.endDate && !!habit.targetCount;
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
    ? (() => { let n = 0; while (n < total && doneSet.has(`count-${n}`)) n++; return n; })()
    : doneCount;

  const progress = total > 0 ? Math.round((filledCount / total) * 100) : 0;
  const statusLabel = isCountMode
    ? `${filledCount} / ${total}`
    : `${doneCount} / ${total} days done`;

  const summaryContent = (
    <>
      <span className="buildup-habit-name">{habit.name}</span>
      <span className="buildup-habit-range">{habitLabel(habit)}</span>
      <span className="buildup-habit-status">{statusLabel}</span>
    </>
  );

  return (
    <details className="buildup-habit">
      <summary className="buildup-habit-summary">
        <span className="buildup-habit-chevron" aria-hidden="true" />
        <div className="buildup-habit-summary-content">
          <div>
            <span className="buildup-habit-name">{habit.name}</span>
            <span className="buildup-habit-range">{habitLabel(habit)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="buildup-habit-status">{statusLabel}</span>
            {!compact && (
              <button
                type="button"
                className="button button-danger"
                style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                onClick={(e) => { e.preventDefault(); onDelete(habit.id); }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
        <div className="buildup-summary-progress">
          <div className="buildup-summary-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </summary>

      <div className="buildup-habit-body">
        {isCountMode ? (
          <CountGrid
            habitId={habit.id}
            target={total}
            filledCount={filledCount}
            onTap={(index) => {
              const newFilled = index < filledCount ? index : index + 1;
              const entries = (store.habitEntries ?? []).filter((e) => e.habitId !== habit.id);
              const next = Array.from({ length: newFilled }, (_, i) => ({
                habitId: habit.id,
                date: `count-${i}`,
                done: true,
              }));
              onSave({ ...store, habitEntries: [...entries, ...next] });
            }}
          />
        ) : (
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
                  onClick={() => onToggle(habit.id, date, done)}
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
        )}

        <div className="buildup-footer">
          <div className="buildup-progress-bar">
            <div className="buildup-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span className="buildup-progress-label">{statusLabel}</span>
        </div>
      </div>
    </details>
  );
}

function CountGrid({
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
    <div className="buildup-count-wrap">
      <p className="buildup-count-hint">
        {filledCount} / {target} done — tap a box to fill up to it, tap filled to unfill
      </p>
      <div className="buildup-count-grid">
        {Array.from({ length: target }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`buildup-count-cell${i < filledCount ? " is-done" : ""}`}
            onClick={() => onTap(i)}
          />
        ))}
      </div>
    </div>
  );
}

export function HabitView({ store, onSave, compact = false }: HabitViewProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const [formError, setFormError] = useState("");

  // Newest first
  const allHabits = [...(store.habits ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  const activeHabits = allHabits.filter((h) => !isExpired(h));
  const expiredHabits = allHabits.filter((h) => isExpired(h));

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
    if (!window.confirm("Delete this habit and all its progress?")) return;
    onSave({
      ...store,
      habits: store.habits.filter((h) => h.id !== habitId),
      habitEntries: store.habitEntries.filter((e) => e.habitId !== habitId),
    });
  }

  function handleToggle(habitId: string, date: string, current: boolean) {
    const updated = upsertHabitEntry(store.habitEntries ?? [], { habitId, date, done: !current });
    onSave({ ...store, habitEntries: updated });
  }

  return (
    <div className={compact ? "buildup-wrap buildup-wrap--compact" : "buildup-wrap"}>
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
              <label>From (optional)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="buildup-date-field">
              <label>To (optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="buildup-date-field">
              <label>Target count (optional)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 51"
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                style={{ width: 90 }}
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

      {/* Active habits as dropdowns — shown in both compact and full view */}
      {activeHabits.length === 0 && expiredHabits.length === 0 && (
        <div className="empty" style={{ marginTop: 12 }}>
          {compact ? "No active habits. Open full view to add one." : "No habits yet. Add one above to start building streaks."}
        </div>
      )}
      {activeHabits.length === 0 && expiredHabits.length > 0 && (
        <div className="empty" style={{ marginTop: 12 }}>No active habits.</div>
      )}
      <div className="buildup-list">
        {activeHabits.map((habit) => (
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
      </div>

      {expiredHabits.length > 0 && !compact && (
        <>
          <p className="buildup-section-label">Completed / Expired</p>
          <div className="buildup-list">
            {expiredHabits.map((habit) => (
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
          </div>
        </>
      )}
    </div>
  );
}
