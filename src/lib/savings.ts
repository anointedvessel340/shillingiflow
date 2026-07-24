// Deterministic interest/current-value math for savings & investment accounts.
// Per spec: whole running principal, monthly compounding, redisplayed daily.

export type LedgerEntry = {
  id: string;
  entry_type: "deposit" | "withdrawal" | "manual_valuation";
  amount: number;
  date: string; // YYYY-MM-DD
  notes: string | null;
  linked_transaction_id: string | null;
};

export type SavingsAccount = {
  id: string;
  name: string;
  held_at: string | null;
  account_kind: "savings" | "investment";
  workspace: "personal" | "business";
  interest_rate: number | null; // annual, e.g. 0.08 for 8%
  compounding_frequency: "monthly" | "none";
  opened_date: string;
  status: "active" | "closed";
  notes: string | null;
};

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Walks the ledger chronologically. For interest-bearing accounts,
 * accrues monthly-compounded interest on the running balance between events,
 * pro-rated by day so the number changes visibly day over day.
 * Returns principal (net contributions), interest, and current value.
 */
export function computeAccountValue(
  account: SavingsAccount,
  ledger: LedgerEntry[],
  asOf: Date = new Date(),
): { principal: number; interest: number; currentValue: number } {
  const entries = [...ledger].sort((a, b) => a.date.localeCompare(b.date));
  let principal = 0;
  const rate = Number(account.interest_rate) || 0;
  const hasRate = rate > 0 && account.compounding_frequency === "monthly";

  // For accounts without a rate: value comes from most recent manual_valuation,
  // else from net contributions.
  if (!hasRate) {
    let net = 0;
    let latestValuation: number | null = null;
    let latestValuationDate = "";
    for (const e of entries) {
      if (e.entry_type === "deposit") net += Number(e.amount) || 0;
      else if (e.entry_type === "withdrawal") net -= Number(e.amount) || 0;
      else if (e.entry_type === "manual_valuation") {
        if (e.date >= latestValuationDate) {
          latestValuation = Number(e.amount) || 0;
          latestValuationDate = e.date;
        }
      }
    }
    principal = net;
    const currentValue = latestValuation !== null ? latestValuation : net;
    return { principal, interest: currentValue - principal, currentValue };
  }

  // Rate-bearing: compound running balance between events, daily fraction.
  const monthlyRate = rate / 12;
  const dailyGrowth = Math.pow(1 + monthlyRate, 1 / 30) - 1; // approx daily equivalent of monthly rate
  let balance = 0;
  let lastDate = new Date(entries[0]?.date ?? account.opened_date);
  for (const e of entries) {
    const d = new Date(e.date);
    const days = daysBetween(lastDate, d);
    if (balance > 0 && days > 0) balance = balance * Math.pow(1 + dailyGrowth, days);
    if (e.entry_type === "deposit") { balance += Number(e.amount) || 0; principal += Number(e.amount) || 0; }
    else if (e.entry_type === "withdrawal") {
      const amt = Number(e.amount) || 0;
      balance = Math.max(0, balance - amt);
      principal = Math.max(0, principal - amt);
    }
    lastDate = d;
  }
  const tailDays = daysBetween(lastDate, asOf);
  if (balance > 0 && tailDays > 0) balance = balance * Math.pow(1 + dailyGrowth, tailDays);
  return { principal, interest: balance - principal, currentValue: balance };
}

/** Balance sparkline points over the last `days` days. */
export function balanceSparkline(
  account: SavingsAccount,
  ledger: LedgerEntry[],
  days = 30,
): { date: string; v: number }[] {
  const out: { date: string; v: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const { currentValue } = computeAccountValue(account, ledger, d);
    out.push({ date: d.toISOString().slice(0, 10), v: currentValue });
  }
  return out;
}
