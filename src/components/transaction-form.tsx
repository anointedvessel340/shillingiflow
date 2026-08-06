import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-provider";
import { useWorkspace } from "./workspace-provider";
import { DateTimePicker, todayISO, nowHHMM } from "./date-time-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Full transaction form — amount, type, category, account, description, date & time. */
export function TransactionForm({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState({ date: todayISO(), time: nowHHMM() });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, workspace").eq("archived", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts").select("id, name, is_default").eq("archived", false)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open) {
      setAmount(""); setType("expense"); setCategoryId(""); setDescription(""); setNotes("");
      setWhen({ date: todayISO(), time: nowHHMM() });
      setAccountId(accounts[0]?.id ?? "");
    }
  }, [open, accounts]);

  const wsCats = categories.filter((c) => c.workspace === workspace);
  const numeric = Number(amount);
  const valid = !!user && Number.isFinite(numeric) && numeric > 0 && !!categoryId && !!accountId;

  const save = useMutation({
    mutationFn: async () => {
      if (!valid) throw new Error("Fill in amount, category and account.");
      const { error } = await supabase.from("transactions").insert({
        user_id: user!.id,
        amount: numeric,
        type,
        category_id: categoryId,
        account_id: accountId,
        workspace,
        description: description.trim() || null,
        notes: notes.trim() || null,
        date: when.date,
        occurred_time: `${when.time}:00`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports-txs"] });
      toast.success("Transaction saved", { description: `${when.date} · ${when.time}` });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="card-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New transaction</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Date and time default to now — use the calendar to log a past entry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              autoFocus inputMode="decimal" placeholder="Amount"
              value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="num"
            />
            <DateTimePicker date={when.date} time={when.time} onChange={setWhen} />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[color:var(--color-hairline)] p-0.5 w-fit">
            {(["expense", "income"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn("rounded-md px-3 py-1 text-xs capitalize",
                  type === t ? "bg-[color:var(--color-surface-2)]" : "text-muted-foreground")}>
                {t}
              </button>
            ))}
          </div>

          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-2 text-sm">
            <option value="">Select category…</option>
            {wsCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-2 text-sm">
            <option value="">Select account…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}
            className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
