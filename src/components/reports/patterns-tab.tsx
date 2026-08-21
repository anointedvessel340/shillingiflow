import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ReportAnalysis } from "@/lib/reports-analysis";

export default function PatternsTab({
  analysis,
  currency,
  period,
  showHeat,
}: {
  analysis: ReportAnalysis;
  currency: string;
  period: { start: Date; end: Date };
  showHeat: boolean;
}) {
  return (
    <div className="space-y-4">
      {showHeat && (
        <div className="card-surface p-5">
          <h3 className="text-sm font-medium">Spending heatmap</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Daily expense intensity across the range.</p>
          <Heatmap heat={analysis.heat} period={period} currency={currency} />
        </div>
      )}

      <div className="card-surface p-5">
        <h3 className="text-sm font-medium">Cash flow waterfall</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Income drawn down by your largest expense categories.</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analysis.waterfall}>
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} width={60}
                tickFormatter={(v) => formatCurrency(v, { currency }).replace(currency + " ", "")} />
              <Tooltip
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-hairline)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v, { currency })}
              />
              <Bar dataKey="cumulative" radius={[3, 3, 0, 0]} fill="var(--color-muted-foreground)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Heatmap({ heat, period, currency }: { heat: Map<string, number>; period: { start: Date; end: Date }; currency: string }) {
  const days: { date: string; v: number }[] = [];
  const cur = new Date(period.start);
  while (cur <= period.end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    days.push({ date: key, v: heat.get(key) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  const max = Math.max(...days.map((d) => d.v), 1);
  const cols = Math.ceil(days.length / 7);
  const cells: { date: string; v: number }[][] = Array.from({ length: 7 }, () => []);
  days.forEach((d, i) => { cells[i % 7].push(d); });

  const opacity = (v: number) => (v === 0 ? 0.08 : 0.15 + (v / max) * 0.85);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        {cells.map((row, i) => (
          <div key={i} className="flex gap-1">
            {row.map((d) => (
              <div key={d.date} title={`${d.date}: ${formatCurrency(d.v, { currency })}`}
                className="h-3 w-3 rounded-sm"
                style={{ background: `color-mix(in oklab, var(--color-negative) ${opacity(d.v) * 100}%, transparent)` }} />
            ))}
            {Array.from({ length: cols - row.length }).map((_, k) => <div key={k} className="h-3 w-3" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
