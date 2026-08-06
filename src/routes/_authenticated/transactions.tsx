import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { formatCurrency, formatDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Search, Plus } from "lucide-react";
import { TransactionForm } from "@/components/transaction-form";
import { PasswordConfirmDialog } from "@/components/password-confirm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — SHILLINGITRACK" }] }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, type, category_id, account_id, date, occurred_time, description, tags, notes, deleted_at, created_at")
        .eq("workspace", workspace)
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .order("occurred_time", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    if (!q.trim()) return txs;
    const needle = q.toLowerCase();
    return txs.filter((t) => {
      const cat = t.category_id ? catMap.get(t.category_id)?.name?.toLowerCase() ?? "" : "";
      return (
        (t.description ?? "").toLowerCase().includes(needle) ||
        cat.includes(needle) ||
        String(t.amount).includes(needle)
      );
    });
  }, [txs, q, catMap]);

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Deleted", { description: "Recoverable for 30 days." });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  // Group by date
  const grouped = useMemo(() => {
    const g = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const key = t.date;
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(t);
    }
    return Array.from(g.entries());
  }, [filtered]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Transactions</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "entry" : "entries"}</span>
          <Button size="sm" onClick={() => setFormOpen(true)}
            className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
            <Plus className="mr-1 h-3.5 w-3.5" /> New
          </Button>
        </div>
      </div>

      <div className="card-surface flex items-center gap-2 px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search description, category, amount…"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {isLoading ? (
        <div className="card-surface py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="card-surface py-16 text-center">
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Press <kbd className="rounded border border-[color:var(--color-hairline)] px-1.5 py-0.5">N</kbd> or Quick add to log one.</p>
        </div>
      ) : (
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
          return (
            <div key={date} className="card-surface overflow-hidden">
              <div className="flex items-baseline justify-between px-4 py-2.5 border-b border-[color:var(--color-hairline)]">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{formatDate(date)}</span>
                <span className={`num text-xs ${dayTotal >= 0 ? "text-[color:var(--color-positive)]" : "text-[color:var(--color-negative)]"}`}>
                  {formatCurrency(dayTotal, { currency, sign: true })}
                </span>
              </div>
              <ul className="divide-y divide-[color:var(--color-hairline)]">
                {items.map((t) => {
                  const cat = t.category_id ? catMap.get(t.category_id) : null;
                  const isIncome = t.type === "income";
                  return (
                    <li key={t.id} className="group flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{t.description || cat?.name || "Transaction"}</p>
                        <p className="text-xs text-muted-foreground">{cat?.name ?? "Uncategorised"}{t.occurred_time ? ` · ${String(t.occurred_time).slice(0, 5)}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`num text-sm ${isIncome ? "text-[color:var(--color-positive)]" : ""}`}>
                          {isIncome ? "+" : "−"}{formatCurrency(Number(t.amount), { currency }).replace("−", "")}
                        </span>
                        <button
                          onClick={() => setPendingDelete(t.id)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-[color:var(--color-negative)] group-hover:opacity-100"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />

      <PasswordConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="Delete this transaction?"
        description="Confirm your password. Deleted entries are recoverable for 30 days before being removed permanently."
        confirmLabel="Delete"
        onConfirmed={async () => { if (pendingDelete) await softDelete.mutateAsync(pendingDelete); }}
      />
    </div>
  );
}
