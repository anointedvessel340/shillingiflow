import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ReportAnalysis } from "@/lib/reports-analysis";

export default function TrendTab({ analysis, currency }: { analysis: ReportAnalysis; currency: string }) {
  const tooltip = {
    contentStyle: { background: "var(--color-card)", border: "1px solid var(--color-hairline)", borderRadius: 8, fontSize: 12 },
    formatter: (v: number) => formatCurrency(v, { currency }),
  } as const;

  return (
    <div className="space-y-4">
      <div className="card-surface p-5">
        <h3 className="text-sm font-medium">Income vs expense</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Daily movement across the selected range.</p>
        {analysis.trend.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No activity in this period.</p>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analysis.trend}>
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} width={60}
                  tickFormatter={(v) => formatCurrency(v, { currency }).replace(currency + " ", "")} />
                <Tooltip {...tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="income" stroke="var(--color-positive)" fill="var(--color-positive)" fillOpacity={0.1} strokeWidth={1.5} />
                <Area type="monotone" dataKey="expense" stroke="var(--color-negative)" fill="var(--color-negative)" fillOpacity={0.06} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card-surface p-5">
        <h3 className="text-sm font-medium">Period comparison</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">This period against the one before it.</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analysis.momData} barCategoryGap={30}>
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} axisLine={false} tickLine={false} />
              <Tooltip {...tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="income" fill="var(--color-positive)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="var(--color-negative)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
