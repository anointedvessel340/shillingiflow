export type PeriodKey = "day" | "week" | "month" | "quarter" | "year" | "custom";

export type Period = { start: Date; end: Date; label: string };

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export function computePeriod(key: PeriodKey, custom?: { start: Date; end: Date }): Period {
  const now = new Date();
  if (key === "custom" && custom) return { start: startOfDay(custom.start), end: endOfDay(custom.end), label: "Custom" };
  if (key === "day") return { start: startOfDay(now), end: endOfDay(now), label: "Today" };
  if (key === "week") {
    const s = new Date(now); s.setDate(now.getDate() - now.getDay());
    return { start: startOfDay(s), end: endOfDay(now), label: "This week" };
  }
  if (key === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now), label: "This month" };
  }
  if (key === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { start: new Date(now.getFullYear(), q * 3, 1), end: endOfDay(now), label: "This quarter" };
  }
  return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now), label: "This year" };
}

export function previousPeriod(p: Period): Period {
  const ms = p.end.getTime() - p.start.getTime();
  const end = new Date(p.start.getTime() - 1);
  const start = new Date(end.getTime() - ms);
  return { start, end, label: "Previous" };
}

export function toISODate(d: Date): string { return d.toISOString().slice(0, 10); }
