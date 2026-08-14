export const colors = {
  bg: "#f5efe5",
  surface: "rgba(255, 252, 247, 0.86)",
  surfaceStrong: "#fffaf2",
  surfaceMuted: "rgba(255, 250, 242, 0.65)",
  ink: "#231814",
  inkSoft: "#5f4d43",
  accent: "#b9552f",
  accentStrong: "#8e3e21",
  accentWarm: "#edb263",
  border: "rgba(74, 46, 33, 0.12)",
  success: "#245b3a",
  successBg: "#e8f5ee",
  danger: "#a03d2f",
  dangerBg: "#fde8e8",
  white: "#ffffff",
} as const;

export const radius = {
  lg: 24,
  md: 18,
  sm: 14,
  xs: 8,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const shadow = {
  shadowColor: "#4f3122",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 20,
  elevation: 6,
} as const;

export const priorityColors: Record<number, { bg: string; text: string }> = {
  1: { bg: "#fde8e8", text: "#b91c1c" },
  2: { bg: "#fef3cd", text: "#92400e" },
  3: { bg: "#e0f2fe", text: "#0369a1" },
  4: { bg: "#f0fdf4", text: "#166534" },
  5: { bg: "rgba(74,46,33,0.08)", text: "#5f4d43" },
};

import { Platform, StatusBar } from "react-native";

/** Safe top padding that clears the status bar on both platforms */
export const TOP_PADDING = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 12 : 52;
