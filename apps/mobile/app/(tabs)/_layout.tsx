import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StoreContext } from "../../hooks/StoreContext";
import { useStore } from "../../hooks/useStore";
import { colors, fontSize } from "../../theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IoniconName, activeName: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? activeName : name} size={22} color={color} />
  );
}

export default function TabsLayout() {
  const storeValue = useStore();

  return (
    <StoreContext.Provider value={storeValue}>
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
          options={{
            title: "Today",
            tabBarLabel: "Today",
            tabBarIcon: tabIcon("sunny-outline", "sunny"),
          }}
        />
        <Tabs.Screen
          name="todos"
          options={{
            title: "To-Dos",
            tabBarLabel: "To-Dos",
            tabBarIcon: tabIcon("checkmark-circle-outline", "checkmark-circle"),
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: "Build-Up",
            tabBarLabel: "Build-Up",
            tabBarIcon: tabIcon("flame-outline", "flame"),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarLabel: "Library",
            tabBarIcon: tabIcon("book-outline", "book"),
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            title: "Notes",
            tabBarLabel: "Notes",
            tabBarIcon: tabIcon("document-text-outline", "document-text"),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarLabel: "History",
            tabBarIcon: tabIcon("time-outline", "time"),
          }}
        />
        <Tabs.Screen
          name="manage"
          options={{
            title: "Manage",
            tabBarLabel: "Manage",
            tabBarIcon: tabIcon("settings-outline", "settings"),
          }}
        />
      </Tabs>
    </StoreContext.Provider>
  );
}
