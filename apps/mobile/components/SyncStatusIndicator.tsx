import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors, fontSize } from "../theme";

export type SyncStatus = "idle" | "pushing" | "pulling" | "error" | "offline";

interface Props {
  status: SyncStatus;
}

const SUCCESS_DISPLAY_MS = 3000;

export function SyncStatusIndicator({ status }: Props) {
  const [showSuccess, setShowSuccess] = useState(false);
  const prevStatus = useRef<SyncStatus>(status);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const wasSyncing = prevStatus.current === "pushing" || prevStatus.current === "pulling";
    if (wasSyncing && status === "idle") {
      setShowSuccess(true);
      successTimer.current = setTimeout(() => setShowSuccess(false), SUCCESS_DISPLAY_MS);
    }
    if (status !== "idle") {
      setShowSuccess(false);
      if (successTimer.current) { clearTimeout(successTimer.current); successTimer.current = null; }
    }
    prevStatus.current = status;
    return () => { if (successTimer.current) clearTimeout(successTimer.current); };
  }, [status]);

  useEffect(() => {
    if (status === "pushing" || status === "pulling") {
      spinAnim.setValue(0);
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
  }, [status, spinAnim]);

  if (status === "idle" && !showSuccess) return null;

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  if (status === "pushing" || status === "pulling") {
    return (
      <View style={s.container}>
        <Animated.Text style={[s.icon, s.syncing, { transform: [{ rotate: spin }] }]}>↻</Animated.Text>
      </View>
    );
  }
  if (status === "idle" && showSuccess) {
    return (
      <View style={s.container}>
        <Text style={[s.icon, s.success]}>✓</Text>
      </View>
    );
  }
  if (status === "error") {
    return (
      <View style={s.container}>
        <Text style={[s.icon, s.error]}>!</Text>
      </View>
    );
  }
  if (status === "offline") {
    return (
      <View style={s.container}>
        <Text style={[s.icon, s.offline]}>✕</Text>
      </View>
    );
  }
  return null;
}

const s = StyleSheet.create({
  container: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.border,
  },
  icon: { fontSize: fontSize.sm, fontWeight: "700", lineHeight: 20 },
  syncing: { color: colors.accent },
  success: { color: colors.success },
  error: { color: colors.danger },
  offline: { color: colors.inkSoft },
});
