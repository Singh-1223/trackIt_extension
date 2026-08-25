import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { repackPriorities, sortedTodos } from "../lib/store";
import { generateId } from "../lib/utils";
import { colors, fontSize, priorityColors, radius, spacing } from "../theme";
import type { SubTask, Todo } from "../types/index";
import { CalendarPicker } from "./CalendarPicker";
import { DatePickerTrigger } from "./DatePickerTrigger";

interface TodoListProps {
  todos: Todo[];
  onSave: (updated: Todo[]) => void;
  compact?: boolean;
  today: string;
}

function dueBadgeStyle(dueDate: string, today: string) {
  if (!dueDate) return null;
  if (dueDate < today) return { bg: colors.dangerBg, text: colors.danger, label: "Overdue" };
  if (dueDate === today) return { bg: "#fff3e0", text: "#e65100", label: "Today" };
  return null;
}

function formatDue(dueDate: string, today: string): string {
  if (!dueDate) return "";
  if (dueDate === today) return "Today";
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

function formatCreatedAt(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

const PRIORITIES = [
  { value: null, label: "No priority" },
  { value: 1, label: "P1 — Critical" },
  { value: 2, label: "P2 — High" },
  { value: 3, label: "P3 — Medium" },
  { value: 4, label: "P4 — Low" },
  { value: 5, label: "P5 — Someday" },
] as const;

export function TodoList({ todos, onSave, compact = false, today }: TodoListProps) {
  const { pending, done } = sortedTodos(todos);

  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addDue, setAddDue] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editPriority, setEditPriority] = useState<number | null>(null);

  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [subAddTitle, setSubAddTitle] = useState<Record<string, string>>({});
  const [subAddDue, setSubAddDue] = useState<Record<string, string>>({});
  const [expandedDone, setExpandedDone] = useState(false);
  const [showEditDuePicker, setShowEditDuePicker] = useState(false);
  const [showSubDuePicker, setShowSubDuePicker] = useState<string | null>(null);

  function startEdit(todo: Todo) {
    setEditId(todo.id);
    setEditTitle(todo.title);
    setEditDesc(todo.description);
    setEditDue(todo.dueDate);
    setEditPriority(todo.priority ?? null);
  }

  function cancelEdit() {
    setEditId(null);
  }

  function handleAdd() {
    const title = addTitle.trim();
    if (!title) return;
    const newTodo: Todo = {
      id: generateId("todo"),
      title,
      description: addDesc.trim(),
      dueDate: addDue,
      done: false,
      subTasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSave([...todos, newTodo]);
    setAddTitle("");
    setAddDesc("");
    setAddDue("");
  }

  function handleSaveEdit() {
    if (!editId || !editTitle.trim()) return;
    onSave(
      todos.map((t) =>
        t.id === editId
          ? {
              ...t,
              title: editTitle.trim(),
              description: editDesc.trim(),
              dueDate: editDue,
              priority: editPriority ?? undefined,
              updatedAt: Date.now(),
            }
          : t
      )
    );
    cancelEdit();
  }

  function handleToggleDone(todo: Todo) {
    const nowDone = !todo.done;
    const updated = todos.map((t) => {
      if (t.id !== todo.id) return t;
      const subTasks = nowDone
        ? t.subTasks.map((s) => ({ ...s, done: true, updatedAt: Date.now() }))
        : t.subTasks;
      return { ...t, done: nowDone, subTasks, updatedAt: Date.now() };
    });
    onSave(repackPriorities(updated));
  }

  function handleToggleSubTask(todo: Todo, subId: string) {
    const updatedSubTasks = todo.subTasks.map((s) =>
      s.id === subId ? { ...s, done: !s.done, updatedAt: Date.now() } : s
    );
    const allDone = updatedSubTasks.length > 0 && updatedSubTasks.every((s) => s.done);
    onSave(
      todos.map((t) =>
        t.id === todo.id
          ? { ...t, subTasks: updatedSubTasks, done: allDone ? true : t.done, updatedAt: Date.now() }
          : t
      )
    );
  }

  function handleAddSubTask(todo: Todo) {
    const title = (subAddTitle[todo.id] ?? "").trim();
    if (!title) return;
    const newSub: SubTask = {
      id: generateId("sub"),
      title,
      dueDate: subAddDue[todo.id] ?? "",
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSave(
      todos.map((t) =>
        t.id === todo.id ? { ...t, subTasks: [...t.subTasks, newSub], updatedAt: Date.now() } : t
      )
    );
    setSubAddTitle((prev) => ({ ...prev, [todo.id]: "" }));
    setSubAddDue((prev) => ({ ...prev, [todo.id]: "" }));
  }

  function handleDeleteSubTask(todo: Todo, subId: string) {
    onSave(
      todos.map((t) =>
        t.id === todo.id
          ? { ...t, subTasks: t.subTasks.filter((s) => s.id !== subId), updatedAt: Date.now() }
          : t
      )
    );
  }

  function handleDelete(id: string) {
    Alert.alert("Delete to-do", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onSave(todos.filter((t) => t.id !== id)) },
    ]);
  }

  function renderSubTasks(todo: Todo, readOnly = false) {
    const expanded = expandedSubtasks[todo.id] ?? false;
    const doneSubs = todo.subTasks.filter((s) => s.done).length;
    return (
      <View style={s.subtaskContainer}>
        <TouchableOpacity
          style={s.subtaskHeader}
          onPress={() => setExpandedSubtasks((prev) => ({ ...prev, [todo.id]: !expanded }))}
        >
          <Text style={s.subtaskChevron}>{expanded ? "▾" : "▸"}</Text>
          <Text style={s.subtaskLabel}>Sub-tasks</Text>
          {todo.subTasks.length > 0 && (
            <View style={s.subtaskBadge}>
              <Text style={s.subtaskBadgeText}>{doneSubs}/{todo.subTasks.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {expanded && (
          <View style={s.subtaskList}>
            {todo.subTasks.map((sub) => (
              <View key={sub.id} style={s.subtaskRow}>
                <TouchableOpacity
                  style={[s.miniCheck, sub.done && s.miniCheckDone]}
                  onPress={() => !readOnly && handleToggleSubTask(todo, sub.id)}
                >
                  {sub.done && <Text style={s.miniCheckMark}>✓</Text>}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[s.subtaskTitle, sub.done && s.subtaskDone]}>{sub.title}</Text>
                  {sub.dueDate ? (
                    <Text style={s.subtaskDueText}>{formatDue(sub.dueDate, today)}</Text>
                  ) : null}
                </View>
                {!readOnly && !compact && (
                  <TouchableOpacity onPress={() => handleDeleteSubTask(todo, sub.id)}>
                    <Text style={s.deleteSmall}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {!readOnly && !compact && editId === todo.id && (
              <View style={s.subtaskAddBlock}>
                <View style={s.subtaskAddRow}>
                  <TextInput
                    style={s.subtaskInput}
                    placeholder="New sub-task…"
                    placeholderTextColor={colors.inkSoft}
                    value={subAddTitle[todo.id] ?? ""}
                    onChangeText={(v) => setSubAddTitle((prev) => ({ ...prev, [todo.id]: v }))}
                    onSubmitEditing={() => handleAddSubTask(todo)}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={s.addSubBtn} onPress={() => handleAddSubTask(todo)}>
                    <Text style={s.addSubBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ marginTop: 4 }}>
                  <DatePickerTrigger
                    label="Sub-task due date (optional)"
                    value={subAddDue[todo.id] || null}
                    onPress={() => setShowSubDuePicker(todo.id)}
                  />
                </View>
                <CalendarPicker
                  visible={showSubDuePicker === todo.id}
                  selectedDate={subAddDue[todo.id] || null}
                  mode="start"
                  otherDate={null}
                  onSelect={(date) => {
                    setSubAddDue((prev) => ({ ...prev, [todo.id]: date }));
                    setShowSubDuePicker(null);
                  }}
                  onDismiss={() => setShowSubDuePicker(null)}
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderTodoCard(todo: Todo, isDone = false) {
    const dueBadge = dueBadgeStyle(todo.dueDate, today);

    return (
      <View key={todo.id} style={[s.card, isDone && s.cardDone]}>
        <View>
            <View style={s.cardRow}>
              <TouchableOpacity
                style={[s.todoCheck, isDone && s.todoCheckDone]}
                onPress={() => handleToggleDone(todo)}
              >
                {isDone && <Text style={s.miniCheckMark}>✓</Text>}
              </TouchableOpacity>
              <Text style={[s.todoTitle, isDone && s.todoTitleDone]}>{todo.title}</Text>
              <View style={s.badges}>
                {todo.priority != null && (
                  <View style={[s.priorityBadge, { backgroundColor: priorityColors[todo.priority].bg }]}>
                    <Text style={[s.priorityBadgeText, { color: priorityColors[todo.priority].text }]}>
                      P{todo.priority}
                    </Text>
                  </View>
                )}
                {todo.dueDate && (
                  <View style={[s.dueBadge, dueBadge ? { backgroundColor: dueBadge.bg } : s.dueBadgeDefault]}>
                    <Text style={[s.dueBadgeText, dueBadge ? { color: dueBadge.text } : {}]}>
                      {dueBadge?.label ?? formatDue(todo.dueDate, today)}
                    </Text>
                  </View>
                )}
              </View>
              {!compact && !isDone && (
                <TouchableOpacity style={s.editBtn} onPress={() => startEdit(todo)}>
                  <Text style={s.editBtnText}>✎</Text>
                </TouchableOpacity>
              )}
              {!compact && isDone && (
                <TouchableOpacity style={s.undoBtn} onPress={() => handleToggleDone(todo)}>
                  <Text style={s.undoBtnText}>↩</Text>
                </TouchableOpacity>
              )}
              {!compact && (
                <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(todo.id)}>
                  <Text style={s.delBtnText}>🗑</Text>
                </TouchableOpacity>
              )}
            </View>
            {!compact && todo.description ? (
              <Text selectable style={s.desc}>{todo.description}</Text>
            ) : null}
            <Text style={s.createdAt}>Added {formatCreatedAt(todo.createdAt)}</Text>
            {renderSubTasks(todo, isDone || compact)}
          </View>
      </View>
    );
  }

  return (
    <View>
      {pending.length === 0 && !compact && (
        <Text style={s.empty}>No pending to-dos. Add one below.</Text>
      )}
      {pending.map((t) => renderTodoCard(t, false))}

      {!compact && done.length > 0 && (
        <View style={s.doneSection}>
          <TouchableOpacity
            style={s.doneSectionHeader}
            onPress={() => setExpandedDone((v) => !v)}
          >
            <Text style={s.doneSectionChevron}>{expandedDone ? "▾" : "▸"}</Text>
            <Text style={s.doneSectionLabel}>Done</Text>
            <View style={s.subtaskBadge}>
              <Text style={s.subtaskBadgeText}>{done.length}</Text>
            </View>
          </TouchableOpacity>
          {expandedDone && done.map((t) => renderTodoCard(t, true))}
        </View>
      )}

      {/* {!compact && (
        <View style={s.addForm}>
          <TextInput
            style={s.input}
            placeholder="New to-do title…"
            placeholderTextColor={colors.inkSoft}
            value={addTitle}
            onChangeText={setAddTitle}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TextInput
            style={[s.input, s.textarea]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.inkSoft}
            value={addDesc}
            onChangeText={setAddDesc}
            multiline
            numberOfLines={2}
          />
          <TextInput
            style={s.input}
            placeholder="Due date (YYYY-MM-DD, optional)"
            placeholderTextColor={colors.inkSoft}
            value={addDue}
            onChangeText={setAddDue}
          />
          <TouchableOpacity style={s.primaryBtn} onPress={handleAdd}>
            <Text style={s.primaryBtnText}>Add To-Do</Text>
          </TouchableOpacity>
        </View>
      )} */}

      {/* Edit To-Do Modal */}
      <Modal visible={editId !== null && !compact} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit To-Do</Text>
              <TouchableOpacity onPress={cancelEdit}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.input} value={editTitle} onChangeText={setEditTitle} placeholder="Title" placeholderTextColor={colors.inkSoft} autoFocus />
            <TextInput style={[s.input, s.textarea]} value={editDesc} onChangeText={setEditDesc} placeholder="Description (optional)" placeholderTextColor={colors.inkSoft} multiline />
            <DatePickerTrigger
              label="Due date (optional)"
              value={editDue || null}
              onPress={() => setShowEditDuePicker(true)}
            />
            <CalendarPicker
              visible={showEditDuePicker}
              selectedDate={editDue || null}
              mode="start"
              otherDate={null}
              onSelect={(date) => {
                setEditDue(date);
                setShowEditDuePicker(false);
              }}
              onDismiss={() => setShowEditDuePicker(false)}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.priorityRow}>
              {PRIORITIES.map((p) => {
                const isSelected = editPriority === p.value;
                const bg = p.value != null ? priorityColors[p.value].bg : colors.border;
                const textColor = p.value != null ? priorityColors[p.value].text : colors.inkSoft;
                return (
                  <TouchableOpacity
                    key={String(p.value)}
                    style={[s.priorityPill, isSelected && { backgroundColor: bg, borderColor: textColor, borderWidth: 1.5 }]}
                    onPress={() => setEditPriority(p.value)}
                  >
                    <Text style={[s.priorityPillText, isSelected && { color: textColor }]}>
                      {p.value != null ? `P${p.value}` : "None"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sub-tasks section inside edit modal */}
            {(() => {
              const editingTodo = todos.find((t) => t.id === editId);
              if (!editingTodo) return null;
              return (
                <View style={s.modalSubtasks}>
                  <Text style={s.modalSubtasksLabel}>Sub-tasks ({editingTodo.subTasks.length})</Text>
                  {editingTodo.subTasks.map((sub) => (
                    <View key={sub.id} style={s.modalSubRow}>
                      <TouchableOpacity
                        style={[s.todoCheck, sub.done && s.todoCheckDone, { width: 18, height: 18, borderRadius: 9 }]}
                        onPress={() => handleToggleSubTask(editingTodo, sub.id)}
                      >
                        {sub.done && <Text style={[s.miniCheckMark, { fontSize: 10 }]}>✓</Text>}
                      </TouchableOpacity>
                      <Text style={[s.modalSubTitle, sub.done && { textDecorationLine: "line-through", color: colors.inkSoft }]}>{sub.title}</Text>
                      <TouchableOpacity onPress={() => handleDeleteSubTask(editingTodo, sub.id)}>
                        <Text style={{ color: colors.danger, fontSize: 10 }}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={s.modalSubAddRow}>
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="New sub-task…"
                      placeholderTextColor={colors.inkSoft}
                      value={subAddTitle[editId!] ?? ""}
                      onChangeText={(v) => setSubAddTitle((prev) => ({ ...prev, [editId!]: v }))}
                      onSubmitEditing={() => handleAddSubTask(editingTodo)}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={s.modalSubAddBtn} onPress={() => handleAddSubTask(editingTodo)}>
                      <Text style={s.modalSubAddBtnText}>＋</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}

            <TouchableOpacity style={s.primaryBtn} onPress={handleSaveEdit}>
              <Text style={s.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  cardDone: { opacity: 0.7 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  todoCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  todoCheckDone: { backgroundColor: colors.success, borderColor: colors.success },
  miniCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  miniCheckDone: { backgroundColor: colors.success, borderColor: colors.success },
  miniCheckMark: { color: colors.white, fontSize: 11, fontWeight: "700" },
  todoTitle: { flex: 1, fontSize: fontSize.base, color: colors.ink, fontWeight: "600" },
  todoTitleDone: { color: colors.inkSoft, textDecorationLine: "line-through" },
  badges: { flexDirection: "row", gap: spacing.xs, flexShrink: 0 },
  priorityBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  priorityBadgeText: { fontSize: fontSize.xs, fontWeight: "700" },
  dueBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  dueBadgeDefault: { backgroundColor: colors.border },
  dueBadgeText: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "600" },
  desc: { fontSize: fontSize.base, color: colors.inkSoft, marginTop: spacing.xs, paddingLeft: 28, lineHeight: 22 },
  createdAt: { fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 2, paddingLeft: 28 },
  editBtn: { backgroundColor: colors.border, borderRadius: radius.xs, paddingHorizontal: 2, paddingVertical: 2 },
  editBtnText: { fontSize: fontSize.xs, color: colors.ink, fontWeight: "600" },
  undoBtn: { backgroundColor: colors.border, borderRadius: radius.xs, paddingHorizontal: 2, paddingVertical: 2 },
  undoBtnText: { fontSize: fontSize.xs, color: colors.ink, fontWeight: "600" },
  delBtn: { borderRadius: radius.xs, paddingHorizontal: 2, paddingVertical: 2, backgroundColor: colors.dangerBg },
  delBtnText: { fontSize: fontSize.xs, color: colors.danger, fontWeight: "600" },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: fontSize.base,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  textarea: { minHeight: 56, textAlignVertical: "top" },
  priorityRow: { marginBottom: spacing.xs },
  priorityPill: {
    backgroundColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginRight: spacing.xs,
  },
  priorityPillText: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "700" },
  editBtnRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  saveBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: "700" },
  cancelBtn: { backgroundColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  cancelBtnText: { color: colors.inkSoft, fontSize: fontSize.sm },
  subtaskContainer: { marginTop: spacing.xs },
  subtaskHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  subtaskChevron: { fontSize: 12, color: colors.inkSoft, width: 12 },
  subtaskLabel: { fontSize: fontSize.sm, color: colors.inkSoft, fontWeight: "600" },
  subtaskBadge: { backgroundColor: colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  subtaskBadgeText: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "600" },
  subtaskList: { paddingLeft: spacing.md },
  subtaskRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 3 },
  subtaskTitle: { fontSize: fontSize.sm, color: colors.ink },
  subtaskDone: { color: colors.inkSoft, textDecorationLine: "line-through" },
  subtaskDueText: { fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 1 },
  deleteSmall: { fontSize: 12, color: colors.danger },
  subtaskAddBlock: { marginTop: spacing.xs },
  subtaskAddRow: { flexDirection: "row", gap: spacing.xs },
  subtaskInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  addSubBtn: { backgroundColor: colors.border, borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  addSubBtnText: { fontSize: fontSize.xs, color: colors.ink, fontWeight: "600" },
  doneSection: { marginBottom: spacing.sm },
  doneSectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  doneSectionChevron: { fontSize: 13, color: colors.inkSoft },
  doneSectionLabel: { fontSize: fontSize.base, color: colors.inkSoft, fontWeight: "600" },
  empty: { fontSize: fontSize.sm, color: colors.inkSoft, marginBottom: spacing.sm },
  addForm: { marginTop: spacing.sm },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing.sm, alignItems: "center" },
  primaryBtnText: { color: colors.white, fontSize: fontSize.base, fontWeight: "700" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.lg },
  modalContent: { backgroundColor: colors.surfaceStrong, borderRadius: radius.lg, padding: spacing.lg },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  modalClose: { fontSize: 20, color: colors.inkSoft, padding: spacing.xs },
  modalSubtasks: { marginTop: spacing.sm, marginBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  modalSubtasksLabel: { fontSize: fontSize.xs, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.xs },
  modalSubRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalSubTitle: { flex: 1, fontSize: fontSize.sm, color: colors.ink },
  modalSubAddRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  modalSubAddBtn: { backgroundColor: colors.accent, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  modalSubAddBtnText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
