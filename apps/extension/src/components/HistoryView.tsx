import { useState } from "react";
import type { TrackItStore } from "../types/index";
import { formatDateLabel, getLastNDays } from "../lib/utils";

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

  const totalTasks = store.tasks.length;

  function getDoneCount(date: string): number {
    return store.entries.filter((e) => e.date === date && e.done).length;
  }

  const sortedGroups = [...store.groups].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="button-row" style={{ marginBottom: 20 }}>
        {(["7", "30", "all"] as FilterRange[]).map((r) => (
          <button
            key={r}
            type="button"
            className={`button ${range === r ? "button-primary" : "button-secondary"}`}
            onClick={() => setRange(r)}
          >
            {r === "7" ? "Last 7 days" : r === "30" ? "Last 30 days" : "All time"}
          </button>
        ))}
      </div>

      {days.length === 0 ? (
        <div className="empty">No history yet. Start checking off tasks today.</div>
      ) : (
        <>
          <div className="history-day-grid">
            {days.map((date) => {
              const doneCount = getDoneCount(date);
              const completionClass =
                doneCount === totalTasks && totalTasks > 0
                  ? "full-complete"
                  : doneCount > 0
                  ? "partial-complete"
                  : "";
              return (
                <button
                  key={date}
                  type="button"
                  className={`history-day-cell ${completionClass}${selectedDate === date ? " selected" : ""}`}
                  title={formatDateLabel(date)}
                  onClick={() => setSelectedDate(selectedDate === date ? null : date)}
                >
                  <span className="history-day-label">{date.slice(5)}</span>
                  <span className="history-day-count">{doneCount}/{totalTasks}</span>
                  <span className="history-day-dot" />
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="history-detail-panel">
              <div className="section-title" style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}>{formatDateLabel(selectedDate)}</h3>
              </div>
              {sortedGroups.map((group) => {
                const groupTasks = store.tasks
                  .filter((t) => t.groupId === group.id)
                  .sort((a, b) => a.order - b.order);
                if (groupTasks.length === 0) return null;
                return (
                  <div key={group.id} style={{ marginBottom: 16 }}>
                    <p className="history-group-label">{group.name}</p>
                    {groupTasks.map((task) => {
                      const entry = store.entries.find(
                        (e) => e.date === selectedDate && e.taskId === task.id
                      );
                      return (
                        <div key={task.id} className="history-detail-row">
                          <span className={entry?.done ? "history-detail-done" : "history-detail-miss"}>
                            {entry?.done ? "✓" : "○"}
                          </span>
                          <div>
                            <span>{task.title}</span>
                            {entry?.comment && (
                              <span className="history-detail-comment">{entry.comment}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
