import { createFileRoute } from "@tanstack/react-router";
import { PieChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — SHILLINGITRACK" }] }),
  component: () => (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[color:var(--color-surface-2)]">
        <PieChart className="h-5 w-5 text-[color:var(--color-gold)]" />
      </div>
      <h1 className="font-display text-xl font-semibold">Reports</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Full reporting — date-range selector, trend line, category donut, month-over-month bars, waterfall, spending heatmap, CSV + PDF export — arrives in the next build.
      </p>
    </div>
  ),
});
