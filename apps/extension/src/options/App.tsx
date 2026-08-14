import { startTransition, useCallback, useEffect, useState } from "react";
import { HistoryView } from "../components/HistoryView";
import { HabitView } from "../components/HabitView";
import { LibraryView } from "../components/LibraryView";
import { NotesList } from "../components/NotesList";
import { TaskManager } from "../components/TaskManager";
import { TodoList } from "../components/TodoList";
import { AuthButton } from "../components/AuthButton";
import { SyncStatusIndicator } from "../components/SyncStatusIndicator";
import { AuthProvider, useAuthContext } from "../lib/auth/AuthProvider";
import { useStartupSync } from "../lib/sync/startupSync";
import { getSyncEngine } from "../lib/sync/syncEngineInstance";
import { getStore, saveStore } from "../lib/store";
import { getTodayString } from "../lib/utils";
import type { SyncStatus } from "../lib/sync/syncEngine";
import type { Note, Todo, TrackItStore } from "../types/index";

type Tab = "history" | "buildup" | "library" | "manage" | "todos" | "notes";

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
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isSignedIn } = useAuthContext();
  const [store, setStore] = useState<TrackItStore | null>(null);
  const [tab, setTab] = useState<Tab>("history");
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const today = getTodayString();

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

  async function handleSave(updated: TrackItStore) {
    try {
      await saveStore(updated);
      startTransition(() => {
        setStore(updated);
        setSaveMsg("Saved.");
      });
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  }

  async function handleTodoSave(updated: Todo[]) {
    if (!store) return;
    await handleSave({ ...store, todos: updated });
  }

  async function handleNoteSave(updated: Note[]) {
    if (!store) return;
    await handleSave({ ...store, notes: updated });
  }

  async function handleHabitSave(updated: TrackItStore) {
    await handleSave(updated);
  }

  async function handleLibrarySave(updated: TrackItStore) {
    await handleSave(updated);
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="hero-badge">TrackIt</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isSignedIn && <SyncStatusIndicator status={effectiveSyncStatus} />}
            <AuthButton />
          </div>
        </div>
        <h1> M.d.n.s , one day at a time.</h1>
        <p>
          Track daily task
        </p>
      </section>

      <nav className="tabs" aria-label="Sections">
        <button
          type="button"
          className={`tab-btn${tab === "history" ? " active" : ""}`}
          onClick={() => setTab("history")}
        >
          History
        </button>
        <button
          type="button"
          className={`tab-btn${tab === "buildup" ? " active" : ""}`}
          onClick={() => setTab("buildup")}
        >
          Build-Up
        </button>
        <button
          type="button"
          className={`tab-btn${tab === "library" ? " active" : ""}`}
          onClick={() => setTab("library")}
        >
          Library
        </button>
        <button
          type="button"
          className={`tab-btn${tab === "todos" ? " active" : ""}`}
          onClick={() => setTab("todos")}
        >
          To-Dos
        </button>
        <button
          type="button"
          className={`tab-btn${tab === "notes" ? " active" : ""}`}
          onClick={() => setTab("notes")}
        >
          Notes
        </button>
        <button
          type="button"
          className={`tab-btn${tab === "manage" ? " active" : ""}`}
          onClick={() => setTab("manage")}
        >
          Manage Tasks
        </button>
      </nav>

      {error && <p className="message message-error">{error}</p>}
      {saveMsg && <p className="message message-success">{saveMsg}</p>}

      {store === null ? (
        <p className="muted">Loading…</p>
      ) : tab === "history" ? (
        <HistoryView store={store} />
      ) : tab === "buildup" ? (
        <HabitView store={store} onSave={handleHabitSave} />
      ) : tab === "library" ? (
        <LibraryView store={store} onSave={handleLibrarySave} />
      ) : tab === "todos" ? (
        <TodoList todos={store.todos} onSave={handleTodoSave} today={today} />
      ) : tab === "notes" ? (
        <NotesList notes={store.notes ?? []} onSave={handleNoteSave} />
      ) : (
        <TaskManager store={store} onSave={handleSave} />
      )}
    </main>
  );
}
