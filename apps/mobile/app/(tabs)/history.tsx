import { ScrollView, StyleSheet, Text, View } from "react-native";
import { HistoryView } from "../../components/HistoryView";
import { useStoreContext } from "../../hooks/StoreContext";
import { colors, fontSize, radius, shadow, spacing, TOP_PADDING } from "../../theme";

export default function HistoryScreen() {
  const { store, loading } = useStoreContext();

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
        <Text style={s.title}>History</Text>
        <Text style={s.sub}>Review your daily completion across any time range.</Text>
      </View>
      <HistoryView store={store} />
      <View style={{ height: spacing.xxl }} />
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
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  sub: { fontSize: fontSize.sm, color: colors.inkSoft },
  muted: { fontSize: fontSize.sm, color: colors.inkSoft },
});
