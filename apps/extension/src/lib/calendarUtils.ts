export interface DayCell {
  date: string; // ISO format YYYY-MM-DD
  dayOfMonth: number; // 1-31
  isCurrentMonth: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

export interface MonthGridData {
  year: number;
  month: number; // 0-indexed (JS convention)
  monthName: string; // e.g. "January"
  days: DayCell[][]; // weeks array, each containing 7 day cells
  totalDaysInMonth: number;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_ABBREVS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Returns YYYY-MM-DD string for a Date object */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns human-readable string like "Jan 15, 2025" */
export function formatDateHuman(isoDate: string): string {
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1; // 0-indexed
  const day = Number(dayStr);
  return `${MONTH_ABBREVS[month]} ${day}, ${year}`;
}

/** Returns inclusive day count between two ISO date strings (difference in days + 1) */
export function computeDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

/** Returns the grid data for a given year/month: array of weeks, each an array of day cells */
export function getMonthGrid(year: number, month: number): MonthGridData {
  const today = formatDateISO(new Date());
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  // First day of the month (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Build all day cells for the grid
  const cells: DayCell[] = [];

  // Add cells from previous month to fill the first week
  if (firstDayOfWeek > 0) {
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const date = formatDateISO(new Date(prevYear, prevMonth, day));
      cells.push({
        date,
        dayOfMonth: day,
        isCurrentMonth: false,
        isToday: date === today,
        isDisabled: false,
      });
    }
  }

  // Add cells for the current month
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const date = formatDateISO(new Date(year, month, day));
    cells.push({
      date,
      dayOfMonth: day,
      isCurrentMonth: true,
      isToday: date === today,
      isDisabled: false,
    });
  }

  // Add cells from next month to complete the last week
  const remainingCells = 7 - (cells.length % 7);
  if (remainingCells < 7) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let day = 1; day <= remainingCells; day++) {
      const date = formatDateISO(new Date(nextYear, nextMonth, day));
      cells.push({
        date,
        dayOfMonth: day,
        isCurrentMonth: false,
        isToday: date === today,
        isDisabled: false,
      });
    }
  }

  // Split cells into weeks of 7
  const days: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    days.push(cells.slice(i, i + 7));
  }

  return {
    year,
    month,
    monthName: MONTH_NAMES[month],
    days,
    totalDaysInMonth,
  };
}

/** Determines if a date should be disabled given constraints */
export function isDateDisabled(
  date: string,
  mode: "start" | "end",
  otherDate: string | null
): boolean {
  if (!otherDate) {
    return false;
  }

  if (mode === "end") {
    // When selecting end date, disable dates before the start date
    return date < otherDate;
  }

  // When selecting start date, disable dates after the end date
  return date > otherDate;
}
