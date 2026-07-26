import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, ArrowRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useWorkspace } from "@/components/workspace-provider";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — SHILLINGITRACK" }] }),
  component: SearchPage,
});

function SearchPage() {
  const { user } = useAuth();
  const { currency } = useWorkspace();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 200); return () => clearTimeout(t); }, [q]);

  const enabled = !!user && debounced.trim().length > 1;

  const { data } = useQuery({
    queryKey: ["search", user?.id, debounced],
    enabled,
    queryFn: async () => {
      // Escape PostgREST filter syntax (,()*) and SQL LIKE wildcards (%_\)
      // so user input is always treated as a literal search string.
      const safe = sanitizeSearch(debounced);
      const needle = `%${safe}%`;
      // Use two separate .ilike() calls unioned client-side instead of .or()
      // with a raw filter string — avoids all PostgREST filter-syntax parsing
      // of user input.
      const txSel = "id, date, amount, type, description, category_id, workspace";
      const [txDesc, txNotes, cat, goal, debt, cli] = await Promise.all([
        supabase.from("transactions").select(txSel).is("deleted_at", null).ilike("description", needle).limit(5),
        supabase.from("transactions").select(txSel).is("deleted_at", null).ilike("notes", needle).limit(5),
        supabase.from("categories").select("id, name, workspace").ilike("name", needle).limit(5),
        supabase.from("goals").select("id, name, current_amount, target_amount").ilike("name", needle).limit(5),
        supabase.from("debts").select("id, person_or_institution, current_balance, direction").ilike("person_or_institution", needle).limit(5),
        supabase.from("clients").select("id, name, business_name, status").ilike("name", needle).limit(5),
      ]);
      const txMap = new Map<string, NonNullable<typeof txDesc.data>[number]>();
      for (const row of [...(txDesc.data ?? []), ...(txNotes.data ?? [])]) txMap.set(row.id, row);
      const tx = Array.from(txMap.values()).slice(0, 5);
      return { tx, cat: cat.data ?? [], goal: goal.data ?? [], debt: debt.data ?? [], cli: cli.data ?? [] };
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <h1 className="font-display text-xl font-semibold">Search</h1>
      <div className="card-surface flex items-center gap-2 px-3 py-2">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions, goals, debts, categories, clients…"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
      </div>

      {!enabled && <p className="text-sm text-muted-foreground">Type at least 2 characters.</p>}

      {enabled && data && (
        <div className="space-y-6">
          <Group title="Transactions" empty={data.tx.length === 0} link={{ to: "/transactions", label: "See all" }}>
            {data.tx.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="truncate">{t.description || "Transaction"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)} · {t.workspace}</p>
                </div>
                <span className={`num ${t.type === "income" ? "text-[color:var(--color-positive)]" : ""}`}>
                  {t.type === "income" ? "+" : "−"}{formatCurrency(Number(t.amount), { currency }).replace("−", "")}
                </span>
              </li>
            ))}
          </Group>
          <Group title="Goals" empty={data.goal.length === 0} link={{ to: "/goals", label: "See all" }}>
            {data.goal.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2 text-sm">
                <span>{g.name}</span>
                <span className="num text-xs text-muted-foreground">{formatCurrency(Number(g.current_amount), { currency })} / {formatCurrency(Number(g.target_amount), { currency })}</span>
              </li>
            ))}
          </Group>
          <Group title="Debts" empty={data.debt.length === 0} link={{ to: "/debts", label: "See all" }}>
            {data.debt.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                <span>{d.person_or_institution} <span className="text-xs text-muted-foreground">· {d.direction === "i_owe" ? "I owe" : "Owed to me"}</span></span>
                <span className="num">{formatCurrency(Number(d.current_balance), { currency })}</span>
              </li>
            ))}
          </Group>
          <Group title="Clients" empty={data.cli.length === 0} link={{ to: "/clients", label: "See all" }}>
            {data.cli.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>{c.name} {c.business_name && <span className="text-muted-foreground text-xs">· {c.business_name}</span>}</span>
                <span className="text-xs text-muted-foreground capitalize">{c.status}</span>
              </li>
            ))}
          </Group>
          <Group title="Categories" empty={data.cat.length === 0}>
            {data.cat.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{c.workspace}</span>
              </li>
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ title, empty, link, children }: { title: string; empty: boolean; link?: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <div className="card-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {link && !empty && (
          <Link to={link.to} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[color:var(--color-gold)]">
            {link.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {empty ? <p className="text-xs text-muted-foreground">No matches.</p> : <ul className="divide-y divide-[color:var(--color-hairline)]">{children}</ul>}
    </div>
  );
}
