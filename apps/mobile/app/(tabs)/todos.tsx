import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CalendarPicker } from "../../components/CalendarPicker";
import { DatePickerTrigger } from "../../components/DatePickerTrigger";
import { AppLoader } from "../../components/AppLoader";
import { TodoList } from "../../components/TodoList";
import { useStoreContext } from "../../hooks/StoreContext";
import { generateId, getTodayString } from "../../lib/utils";
import { colors, fontSize, radius, shadow, spacing, TOP_PADDING } from "../../theme";
import type { Todo } from "../../types/index";

export default function TodosScreen() {
  const { store, loading, save } = useStoreContext();
  const today = getTodayString();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("");
  const [showDuePicker, setShowDuePicker] = useState(false);

  if (loading || !store) {
    return <AppLoader />;
  }

  function handleAdd() {
    const t = title.trim();
    if (!t) return;
    const newTodo: Todo = {
      id: generateId("todo"),
      title: t,
      description: description.trim(),
      dueDate: dueDate.trim(),
      done: false,
      priority: priority ? parseInt(priority, 10) : undefined,
      subTasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    save({ ...store!, todos: [...store!.todos, newTodo] });
    setTitle(""); setDescription(""); setDueDate(""); setPriority("");
    setShowAdd(false);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>To-Dos</Text>
            <Text style={s.sub}>Manage tasks with priorities, due dates, and sub-tasks.</Text>
          </View>
          <TouchableOpacity style={s.addIconBtn} onPress={() => setShowAdd(true)}>
            <Text style={s.addIconText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TodoList
        todos={store.todos}
        onSave={(updated) => save({ ...store, todos: updated })}
        today={today}
      />
      <View style={{ height: spacing.xxl }} />

      {/* Add To-Do Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add To-Do</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.input} placeholder="Title…" placeholderTextColor={colors.inkSoft} value={title} onChangeText={setTitle} />
            <TextInput style={[s.input, { minHeight: 70 }]} placeholder="Description (optional)" placeholderTextColor={colors.inkSoft} value={description} onChangeText={setDescription} multiline />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <DatePickerTrigger
                  label="Due date (optional)"
                  value={dueDate || null}
                  onPress={() => setShowDuePicker(true)}
                />
              </View>
              <TextInput style={[s.input, { width: 80 }]} placeholder="P1–P5" placeholderTextColor={colors.inkSoft} value={priority} onChangeText={setPriority} keyboardType="numeric" />
            </View>
            <CalendarPicker
              visible={showDuePicker}
              selectedDate={dueDate || null}
              mode="start"
              otherDate={null}
              onSelect={(date) => {
                setDueDate(date);
                setShowDuePicker(false);
              }}
              onDismiss={() => setShowDuePicker(false)}
            />
            <TouchableOpacity style={s.btnPrimary} onPress={handleAdd}>
              <Text style={s.btnPrimaryText}>Add To-Do</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: TOP_PADDING },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  sub: { fontSize: fontSize.sm, color: colors.inkSoft },
  addIconBtn: { backgroundColor: colors.accent, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  addIconText: { color: colors.white, fontSize: 22, fontWeight: "700", marginTop: -1 },
  muted: { fontSize: fontSize.sm, color: colors.inkSoft },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.lg },
  modalContent: { backgroundColor: colors.surfaceStrong, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  modalClose: { fontSize: 20, color: colors.inkSoft, padding: spacing.xs },
  input: { backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, fontSize: fontSize.base, color: colors.ink, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.xs },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing.sm + 2, alignItems: "center", marginTop: spacing.xs },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
});
