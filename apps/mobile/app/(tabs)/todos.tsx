import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TodoList } from "../../components/TodoList";
import { useStore } from "../../hooks/useStore";
import { getTodayString } from "../../lib/utils";
import { colors, fontSize, radius, shadow, spacing } from "../../theme";

export default function TodosScreen() {
  const { store, loading, save } = useStore();
  const today = getTodayString();

  if (loading || !store) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>To-Dos</Text>
        <Text style={s.sub}>Manage tasks with priorities, due dates, and sub-tasks.</Text>
      </View>
      <TodoList
        todos={store.todos}
        onSave={(updated) => save({ ...store, todos: updated })}
        today={today}
      />
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
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
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  sub: { fontSize: fontSize.sm, color: colors.inkSoft },
  muted: { fontSize: fontSize.sm, color: colors.inkSoft },
});
