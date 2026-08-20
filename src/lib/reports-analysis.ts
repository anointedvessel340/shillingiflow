import { parseLocalDate } from "@/components/date-time-picker";
import { formatCurrency } from "@/lib/format";

export type ReportTx = {
  id: string;
  amount: number | string;
  type: string;
  category_id: string | null;
  date: string;
  description: string | null;
  workspace: string;
};

export type ReportCategory = { id: string; name: string; color: string | null };

type Range = { start: Date; end: Date };

/**
 * Identical maths to the previous single-page Reports view — extracted only so
 * the tabbed layout can share it. No calculation was changed.
 */
export function analyseReport(
  txs: ReportTx[],
  catMap: Map<string, ReportCategory>,
  period: Range,
  prev: Range,
) {
  const inPeriod = (d: string) => {
    const t = parseLocalDate(d).getTime();
    return t >= period.start.getTime() && t <= period.end.getTime();
  };
  const inPrev = (d: string) => {
    const t = parseLocalDate(d).getTime();
    return t >= prev.start.getTime() && t <= prev.end.getTime();
  };
  let inn = 0, out = 0, prevIn = 0, prevOut = 0;
  const catTot = new Map<string, number>();
  const prevCatTot = new Map<string, number>();
  const incomeCatTot = new Map<string, number>();
  const daily = new Map<string, { in: number; out: number }>();
  const heat = new Map<string, number>();
  const periodTxs: ReportTx[] = [];
  for (const t of txs) {
    const amt = Number(t.amount) || 0;
    if (inPeriod(t.date)) {
      periodTxs.push(t);
      if (t.type === "income") inn += amt; else if (t.type === "expense") out += amt;
      if (t.type === "expense" && t.category_id) catTot.set(t.category_id, (catTot.get(t.category_id) ?? 0) + amt);
      if (t.type === "income" && t.category_id) incomeCatTot.set(t.category_id, (incomeCatTot.get(t.category_id) ?? 0) + amt);
      const d = daily.get(t.date) ?? { in: 0, out: 0 };
      if (t.type === "income") d.in += amt; else if (t.type === "expense") d.out += amt;
      daily.set(t.date, d);
      if (t.type === "expense") heat.set(t.date, (heat.get(t.date) ?? 0) + amt);
    } else if (inPrev(t.date)) {
      if (t.type === "income") prevIn += amt; else if (t.type === "expense") prevOut += amt;
      if (t.type === "expense" && t.category_id) prevCatTot.set(t.category_id, (prevCatTot.get(t.category_id) ?? 0) + amt);
    }
  }
  const trend = Array.from(daily.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, income: v.in, expense: v.out }));
  const sorted = Array.from(catTot.entries()).sort(([, a], [, b]) => b - a);
  const top6 = sorted.slice(0, 6).map(([id, v]) => ({
    id,
    name: catMap.get(id)?.name ?? "Uncategorised",
    value: v,
    color: catMap.get(id)?.color ?? "#C9A24B",
  }));
  const rest = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
  const donut = rest > 0 ? [...top6, { id: "other", name: "Other", value: rest, color: "#8B8D97" }] : top6;
  const totalSpend = out;
  const momData = [
    { label: "Previous", income: prevIn, expense: prevOut },
    { label: "Current", income: inn, expense: out },
  ];
  const netChange = (inn - out) - (prevIn - prevOut);
  const netPctBase = Math.abs(prevIn - prevOut);
  const netPct = netPctBase > 0 ? (netChange / netPctBase) * 100 : 0;

  const waterfall = [
    { label: "Start", v: 0, cumulative: 0 },
    { label: "Income", v: inn, cumulative: inn },
    ...top6.map((c, i) => {
      const prevCum = i === 0 ? inn : inn - top6.slice(0, i).reduce((s, x) => s + x.value, 0);
      return { label: c.name, v: -c.value, cumulative: prevCum - c.value };
    }),
    { label: "End", v: 0, cumulative: inn - out },
  ];

  return {
    inn, out, net: inn - out, prevIn, prevOut, trend, donut, totalSpend, momData, netPct, heat, waterfall,
    top6, catTot, prevCatTot, incomeCatTot, periodTxs,
  };
}

export type ReportAnalysis = ReturnType<typeof analyseReport>;

/** Short, strictly factual observations derived from the numbers above. */
export function buildInsights(
  a: ReportAnalysis,
  catMap: Map<string, ReportCategory>,
  currency: string,
  periodLabel: string,
): string[] {
  const out: string[] = [];
  const label = periodLabel.toLowerCase();

  // 1. Biggest expense category movement vs the previous period.
  let bestId: string | null = null;
  let bestDelta = 0;
  for (const [id, v] of a.catTot) {
    const before = a.prevCatTot.get(id) ?? 0;
    if (before <= 0) continue;
    const pct = ((v - before) / before) * 100;
    if (Math.abs(pct) > Math.abs(bestDelta) && Math.abs(v - before) > 0) {
      bestDelta = pct;
      bestId = id;
    }
  }
  if (bestId) {
    const name = catMap.get(bestId)?.name ?? "Uncategorised";
    const dir = bestDelta >= 0 ? "more" : "less";
    const big = a.periodTxs.filter(
      (t) => t.category_id === bestId && t.type === "expense" && Number(t.amount) >= 1000,
    ).length;
    const driver = big > 0 ? `, driven mainly by ${big} entr${big === 1 ? "y" : "ies"} over ${formatCurrency(1000, { currency })}` : "";
    out.push(`You spent ${Math.abs(bestDelta).toFixed(0)}% ${dir} on ${name} this ${label}${driver}.`);
  } else if (a.top6.length > 0) {
    const share = a.totalSpend > 0 ? (a.top6[0].value / a.totalSpend) * 100 : 0;
    out.push(`${a.top6[0].name} is your largest expense this ${label} at ${share.toFixed(0)}% of all spending.`);
  }

  // 2. Largest income source.
  const topIncome = Array.from(a.incomeCatTot.entries()).sort(([, x], [, y]) => y - x)[0];
  if (topIncome) {
    const name = catMap.get(topIncome[0])?.name ?? "Uncategorised";
    const share = a.inn > 0 ? (topIncome[1] / a.inn) * 100 : 0;
    out.push(`${name} is your largest income source this ${label}, at ${share.toFixed(0)}% of money in.`);
  }

  // 3. Net position vs previous period.
  if (a.prevIn > 0 || a.prevOut > 0) {
    const prevNet = a.prevIn - a.prevOut;
    const delta = a.net - prevNet;
    if (delta !== 0) {
      out.push(
        `Your net is ${formatCurrency(Math.abs(delta), { currency })} ${delta > 0 ? "higher" : "lower"} than the previous ${label}.`,
      );
    }
  } else if (a.net !== 0) {
    out.push(`Net for this ${label} is ${formatCurrency(a.net, { currency })} across ${a.periodTxs.length} entries.`);
  }

  return out.slice(0, 3);
}
