import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors, fontSize, spacing } from "../theme";

interface AppLoaderProps {
  /** Optional message shown beneath the animation. */
  message?: string;
  /** Render just the animation without the full-screen centered container. */
  inline?: boolean;
}

const DOT_COUNT = 3;

/**
 * A lively, animated loader used while the store is loading.
 *
 * Combines a rotating gradient-style ring with a row of pulsing dots so the
 * loading state feels alive instead of a static "Loading…" label.
 */
export function AppLoader({ message = "Loading your day…", inline = false }: AppLoaderProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const dots = useRef(Array.from({ length: DOT_COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    const dotLoops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 380, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.delay((DOT_COUNT - i) * 160),
        ])
      )
    );

    spinLoop.start();
    pulseLoop.start();
    dotLoops.forEach((l) => l.start());

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      dotLoops.forEach((l) => l.stop());
    };
  }, [spin, pulse, dots]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const coreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  const animation = (
    <View style={s.animationWrap}>
      {/* Spinning ring with a highlighted arc */}
      <Animated.View style={[s.ring, { transform: [{ rotate }] }]}>
        <View style={s.ringArc} />
      </Animated.View>
      {/* Pulsing core */}
      <Animated.View style={[s.core, { transform: [{ scale }], opacity: coreOpacity }]} />
    </View>
  );

  if (inline) return animation;

  return (
    <View style={s.center}>
      {animation}
      <View style={s.dotsRow}>
        {dots.map((dot, i) => {
          const dScale = dot.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
          const dOpacity = dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
          return (
            <Animated.View
              key={i}
              style={[s.dot, { opacity: dOpacity, transform: [{ scale: dScale }] }]}
            />
          );
        })}
      </View>
      {message ? <Text style={s.message}>{message}</Text> : null}
    </View>
  );
}

const RING_SIZE = 56;

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  animationWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ringArc: {
    position: "absolute",
    top: -4,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 4,
    borderColor: "transparent",
    borderTopColor: colors.accent,
    borderRightColor: colors.accentWarm,
  },
  core: {
    width: RING_SIZE / 2.6,
    height: RING_SIZE / 2.6,
    borderRadius: RING_SIZE / 5.2,
    backgroundColor: colors.accent,
  },
  dotsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentStrong,
  },
  message: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    fontWeight: "600",
  },
});
