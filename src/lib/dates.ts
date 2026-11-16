/** Local calendar date as YYYY-MM-DD (the user's day, not UTC). */
export function toLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
}

export function friendlyDate(s: string, today: string): string {
  if (s === today) return "Today";
  if (s === addDays(today, -1)) return "Yesterday";
  return parseLocalDate(s).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function shortDate(s: string): string {
  return parseLocalDate(s).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
