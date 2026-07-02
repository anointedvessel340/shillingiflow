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
import { toast } from "sonner";
import { Plus, Trash2, FileDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — SHILLINGITRACK" }] }),
  component: InvoicesPage,
});

type LineItem = { description: string; quantity: number; unit_price: number };

function InvoicesPage() {
  const { user } = useAuth();
  const { currency } = useWorkspace();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [form, setForm] = useState({ invoice_number: "", client_id: "", project_id: "", due_date: "", tax: "0" });
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("invoices").select("*").order("issue_date", { ascending: false })).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-simple", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("clients").select("id, name")).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-simple", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("projects").select("id, name, client_id")).data ?? [],
  });

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = subtotal + Number(form.tax || 0);

  const create = useMutation({
    mutationFn: async () => {
      const { data: inv, error } = await supabase.from("invoices").insert({
        user_id: user!.id, invoice_number: form.invoice_number || `INV-${Date.now()}`,
        client_id: form.client_id || null, project_id: form.project_id || null,
        due_date: form.due_date || null, subtotal, tax: Number(form.tax || 0), total, status: "unpaid",
      }).select("id").single();
      if (error) throw error;
      const rows = items.filter((i) => i.description).map((i) => ({ ...i, invoice_id: inv.id, user_id: user!.id }));
      if (rows.length) await supabase.from("invoice_items").insert(rows);
    },
    onSuccess: () => {
      setCreating(false); setForm({ invoice_number: "", client_id: "", project_id: "", due_date: "", tax: "0" });
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!payingId) return;
      const { error } = await supabase.from("invoice_payments").insert({
        user_id: user!.id, invoice_id: payingId, amount: Number(payAmount), payment_method: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => { setPayingId(null); setPayAmount(""); qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Payment recorded — income transaction created"); },
  });

  const exportPDF = async (inv: typeof invoices[0]) => {
    const { jsPDF } = await import("jspdf");
    const { data: lineItems } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("INVOICE", 14, 20);
    doc.setFontSize(10);
    doc.text(`# ${inv.invoice_number}`, 14, 28);
    doc.text(`Issue: ${formatDate(inv.issue_date)}${inv.due_date ? `  Due: ${formatDate(inv.due_date)}` : ""}`, 14, 34);
    doc.text(`Client: ${inv.client_id ? clientMap.get(inv.client_id) : "—"}`, 14, 40);
    let y = 54;
    doc.setFontSize(11); doc.text("Description", 14, y); doc.text("Qty", 120, y); doc.text("Unit", 140, y); doc.text("Total", 175, y);
    y += 4; doc.line(14, y, 195, y); y += 6;
    doc.setFontSize(10);
    for (const it of lineItems ?? []) {
      doc.text(String(it.description).slice(0, 60), 14, y);
      doc.text(String(it.quantity), 120, y);
      doc.text(formatCurrency(it.unit_price, { currency }), 140, y);
      doc.text(formatCurrency(it.quantity * it.unit_price, { currency }), 175, y);
      y += 6;
    }
    y += 6;
    doc.text(`Subtotal:  ${formatCurrency(inv.subtotal, { currency })}`, 130, y); y += 6;
    doc.text(`Tax:       ${formatCurrency(inv.tax, { currency })}`, 130, y); y += 6;
    doc.setFontSize(12); doc.text(`Total:     ${formatCurrency(inv.total, { currency })}`, 130, y); y += 6;
    doc.setFontSize(10); doc.text(`Paid:      ${formatCurrency(inv.amount_paid, { currency })}`, 130, y);
    doc.save(`invoice-${inv.invoice_number}.pdf`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Invoices</h1>
        <Button onClick={() => setCreating(true)} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90"><Plus className="mr-1 h-4 w-4" />New</Button>
      </div>

      <div className="card-surface overflow-hidden">
        {invoices.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No invoices yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-[color:var(--color-hairline)]">
                <th className="px-4 py-2 text-left font-normal">#</th>
                <th className="px-4 py-2 text-left font-normal">Client</th>
                <th className="px-4 py-2 text-left font-normal">Due</th>
                <th className="px-4 py-2 text-right font-normal">Total</th>
                <th className="px-4 py-2 text-right font-normal">Paid</th>
                <th className="px-4 py-2 text-left font-normal">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-[color:var(--color-hairline)] last:border-0">
                  <td className="px-4 py-3">{i.invoice_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.client_id ? clientMap.get(i.client_id) : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.due_date ? formatDate(i.due_date) : "—"}</td>
                  <td className="px-4 py-3 text-right"><span className="num">{formatCurrency(i.total, { currency })}</span></td>
                  <td className="px-4 py-3 text-right"><span className="num text-[color:var(--color-positive)]">{formatCurrency(i.amount_paid, { currency })}</span></td>
                  <td className="px-4 py-3"><span className="rounded-md border border-[color:var(--color-hairline)] px-1.5 py-0.5 text-xs capitalize">{i.status}</span></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => setPayingId(i.id)} className="text-xs text-[color:var(--color-gold)]">Pay</button>
                    <button onClick={() => exportPDF(i)} className="text-xs text-muted-foreground hover:text-foreground"><FileDown className="inline h-3 w-3" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="card-surface sm:max-w-2xl">
          <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Invoice # (auto)" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
                <option value="">— client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm">
                <option value="">— project —</option>
                {projects.filter((p) => !form.client_id || p.client_id === form.client_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Line items</p>
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input placeholder="Description" value={it.description} onChange={(e) => { const n = [...items]; n[i].description = e.target.value; setItems(n); }} className="flex-1" />
                  <Input type="number" placeholder="Qty" value={it.quantity} onChange={(e) => { const n = [...items]; n[i].quantity = Number(e.target.value); setItems(n); }} className="w-16" />
                  <Input type="number" placeholder="Unit" value={it.unit_price} onChange={(e) => { const n = [...items]; n[i].unit_price = Number(e.target.value); setItems(n); }} className="w-24" />
                  <button onClick={() => setItems(items.filter((_, k) => k !== i))} className="rounded p-1 text-muted-foreground hover:text-[color:var(--color-negative)]"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0 }])}>+ line</Button>
            </div>
            <div className="flex items-center justify-between border-t border-[color:var(--color-hairline)] pt-3 text-sm">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Tax</label>
                <Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} className="w-24" />
              </div>
              <span className="num">Subtotal: {formatCurrency(subtotal, { currency })} · Total: <b>{formatCurrency(total, { currency })}</b></span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!items.some((i) => i.description)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payingId} onOpenChange={(v) => !v && setPayingId(null)}>
        <DialogContent className="card-surface sm:max-w-sm">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <Input type="number" placeholder="Amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          <p className="text-xs text-muted-foreground">A matching business income transaction will be created automatically.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayingId(null)}>Cancel</Button>
            <Button onClick={() => pay.mutate()} disabled={!payAmount}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
