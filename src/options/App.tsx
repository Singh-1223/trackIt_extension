import { startTransition, useCallback, useEffect, useState } from "react";
import { HistoryView } from "../components/HistoryView";
import { HabitView } from "../components/HabitView";
import { NotesList } from "../components/NotesList";
import { TaskManager } from "../components/TaskManager";
import { TodoList } from "../components/TodoList";
import { getStore, saveStore } from "../lib/store";
import { getTodayString } from "../lib/utils";
import type { Note, Todo, TrackItStore } from "../types/index";

type Tab = "history" | "buildup" | "manage" | "todos" | "notes";

export function App() {
  const [store, setStore] = useState<TrackItStore | null>(null);
  const [tab, setTab] = useState<Tab>("history");
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const today = getTodayString();

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

  return (
    <main className="page-shell">
      <section className="hero">
        <span className="hero-badge">TrackIt</span>
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
