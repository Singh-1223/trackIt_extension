import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { generateId } from "../lib/utils";
import { colors, fontSize, radius, spacing } from "../theme";
import type { Task, TaskGroup, TrackItStore } from "../types/index";

interface TaskManagerProps {
  store: TrackItStore;
  onSave: (updated: TrackItStore) => void;
}

export function TaskManager({ store, onSave }: TaskManagerProps) {
  const [addTaskInputs, setAddTaskInputs] = useState<Record<string, string>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const sortedGroups = [...store.groups].sort((a, b) => a.order - b.order);

  function handleAddTask(groupId: string) {
    const title = (addTaskInputs[groupId] ?? "").trim();
    if (!title) return;
    const groupTasks = store.tasks.filter((t) => t.groupId === groupId);
    const newTask: Task = { id: generateId("task"), groupId, title, order: groupTasks.length };
    onSave({ ...store, tasks: [...store.tasks, newTask] });
    setAddTaskInputs((prev) => ({ ...prev, [groupId]: "" }));
  }

  function handleDeleteTask(taskId: string) {
    Alert.alert("Delete task", "Its history entries will remain.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onSave({ ...store, tasks: store.tasks.filter((t) => t.id !== taskId) }),
      },
    ]);
  }

  function handleSaveTaskEdit(taskId: string) {
    const title = editingTitle.trim();
    if (!title) return;
    onSave({ ...store, tasks: store.tasks.map((t) => (t.id === taskId ? { ...t, title } : t)) });
    setEditingTaskId(null);
    setEditingTitle("");
  }

  function handleMoveTask(taskId: string, direction: "up" | "down") {
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const groupTasks = [...store.tasks.filter((t) => t.groupId === task.groupId)].sort(
      (a, b) => a.order - b.order
    );
    const idx = groupTasks.findIndex((t) => t.id === taskId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groupTasks.length) return;
    const swapTask = groupTasks[swapIdx];
    onSave({
      ...store,
      tasks: store.tasks.map((t) => {
        if (t.id === taskId) return { ...t, order: swapTask.order };
        if (t.id === swapTask.id) return { ...t, order: task.order };
        return t;
      }),
    });
  }

  function handleAddGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const newGroup: TaskGroup = { id: generateId("grp"), name, order: store.groups.length };
    onSave({ ...store, groups: [...store.groups, newGroup] });
    setNewGroupName("");
  }

  function handleSaveGroupEdit(groupId: string) {
    const name = editingGroupName.trim();
    if (!name) return;
    onSave({ ...store, groups: store.groups.map((g) => (g.id === groupId ? { ...g, name } : g)) });
    setEditingGroupId(null);
    setEditingGroupName("");
  }

  function handleDeleteGroup(groupId: string) {
    Alert.alert("Delete group", "This will delete the group and all its tasks.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          onSave({
            ...store,
            groups: store.groups.filter((g) => g.id !== groupId),
            tasks: store.tasks.filter((t) => t.groupId !== groupId),
          }),
      },
    ]);
  }

  return (
    <View>
      {sortedGroups.map((group) => {
        const groupTasks = store.tasks
          .filter((t) => t.groupId === group.id)
          .sort((a, b) => a.order - b.order);

        return (
          <View key={group.id} style={s.groupCard}>
            <View style={s.groupHeader}>
              {editingGroupId === group.id ? (
                <View style={s.inlineEdit}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={editingGroupName}
                    onChangeText={setEditingGroupName}
                    autoFocus
                    onSubmitEditing={() => handleSaveGroupEdit(group.id)}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={s.saveBtn} onPress={() => handleSaveGroupEdit(group.id)}>
                    <Text style={s.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.cancelBtn}
                    onPress={() => { setEditingGroupId(null); setEditingGroupName(""); }}
                  >
                    <Text style={s.cancelBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.groupHeaderRow}>
                  <Text style={s.groupName}>{group.name}</Text>
                  <View style={s.groupActions}>
                    <TouchableOpacity
                      style={s.secondaryBtn}
                      onPress={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); }}
                    >
                      <Text style={s.secondaryBtnText}>Rename</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.dangerBtn} onPress={() => handleDeleteGroup(group.id)}>
                      <Text style={s.dangerBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {groupTasks.map((task, idx) => (
              <View key={task.id} style={s.taskRow}>
                {editingTaskId === task.id ? (
                  <View style={s.inlineEdit}>
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      value={editingTitle}
                      onChangeText={setEditingTitle}
                      autoFocus
                      onSubmitEditing={() => handleSaveTaskEdit(task.id)}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={s.saveBtn} onPress={() => handleSaveTaskEdit(task.id)}>
                      <Text style={s.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => { setEditingTaskId(null); setEditingTitle(""); }}
                    >
                      <Text style={s.cancelBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={s.orderBtns}>
                      <TouchableOpacity
                        style={[s.orderBtn, idx === 0 && s.orderBtnDisabled]}
                        disabled={idx === 0}
                        onPress={() => handleMoveTask(task.id, "up")}
                      >
                        <Text style={s.orderBtnText}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.orderBtn, idx === groupTasks.length - 1 && s.orderBtnDisabled]}
                        disabled={idx === groupTasks.length - 1}
                        onPress={() => handleMoveTask(task.id, "down")}
                      >
                        <Text style={s.orderBtnText}>▼</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={s.taskTitle}>{task.title}</Text>
                    <TouchableOpacity
                      style={s.secondaryBtn}
                      onPress={() => { setEditingTaskId(task.id); setEditingTitle(task.title); }}
                    >
                      <Text style={s.secondaryBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.dangerBtn} onPress={() => handleDeleteTask(task.id)}>
                      <Text style={s.dangerBtnText}>Del</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}

            <View style={s.addTaskRow}>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder="New task title…"
                placeholderTextColor={colors.inkSoft}
                value={addTaskInputs[group.id] ?? ""}
                onChangeText={(v) => setAddTaskInputs((prev) => ({ ...prev, [group.id]: v }))}
                onSubmitEditing={() => handleAddTask(group.id)}
                returnKeyType="done"
              />
              <TouchableOpacity style={s.addBtn} onPress={() => handleAddTask(group.id)}>
                <Text style={s.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <View style={s.addGroupRow}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="New group name…"
          placeholderTextColor={colors.inkSoft}
          value={newGroupName}
          onChangeText={setNewGroupName}
          onSubmitEditing={handleAddGroup}
          returnKeyType="done"
        />
        <TouchableOpacity style={s.addBtn} onPress={handleAddGroup}>
          <Text style={s.addBtnText}>Add group</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  groupCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  groupHeader: { marginBottom: spacing.xs },
  groupHeaderRow: { flexDirection: "row", alignItems: "center" },
  groupName: { flex: 1, fontSize: fontSize.md, fontWeight: "700", color: colors.ink },
  groupActions: { flexDirection: "row", gap: spacing.xs },
  inlineEdit: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: fontSize.sm,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  saveBtnText: { color: colors.white, fontSize: fontSize.xs, fontWeight: "700" },
  cancelBtn: { backgroundColor: colors.border, borderRadius: radius.xs, paddingHorizontal: spacing.xs + 2, paddingVertical: 5 },
  cancelBtnText: { color: colors.inkSoft, fontSize: fontSize.xs },
  secondaryBtn: { backgroundColor: colors.border, borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  secondaryBtnText: { fontSize: fontSize.xs, color: colors.ink, fontWeight: "600" },
  dangerBtn: { backgroundColor: colors.dangerBg, borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  dangerBtnText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: "600" },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderBtns: { gap: 2 },
  orderBtn: { backgroundColor: colors.border, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  orderBtnDisabled: { opacity: 0.3 },
  orderBtnText: { fontSize: 10, color: colors.inkSoft },
  taskTitle: { flex: 1, fontSize: fontSize.sm, color: colors.ink },
  addTaskRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs, alignItems: "center" },
  addGroupRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2 },
  addBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: "700" },
});
