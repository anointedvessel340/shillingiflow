import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus } from "lucide-react";

const STAGES = ["quoted", "booked", "in_progress", "delivered", "paid", "cancelled"] as const;

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projects — SHILLINGITRACK" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { user } = useAuth();
  const { currency } = useWorkspace();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", client_id: "", estimated_revenue: "", estimated_cost: "", start_date: "", end_date: "" });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("projects").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-simple", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("clients").select("id, name")).data ?? [],
  });
  const { data: txs = [] } = useQuery({
    queryKey: ["project-txs", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("transactions").select("project_id, amount, type").eq("workspace", "business").is("deleted_at", null)).data ?? [],
  });

  const rollups = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>();
    for (const t of txs) {
      if (!t.project_id) continue;
      const cur = m.get(t.project_id) ?? { income: 0, expense: 0 };
      if (t.type === "income") cur.income += Number(t.amount);
      else if (t.type === "expense") cur.expense += Number(t.amount);
      m.set(t.project_id, cur);
    }
    return m;
  }, [txs]);
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").insert({
        user_id: user!.id, name: form.name, client_id: form.client_id || null,
        estimated_revenue: form.estimated_revenue ? Number(form.estimated_revenue) : 0,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : 0,
        start_date: form.start_date || null, end_date: form.end_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setCreating(false); setForm({ name: "", client_id: "", estimated_revenue: "", estimated_cost: "", start_date: "", end_date: "" }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });

  const move = async (id: string, status: string) => {
    await supabase.from("projects").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Projects</h1>
        <Button onClick={() => setCreating(true)} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90"><Plus className="mr-1 h-4 w-4" />New</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => {
          const list = projects.filter((p) => p.status === s);
          return (
            <div key={s} className="card-surface p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-xs font-medium capitalize">{s.replace("_", " ")}</h3>
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>
              <ul className="space-y-2">
                {list.map((p) => {
                  const r = rollups.get(p.id) ?? { income: 0, expense: 0 };
                  return (
                    <li key={p.id} className="rounded-md border border-[color:var(--color-hairline)] p-2 text-xs">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-muted-foreground">{p.client_id ? clientMap.get(p.client_id) : "No client"}</p>
                      <p className="num mt-1 text-[color:var(--color-positive)]">+{formatCurrency(r.income, { currency })}</p>
                      <p className="num text-[color:var(--color-negative)]">−{formatCurrency(r.expense, { currency })}</p>
                      {p.end_date && <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(p.end_date)}</p>}
                      <select value={p.status} onChange={(e) => move(p.id, e.target.value)}
                        className="mt-1 w-full rounded border border-[color:var(--color-hairline)] bg-transparent px-1 py-0.5 text-[10px]">
                        {STAGES.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </li>
                  );
                })}
                {list.length === 0 && <p className="py-3 text-center text-[11px] text-muted-foreground/50">Empty</p>}
              </ul>
            </div>
          );
        })}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="card-surface sm:max-w-md">
          <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="w-full rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
              <option value="">— select client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input type="number" placeholder="Estimated revenue" value={form.estimated_revenue} onChange={(e) => setForm({ ...form, estimated_revenue: e.target.value })} />
            <Input type="number" placeholder="Estimated cost" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
