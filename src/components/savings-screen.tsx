import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  computeAccountValue,
  balanceSparkline,
  type SavingsAccount,
  type LedgerEntry,
} from "@/lib/savings";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { ArrowDownLeft, ArrowUpRight, Plus, Landmark, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, SkeletonList } from "@/components/ui/loading";

type Kind = "savings" | "investment";

export function SavingsScreen({ kind }: { kind: Kind }) {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [openAcct, setOpenAcct] = useState<SavingsAccount | null>(null);
  const [entry, setEntry] = useState<{ acct: SavingsAccount; type: "deposit" | "withdrawal" | "manual_valuation" } | null>(null);

  const { data: accounts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["savings-accounts", user?.id, workspace, kind],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_accounts")
        .select("*")
        .eq("account_kind", kind)
        .eq("workspace", workspace)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavingsAccount[];
    },
  });

  const activeIds = accounts.filter((a) => a.status === "active").map((a) => a.id);
  const { data: ledgerAll = [], isError: isLedgerError, refetch: refetchLedger } = useQuery({
    queryKey: ["savings-ledger-all", user?.id, activeIds.join(",")],
    enabled: !!user && activeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_ledger")
        .select("id, account_id, entry_type, amount, date, notes, linked_transaction_id")
        .in("account_id", activeIds)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (LedgerEntry & { account_id: string })[];
    },
  });

  const ledgerByAcct = useMemo(() => {
    const m = new Map<string, LedgerEntry[]>();
    for (const e of ledgerAll) {
      const arr = m.get(e.account_id) ?? [];
      arr.push(e);
      m.set(e.account_id, arr);
    }
    return m;
  }, [ledgerAll]);

  const label = kind === "investment" ? "Investments" : "Savings";
  const Icon = kind === "investment" ? TrendingUp : Landmark;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">{label}</h1>
          <p className="text-sm text-muted-foreground">
            {kind === "investment"
              ? "Track holdings, valuations, and growth outside your cash accounts."
              : "Set aside money in named accounts, with clean interest math."}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-gold)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-gold-foreground)]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> New account
        </button>
      </header>

      {isError ? (
        <div className="card-surface p-4">
          <ErrorState message="Couldn't load your accounts." onRetry={() => refetch()} />
        </div>
      ) : isLedgerError ? (
        <div className="card-surface p-4">
          <ErrorState message="Couldn't load your ledger." onRetry={() => refetchLedger()} />
        </div>
      ) : isLoading ? (
        <div className="card-surface p-4"><SkeletonList rows={5} /></div>
      ) : accounts.filter((a) => a.status === "active").length === 0 ? (
        <div className="card-surface flex flex-col items-center gap-3 p-10 text-center">
          <Icon className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No active {kind} accounts yet.</p>
          <button onClick={() => setCreating(true)} className="text-xs text-[color:var(--color-gold)] hover:underline">
            Create your first account
          </button>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {accounts
            .filter((a) => a.status === "active")
            .map((a) => {
              const ledger = ledgerByAcct.get(a.id) ?? [];
              const { principal, interest, currentValue } = computeAccountValue(a, ledger);
              const spark = balanceSparkline(a, ledger, 30);
              const needsValuation = a.account_kind === "investment" && !a.interest_rate && !ledger.some((e) => e.entry_type === "manual_valuation");
              return (
                <div key={a.id} className="card-surface p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <button onClick={() => setOpenAcct(a)} className="truncate text-left text-sm font-medium hover:text-[color:var(--color-gold)]">
                        {a.name}
                      </button>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.held_at || "—"}
                        {a.interest_rate ? ` · ${(Number(a.interest_rate) * 100).toFixed(2)}% p.a.` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-2xl">{formatCurrency(currentValue, { currency })}</p>
                      {interest !== 0 && (
                        <p className="num text-[11px] text-[color:var(--color-gold)]">
                          {interest >= 0 ? "+" : "−"}
                          {formatCurrency(Math.abs(interest), { currency })} growth
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-y border-[color:var(--color-hairline)] py-3">
                    <Metric label="Principal" value={formatCurrency(principal, { currency })} />
                    <Metric label="Growth" value={formatCurrency(interest, { currency })} accent={interest > 0} />
                    <Metric label="Current" value={formatCurrency(currentValue, { currency })} />
                  </div>

                  <div className="mt-3 h-12">
                    {spark.some((p) => p.v !== 0) && (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={spark}>
                          <Line type="monotone" dataKey="v" stroke="var(--color-gold)" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {needsValuation && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      No rate or valuation set — value shows contributions only.{" "}
                      <button className="text-[color:var(--color-gold)] hover:underline" onClick={() => setEntry({ acct: a, type: "manual_valuation" })}>
                        Add a valuation
                      </button>
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setEntry({ acct: a, type: "deposit" })}
                      className="flex-1 rounded-lg border border-[color:var(--color-hairline)] py-1.5 text-xs hover:bg-[color:var(--color-surface-2)]"
                    >
                      <ArrowDownLeft className="mr-1 inline h-3 w-3" /> Deposit
                    </button>
                    <button
                      onClick={() => setEntry({ acct: a, type: "withdrawal" })}
                      className="flex-1 rounded-lg border border-[color:var(--color-hairline)] py-1.5 text-xs hover:bg-[color:var(--color-surface-2)]"
                    >
                      <ArrowUpRight className="mr-1 inline h-3 w-3" /> Withdraw
                    </button>
                    {a.account_kind === "investment" && (
                      <button
                        onClick={() => setEntry({ acct: a, type: "manual_valuation" })}
                        className="flex-1 rounded-lg border border-[color:var(--color-hairline)] py-1.5 text-xs hover:bg-[color:var(--color-surface-2)]"
                      >
                        Update value
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </section>
      )}

      {creating && (
        <AccountForm
          kind={kind}
          workspace={workspace}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["savings-accounts"] });
          }}
        />
      )}
      {entry && (
        <EntryForm
          account={entry.acct}
          type={entry.type}
          ledger={ledgerByAcct.get(entry.acct.id) ?? []}
          currency={currency}
          onClose={() => setEntry(null)}
          onSaved={() => {
            setEntry(null);
            qc.invalidateQueries({ queryKey: ["savings-ledger-all"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
            qc.invalidateQueries({ queryKey: ["balance-alert"] });
            qc.invalidateQueries({ queryKey: ["savings-totals"] });
          }}
        />
      )}
      {openAcct && (
        <AccountDetail
          account={openAcct}
          ledger={ledgerByAcct.get(openAcct.id) ?? []}
          currency={currency}
          onClose={() => setOpenAcct(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["savings-accounts"] });
            qc.invalidateQueries({ queryKey: ["savings-ledger-all"] });
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-sm ${accent ? "text-[color:var(--color-gold)]" : ""}`}>{value}</p>
    </div>
  );
}

function AccountForm({ kind, workspace, onClose, onSaved }: {
  kind: Kind; workspace: "personal" | "business"; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [heldAt, setHeldAt] = useState("");
  const [rate, setRate] = useState("");
  const [compounding, setCompounding] = useState<"monthly" | "none">(kind === "savings" ? "monthly" : "none");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not signed in");
      const rateNum = rate.trim() === "" ? null : Number(rate) / 100;
      const { error } = await supabase.from("savings_accounts").insert({
        user_id: user.id,
        name: name.trim(),
        held_at: heldAt.trim() || null,
        account_kind: kind,
        workspace,
        interest_rate: rateNum,
        compounding_frequency: rateNum ? compounding : "none",
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account created");
      onSaved();
    },
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't create this account. Please try again.");
    },
  });

  return (
    <Modal title={`New ${kind} account`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}
      >
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required placeholder="Emergency fund" /></Field>
        <Field label="Held at"><input value={heldAt} onChange={(e) => setHeldAt(e.target.value)} className={inputCls} placeholder="KCB / M-PESA / Money Market Fund" /></Field>
        <Field label={`Interest rate (annual %) ${kind === "investment" ? "— optional" : ""}`}>
          <input value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} inputMode="decimal" placeholder={kind === "savings" ? "e.g. 8" : "leave blank for manual valuation"} />
        </Field>
        {rate.trim() !== "" && (
          <Field label="Compounding">
            <select value={compounding} onChange={(e) => setCompounding(e.target.value as "monthly" | "none")} className={inputCls}>
              <option value="monthly">Monthly</option>
              <option value="none">None (simple)</option>
            </select>
          </Field>
        )}
        <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={2} /></Field>
        {save.isError && <p className="text-xs text-[color:var(--color-negative)]">{(save.error as Error).message}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[color:var(--color-hairline)] px-3 py-1.5 text-xs">Cancel</button>
          <button type="submit" disabled={save.isPending} className="rounded-lg bg-[color:var(--color-gold)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-gold-foreground)]">
            {save.isPending ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EntryForm({ account, type, ledger, currency, onClose, onSaved }: {
  account: SavingsAccount;
  type: "deposit" | "withdrawal" | "manual_valuation";
  ledger: LedgerEntry[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const { principal, currentValue } = computeAccountValue(account, ledger);

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a positive amount");
      if (type === "withdrawal" && amt > currentValue) throw new Error("Cannot withdraw more than current value");
      const { error } = await supabase.rpc("savings_record_entry", {
        _account_id: account.id,
        _entry_type: type,
        _amount: amt,
        _date: date,
        _notes: notes.trim() || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e) => {
      console.error(e);
      toast.error(e instanceof Error && e.message.includes("Cannot withdraw")
        ? e.message
        : e instanceof Error && e.message.includes("positive")
        ? e.message
        : "Couldn't save this entry. Please try again.");
    },
  });

  const title = type === "deposit" ? "Deposit" : type === "withdrawal" ? "Withdraw" : "Update value";
  const warn = type === "withdrawal" && Number(amount) > principal && Number(amount) <= currentValue
    ? "This withdrawal exceeds your deposited principal — you are pulling from growth."
    : null;

  return (
    <Modal title={`${title} — ${account.name}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Amount">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} inputMode="decimal" required autoFocus placeholder="0" />
        </Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required /></Field>
        <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={2} /></Field>

        <div className="rounded-lg border border-[color:var(--color-hairline)] p-3 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Principal</span><span className="num">{formatCurrency(principal, { currency })}</span></div>
          <div className="flex justify-between"><span>Current value</span><span className="num">{formatCurrency(currentValue, { currency })}</span></div>
        </div>
        {warn && <p className="text-xs text-[color:var(--color-gold)]">{warn}</p>}
        {type !== "manual_valuation" && (
          <p className="text-[11px] text-muted-foreground">
            Recorded atomically: this posts to the account ledger and creates a matching {type === "deposit" ? "savings_deposit" : "savings_withdrawal"} in your transactions in a single database call.
          </p>
        )}
        {save.isError && <p className="text-xs text-[color:var(--color-negative)]">{(save.error as Error).message}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[color:var(--color-hairline)] px-3 py-1.5 text-xs">Cancel</button>
          <button type="submit" disabled={save.isPending} className="rounded-lg bg-[color:var(--color-gold)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-gold-foreground)]">
            {save.isPending ? "Saving…" : "Confirm"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AccountDetail({ account, ledger, currency, onClose, onChanged }: {
  account: SavingsAccount; ledger: LedgerEntry[]; currency: string; onClose: () => void; onChanged: () => void;
}) {
  const { principal, interest, currentValue } = computeAccountValue(account, ledger);
  const sorted = [...ledger].sort((a, b) => b.date.localeCompare(a.date));

  const close = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("savings_accounts").update({ status: "closed" }).eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account closed");
      onChanged();
      onClose();
    },
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't close this account. Please try again.");
    },
  });

  return (
    <Modal title={account.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 border-b border-[color:var(--color-hairline)] pb-3">
          <Metric label="Principal" value={formatCurrency(principal, { currency })} />
          <Metric label="Growth" value={formatCurrency(interest, { currency })} accent={interest > 0} />
          <Metric label="Current" value={formatCurrency(currentValue, { currency })} />
        </div>
        <div>
          <h4 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Ledger</h4>
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground">No entries yet.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-[color:var(--color-hairline)] overflow-y-auto">
              {sorted.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="capitalize">{e.entry_type.replace("_", " ")}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(e.date)}{e.notes ? ` · ${e.notes}` : ""}</p>
                  </div>
                  <span className="num shrink-0">
                    {e.entry_type === "withdrawal" ? "−" : e.entry_type === "deposit" ? "+" : ""}
                    {formatCurrency(Number(e.amount), { currency })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end border-t border-[color:var(--color-hairline)] pt-3">
          <button
            onClick={() => { if (confirm("Close this account? History is kept.")) close.mutate(); }}
            className="rounded-lg border border-[color:var(--color-negative)]/60 px-3 py-1.5 text-xs text-[color:var(--color-negative)]"
          >
            Close account
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-card)] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-1)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";
