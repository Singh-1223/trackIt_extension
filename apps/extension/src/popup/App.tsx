import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { GroupSection } from "../components/GroupSection";
import { HabitView } from "../components/HabitView";
import { LibraryView } from "../components/LibraryView";
import { TodoList } from "../components/TodoList";
import { AuthButton } from "../components/AuthButton";
import { AppLockGate } from "../components/AppLockGate";
import { SyncStatusIndicator } from "../components/SyncStatusIndicator";
import { AuthProvider, useAuthContext } from "../lib/auth/AuthProvider";
import { useStartupSync } from "../lib/sync/startupSync";
import { getSyncEngine } from "../lib/sync/syncEngineInstance";
import { lastWriteWins } from "../lib/sync/syncEngine";
import { ensureSnapshot, getStore, openOptionsPage, saveStore, sortedTodos, upsertEntry } from "../lib/store";
import { formatDateLabel, getLastNDays, getTodayString } from "../lib/utils";
import type { SyncStatus } from "../lib/sync/syncEngine";
import type { DayEntry, Todo, TrackItStore } from "../types/index";

const TODAY = getTodayString();

/**
 * Top-level App wraps the content in AuthProvider so auth context
 * is available to all child components. The extension still works
 * in unauthenticated mode (local-only, no sync).
 *
 * Requirements: 1.1, 1.6
 */
export function App() {
  return (
    <AuthProvider>
      <AppLockGate>
        <AppContent />
      </AppLockGate>
    </AuthProvider>
  );
}

