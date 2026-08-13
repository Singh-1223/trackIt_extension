import { Tabs } from "expo-router";
import { colors, fontSize } from "../../theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceStrong,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { fontSize: fontSize.xs, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarLabel: "Today" }}
      />
      <Tabs.Screen
        name="todos"
        options={{ title: "To-Dos", tabBarLabel: "To-Dos" }}
      />
      <Tabs.Screen
        name="habits"
        options={{ title: "Build-Up", tabBarLabel: "Build-Up" }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: "Notes", tabBarLabel: "Notes" }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "History", tabBarLabel: "History" }}
      />
      <Tabs.Screen
        name="manage"
        options={{ title: "Manage", tabBarLabel: "Manage" }}
      />
    </Tabs>
  );
}
