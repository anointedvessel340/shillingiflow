import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { computePeriod, previousPeriod, toISODate, type PeriodKey } from "@/lib/period";
import { parseLocalDate } from "@/components/date-time-picker";
import { formatCurrency, formatDate } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend, Area, AreaChart } from "recharts";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — SHILLINGITRACK" }] }),
  component: ReportsPage,
});

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" }, { key: "year", label: "Year" }, { key: "custom", label: "Custom" },
];

function ReportsPage() {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();
  const [periodKey, setPeriodKey] = useState<PeriodKey>("month");
  const [customStart, setCustomStart] = useState(toISODate(new Date(Date.now() - 30 * 86400000)));
  const [customEnd, setCustomEnd] = useState(toISODate(new Date()));
  const [wsFilter, setWsFilter] = useState<"personal" | "business" | "combined">(workspace);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const period = useMemo(() => computePeriod(periodKey, {
    start: new Date(customStart), end: new Date(customEnd),
  }), [periodKey, customStart, customEnd]);
  const prev = useMemo(() => previousPeriod(period), [period]);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name, color, workspace");
      return data ?? [];
    },
  });

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["reports-txs", user?.id, period.start.toISOString(), period.end.toISOString(), wsFilter, categoryFilter],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("transactions")
        .select("id, amount, type, category_id, date, description, workspace")
        .is("deleted_at", null)
        .gte("date", toISODate(prev.start))
        .lte("date", toISODate(period.end));
      if (wsFilter !== "combined") q = q.eq("workspace", wsFilter);
      if (categoryFilter !== "all") q = q.eq("category_id", categoryFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const analysis = useMemo(() => {
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
    const daily = new Map<string, { in: number; out: number }>();
    const heat = new Map<string, number>();
    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      if (inPeriod(t.date)) {
        if (t.type === "income") inn += amt; else if (t.type === "expense") out += amt;
        if (t.type === "expense" && t.category_id) catTot.set(t.category_id, (catTot.get(t.category_id) ?? 0) + amt);
        const d = daily.get(t.date) ?? { in: 0, out: 0 };
        if (t.type === "income") d.in += amt; else if (t.type === "expense") d.out += amt;
        daily.set(t.date, d);
        if (t.type === "expense") heat.set(t.date, (heat.get(t.date) ?? 0) + amt);
      } else if (inPrev(t.date)) {
        if (t.type === "income") prevIn += amt; else if (t.type === "expense") prevOut += amt;
      }
    }
    const trend = Array.from(daily.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, income: v.in, expense: v.out }));
    const sorted = Array.from(catTot.entries()).sort(([, a], [, b]) => b - a);
    const top6 = sorted.slice(0, 6).map(([id, v]) => ({ id, name: catMap.get(id)?.name ?? "Uncategorised", value: v, color: catMap.get(id)?.color ?? "#C9A24B" }));
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

    // Waterfall: starting balance = 0; income + then each top category expense down; end
    const waterfall = [
      { label: "Start", v: 0, cumulative: 0 },
      { label: "Income", v: inn, cumulative: inn },
      ...top6.map((c, i) => {
        const prevCum = i === 0 ? inn : inn - top6.slice(0, i).reduce((s, x) => s + x.value, 0);
        return { label: c.name, v: -c.value, cumulative: prevCum - c.value };
      }),
      { label: "End", v: 0, cumulative: inn - out },
    ];
    return { inn, out, net: inn - out, prevIn, prevOut, trend, donut, totalSpend, momData, netPct, heat, waterfall };
  }, [txs, catMap, period, prev]);

  const showHeat = periodKey === "month" || periodKey === "year";

  const exportCSV = () => {
    const rows = [["date", "type", "category", "workspace", "amount", "description"]];
    const inPeriod = (d: string) => {
      const t = parseLocalDate(d).getTime();
      return t >= period.start.getTime() && t <= period.end.getTime();
    };
    for (const t of txs.filter((x) => inPeriod(x.date))) {
      rows.push([t.date, t.type, catMap.get(t.category_id ?? "")?.name ?? "", t.workspace, String(t.amount), (t.description ?? "").replace(/"/g, '""')]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-${toISODate(period.start)}-${toISODate(period.end)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("SHILLINGITRACK — Report", 14, 18);
    doc.setFontSize(10); doc.text(`${formatDate(period.start)} → ${formatDate(period.end)}  ·  ${wsFilter}`, 14, 26);
    doc.setFontSize(11);
    doc.text(`Money in:  ${formatCurrency(analysis.inn, { currency })}`, 14, 42);
    doc.text(`Money out: ${formatCurrency(analysis.out, { currency })}`, 14, 50);
    doc.text(`Net:       ${formatCurrency(analysis.net, { currency })}`, 14, 58);
    doc.text("Top categories", 14, 74);
    let y = 82;
    for (const c of analysis.donut) { doc.text(`${c.name.padEnd(30, " ")} ${formatCurrency(c.value, { currency })}`, 14, y); y += 7; }
    doc.save(`report-${toISODate(period.start)}-${toISODate(period.end)}.pdf`);
    toast.success("PDF exported");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold">Reports</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1.5 h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="mr-1.5 h-3.5 w-3.5" />PDF</Button>
        </div>
      </div>

      {/* Period pills */}
      <div className="card-surface flex flex-wrap items-center gap-3 p-3">
        <div className="relative flex items-center rounded-lg border border-[color:var(--color-hairline)] p-0.5">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriodKey(p.key)}
              className={cn(
                "relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                periodKey === p.key ? "bg-[color:var(--color-surface-2)] text-foreground" : "text-muted-foreground hover:text-foreground",
              )}>{p.label}</button>
          ))}
        </div>
        {periodKey === "custom" && (
          <div className="flex items-center gap-2 text-xs">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1" />
            <span className="text-muted-foreground">→</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1" />
          </div>
        )}
        <select value={wsFilter} onChange={(e) => setWsFilter(e.target.value as "personal" | "business" | "combined")}
          className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-xs">
          <option value="personal">Personal</option>
          <option value="business">Business</option>
          <option value="combined">Combined</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-xs">
          <option value="all">All categories</option>
          {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>

      {/* Hero stats */}
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Money in" value={analysis.inn} currency={currency} tone="positive" />
        <Stat label="Money out" value={analysis.out} currency={currency} tone="negative" />
        <Stat label="Net" value={analysis.net} currency={currency} tone={analysis.net >= 0 ? "positive" : "negative"} />
      </section>
      <p className="text-xs text-muted-foreground">
        vs previous {period.label.toLowerCase()}:&nbsp;
        <span className={analysis.netPct >= 0 ? "text-[color:var(--color-positive)]" : "text-[color:var(--color-negative)]"}>
          {analysis.netPct >= 0 ? "+" : ""}{analysis.netPct.toFixed(1)}%
        </span>
      </p>

      {/* Trend */}
      <div className="card-surface p-5">
        <h3 className="mb-3 text-sm font-medium">Income vs expense</h3>
        {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analysis.trend}>
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} width={60}
                  tickFormatter={(v) => formatCurrency(v, { currency }).replace(currency + " ", "")} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-hairline)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v, { currency })} />
                <Area type="monotone" dataKey="income" stroke="var(--color-positive)" fill="var(--color-gold)" fillOpacity={0.08} strokeWidth={1.5} />
                <Area type="monotone" dataKey="expense" stroke="var(--color-negative)" fill="transparent" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Donut */}
        <div className="card-surface p-5">
          <h3 className="mb-3 text-sm font-medium">Category breakdown</h3>
          {analysis.donut.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No spending in this period.</p> : (
            <div className="relative h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analysis.donut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} strokeWidth={1} stroke="var(--color-background)">
                    {analysis.donut.map((c, i) => (<Cell key={i} fill={c.color} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-hairline)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => formatCurrency(v, { currency })} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="num text-xl">{formatCurrency(analysis.totalSpend, { currency })}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">total spend</p>
              </div>
            </div>
          )}
        </div>

        {/* MoM */}
        <div className="card-surface p-5">
          <h3 className="mb-3 text-sm font-medium">Period comparison</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.momData} barCategoryGap={30}>
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-hairline)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v, { currency })} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" fill="var(--color-positive)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="var(--color-negative)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Waterfall */}
      <div className="card-surface p-5">
        <h3 className="mb-3 text-sm font-medium">Cash flow waterfall</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analysis.waterfall}>
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} width={60}
                tickFormatter={(v) => formatCurrency(v, { currency }).replace(currency + " ", "")} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-hairline)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v, { currency })} />
              <Bar dataKey="cumulative" fill="var(--color-gold)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap */}
      {showHeat && (
        <div className="card-surface p-5">
          <h3 className="mb-3 text-sm font-medium">Spending heatmap</h3>
          <Heatmap heat={analysis.heat} period={period} currency={currency} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, currency, tone }: { label: string; value: number; currency: string; tone: "positive" | "negative" }) {
  const color = tone === "positive" ? "text-[color:var(--color-positive)]" : "text-[color:var(--color-negative)]";
  return (
    <div className="card-surface p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-2 text-xl md:text-2xl ${value === 0 ? "" : color}`}>{formatCurrency(value, { currency })}</p>
    </div>
  );
}

function Heatmap({ heat, period, currency }: { heat: Map<string, number>; period: { start: Date; end: Date }; currency: string }) {
  const days: { date: string; v: number }[] = [];
  const cur = new Date(period.start);
  while (cur <= period.end) {
    const key = cur.toISOString().slice(0, 10);
    days.push({ date: key, v: heat.get(key) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  const max = Math.max(...days.map((d) => d.v), 1);
  const cols = Math.ceil(days.length / 7);
  const cells: { date: string; v: number }[][] = Array.from({ length: 7 }, () => []);
  days.forEach((d, i) => { cells[i % 7].push(d); });

  const opacity = (v: number) => v === 0 ? 0.08 : 0.15 + (v / max) * 0.85;

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        {cells.map((row, i) => (
          <div key={i} className="flex gap-1">
            {row.map((d) => (
              <div key={d.date} title={`${d.date}: ${formatCurrency(d.v, { currency })}`}
                className="h-3 w-3 rounded-sm"
                style={{ background: `color-mix(in oklab, var(--color-gold) ${opacity(d.v) * 100}%, transparent)` }} />
            ))}
            {Array.from({ length: cols - row.length }).map((_, k) => <div key={k} className="h-3 w-3" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
