import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ArrowLeftRight, PieChart, Search, Settings, Plus, HandCoins } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "./workspace-provider";
import { useAuth } from "./auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { QuickCapture } from "./quick-capture";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Transactions", to: "/transactions", icon: ArrowLeftRight },
  { label: "Debts", to: "/debts", icon: HandCoins },
  { label: "Reports", to: "/reports", icon: PieChart },
  { label: "Search", to: "/search", icon: Search },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

const LOW_BALANCE_THRESHOLD = 500;


export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { workspace, setWorkspace, currency } = useWorkspace();
  const { user } = useAuth();
  const [captureOpen, setCaptureOpen] = useState(false);

  const { data: balance = 0 } = useQuery({
    queryKey: ["balance-alert", user?.id, workspace],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("workspace", workspace)
        .is("deleted_at", null);
      if (error) throw error;
      let bal = 0;
      for (const t of data ?? []) {
        const amt = Number(t.amount) || 0;
        if (t.type === "income") bal += amt;
        else if (t.type === "expense") bal -= amt;
      }
      return bal;
    },
  });
  const lowBalance = user != null && balance < LOW_BALANCE_THRESHOLD;


  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar — desktop */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-[color:var(--color-hairline)] px-3 py-6 md:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--color-gold)] font-display text-sm font-bold text-[color:var(--color-gold-foreground)]">S</div>
          <span className="font-display text-sm font-semibold tracking-tight">SHILLINGITRACK</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map(({ label, to, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-[color:var(--color-surface-2)] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-[color:var(--color-surface-1)]",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-[color:var(--color-gold)]")} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[color:var(--color-hairline)] bg-background/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            {/* Workspace toggle */}
            <div className="flex items-center rounded-lg border border-[color:var(--color-hairline)] p-0.5">
              {(["personal", "business"] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setWorkspace(w)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                    workspace === w
                      ? "bg-[color:var(--color-surface-2)] text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setCaptureOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-gold)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-gold-foreground)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Quick add
            <kbd className="ml-1 hidden rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-normal sm:inline">N</kbd>
          </button>
        </header>

        <main className="flex-1">{children}</main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-[color:var(--color-hairline)] bg-background/95 backdrop-blur md:hidden">
        {nav.map(({ label, to, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                active ? "text-[color:var(--color-gold)]" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <QuickCapture open={captureOpen} onOpenChange={setCaptureOpen} />
    </div>
  );
}
