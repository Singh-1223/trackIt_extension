export function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(y, m - 1, d));
}

export function getLastNDays(n: number): string[] {
  const result: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    result.push(`${y}-${mo}-${day}`);
  }
  return result;
}

export function generateId(prefix = "ti"): string {
  return [prefix, Date.now().toString(36), Math.random().toString(36).slice(2, 8)].join("_");
}

export function pruneOldEntries(
  entries: import("../types/index").DayEntry[],
  cutoffDays = 90
): import("../types/index").DayEntry[] {
  const cutoff = getLastNDays(cutoffDays + 1).at(-1) ?? "";
  return entries.filter((e) => e.date >= cutoff);
}
