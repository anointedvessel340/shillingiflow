import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/equipment")({
  head: () => ({ meta: [{ title: "Equipment — SHILLINGITRACK" }] }),
  component: EquipmentPage,
});

function depreciate(purchasePrice: number, purchaseDate: string | null, life: number): number {
  if (!purchaseDate || !life) return purchasePrice;
  const years = (Date.now() - new Date(purchaseDate).getTime()) / (365.25 * 86400000);
  return Math.max(0, purchasePrice - (purchasePrice / life) * years);
}

function EquipmentPage() {
  const { user } = useAuth();
  const { currency } = useWorkspace();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", purchase_price: "", purchase_date: "", useful_life_years: "5", status: "available", condition: "good" });

  const { data: gear = [] } = useQuery({
    queryKey: ["equipment", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("equipment").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const price = Number(form.purchase_price || 0);
      const life = Number(form.useful_life_years || 5);
      const current = depreciate(price, form.purchase_date || null, life);
      const { error } = await supabase.from("equipment").insert({
        user_id: user!.id, name: form.name, category: form.category || null,
        purchase_price: price, purchase_date: form.purchase_date || null,
        useful_life_years: life, current_value: current,
        status: form.status as "available" | "assigned" | "in_repair" | "retired",
        condition: form.condition as "new" | "excellent" | "good" | "fair" | "poor",
        workspace: "business",
      });
      if (error) throw error;
    },
    onSuccess: () => { setCreating(false); qc.invalidateQueries({ queryKey: ["equipment"] }); },
  });

  const withCurrent = gear.map((g) => ({ ...g, computed: depreciate(Number(g.purchase_price), g.purchase_date, g.useful_life_years ?? 5) }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Equipment</h1>
        <Button onClick={() => setCreating(true)} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90"><Plus className="mr-1 h-4 w-4" />New</Button>
      </div>

      <div className="card-surface overflow-hidden">
        {withCurrent.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No equipment yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-[color:var(--color-hairline)]">
                <th className="px-4 py-2 text-left font-normal">Name</th>
                <th className="px-4 py-2 text-left font-normal">Category</th>
                <th className="px-4 py-2 text-left font-normal">Status</th>
                <th className="px-4 py-2 text-right font-normal">Purchase</th>
                <th className="px-4 py-2 text-right font-normal">Current value</th>
              </tr>
            </thead>
            <tbody>
              {withCurrent.map((g) => (
                <tr key={g.id} className="border-b border-[color:var(--color-hairline)] last:border-0">
                  <td className="px-4 py-3">{g.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.category || "—"}</td>
                  <td className="px-4 py-3"><span className="rounded-md border border-[color:var(--color-hairline)] px-1.5 py-0.5 text-xs capitalize">{g.status.replace("_", " ")}</span></td>
                  <td className="px-4 py-3 text-right"><span className="num text-muted-foreground">{formatCurrency(Number(g.purchase_price), { currency })}</span></td>
                  <td className="px-4 py-3 text-right"><span className="num text-[color:var(--color-gold)]">{formatCurrency(g.computed, { currency })}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="card-surface sm:max-w-md">
          <DialogHeader><DialogTitle>New equipment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Category (e.g. Camera)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Purchase price" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
              <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <label>Life (yrs)<Input type="number" value={form.useful_life_years} onChange={(e) => setForm({ ...form, useful_life_years: e.target.value })} /></label>
              <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5">{["available", "assigned", "in_repair", "retired"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <label>Condition<select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="w-full rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5">{["new", "excellent", "good", "fair", "poor"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
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
