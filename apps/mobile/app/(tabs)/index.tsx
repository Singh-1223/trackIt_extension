import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AppLoader } from "../../components/AppLoader";
import { SyncStatusIndicator } from "../../components/SyncStatusIndicator";
import { useStoreContext } from "../../hooks/StoreContext";
import { colors, fontSize, radius, shadow, spacing, TOP_PADDING } from "../../theme";

type Feature = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route: Href;
  meta?: string;
  tint: string;
  iconColor: string;
};

export default function HomeScreen() {
  const { store, loading, error, syncStatus, refresh, refreshing } = useStoreContext();
  const { signOut } = useAuth();
  const router = useRouter();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (refreshing) {
      const loop = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
      );
      loop.start();
      return () => {
        loop.stop();
        spin.setValue(0);
      };
    }
  }, [refreshing, spin]);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  if (loading || !store) {
    return <AppLoader />;
  }

  const pendingTodos = store.todos.filter((todo) => !todo.done).length;
  const readingBooks = (store.books ?? []).filter((book) => book.status === "reading").length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const features: Feature[] = [
    {
      title: "Daily Grind",
      description: "Plan your groups and tasks",
      icon: "checkbox-outline",
      route: "/manage",
      meta: `${store.tasks.length} task${store.tasks.length === 1 ? "" : "s"}`,
      tint: "#fbe6dc",
      iconColor: colors.accentStrong,
    },
    {
      title: "To-Dos",
      description: "Keep one-off work moving",
      icon: "checkmark-circle-outline",
      route: "/todos",
      meta: pendingTodos ? `${pendingTodos} pending` : "All clear",
      tint: "#e8f5ee",
      iconColor: colors.success,
    },
    {
      title: "Build-Up",
      description: "Grow your habits",
      icon: "flame-outline",
      route: "/habits",
      meta: `${store.habits.length} habit${store.habits.length === 1 ? "" : "s"}`,
      tint: "#fff0d9",
      iconColor: "#9a5a16",
    },
    {
      title: "Library",
      description: "Track books and learning",
      icon: "book-outline",
      route: "/library",
      meta: readingBooks ? `${readingBooks} reading` : "Your reading list",
      tint: "#e8eefb",
      iconColor: "#385d9d",
    },
    {
      title: "Notes",
      description: "Capture ideas and references",
      icon: "document-text-outline",
      route: "/notes",
      meta: `${store.notes.length} note${store.notes.length === 1 ? "" : "s"}`,
      tint: "#f1eafa",
      iconColor: "#755096",
    },
    {
      title: "History",
      description: "Review your progress",
      icon: "time-outline",
      route: "/history",
      meta: "Review progress",
      tint: "#e5f4f1",
      iconColor: "#257167",
    },
    {
      title: "Reflections",
      description: "Memories, gratitude, and daily moments",
      icon: "heart-outline",
      route: "/reflections" as Href,
      meta: `${(store.reflections ?? []).length} entries`,
      tint: "#fde7e1",
      iconColor: "#a34c52",
    },
  ];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.brand}>TrackIt</Text>
          <View style={s.headerActions}>
            <SyncStatusIndicator status={syncStatus} />
            <TouchableOpacity
              onPress={() => refresh()}
              disabled={refreshing}
              accessibilityLabel="Refresh data"
              style={s.signOutBtn}
            >
              <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
                <Ionicons name="refresh-outline" size={19} color={colors.inkSoft} />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => signOut()} accessibilityLabel="Sign out" style={s.signOutBtn}>
              <Ionicons name="log-out-outline" size={19} color={colors.inkSoft} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.greeting}>{greeting}.</Text>
        <Text style={s.headerSub}>Pick up where you left off.</Text>
      </View>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <TouchableOpacity style={s.todayCard} onPress={() => router.push("/today" as Href)} activeOpacity={0.85} accessibilityLabel="Open Today">
        <View style={s.todayIcon}>
          <Ionicons name="sunny" size={24} color={colors.accentStrong} />
        </View>
        <View style={s.todayContent}>
          <Text style={s.todayEyebrow}>YOUR DAILY VIEW</Text>
          <Text style={s.todayTitle}>Today</Text>
          <Text style={s.todaySub}>Your tasks, habits, and focus in one place</Text>
        </View>
        <View style={s.todayArrow}>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </View>
      </TouchableOpacity>

      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Explore</Text>
        <Text style={s.sectionMeta}>{features.length} tools</Text>
      </View>
      <View style={s.featureGrid}>
        {features.map((feature) => (
          <TouchableOpacity
            key={feature.title}
            style={s.featureCard}
            onPress={() => router.push(feature.route)}
            activeOpacity={0.8}
            accessibilityLabel={`Open ${feature.title}`}
          >
            <View style={[s.iconWrap, { backgroundColor: feature.tint }]}>
              <Ionicons name={feature.icon} size={20} color={feature.iconColor} />
            </View>
            <Text style={s.featureTitle}>{feature.title}</Text>
            <Text style={s.featureDescription} numberOfLines={1}>{feature.description}</Text>
            {feature.meta ? <Text style={s.featureMeta}>{feature.meta}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: TOP_PADDING },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  muted: { fontSize: fontSize.sm, color: colors.inkSoft },
  header: { marginBottom: spacing.lg },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  brand: { fontSize: fontSize.md, color: colors.accentStrong, fontWeight: "800", letterSpacing: 0.3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  signOutBtn: { backgroundColor: colors.surfaceStrong, borderRadius: 99, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  greeting: { fontSize: fontSize.xxl, color: colors.ink, fontWeight: "800", marginBottom: 2 },
  headerSub: { fontSize: fontSize.base, color: colors.inkSoft },
  errorText: { fontSize: fontSize.sm, color: colors.danger, marginBottom: spacing.md },
  todayCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xl, ...shadow },
  todayIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentWarm, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  todayContent: { flex: 1 },
  todayEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: "rgba(255,255,255,0.72)", marginBottom: 2 },
  todayTitle: { fontSize: fontSize.lg, color: colors.white, fontWeight: "800", marginBottom: 2 },
  todaySub: { fontSize: fontSize.xs, color: "rgba(255,255,255,0.85)" },
  todayArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  sectionMeta: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "700" },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  featureCard: {
    width: "48.5%",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 118,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  featureTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.ink, marginBottom: 2 },
  featureDescription: { fontSize: fontSize.xs, color: colors.inkSoft },
  featureMeta: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "700", marginTop: "auto", paddingTop: spacing.xs },
});
