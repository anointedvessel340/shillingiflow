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
import { Plus, Pause, Play, SkipForward, Trash2 } from "lucide-react";

const FREQ = ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"] as const;

export const Route = createFileRoute("/_authenticated/recurring")({
  head: () => ({ meta: [{ title: "Recurring — SHILLINGITRACK" }] }),
  component: RecurringPage,
});

function nextDate(freq: string, from: Date): Date {
  const d = new Date(from);
  switch (freq) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

function RecurringPage() {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", type: "expense" as "income" | "expense", frequency: "monthly", category_id: "", account_id: "", next_occurrence_date: new Date().toISOString().slice(0, 10) });

  const { data: rules = [] } = useQuery({
    queryKey: ["recurring", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => (await supabase.from("recurring_rules").select("*").eq("workspace", workspace).order("next_occurrence_date")).data ?? [],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["cats-simple", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => (await supabase.from("categories").select("id, name").eq("workspace", workspace)).data ?? [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-simple", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("accounts").select("id, name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("recurring_rules").insert({
        user_id: user!.id, workspace, type: form.type, amount: Number(form.amount),
        category_id: form.category_id || null, account_id: form.account_id || null,
        frequency: form.frequency as "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly",
        next_occurrence_date: form.next_occurrence_date, description: form.description,
      });
      if (error) throw error;
    },
    onSuccess: () => { setCreating(false); qc.invalidateQueries({ queryKey: ["recurring"] }); toast.success("Rule saved"); },
  });

  const toggle = async (id: string, status: string) => {
    await supabase.from("recurring_rules").update({ status: status === "active" ? "paused" : "active" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["recurring"] });
  };
  const skip = async (id: string, freq: string, next: string) => {
    const n = nextDate(freq, new Date(next));
    await supabase.from("recurring_rules").update({ next_occurrence_date: n.toISOString().slice(0, 10) }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["recurring"] });
    toast.success("Next occurrence skipped");
  };
  const remove = async (id: string) => { await supabase.from("recurring_rules").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["recurring"] }); };

  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Recurring · <span className="text-muted-foreground capitalize">{workspace}</span></h1>
        <Button onClick={() => setCreating(true)} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90"><Plus className="mr-1 h-4 w-4" />New</Button>
      </div>

      <p className="text-xs text-muted-foreground">Rules run daily via <code className="rounded bg-[color:var(--color-surface-2)] px-1">pg_cron</code>. Each due rule generates a normal transaction and advances to the next date.</p>

      <div className="card-surface divide-y divide-[color:var(--color-hairline)]">
        {rules.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No recurring rules yet.</p> :
          rules.map((r) => (
            <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.status !== "active" ? "opacity-60" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm">{r.description || catMap.get(r.category_id ?? "") || "Recurring"}</p>
                <p className="text-xs text-muted-foreground">{r.frequency} · next {formatDate(r.next_occurrence_date)}</p>
              </div>
              <span className={`num text-sm ${r.type === "income" ? "text-[color:var(--color-positive)]" : ""}`}>
                {r.type === "income" ? "+" : "−"}{formatCurrency(Number(r.amount), { currency }).replace("−", "")}
              </span>
              <button onClick={() => toggle(r.id, r.status)} title="Pause/Resume" className="rounded p-1 text-muted-foreground hover:text-foreground">
                {r.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => skip(r.id, r.frequency, r.next_occurrence_date)} title="Skip next" className="rounded p-1 text-muted-foreground hover:text-foreground"><SkipForward className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(r.id)} className="rounded p-1 text-muted-foreground hover:text-[color:var(--color-negative)]"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        }
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="card-surface sm:max-w-md">
          <DialogHeader><DialogTitle>New recurring rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })} className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
                <option value="expense">Expense</option><option value="income">Income</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
                {FREQ.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <Input type="date" value={form.next_occurrence_date} onChange={(e) => setForm({ ...form, next_occurrence_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
                <option value="">— category —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
                <option value="">— account —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!form.amount}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
