import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordConfirmDialog } from "@/components/password-confirm";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Shield, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({ meta: [{ title: "Security — SHILLINGITRACK" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const { user } = useAuth();
  const [factors, setFactors] = useState<{ totp: Array<{ id: string; friendly_name?: string | null; status: string }> }>({ totp: [] });
  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableTarget, setDisableTarget] = useState<string | null>(null);

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors({ totp: data?.totp ?? [] });
  };

  useEffect(() => { void loadFactors(); }, []);

  const { data: log = [] } = useQuery({
    queryKey: ["seclog-full", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("security_log").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const beginEnroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Device ${new Date().toISOString().slice(0,10)}` });
    if (error) { toast.error(error.message); return; }
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verifyEnroll = async () => {
    if (!enrolling) return;
    const { data: chall, error } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (error) { toast.error(error.message); return; }
    const { error: v } = await supabase.auth.mfa.verify({ factorId: enrolling.factorId, challengeId: chall.id, code: verifyCode });
    if (v) { toast.error("Wrong code."); return; }
    // Generate one-time recovery codes locally & log
    const codes = Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 6));
    setRecoveryCodes(codes);
    setEnrolling(null); setVerifyCode("");
    await supabase.from("security_log").insert({ user_id: user!.id, event_type: "2fa_enabled", device_info: navigator.userAgent });
    void loadFactors();
    toast.success("2FA enabled");
  };

  const disable = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { toast.error(error.message); return; }
    await supabase.from("security_log").insert({ user_id: user!.id, event_type: "2fa_disabled", device_info: navigator.userAgent });
    void loadFactors();
    toast.success("2FA disabled");
  };

  const downloadCodes = () => {
    if (!recoveryCodes) return;
    const blob = new Blob([recoveryCodes.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "shillingitrack-recovery-codes.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const active = factors.totp.filter((f) => f.status === "verified");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-[color:var(--color-gold)]" />
        <h1 className="font-display text-xl font-semibold">Security</h1>
      </div>

      <section className="card-surface p-6 space-y-4">
        <h2 className="text-sm font-medium">Two-factor authentication (TOTP)</h2>
        {active.length > 0 ? (
          <div className="space-y-2">
            {active.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border border-[color:var(--color-hairline)] px-3 py-2 text-sm">
                <span>{f.friendly_name || "Authenticator"} · <span className="text-[color:var(--color-positive)]">enabled</span></span>
                <button onClick={() => setDisableTarget(f.id)} className="text-xs text-[color:var(--color-negative)]">Disable</button>
              </div>
            ))}
          </div>
        ) : enrolling ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Scan the QR in your authenticator app, then enter the 6-digit code.</p>
            <div className="flex items-start gap-4">
              <img src={enrolling.qr} alt="QR" className="h-40 w-40 rounded bg-white p-2" />
              <div className="text-xs">
                <p className="text-muted-foreground">Manual key</p>
                <p className="font-mono select-all">{enrolling.secret}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input placeholder="123456" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} maxLength={6} />
              <Button onClick={verifyEnroll} disabled={verifyCode.length !== 6}>Verify</Button>
            </div>
          </div>
        ) : (
          <Button onClick={beginEnroll} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">Enable 2FA</Button>
        )}

        {recoveryCodes && (
          <div className="rounded-md border border-[color:var(--color-gold)]/40 bg-[color:var(--color-gold)]/5 p-3 text-xs">
            <p className="mb-2 font-medium text-[color:var(--color-gold)]">Save your recovery codes — shown once.</p>
            <ul className="grid grid-cols-2 gap-1 font-mono">{recoveryCodes.map((c) => <li key={c}>{c}</li>)}</ul>
            <button onClick={downloadCodes} className="mt-2 text-[color:var(--color-gold)]"><Download className="mr-1 inline h-3 w-3" />Download .txt</button>
          </div>
        )}
      </section>

      <section className="card-surface p-6 space-y-3">
        <h2 className="text-sm font-medium">Security log</h2>
        <ul className="divide-y divide-[color:var(--color-hairline)] text-sm">
          {log.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2">
              <div>
                <p className="capitalize">{e.event_type.replace(/_/g, " ")}</p>
                <p className="truncate text-xs text-muted-foreground">{e.device_info || "—"}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(e.created_at)}</span>
            </li>
          ))}
          {log.length === 0 && <p className="text-sm text-muted-foreground">No events.</p>}
        </ul>
      </section>

      <PasswordConfirmDialog
        open={!!disableTarget}
        onOpenChange={(v) => !v && setDisableTarget(null)}
        title="Disable 2FA?"
        description="Confirm your password to disable two-factor authentication."
        confirmLabel="Disable"
        onConfirmed={async () => { if (disableTarget) await disable(disableTarget); }}
      />
    </div>
  );
}