function AppContent() {
  const { isSignedIn } = useAuthContext();
  const [store, setStore] = useState<TrackItStore | null>(null);
  const [error, setError] = useState("");
  const saveRef = useRef<Promise<void>>(Promise.resolve());

  // Sync engine status tracking for the SyncStatusIndicator
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  // Run startup sync when authenticated (pulls remote, resolves conflicts)
  const { status: startupStatus, store: syncedStore } = useStartupSync();

  // When startup sync resolves with a store, update local state
  useEffect(() => {
    if (syncedStore) {
      setStore(syncedStore);
    }
  }, [syncedStore]);

  // Subscribe to sync engine status changes for ongoing push/pull feedback
  useEffect(() => {
    if (!isSignedIn) {
      setSyncStatus("idle");
      return;
    }
    const engine = getSyncEngine();
    setSyncStatus(engine.getStatus());
    const unsubscribe = engine.onStatusChange(setSyncStatus);
    return unsubscribe;
  }, [isSignedIn]);

  // Derive effective sync status: startup sync takes precedence while active
  const effectiveSyncStatus: SyncStatus =
    startupStatus === "syncing" ? "pulling" :
    startupStatus === "offline" ? "offline" :
    startupStatus === "error" ? "error" :
    syncStatus;

  const [refreshing, setRefreshing] = useState(false);

  const loadStore = useCallback(async () => {
    try {
      const s = await getStore();
      startTransition(() => setStore(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }, []);

  // Manual refresh: pull the latest remote store and reconcile with local via
  // last-write-wins, then persist locally. No-op when not signed in.
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      if (isSignedIn) {
        const engine = getSyncEngine();
        const remote = await engine.pull();
        const local = await getStore();
        if (remote) {
          const winner = lastWriteWins(local, remote);
          if (winner === remote) {
            await saveStore(remote);
            setStore(remote);
          } else {
            await engine.push(local);
            setStore(local);
          }
        } else {
          setStore(local);
        }
      } else {
        await loadStore();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, isSignedIn, loadStore]);

  useEffect(() => {
    void loadStore();
    chrome.storage.onChanged.addListener(loadStore);
    return () => chrome.storage.onChanged.removeListener(loadStore);
  }, [loadStore]);

  function handleUpdate(date: string, taskId: string, patch: { done: boolean; comment: string }) {
    if (!store) return;

    const snapshotStore = ensureSnapshot(store, date);
    const updatedEntries = upsertEntry(snapshotStore.entries, {
      date,
      taskId,
      done: patch.done,
      comment: patch.comment
    });
    const updatedStore: TrackItStore = { ...snapshotStore, entries: updatedEntries };

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
  const past7Days = getLastNDays(8).slice(1); // last 7 days excluding today
  const sortedGroups = store ? [...store.groups].sort((a, b) => a.order - b.order) : [];
  const pendingTodos = store ? sortedTodos(store.todos).pending : [];
  const noteSections = store ? [...(store.noteGroups ?? []).sort((a, b) => a.order - b.order).map((group) => ({ name: group.name, notes: store.notes.filter((note) => note.groupId === group.id) })), { name: "Unsorted", notes: store.notes.filter((note) => !note.groupId) }].filter((section) => section.notes.length > 0) : [];
  const reflectionSections = store ? [...(store.reflectionCategories ?? []).sort((a, b) => a.order - b.order).map((category) => ({ name: category.name, entries: (store.reflections ?? []).filter((entry) => entry.categoryId === category.id) })), { name: "Unsorted", entries: (store.reflections ?? []).filter((entry) => !entry.categoryId) }].filter((section) => section.entries.length > 0) : [];

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

  function handleHabitSave(updated: TrackItStore) {
    setStore(updated);
    saveRef.current = saveRef.current.then(async () => {
      try {
        await saveStore(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  function handleLibrarySave(updated: TrackItStore) {
    setStore(updated);
    saveRef.current = saveRef.current.then(async () => {
      try {
        await saveStore(updated);
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isSignedIn && <SyncStatusIndicator status={effectiveSyncStatus} />}
            <button
              type="button"
              className="refresh-button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh data"
              title="Refresh data"
            >
              <svg
                className={refreshing ? "refresh-icon is-spinning" : "refresh-icon"}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="15"
                height="15"
              >
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <span className="muted" style={{ fontSize: "0.78rem" }}>{TODAY}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1>Today's prep</h1>
          <AuthButton />
        </div>
        <p>Check off tasks as you complete them. Tap ✏ to add a note.</p>
      </section>

      {error && <p className="message message-error" style={{ paddingTop: 8 }}>{error}</p>}

      <div style={{ paddingTop: 14 }}>
        {store === null ? (
          <p className="muted" style={{ fontSize: "0.88rem" }}>Loading…</p>
        ) : sortedGroups.length === 0 ? (
          <div className="empty">No task groups yet. Open settings to create some.</div>
        ) : (
          <details className="group-accordion">
            <summary className="group-accordion-summary">
              <span className="group-accordion-chevron" aria-hidden="true" />
              <span className="group-accordion-name">Daily Grind</span>
              <span className="group-progress-badge">
                {todayEntries.filter((e) => e.done).length} / {store.tasks.length}
              </span>
            </summary>
            <div className="group-task-list" style={{ paddingTop: 4 }}>
              {sortedGroups.map((group) => {
                const groupTasks = store.tasks
                  .filter((t) => t.groupId === group.id)
                  .sort((a, b) => a.order - b.order);
                return (
                  <GroupSection
                    key={group.id}
                    group={group}
                    tasks={groupTasks}
                    entries={todayEntries}
                    onUpdate={(taskId, patch) => handleUpdate(TODAY, taskId, patch)}
                  />
                );
              })}
            </div>
          </details>
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

      {/* Reflections accordion */}
      {store !== null && (
        <details className="group-accordion" style={{ marginTop: 8 }}>
          <summary className="group-accordion-summary">
            <span className="group-accordion-chevron" aria-hidden="true" />
            <span className="group-accordion-name">Reflections</span>
            {(store.reflections ?? []).length > 0 && <span className="group-progress-badge">{store.reflections?.length}</span>}
          </summary>
          {reflectionSections.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.83rem", padding: "4px 2px 6px" }}>No reflections yet. Add them in the mobile app.</p>
          ) : (
            <div className="group-task-list">
              {reflectionSections.map((section) => (
                <details key={section.name} className="group-accordion" style={{ marginBottom: 6, overflow: "hidden" }}>
                  <summary className="group-accordion-summary">
                    <span className="group-accordion-chevron" aria-hidden="true" />
                    <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{section.name}</span>
                    <span className="group-progress-badge">{section.entries.length}</span>
                  </summary>
                  <div style={{ padding: "4px 16px 12px", overflow: "hidden" }}>
                    {section.entries.map((entry) => <details key={entry.id} className="todo-done-details"><summary><span style={{ fontWeight: 600 }}>{entry.title}</span></summary><div style={{ padding: "4px 0 8px" }}><span className="muted" style={{ display: "block", fontSize: "0.76rem", marginBottom: 4 }}>{formatReflectionDate(entry.date)}</span>{entry.content ? <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{entry.content}</span> : null}{entry.tags.length > 0 && <span style={{ display: "block", marginTop: 6, fontSize: "0.76rem", color: "var(--accent-strong)" }}>{entry.tags.map((tag) => `#${tag}`).join("  ")}</span>}</div></details>)}
                  </div>
                </details>
              ))}
            </div>
          )}
        </details>
      )}

      {/* Notes accordion */}
      {store !== null && (
        <details className="group-accordion" style={{ marginTop: 8 }}>
          <summary className="group-accordion-summary">
            <span className="group-accordion-chevron" aria-hidden="true" />
            <span className="group-accordion-name">Notes</span>
            {noteSections.length > 0 && (
              <span className="group-progress-badge">{(store.notes ?? []).length} notes</span>
            )}
          </summary>
          {noteSections.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.83rem", padding: "4px 2px 6px" }}>
              No notes yet. Add them in the options page.
            </p>
          ) : (
            <div className="group-task-list">
              {noteSections.map((section) => (
                <details key={section.name} className="group-accordion" style={{ marginBottom: 6, overflow: "hidden" }}>
                  <summary className="group-accordion-summary">
                    <span className="group-accordion-chevron" aria-hidden="true" />
                    <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{section.name}</span>
                    <span className="group-progress-badge">{section.notes.length}</span>
                  </summary>
                  <div style={{ padding: "4px 16px 12px", overflow: "hidden" }}>
                    {section.notes.map((note) => <details key={note.id} className="todo-done-details"><summary><span style={{ fontWeight: 600 }}>{note.heading}</span></summary><div style={{ padding: "4px 0 8px" }}>{note.description ? <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{note.description}</span> : <span className="muted" style={{ fontSize: "0.82rem" }}>No description.</span>}</div></details>)}
                  </div>
                </details>
              ))}
            </div>
          )}
        </details>
      )}

      {/* Build-Up accordion */}
      {store !== null && (
        <details className="group-accordion" style={{ marginTop: 8 }}>
          <summary className="group-accordion-summary">
            <span className="group-accordion-chevron" aria-hidden="true" />
            <span className="group-accordion-name">Build-Up</span>
            {(store.habits ?? []).length > 0 && (
              <span className="group-progress-badge">{(store.habits ?? []).length} habit{(store.habits ?? []).length === 1 ? "" : "s"}</span>
            )}
          </summary>
          <div style={{ padding: "8px 12px 12px" }}>
            <HabitView store={store} onSave={handleHabitSave} compact={true} />
          </div>
        </details>
      )}

      {/* Library accordion */}
      {store !== null && (
        <details className="group-accordion" style={{ marginTop: 8 }}>
          <summary className="group-accordion-summary">
            <span className="group-accordion-chevron" aria-hidden="true" />
            <span className="group-accordion-name">Library</span>
            {(store.books ?? []).filter((b) => b.status === "reading").length > 0 && (
              <span className="group-progress-badge">
                {(store.books ?? []).filter((b) => b.status === "reading").length} reading
              </span>
            )}
          </summary>
          <div style={{ padding: "8px 12px 12px" }}>
            <LibraryView store={store} onSave={handleLibrarySave} compact={true} />
          </div>
        </details>
      )}

      {/* Past 7 days */}
      {store !== null && sortedGroups.length > 0 && (
        <details className="group-accordion" style={{ marginTop: 8 }}>
          <summary className="group-accordion-summary">
            <span className="group-accordion-chevron" aria-hidden="true" />
            <span className="group-accordion-name">Past 7 Days</span>
          </summary>
          <div style={{ paddingTop: 4 }}>
            {past7Days.map((date) => {
              const dateEntries = store.entries.filter((e) => e.date === date);
              const doneCount = dateEntries.filter((e) => e.done).length;
              const snapshot = store.snapshots?.find((s) => s.date === date);
              const totalCount = snapshot ? snapshot.tasks.length : store.tasks.length;
              const activeTasks = snapshot ? snapshot.tasks : store.tasks;
              const activeGroups = snapshot ? snapshot.groups : store.groups;
              const dateSortedGroups = [...activeGroups].sort((a, b) => a.order - b.order);
              return (
                <details key={date} className="group-accordion" style={{ marginBottom: 4 }}>
                  <summary className="group-accordion-summary">
                    <span className="group-accordion-chevron" aria-hidden="true" />
                    <span className="group-accordion-name" style={{ fontSize: "0.88rem" }}>
                      {formatDateLabel(date)}
                    </span>
                    <span className="group-progress-badge">{doneCount} / {totalCount}</span>
                  </summary>
                  <div className="group-task-list" style={{ paddingTop: 4 }}>
                    {dateSortedGroups.map((group) => {
                      const groupTasks = activeTasks
                        .filter((t) => t.groupId === group.id)
                        .sort((a, b) => a.order - b.order);
                      if (groupTasks.length === 0) return null;
                      return (
                        <GroupSection
                          key={group.id}
                          group={group}
                          tasks={groupTasks}
                          entries={dateEntries}
                          onUpdate={(taskId, patch) => handleUpdate(date, taskId, patch)}
                          commentPlaceholder={`Note for ${formatDateLabel(date)}…`}
                        />
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
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

function formatReflectionDate(date: NonNullable<TrackItStore["reflections"]>[number]["date"]) {
  if (date.precision === "unknown") return "Date unknown";
  if (date.precision === "year") return String(date.year);
  const month = new Date(date.year, date.month - 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return date.precision === "month" ? month : new Date(date.year, date.month - 1, date.day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
