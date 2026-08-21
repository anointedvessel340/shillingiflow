import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ReportAnalysis } from "@/lib/reports-analysis";
import TopCategoriesList from "./top-categories-list";

export default function BreakdownTab({ analysis, currency }: { analysis: ReportAnalysis; currency: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="card-surface p-5">
        <h3 className="text-sm font-medium">Category breakdown</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Where money went in this period.</p>
        {analysis.donut.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No spending in this period.</p>
        ) : (
          <div className="relative mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analysis.donut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}
                  strokeWidth={1} stroke="var(--color-background)">
                  {analysis.donut.map((c, i) => (<Cell key={i} fill={c.color ?? "var(--color-negative)"} />))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-hairline)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v, { currency })}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="num text-xl">{formatCurrency(analysis.totalSpend, { currency })}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">total spend</p>
            </div>
          </div>
        )}
      </div>

      <div className="card-surface p-5">
        <h3 className="text-sm font-medium">Top categories</h3>
        <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Ranked by amount spent.</p>
        <TopCategoriesList items={analysis.top6} currency={currency} />
      </div>
    </div>
  );
}
