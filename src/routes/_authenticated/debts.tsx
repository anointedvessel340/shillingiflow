import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ErrorState, SkeletonList } from "@/components/ui/loading";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({ meta: [{ title: "Debts — SHILLINGITRACK" }] }),
  component: DebtsPage,
});

function DebtsPage() {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [form, setForm] = useState({ person: "", direction: "i_owe" as "i_owe" | "owed_to_me", amount: "", due: "" });

  const { data: debts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["debts", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("*").eq("workspace", workspace).order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const amt = Number(form.amount);
      const { error } = await supabase.from("debts").insert({
        user_id: user!.id, person_or_institution: form.person, direction: form.direction,
        original_amount: amt, current_balance: amt, due_date: form.due || null, workspace,
      });
      if (error) throw error;
      return null as unknown as string;
    },
    onSuccess: () => { setCreating(false); setForm({ person: "", direction: "i_owe", amount: "", due: "" }); qc.invalidateQueries({ queryKey: ["debts"] }); toast.success("Added"); },
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't add this debt. Please try again.");
    },
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!payingId) return;
      const d = debts.find((x) => x.id === payingId)!;
      const remaining = Math.max(0, Number(d.current_balance) - Number(payAmount));
      const { error } = await supabase.from("debt_payments").insert({
        user_id: user!.id, debt_id: payingId, amount: Number(payAmount), remaining_balance_after: remaining,
      });
      if (error) throw error;
    },
    onSuccess: () => { setPayingId(null); setPayAmount(""); qc.invalidateQueries({ queryKey: ["debts"] }); toast.success("Payment recorded"); },
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't record this payment. Please try again.");
    },
  });

  const owed = debts.filter((d) => d.direction === "owed_to_me" && d.status === "open");
  const iowe = debts.filter((d) => d.direction === "i_owe" && d.status === "open");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Debts · <span className="text-muted-foreground capitalize">{workspace}</span></h1>
        <Button onClick={() => setCreating(true)} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
          <Plus className="mr-1 h-4 w-4" />New
        </Button>
      </div>

      {isError ? (
        <div className="card-surface p-4"><ErrorState message="Couldn't load debts." onRetry={() => refetch()} /></div>
      ) : isLoading ? (
        <div className="card-surface p-4"><SkeletonList rows={5} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <DebtList title="Money owed to me" debts={owed} currency={currency} onPay={setPayingId} />
          <DebtList title="Money I owe" debts={iowe} currency={currency} onPay={setPayingId} />
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="card-surface sm:max-w-md">
          <DialogHeader><DialogTitle>New debt</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1 rounded-lg border border-[color:var(--color-hairline)] p-0.5">
              {(["i_owe", "owed_to_me"] as const).map((d) => (
                <button key={d} onClick={() => setForm({ ...form, direction: d })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs ${form.direction === d ? "bg-[color:var(--color-surface-2)]" : "text-muted-foreground"}`}>
                  {d === "i_owe" ? "I owe" : "Owed to me"}
                </button>
              ))}
            </div>
            <Input placeholder="Person or institution" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} />
            <Input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Input type="date" placeholder="Due date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!form.person || !form.amount}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payingId} onOpenChange={(v) => !v && setPayingId(null)}>
        <DialogContent className="card-surface sm:max-w-sm">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <Input type="number" placeholder="Amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayingId(null)}>Cancel</Button>
            <Button onClick={() => pay.mutate()} disabled={!payAmount}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DebtList({ title, debts, currency, onPay }: { title: string; debts: Array<{ id: string; person_or_institution: string; current_balance: number | string; original_amount: number | string; due_date: string | null }>; currency: string; onPay: (id: string) => void }) {
  const total = debts.reduce((s, d) => s + Number(d.current_balance), 0);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="card-surface p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="num text-sm text-muted-foreground">{formatCurrency(total, { currency })}</span>
      </div>
      {debts.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">None.</p> : (
        <ul className="divide-y divide-[color:var(--color-hairline)]">
          {debts.map((d) => {
            const overdue = d.due_date && d.due_date < today;
            return (
              <li key={d.id} className="py-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm">{d.person_or_institution}</p>
                  <span className={`num text-sm ${overdue ? "text-[color:var(--color-negative)]" : ""}`}>{formatCurrency(Number(d.current_balance), { currency })}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{d.due_date ? `Due ${formatDate(d.due_date)}${overdue ? " · overdue" : ""}` : "No due date"}</span>
                  <button onClick={() => onPay(d.id)} className="text-[color:var(--color-gold)]">Record payment</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
