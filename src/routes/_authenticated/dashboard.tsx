import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { ArrowDownLeft, ArrowUpRight, Target, HandCoins, Landmark, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { computeAccountValue, type SavingsAccount, type LedgerEntry } from "@/lib/savings";
import { parseLocalDate } from "@/components/date-time-picker";
import { ErrorState, SkeletonList, Shimmer } from "@/components/ui/loading";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SHILLINGITRACK" }] }),
  component: DashboardPage,
});

type Tx = {
  id: string;
  amount: number;
  type: "income" | "expense" | "transfer" | "savings_deposit" | "savings_withdrawal";
  category_id: string | null;
  date: string;
  description: string | null;
  created_at: string;
};

function DashboardPage() {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();

  const { data: txs = [], isLoading, isError: txError, refetch: refetchTx } = useQuery({
    queryKey: ["dashboard", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, type, category_id, date, description, created_at")
        .eq("workspace", workspace)
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, color");
      if (error) throw error;
      return data ?? [];
    },
  });
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const { data: debts = [], isLoading: debtsLoading, isError: debtsError, refetch: refetchDebts } = useQuery({
    queryKey: ["dashboard-debts", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("id, person_or_institution, current_balance, original_amount, direction, status, due_date")
        .eq("workspace", workspace)
        .eq("status", "open")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const debtStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let iOwe = 0, owedToMe = 0, overdueCount = 0;
    let iOweOrig = 0, owedOrig = 0;
    for (const d of debts) {
      const cur = Number(d.current_balance) || 0;
      const orig = Number(d.original_amount) || 0;
      if (d.direction === "i_owe") { iOwe += cur; iOweOrig += orig; }
      else { owedToMe += cur; owedOrig += orig; }
      if (d.due_date && d.due_date < today) overdueCount += 1;
    }
    const net = owedToMe - iOwe;
    const iOwePct = iOweOrig > 0 ? Math.min(100, ((iOweOrig - iOwe) / iOweOrig) * 100) : 0;
    const owedPct = owedOrig > 0 ? Math.min(100, ((owedOrig - owedToMe) / owedOrig) * 100) : 0;
    return { iOwe, owedToMe, overdueCount, net, iOwePct, owedPct, topOverdue: debts.filter((d) => d.due_date && d.due_date < today).slice(0, 3) };
  }, [debts]);

  // Savings + investment totals
  const { data: savingsTotals, isLoading: wealthLoading, isError: wealthError, refetch: refetchWealth } = useQuery({
    queryKey: ["savings-totals", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data: accts, error } = await supabase
        .from("savings_accounts")
        .select("*")
        .eq("workspace", workspace)
        .eq("status", "active");
      if (error) throw error;
      const accounts = (accts ?? []) as SavingsAccount[];
      if (accounts.length === 0) return { savings: 0, investments: 0, savingsGrowth: 0, investGrowth: 0 };
      const ids = accounts.map((a) => a.id);
      const { data: led } = await supabase
        .from("savings_ledger")
        .select("id, account_id, entry_type, amount, date, notes, linked_transaction_id")
        .in("account_id", ids);
      const byAcct = new Map<string, LedgerEntry[]>();
      for (const e of (led ?? []) as (LedgerEntry & { account_id: string })[]) {
        const arr = byAcct.get(e.account_id) ?? [];
        arr.push(e);
        byAcct.set(e.account_id, arr);
      }
      let savings = 0, investments = 0, savingsGrowth = 0, investGrowth = 0;
      for (const a of accounts) {
        const { currentValue, interest } = computeAccountValue(a, byAcct.get(a.id) ?? []);
        if (a.account_kind === "investment") { investments += currentValue; investGrowth += interest; }
        else { savings += currentValue; savingsGrowth += interest; }
      }
      return { savings, investments, savingsGrowth, investGrowth };
    },
  });




  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const start30 = new Date(); start30.setDate(start30.getDate() - 29);

    let totalIn = 0, totalOut = 0, balance = 0;
    let monthIn = 0, monthOut = 0;
    let prevMonthIn = 0, prevMonthOut = 0;
    const catTotals = new Map<string, number>();
    const dailyNet = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      dailyNet.set(d.toISOString().slice(0, 10), 0);
    }

    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      const isIncome = t.type === "income";
      const isExpense = t.type === "expense";
      // Cash balance reflects real spending + savings movements (deposit = cash out, withdrawal = cash in)
      let delta = 0;
      if (isIncome || t.type === "savings_withdrawal") delta = amt;
      else if (isExpense || t.type === "savings_deposit") delta = -amt;
      balance += delta;
      // Income/expense analytics EXCLUDE savings movements
      if (isIncome) totalIn += amt; else if (isExpense) totalOut += amt;
      const d = parseLocalDate(t.date);
      if (d >= startOfMonth) { if (isIncome) monthIn += amt; else if (isExpense) monthOut += amt; }
      else if (d >= startOfPrevMonth && d <= endOfPrevMonth) {
        if (isIncome) prevMonthIn += amt; else if (isExpense) prevMonthOut += amt;
      }
      if (isExpense && d >= startOfMonth && t.category_id) {
        catTotals.set(t.category_id, (catTotals.get(t.category_id) ?? 0) + amt);
      }
      const key = t.date;
      if (dailyNet.has(key)) dailyNet.set(key, (dailyNet.get(key) ?? 0) + delta);
    }

    const spark = Array.from(dailyNet.entries()).map(([date, v]) => ({ date, v }));
    // running balance sparkline
    let running = 0;
    const runningSpark = spark.map((p) => { running += p.v; return { date: p.date, v: running }; });

    const topCats = Array.from(catTotals.entries())
      .map(([id, v]) => ({ id, name: catMap.get(id)?.name ?? "Uncategorised", value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      balance, totalIn, totalOut,
      monthIn, monthOut, monthNet: monthIn - monthOut,
      prevMonthIn, prevMonthOut,
      spark: runningSpark,
      topCats,
      momData: [
        { label: "Last month", income: prevMonthIn, expense: prevMonthOut },
        { label: "This month", income: monthIn, expense: monthOut },
      ],
    };
  }, [txs, catMap]);

  const recent = txs.slice(0, 8);

  const { data: goalAgg, isError: goalsError, refetch: refetchGoals } = useQuery({
    queryKey: ["dashboard-goals", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("target_amount, current_amount")
        .eq("workspace", workspace)
        .eq("status", "active");
      if (error) throw error;
      let target = 0, current = 0;
      for (const g of data ?? []) {
        target += Number(g.target_amount) || 0;
        current += Number(g.current_amount) || 0;
      }
      return { target, current };
    },
  });
  const savingsGoal = goalAgg?.target ?? 0;
  const savingsProgress = savingsGoal > 0 ? Math.max(0, Math.min(1, (goalAgg?.current ?? 0) / savingsGoal)) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Hero */}
      <section className="card-surface p-6 md:p-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Net balance · {workspace}</p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className={`num text-4xl md:text-5xl ${stats.balance < 0 ? "text-[color:var(--color-negative)]" : ""}`}>
            {formatCurrency(stats.balance, { currency })}
          </span>
        </div>
        <div className="mt-6 h-16 w-full">
          {stats.spark.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.spark}>
                <Line type="monotone" dataKey="v" stroke="var(--color-gold)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 3-stat */}
      <section className="grid grid-cols-3 gap-3 md:gap-4">
        <StatCard label="Money in" value={stats.monthIn} tone="positive" currency={currency} />
        <StatCard label="Money out" value={stats.monthOut} tone="negative" currency={currency} />
        <StatCard label="Net" value={stats.monthNet} tone={stats.monthNet >= 0 ? "positive" : "negative"} currency={currency} />
      </section>

      {/* Savings & Investments totals */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <WealthCard to="/savings" label="Total savings" value={savingsTotals?.savings ?? 0} growth={savingsTotals?.savingsGrowth ?? 0} currency={currency} icon={Landmark} />
        <WealthCard to="/investments" label="Total investments" value={savingsTotals?.investments ?? 0} growth={savingsTotals?.investGrowth ?? 0} currency={currency} icon={TrendingUp} />
      </section>



      {/* Debts — analytics-style snapshot */}
      <section className="card-surface p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-gold)]">
              <HandCoins className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-medium">Debts overview</h3>
            {debtStats.overdueCount > 0 && (
              <span className="rounded-md bg-[color:var(--color-negative)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--color-negative)]">
                {debtStats.overdueCount} overdue
              </span>
            )}
          </div>
          <Link to="/debts" className="text-xs text-[color:var(--color-gold)] hover:underline">Open</Link>
        </div>

        {debts.length === 0 ? (
          <Empty label="No open debts. Track what you owe or what's owed to you." />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <DebtStat label="I owe" value={debtStats.iOwe} pct={debtStats.iOwePct} tone="negative" currency={currency} />
            <DebtStat label="Owed to me" value={debtStats.owedToMe} pct={debtStats.owedPct} tone="positive" currency={currency} />
            <div className="rounded-lg border border-[color:var(--color-hairline)] p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Net position</p>
              <p className={`num mt-1.5 text-xl ${debtStats.net >= 0 ? "text-[color:var(--color-positive)]" : "text-[color:var(--color-negative)]"}`}>
                {debtStats.net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(debtStats.net), { currency }).replace("−", "")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{debts.length} open debt{debts.length === 1 ? "" : "s"}</p>
            </div>
            {debtStats.topOverdue.length > 0 && (
              <ul className="col-span-full space-y-1.5 border-t border-[color:var(--color-hairline)] pt-3">
                {debtStats.topOverdue.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-xs">
                    <span className="truncate">
                      <span className="text-[color:var(--color-negative)]">● </span>
                      {d.person_or_institution}
                      <span className="text-muted-foreground"> · {d.direction === "i_owe" ? "I owe" : "owes me"}</span>
                    </span>
                    <span className="num text-[color:var(--color-negative)]">{formatCurrency(Number(d.current_balance), { currency })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Grid */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Top categories */}
        <div className="card-surface p-5">
          <h3 className="mb-4 text-sm font-medium">Top spending — this month</h3>
          {stats.topCats.length === 0 ? (
            <Empty label={isLoading ? "Loading…" : "No spending yet this month."} />
          ) : (
            <ul className="space-y-3">
              {stats.topCats.map((c) => {
                const max = stats.topCats[0].value;
                const pct = (c.value / max) * 100;
                return (
                  <li key={c.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{c.name}</span>
                      <span className="num text-muted-foreground">{formatCurrency(c.value, { currency })}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
                      <div className="h-full rounded-full bg-[color:var(--color-negative)]" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="card-surface p-5">
          <h3 className="mb-4 text-sm font-medium">Recent activity</h3>
          {recent.length === 0 ? (
            <Empty label={isLoading ? "Loading…" : "No transactions yet. Press N to add one."} />
          ) : (
            <ul className="divide-y divide-[color:var(--color-hairline)]">
              {recent.map((t) => {
                const cat = t.category_id ? catMap.get(t.category_id) : null;
                const isIncome = t.type === "income";
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isIncome ? "bg-[color:var(--color-positive)]/10 text-[color:var(--color-positive)]" : "bg-[color:var(--color-surface-2)] text-muted-foreground"}`}>
                        {isIncome ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm">{t.description || cat?.name || "Transaction"}</p>
                        <p className="text-xs text-muted-foreground">{cat?.name ?? "Uncategorised"} · {formatRelativeDate(t.date)}</p>
                      </div>
                    </div>
                    <span className={`num shrink-0 text-sm ${isIncome ? "text-[color:var(--color-positive)]" : ""}`}>
                      {isIncome ? "+" : "−"}{formatCurrency(Number(t.amount), { currency }).replace("−", "")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Savings ring — sum of active goals */}
        <Link to="/goals" className="card-surface flex items-center gap-5 p-5 transition-colors hover:bg-[color:var(--color-surface-1)]">
          <ProgressRing progress={savingsProgress} />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Goals progress</p>
            <p className="num mt-1 text-xl">{formatCurrency(goalAgg?.current ?? 0, { currency })}</p>
            <p className="text-xs text-muted-foreground">
              {savingsGoal > 0 ? `of ${formatCurrency(savingsGoal, { currency })} target` : "No active goals yet"}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">{savingsGoal > 0 ? `${Math.round(savingsProgress * 100)}% complete` : "Add one from Goals →"}</p>
          </div>
        </Link>

        {/* MoM bars */}
        <div className="card-surface p-5">
          <h3 className="mb-4 text-sm font-medium">This month vs last month</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.momData} barCategoryGap={30}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)" }}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-hairline)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v, { currency })}
                />
                <Bar dataKey="income" fill="var(--color-positive)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="var(--color-negative)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

function WealthCard({ to, label, value, growth, currency, icon: Icon }: { to: "/savings" | "/investments"; label: string; value: number; growth: number; currency: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link to={to} className="card-surface flex items-center gap-4 p-5 transition-colors hover:bg-[color:var(--color-surface-1)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-gold)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="num mt-1 text-xl">{formatCurrency(value, { currency })}</p>
        {growth !== 0 && (
          <p className="num mt-0.5 text-[11px] text-[color:var(--color-gold)]">
            {growth >= 0 ? "+" : "−"}{formatCurrency(Math.abs(growth), { currency })} growth
          </p>
        )}
      </div>
    </Link>
  );
}

function StatCard({ label, value, tone, currency }: { label: string; value: number; tone: "positive" | "negative"; currency: string }) {
  const color = tone === "positive" ? "text-[color:var(--color-positive)]" : "text-[color:var(--color-negative)]";
  return (
    <div className="card-surface p-4 md:p-5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-2 text-lg md:text-2xl ${value === 0 ? "" : color}`}>{formatCurrency(value, { currency })}</p>
    </div>
  );
}

function DebtStat({ label, value, pct, tone, currency }: { label: string; value: number; pct: number; tone: "positive" | "negative"; currency: string }) {
  const color = tone === "positive" ? "var(--color-positive)" : "var(--color-negative)";
  return (
    <div className="rounded-lg border border-[color:var(--color-hairline)] p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="num mt-1.5 text-xl" style={{ color }}>{formatCurrency(value, { currency })}</p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{Math.round(pct)}% cleared</p>
    </div>
  );
}


function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
      <Target className="h-5 w-5 text-muted-foreground/40" />
      {label}
    </div>
  );
}

function ProgressRing({ progress }: { progress: number }) {
  const size = 88;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * progress;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--color-gold)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="fill-foreground num text-sm">
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}
