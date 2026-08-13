import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NotesList } from "../../components/NotesList";
import { useStore } from "../../hooks/useStore";
import { colors, fontSize, radius, shadow, spacing } from "../../theme";

export default function NotesScreen() {
  const { store, loading, save } = useStore();

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
        <Text style={s.title}>Notes</Text>
        <Text style={s.sub}>Save thoughts, references, and quick notes.</Text>
      </View>
      <NotesList
        notes={store.notes}
        onSave={(updated) => save({ ...store, notes: updated })}
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
