import { useState } from "react";
import type { Task, TaskGroup, TrackItStore } from "../types/index";
import { generateId } from "../lib/utils";

interface TaskManagerProps {
  store: TrackItStore;
  onSave: (updated: TrackItStore) => Promise<void>;
}

export function TaskManager({ store, onSave }: TaskManagerProps) {
  const [addTaskInputs, setAddTaskInputs] = useState<Record<string, string>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const sortedGroups = [...store.groups].sort((a, b) => a.order - b.order);

  async function handleAddTask(groupId: string) {
    const title = (addTaskInputs[groupId] ?? "").trim();
    if (!title) return;
    const groupTasks = store.tasks.filter((t) => t.groupId === groupId);
    const newTask: Task = { id: generateId("task"), groupId, title, order: groupTasks.length };
    await onSave({ ...store, tasks: [...store.tasks, newTask] });
    setAddTaskInputs((prev) => ({ ...prev, [groupId]: "" }));
  }

  async function handleDeleteTask(taskId: string) {
    if (!window.confirm("Delete this task? Its history entries will remain.")) return;
    await onSave({ ...store, tasks: store.tasks.filter((t) => t.id !== taskId) });
  }

  async function handleSaveTaskEdit(taskId: string) {
    const title = editingTitle.trim();
    if (!title) return;
    await onSave({ ...store, tasks: store.tasks.map((t) => (t.id === taskId ? { ...t, title } : t)) });
    setEditingTaskId(null);
    setEditingTitle("");
  }

  async function handleMoveTask(taskId: string, direction: "up" | "down") {
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const groupTasks = [...store.tasks.filter((t) => t.groupId === task.groupId)].sort((a, b) => a.order - b.order);
    const idx = groupTasks.findIndex((t) => t.id === taskId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groupTasks.length) return;
    const swapTask = groupTasks[swapIdx];
    await onSave({
      ...store,
      tasks: store.tasks.map((t) => {
        if (t.id === taskId) return { ...t, order: swapTask.order };
        if (t.id === swapTask.id) return { ...t, order: task.order };
        return t;
      })
    });
  }

  async function handleAddGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const newGroup: TaskGroup = { id: generateId("grp"), name, order: store.groups.length };
    await onSave({ ...store, groups: [...store.groups, newGroup] });
    setNewGroupName("");
  }

  async function handleSaveGroupEdit(groupId: string) {
    const name = editingGroupName.trim();
    if (!name) return;
    await onSave({ ...store, groups: store.groups.map((g) => (g.id === groupId ? { ...g, name } : g)) });
    setEditingGroupId(null);
    setEditingGroupName("");
  }

  async function handleDeleteGroup(groupId: string) {
    if (!window.confirm("Delete this group and all its tasks?")) return;
    await onSave({
      ...store,
      groups: store.groups.filter((g) => g.id !== groupId),
      tasks: store.tasks.filter((t) => t.groupId !== groupId)
    });
  }

  return (
    <div>
      <div className="task-manager-groups">
        {sortedGroups.map((group) => {
          const groupTasks = store.tasks
            .filter((t) => t.groupId === group.id)
            .sort((a, b) => a.order - b.order);

          return (
            <div key={group.id} className="task-manager-group">
              <div className="task-manager-group-header">
                {editingGroupId === group.id ? (
                  <>
                    <input
                      className="add-task-input"
                      value={editingGroupName}
                      autoFocus
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveGroupEdit(group.id);
                        if (e.key === "Escape") { setEditingGroupId(null); setEditingGroupName(""); }
                      }}
                    />
                    <button
                      type="button"
                      className="button button-primary"
                      style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                      onClick={() => void handleSaveGroupEdit(group.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                      onClick={() => { setEditingGroupId(null); setEditingGroupName(""); }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="task-manager-group-name">{group.name}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                        onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="button button-danger"
                        style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                        onClick={() => void handleDeleteGroup(group.id)}
                      >
                        Delete group
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="task-manager-task-list">
                {groupTasks.map((task, idx) => (
                  <div key={task.id} className="task-manager-task-row">
                    {editingTaskId === task.id ? (
                      <>
                        <input
                          className="add-task-input"
                          value={editingTitle}
                          autoFocus
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSaveTaskEdit(task.id);
                            if (e.key === "Escape") { setEditingTaskId(null); setEditingTitle(""); }
                          }}
                        />
                        <button
                          type="button"
                          className="button button-primary"
                          style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                          onClick={() => void handleSaveTaskEdit(task.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                          onClick={() => { setEditingTaskId(null); setEditingTitle(""); }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="task-manager-task-title">{task.title}</span>
                        <div className="task-manager-order-btns">
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ padding: "3px 8px", fontSize: "0.75rem", lineHeight: 1 }}
                            disabled={idx === 0}
                            onClick={() => void handleMoveTask(task.id, "up")}
                            aria-label="Move up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ padding: "3px 8px", fontSize: "0.75rem", lineHeight: 1 }}
                            disabled={idx === groupTasks.length - 1}
                            onClick={() => void handleMoveTask(task.id, "down")}
                            aria-label="Move down"
                          >
                            ▼
                          </button>
                        </div>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                          onClick={() => { setEditingTaskId(task.id); setEditingTitle(task.title); }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button button-danger"
                          style={{ padding: "7px 14px", fontSize: "0.82rem" }}
                          onClick={() => void handleDeleteTask(task.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="add-task-form">
                <input
                  className="add-task-input"
                  placeholder="New task title…"
                  value={addTaskInputs[group.id] ?? ""}
                  onChange={(e) =>
                    setAddTaskInputs((prev) => ({ ...prev, [group.id]: e.target.value }))
                  }
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddTask(group.id); }}
                />
                <button
                  type="button"
                  className="button button-primary"
                  style={{ padding: "7px 16px", fontSize: "0.88rem" }}
                  onClick={() => void handleAddTask(group.id)}
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="add-group-bar">
        <input
          className="add-task-input"
          placeholder="New group name…"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleAddGroup(); }}
        />
        <button
          type="button"
          className="button button-primary"
          onClick={() => void handleAddGroup()}
        >
          Add group
        </button>
      </div>
    </div>
  );
}
