import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/components/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Shield, LogOut, Tag, Wallet, Target, HandCoins, Users, Briefcase, FileText, Package, Repeat, Database, ChevronRight, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SHILLINGITRACK" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: log = [] } = useQuery({
    queryKey: ["seclog", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("security_log").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [name, setName] = useState("");
  const [autoLock, setAutoLock] = useState<number>(15);
  const [saving, setSaving] = useState(false);

  // hydrate form
  if (profile && !name && profile.display_name) setName(profile.display_name);
  if (profile && autoLock === 15 && profile.auto_lock_minutes && profile.auto_lock_minutes !== autoLock) setAutoLock(profile.auto_lock_minutes);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name, auto_lock_minutes: autoLock }).eq("id", user!.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); refetch(); }
  };

  const links = [
    { to: "/categories", label: "Categories", icon: Tag },
    { to: "/budgets", label: "Budgets", icon: Wallet },
    { to: "/goals", label: "Goals", icon: Target },
    { to: "/debts", label: "Debts", icon: HandCoins },
    { to: "/clients", label: "Clients", icon: Users },
    { to: "/projects", label: "Projects", icon: Briefcase },
    { to: "/invoices", label: "Invoices", icon: FileText },
    { to: "/equipment", label: "Equipment", icon: Package },
    { to: "/recurring", label: "Recurring", icon: Repeat },
    { to: "/security", label: "Security & 2FA", icon: Shield },
    { to: "/access-control", label: "Access Control", icon: KeyRound },
    { to: "/backup", label: "Backup & restore", icon: Database },
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <h1 className="font-display text-xl font-semibold">Settings</h1>

      <section className="card-surface divide-y divide-[color:var(--color-hairline)]">
        {links.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[color:var(--color-surface-2)]">
            <Icon className="h-4 w-4 text-[color:var(--color-gold)]" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </section>

      <section className="card-surface p-6 space-y-4">
        <h2 className="text-sm font-medium">Profile</h2>
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Display name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Email</label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Auto-lock after inactivity</label>
          <div className="flex gap-1">
            {[5, 10, 15, 30, 60].map((m) => (
              <button
                key={m}
                onClick={() => setAutoLock(m)}
                className={`rounded-md border px-3 py-1.5 text-xs ${autoLock === m ? "border-[color:var(--color-gold)] text-[color:var(--color-gold)]" : "border-[color:var(--color-hairline)] text-muted-foreground"}`}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>

      <section className="card-surface p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[color:var(--color-gold)]" />
          <h2 className="text-sm font-medium">Security log</h2>
        </div>
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-hairline)] text-sm">
            {log.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="capitalize">{e.event_type.replace(/_/g, " ")}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.device_info || "—"}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-surface p-6">
        <Button variant="ghost" onClick={signOut} className="text-muted-foreground hover:text-[color:var(--color-negative)]">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </section>
    </div>
  );
}
