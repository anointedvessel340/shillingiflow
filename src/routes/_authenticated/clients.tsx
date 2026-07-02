import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — SHILLINGITRACK" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const { user } = useAuth();
  const { currency } = useWorkspace();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", business_name: "", phone: "", email: "", status: "lead" });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [],
  });

  const { data: revenue = [] } = useQuery({
    queryKey: ["client-rev", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("transactions").select("client_id, amount, type").eq("workspace", "business").eq("type", "income").is("deleted_at", null)).data ?? [],
  });

  const revMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of revenue) if (r.client_id) m.set(r.client_id, (m.get(r.client_id) ?? 0) + Number(r.amount));
    return m;
  }, [revenue]);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({ ...form, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { setCreating(false); setForm({ name: "", business_name: "", phone: "", email: "", status: "lead" }); qc.invalidateQueries({ queryKey: ["clients"] }); },
  });

  const filtered = clients.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Clients</h1>
        <Button onClick={() => setCreating(true)} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90"><Plus className="mr-1 h-4 w-4" />Add</Button>
      </div>
      <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card-surface overflow-hidden">
        {filtered.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No clients yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-[color:var(--color-hairline)]">
                <th className="px-4 py-2 text-left font-normal">Name</th>
                <th className="px-4 py-2 text-left font-normal">Business</th>
                <th className="px-4 py-2 text-left font-normal">Status</th>
                <th className="px-4 py-2 text-right font-normal">Lifetime revenue</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[color:var(--color-hairline)] last:border-0">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.business_name || "—"}</td>
                  <td className="px-4 py-3"><span className="rounded-md border border-[color:var(--color-hairline)] px-1.5 py-0.5 text-xs capitalize">{c.status}</span></td>
                  <td className="px-4 py-3 text-right"><span className="num">{formatCurrency(revMap.get(c.id) ?? 0, { currency })}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="card-surface sm:max-w-md">
          <DialogHeader><DialogTitle>New client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Business name" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
              {["lead", "prospect", "active", "vip", "inactive"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
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
