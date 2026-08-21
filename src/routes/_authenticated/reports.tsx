import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { computePeriod, previousPeriod, toISODate, type PeriodKey } from "@/lib/period";
import { parseLocalDate } from "@/components/date-time-picker";
import { formatCurrency, formatDate } from "@/lib/format";
import { analyseReport, buildInsights, type ReportTx, type ReportCategory } from "@/lib/reports-analysis";
import { Button } from "@/components/ui/button";
import { Download, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ErrorState, LoadingBlock, SkeletonChart } from "@/components/ui/loading";

const TrendTab = lazy(() => import("@/components/reports/trend-tab"));
const BreakdownTab = lazy(() => import("@/components/reports/breakdown-tab"));
const PatternsTab = lazy(() => import("@/components/reports/patterns-tab"));

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SHILLINGITRACK" },
      { name: "description", content: "Trends, category breakdowns and spending patterns computed live from your own entries." },
      { property: "og:title", content: "Reports — SHILLINGITRACK" },
      { property: "og:description", content: "Trends, category breakdowns and spending patterns computed live from your own entries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" }, { key: "year", label: "Year" }, { key: "custom", label: "Custom" },
];

type TabKey = "trend" | "breakdown" | "patterns";
const TABS: { key: TabKey; label: string }[] = [
  { key: "trend", label: "Trend" },
  { key: "breakdown", label: "Breakdown" },
  { key: "patterns", label: "Patterns" },
];

function ReportsPage() {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();
  const [periodKey, setPeriodKey] = useState<PeriodKey>("month");
  const [customStart, setCustomStart] = useState(toISODate(new Date(Date.now() - 30 * 86400000)));
  const [customEnd, setCustomEnd] = useState(toISODate(new Date()));
  const [wsFilter, setWsFilter] = useState<"personal" | "business" | "combined">(workspace);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tab, setTab] = useState<TabKey>("trend");

  const period = useMemo(() => computePeriod(periodKey, {
    start: new Date(customStart), end: new Date(customEnd),
  }), [periodKey, customStart, customEnd]);
  const prev = useMemo(() => previousPeriod(period), [period]);

  const catsQuery = useQuery({
    queryKey: ["categories-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, color, workspace");
      if (error) throw error;
      return (data ?? []) as (ReportCategory & { workspace: string })[];
    },
  });
  const cats = catsQuery.data ?? [];

  const txQuery = useQuery({
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
      return (data ?? []) as ReportTx[];
    },
  });
  const txs = txQuery.data ?? [];

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c as ReportCategory])), [cats]);
  const analysis = useMemo(() => analyseReport(txs, catMap, period, prev), [txs, catMap, period, prev]);
  const insights = useMemo(
    () => buildInsights(analysis, catMap, currency, period.label),
    [analysis, catMap, currency, period.label],
  );

  const showHeat = periodKey === "month" || periodKey === "year";

  const exportCSV = () => {
    try {
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
      toast.success("CSV exported");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't export the CSV — please try again.");
    }
  };

  const exportPDF = async () => {
    try {
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
    } catch (err) {
      console.error(err);
      toast.error("Couldn't export the PDF — please try again.");
    }
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

      {/* Filters */}
      <div className="card-surface flex flex-wrap items-center gap-3 p-3">
        <div className="relative flex flex-wrap items-center rounded-lg border border-[color:var(--color-hairline)] p-0.5">
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

      {txQuery.isError ? (
        <div className="card-surface p-5">
          <ErrorState message="Couldn't load your report data." onRetry={() => txQuery.refetch()} />
        </div>
      ) : (
        <>
          {/* Insights */}
          {!txQuery.isLoading && insights.length > 0 && (
            <section className="card-surface p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--color-gold)]" />
                <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">Insights</h2>
              </div>
              <ul className="mt-3 space-y-1.5">
                {insights.map((line, i) => (
                  <li key={i} className="text-sm leading-relaxed">{line}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Hero stats — dominant */}
          <section className="card-surface grid grid-cols-1 gap-8 p-6 sm:grid-cols-3 md:p-10">
            <Stat label="Money in" value={analysis.inn} currency={currency} tone="positive" loading={txQuery.isLoading} />
            <Stat label="Money out" value={analysis.out} currency={currency} tone="negative" loading={txQuery.isLoading} />
            <Stat label="Net" value={analysis.net} currency={currency} tone={analysis.net >= 0 ? "positive" : "negative"} loading={txQuery.isLoading} />
            <p className="text-xs text-muted-foreground sm:col-span-3">
              vs previous {period.label.toLowerCase()}:&nbsp;
              <span className={analysis.netPct >= 0 ? "text-[color:var(--color-positive)]" : "text-[color:var(--color-negative)]"}>
                {analysis.netPct >= 0 ? "+" : ""}{analysis.netPct.toFixed(1)}%
              </span>
            </p>
          </section>

          {/* Tabs */}
          <div role="tablist" aria-label="Report views"
            className="inline-flex rounded-lg border border-[color:var(--color-hairline)] p-0.5">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-xs font-medium transition-colors",
                  tab === t.key ? "bg-[color:var(--color-surface-2)] text-foreground" : "text-muted-foreground hover:text-foreground",
                )}>{t.label}</button>
            ))}
          </div>

          <div role="tabpanel">
            {txQuery.isLoading ? (
              <div className="card-surface p-5"><SkeletonChart /></div>
            ) : (
              <Suspense fallback={<div className="card-surface p-5"><LoadingBlock label="Preparing charts…" /></div>}>
                {tab === "trend" && <TrendTab analysis={analysis} currency={currency} />}
                {tab === "breakdown" && <BreakdownTab analysis={analysis} currency={currency} />}
                {tab === "patterns" && (
                  <PatternsTab analysis={analysis} currency={currency} period={period} showHeat={showHeat} />
                )}
              </Suspense>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, currency, tone, loading }: {
  label: string; value: number; currency: string; tone: "positive" | "negative"; loading?: boolean;
}) {
  const color = tone === "positive" ? "text-[color:var(--color-positive)]" : "text-[color:var(--color-negative)]";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-3 h-8 w-32 rounded-md bg-[color:var(--color-surface-2)] shimmer" />
      ) : (
        <p className={`num mt-2 text-3xl md:text-4xl ${value === 0 ? "" : color}`}>{formatCurrency(value, { currency })}</p>
      )}
    </div>
  );
}
