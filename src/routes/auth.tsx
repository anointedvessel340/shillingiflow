import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { attemptSignIn, requestPasswordReset } from "@/lib/access-control.functions";
import { Fingerprint, Lock, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — SHILLINGITRACK" },
      { name: "description", content: "Sign in to your SHILLINGITRACK account. Invite-only." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "forgot" | "mfa";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // MFA challenge state
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const { user } = useAuth();
  const navigate = useNavigate();
  const doSignIn = useServerFn(attemptSignIn);
  const doReset = useServerFn(requestPasswordReset);

  useEffect(() => {
    if (user && mode !== "mfa") navigate({ to: "/dashboard", replace: true });
  }, [user, navigate, mode]);

  const continueAfterSession = async () => {
    // Detect required MFA step-up
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (totp) {
        const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (error || !challenge) { toast.error(error?.message ?? "Could not start 2FA"); return; }
        setMfaFactorId(totp.id);
        setMfaChallengeId(challenge.id);
        setMode("mfa");
        return;
      }
    }
    navigate({ to: "/dashboard", replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        await doReset({ data: { email, redirectTo: `${window.location.origin}/reset-password` } });
        // Always generic — don't reveal existence.
        toast.success("If that address is on the allowlist, a reset link is on the way.");
        setMode("signin");
        return;
      }
      if (mode === "mfa") {
        if (!mfaFactorId || !mfaChallengeId) return;
        const { error } = await supabase.auth.mfa.verify({
          factorId: mfaFactorId, challengeId: mfaChallengeId, code: mfaCode,
        });
        if (error) throw new Error(error.message);
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      // signin
      const res = await doSignIn({ data: { email, password } });
      if (!res.ok) { toast.error(res.message); return; }
      const { error } = await supabase.auth.setSession(res.session);
      if (error) throw new Error(error.message);
      await continueAfterSession();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] font-display font-bold">S</div>
          <h1 className="font-display text-2xl font-semibold">SHILLINGITRACK</h1>
          <p className="mt-1 text-sm text-muted-foreground">Private financial workspace. Invite-only.</p>
        </div>

        <form onSubmit={submit} className="card-surface space-y-4 p-6">
          {mode === "mfa" ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-[color:var(--color-gold)]" />
                <span>Enter the 6-digit code from your authenticator app.</span>
              </div>
              <Input
                inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456" className="tracking-[0.5em] text-center text-lg"
              />
              <Button type="submit" disabled={busy || mfaCode.length !== 6}
                className="w-full bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
                {busy ? "Verifying…" : "Verify"}
              </Button>
              <button type="button" onClick={async () => {
                  await supabase.auth.signOut();
                  setMode("signin"); setPassword(""); setMfaCode("");
                  setMfaFactorId(null); setMfaChallengeId(null);
                }} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Cancel and sign out
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" /> Email
                </label>
                <Input type="email" required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              {mode === "signin" && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" /> Password
                    </label>
                    <button type="button" onClick={() => setMode("forgot")}
                      className="text-xs text-[color:var(--color-gold)] hover:underline">
                      Forgot?
                    </button>
                  </div>
                  <Input type="password" required minLength={8} autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <Button type="submit" disabled={busy}
                className="w-full bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Send reset link"}
              </Button>

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => toast.info("Passkey / biometric login is planned. For now, sign in with password — your authenticator app will be prompted next.")}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-[color:var(--color-hairline)] px-3 py-2 text-xs text-muted-foreground hover:bg-[color:var(--color-surface-2)]"
                >
                  <Fingerprint className="h-4 w-4" />
                  Use passkey / biometric
                </button>
              )}

              {mode === "forgot" && (
                <button type="button" onClick={() => setMode("signin")}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
                  Back to sign in
                </button>
              )}
            </>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Access is invite-only. Only accounts approved by the owner can sign in.
        </p>
      </div>
    </div>
  );
}
