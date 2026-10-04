/**
 * Schedule & Custom Weekday Calculation Utilities
 * Python weekday standard: 0 = Dushanba (Monday) ... 6 = Yakshanba (Sunday)
 */

export const WEEKDAYS_MAP = [
  { id: 0, label: "Dushanba", short: "Du", legacyType: "odd" },
  { id: 1, label: "Seshanba", short: "Se", legacyType: "even" },
  { id: 2, label: "Chorshanba", short: "Chor", legacyType: "odd" },
  { id: 3, label: "Payshanba", short: "Pay", legacyType: "even" },
  { id: 4, label: "Juma", short: "Ju", legacyType: "odd" },
  { id: 5, label: "Shanba", short: "Shan", legacyType: "even" },
  { id: 6, label: "Yakshanba", short: "Yak", legacyType: null },
];

export const LEGACY_DAYS_MAP = {
  odd: [0, 2, 4],
  even: [1, 3, 5],
  everyday: [0, 1, 2, 3, 4, 5],
};

/**
 * Normalizes any day representation into a sorted list of integer weekday indices (0-6).
 */
export function normalizeCustomDays(customDays, legacyDays) {
  if (Array.isArray(customDays) && customDays.length > 0) {
    const valid = customDays
      .map(Number)
      .filter((d) => !isNaN(d) && d >= 0 && d <= 6);
    if (valid.length > 0) {
      return Array.from(new Set(valid)).sort((a, b) => a - b);
    }
  }

  if (typeof legacyDays === "string" && LEGACY_DAYS_MAP[legacyDays]) {
    return LEGACY_DAYS_MAP[legacyDays];
  }

  return [0, 2, 4]; // Default: Du, Chor, Ju
}

/**
 * Converts JS Date.getDay() (0=Sun, 1=Mon... 6=Sat) to Python weekday (0=Mon... 6=Sun)
 */
export function jsToPythonWeekday(jsDay) {
  return (jsDay + 6) % 7;
}

/**
 * Calculates all scheduled lesson dates in a specific month for a given custom_days array.
 * @param {number[]} customDays - list of weekday numbers (0-6)
 * @param {number} year - full year e.g. 2026
 * @param {number} month - 1-based month (1-12)
 * @returns {{ count: number, dates: string[] }}
 */
export function getMonthLessonCalculation(customDays = [0, 2, 4], year, month) {
  const normalized = normalizeCustomDays(customDays);
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || now.getMonth() + 1;

  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const dates = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(targetYear, targetMonth - 1, day);
    const pyDay = jsToPythonWeekday(d.getDay());
    if (normalized.includes(pyDay)) {
      const monthStr = String(targetMonth).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");
      dates.push(`${targetYear}-${monthStr}-${dayStr}`);
    }
  }

  return {
    count: dates.length,
    dates,
    year: targetYear,
    month: targetMonth,
  };
}

/**
 * Formats custom days to Uzbek display text.
 * @param {number[]} customDays
 * @param {boolean} full - true for "Dushanba, Chorshanba", false for "Du, Chor"
 */
export function formatDaysDisplay(customDays, full = false) {
  const normalized = normalizeCustomDays(customDays);
  return normalized
    .map((dayIdx) => {
      const match = WEEKDAYS_MAP.find((w) => w.id === dayIdx);
      if (!match) return "";
      return full ? match.label : match.short;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Checks if a specific date (YYYY-MM-DD or Date object) is a scheduled lesson day.
 */
export function isScheduledLessonDate(dateVal, customDays) {
  if (!dateVal) return false;
  const d = typeof dateVal === "string" ? new Date(dateVal + "T00:00:00") : dateVal;
  if (isNaN(d.getTime())) return false;
  const pyDay = jsToPythonWeekday(d.getDay());
  const normalized = normalizeCustomDays(customDays);
  return normalized.includes(pyDay);
}
