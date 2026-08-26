import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/components/date-time-picker";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ErrorState, SkeletonList } from "@/components/ui/loading";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({ meta: [{ title: "Budgets — SHILLINGITRACK" }] }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");

  const { data: cats = [] } = useQuery({
    queryKey: ["cats-simple", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").eq("workspace", workspace).eq("archived", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: budgets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["budgets", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*").eq("workspace", workspace);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: spend = [] } = useQuery({
    queryKey: ["budget-spend", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);
      const startWeek = new Date(); startWeek.setDate(startWeek.getDate() - startWeek.getDay()); startWeek.setHours(0,0,0,0);
      const start = startWeek < startMonth ? startWeek : startMonth;
      const { data, error } = await supabase.from("transactions")
        .select("amount, type, category_id, date")
        .eq("workspace", workspace).eq("type", "expense").is("deleted_at", null)
        .gte("date", start.toISOString().slice(0, 10));
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("budgets").insert({
        user_id: user!.id, category_id: categoryId || null, workspace,
        amount: Number(amount), period_type: period,
      });
      if (error) throw error;
    },
    onSuccess: () => { setAmount(""); setCategoryId(""); qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Budget added"); },
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't add this budget. Please try again.");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Budget removed"); },
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't remove this budget. Please try again.");
    },
  });

  const rows = useMemo(() => {
    const catMap = new Map(cats.map((c) => [c.id, c.name]));
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
    return budgets.map((b) => {
      const s = b.period_type === "weekly" ? weekStart : monthStart;
      const spent = spend.filter((t) => t.category_id === b.category_id && parseLocalDate(t.date) >= s)
        .reduce((s, t) => s + Number(t.amount), 0);
      const pct = b.amount > 0 ? Math.min(1.5, spent / Number(b.amount)) : 0;
      return { ...b, name: catMap.get(b.category_id ?? "") ?? "All expenses", spent, pct };
    });
  }, [budgets, spend, cats]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <h1 className="font-display text-xl font-semibold">Budgets · <span className="text-muted-foreground capitalize">{workspace}</span></h1>

      {rows.some((r) => r.pct >= 0.75) && (
        <div className="card-surface p-3 text-sm">
          {rows.filter((r) => r.pct >= 0.75).map((r) => (
            <p key={r.id} className={r.pct >= 1 ? "text-[color:var(--color-negative)]" : r.pct >= 0.9 ? "text-[color:var(--color-gold)]" : ""}>
              {r.name} budget: {Math.round(r.pct * 100)}% used, {formatCurrency(Math.max(0, Number(r.amount) - r.spent), { currency })} remaining
            </p>
          ))}
        </div>
      )}

      <div className="card-surface flex flex-wrap items-end gap-2 p-3">
        <div className="flex-1 min-w-[140px]">
          <label className="mb-1 block text-xs text-muted-foreground">Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
            <option value="">All expenses</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Amount</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Period</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly")}
            className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <Button disabled={!amount} onClick={() => create.mutate()} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">Add</Button>
      </div>

      <div className="space-y-3">
        {isError ? (
          <div className="card-surface p-4"><ErrorState message="Couldn't load budgets." onRetry={() => refetch()} /></div>
        ) : isLoading ? (
          <div className="card-surface p-4"><SkeletonList rows={5} /></div>
        ) : rows.length === 0 ? (
          <p className="card-surface p-6 text-center text-sm text-muted-foreground">No budgets yet.</p>
        ) : null}
        {!isError && !isLoading && rows.map((r) => (
          <div key={r.id} className="card-surface p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <p className="text-sm">{r.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{r.period_type}</p>
              </div>
              <div className="text-right">
                <p className="num text-sm">{formatCurrency(r.spent, { currency })} <span className="text-muted-foreground">/ {formatCurrency(Number(r.amount), { currency })}</span></p>
                <button onClick={() => remove.mutate(r.id)} className="text-xs text-muted-foreground hover:text-[color:var(--color-negative)]"><Trash2 className="inline h-3 w-3" /></button>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(100, r.pct * 100)}%`,
                background: r.pct >= 1 ? "var(--color-negative)" : r.pct >= 0.9 ? "var(--color-gold)" : "var(--color-positive)",
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
