import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { inviteAdmin, setAccessStatus } from "@/lib/access-control.functions";
import { Shield, ShieldAlert, ShieldCheck, UserPlus, XCircle, RotateCcw } from "lucide-react";
import { ErrorState, SkeletonList } from "@/components/ui/loading";

export const Route = createFileRoute("/_authenticated/access-control")({
  head: () => ({ meta: [{ title: "Access Control — SHILLINGITRACK" }] }),
  component: AccessControlPage,
});

function AccessControlPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const doInvite = useServerFn(inviteAdmin);
  const doSetStatus = useServerFn(setAccessStatus);

  const { data: me, isLoading: meLoading, isError: meError, refetch: refetchMe } = useQuery({
    queryKey: ["access-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("approved_emails").select("role, status")
        .eq("email", (user!.email ?? "").toLowerCase()).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isOwner = me?.role === "owner" && me.status === "active";

  const { data: approved = [], isLoading: apLoading, isError: apError, refetch: refetchAp } = useQuery({
    queryKey: ["approved-emails"],
    enabled: isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("approved_emails")
        .select("*").order("added_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: attempts = [], isLoading: atLoading, isError: atError, refetch: refetchAt } = useQuery({
    queryKey: ["login-attempts"],
    enabled: isOwner,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("login_attempts")
        .select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    if (!inviteEmail) return;
    setBusy(true);
    try {
      const res = await doInvite({
        data: { email: inviteEmail, redirectTo: `${window.location.origin}/reset-password` },
      });
      if (res.invited) toast.success("Invited — they'll receive an email to set their password.");
      else toast.warning(res.warning ?? "Added to allowlist. Email send failed — ask them to use Forgot password.");
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["approved-emails"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally { setBusy(false); }
  };

  const flipStatus = async (id: string, status: "active" | "revoked") => {
    try {
      await doSetStatus({ data: { id, status } });
      toast.success(status === "revoked" ? "Access revoked. Any active sessions were terminated." : "Access reinstated.");
      qc.invalidateQueries({ queryKey: ["approved-emails"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  if (!user) return null;
  if (meError) return <div className="mx-auto max-w-2xl p-8"><ErrorState message="Couldn't check your access level." onRetry={() => refetchMe()} /></div>;
  if (meLoading) return <div className="mx-auto max-w-2xl p-8"><SkeletonList rows={3} /></div>;

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="card-surface flex items-start gap-3 p-6">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-[color:var(--color-negative)]" />
          <div>
            <h1 className="font-display text-lg font-semibold">Owner only</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Access control is restricted to the workspace owner.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-[color:var(--color-gold)]" />
        <h1 className="font-display text-xl font-semibold">Access Control</h1>
      </div>

      <section className="card-surface p-6 space-y-3">
        <h2 className="text-sm font-medium">Invite an admin</h2>
        <p className="text-xs text-muted-foreground">
          They'll receive an email to set their own password. You'll never handle their credentials.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="admin@example.com" className="flex-1" />
          <Button onClick={invite} disabled={busy || !inviteEmail}
            className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
            <UserPlus className="mr-2 h-4 w-4" /> {busy ? "Sending…" : "Invite"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Owner + admin actions require 2FA. If this fails with "Two-factor authentication required", enrol TOTP under Security first.
        </p>
      </section>

      <section className="card-surface p-6">
        <h2 className="mb-4 text-sm font-medium">Approved accounts</h2>
        {apError ? <ErrorState message="Couldn't load approved accounts." onRetry={() => refetchAp()} /> : apLoading ? <SkeletonList rows={3} /> : null}
        <ul className="divide-y divide-[color:var(--color-hairline)]">
          {!apError && !apLoading && approved.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{row.email}</p>
                <p className="text-xs text-muted-foreground">
                  {row.role} · added {formatDate(row.added_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                  row.status === "active"
                    ? "bg-[color:var(--color-positive)]/15 text-[color:var(--color-positive)]"
                    : "bg-[color:var(--color-negative)]/15 text-[color:var(--color-negative)]"
                }`}>
                  {row.status}
                </span>
                {row.role !== "owner" && (
                  row.status === "active" ? (
                    <Button size="sm" variant="ghost" onClick={() => flipStatus(row.id, "revoked")}
                      className="text-[color:var(--color-negative)] hover:text-[color:var(--color-negative)]">
                      <XCircle className="mr-1 h-3.5 w-3.5" /> Revoke
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => flipStatus(row.id, "active")}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reinstate
                    </Button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[color:var(--color-gold)]" />
          <h2 className="text-sm font-medium">Recent login attempts</h2>
        </div>
        {atError ? (
          <ErrorState message="Couldn't load login attempts." onRetry={() => refetchAt()} />
        ) : atLoading ? (
          <SkeletonList rows={4} />
        ) : attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attempts yet.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-hairline)] text-sm">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate">{a.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.reason ?? (a.success ? "success" : "failure")} · {a.device_info ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                    a.success
                      ? "bg-[color:var(--color-positive)]/15 text-[color:var(--color-positive)]"
                      : "bg-[color:var(--color-negative)]/15 text-[color:var(--color-negative)]"
                  }`}>
                    {a.success ? "ok" : "blocked"}
                  </span>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(a.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
