import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { GroupSection } from "../components/GroupSection";
import { TodoList } from "../components/TodoList";
import { getStore, openOptionsPage, saveStore, sortedTodos, upsertEntry } from "../lib/store";
import { getTodayString } from "../lib/utils";
import type { DayEntry, Todo, TrackItStore } from "../types/index";

const TODAY = getTodayString();

export function App() {
  const [store, setStore] = useState<TrackItStore | null>(null);
  const [error, setError] = useState("");
  const saveRef = useRef<Promise<void>>(Promise.resolve());

  const loadStore = useCallback(async () => {
    try {
      const s = await getStore();
      startTransition(() => setStore(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }, []);

  useEffect(() => {
    void loadStore();
    chrome.storage.onChanged.addListener(loadStore);
    return () => chrome.storage.onChanged.removeListener(loadStore);
  }, [loadStore]);

  function handleUpdate(taskId: string, patch: { done: boolean; comment: string }) {
    if (!store) return;

    const updatedEntries = upsertEntry(store.entries, {
      date: TODAY,
      taskId,
      done: patch.done,
      comment: patch.comment
    });
    const updatedStore: TrackItStore = { ...store, entries: updatedEntries };

    setStore(updatedStore);

    saveRef.current = saveRef.current.then(async () => {
      try {
        await saveStore(updatedStore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  const todayEntries: DayEntry[] = store ? store.entries.filter((e) => e.date === TODAY) : [];
  const sortedGroups = store ? [...store.groups].sort((a, b) => a.order - b.order) : [];
  const pendingTodos = store ? sortedTodos(store.todos).pending : [];

  async function handleTodoSave(updated: Todo[]) {
    if (!store) return;
    const updatedStore: TrackItStore = { ...store, todos: updated };
    setStore(updatedStore);
    saveRef.current = saveRef.current.then(async () => {
      try {
        await saveStore(updatedStore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  return (
    <main className="popup-shell">
      <section className="popup-hero">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="hero-badge">TrackIt</span>
          <span className="muted" style={{ fontSize: "0.78rem" }}>{TODAY}</span>
        </div>
        <h1>Today's prep</h1>
        <p>Check off tasks as you complete them. Tap ✏ to add a note.</p>
      </section>

      {error && <p className="message message-error" style={{ paddingTop: 8 }}>{error}</p>}

      <div style={{ paddingTop: 14 }}>
        {store === null ? (
          <p className="muted" style={{ fontSize: "0.88rem" }}>Loading…</p>
        ) : sortedGroups.length === 0 ? (
          <div className="empty">No task groups yet. Open settings to create some.</div>
        ) : (
          sortedGroups.map((group) => {
            const groupTasks = store.tasks
              .filter((t) => t.groupId === group.id)
              .sort((a, b) => a.order - b.order);
            return (
              <GroupSection
                key={group.id}
                group={group}
                tasks={groupTasks}
                entries={todayEntries}
                onUpdate={handleUpdate}
              />
            );
          })
        )}
      </div>

      {/* To-Dos accordion */}
      {store !== null && (
        <details className="group-accordion" style={{ marginTop: 8 }}>
          <summary className="group-accordion-summary">
            <span className="group-accordion-chevron" aria-hidden="true" />
            <span className="group-accordion-name">To-Dos</span>
            {pendingTodos.length > 0 && (
              <span className="group-progress-badge">{pendingTodos.length} pending</span>
            )}
          </summary>
          {pendingTodos.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.83rem", padding: "4px 2px 6px" }}>
              No pending to-dos. Manage them in the options page.
            </p>
          ) : (
            <TodoList
              todos={store.todos}
              onSave={handleTodoSave}
              compact={true}
              today={TODAY}
            />
          )}
        </details>
      )}

      <div className="popup-footer">
        <button
          type="button"
          className="button button-link"
          style={{ fontSize: "0.85rem" }}
          onClick={async () => {
            await openOptionsPage();
            window.close();
          }}
        >
          View history / Manage →
        </button>
      </div>
    </main>
  );
}
