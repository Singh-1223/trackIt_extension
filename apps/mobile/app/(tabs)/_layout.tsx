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
          headerShown: false,
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
            title: "Home",
            tabBarLabel: "Home",
            tabBarIcon: tabIcon("home-outline", "home"),
          }}
        />
        <Tabs.Screen
          name="today"
          options={{
            title: "Today",
            tabBarLabel: "Today",
            tabBarIcon: tabIcon("sunny-outline", "sunny"),
          }}
        />
        <Tabs.Screen
          name="todos"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen name="reflections" options={{ href: null }} />
        <Tabs.Screen
          name="history"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="manage"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </StoreContext.Provider>
  );
}
