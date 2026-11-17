import { useEffect, useState } from "react";
import { supabase } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { LoadingBlock } from "./ui/loading";
import { useAuth } from "./auth-provider";
export function MFAGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [checking, setChecking] = useState(true);
  const [factor, setFactor] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setChecking(true); setError("");
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
        const { data: factors, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const verified = factors.totp.find((factor) => factor.status === "verified");
        if (!verified) throw new Error("Authenticator unavailable");
        setFactor(verified.id);
      } else setFactor("");
    } catch { setError("Couldn't verify your sign-in. Please try again."); }
    finally { setChecking(false); }
  };
  useEffect(() => { if (session) void check(); else setChecking(false); }, [session?.access_token]);
  if (!session) return <>{children}</>;
  if (checking) return <div className="flex min-h-screen items-center justify-center"><LoadingBlock label="Checking sign-in…" /></div>;
  if (!factor && !error) return <>{children}</>;
  return <main className="flex min-h-screen items-center justify-center p-4"><form className="card-surface w-full max-w-sm space-y-4 p-6" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code });
      if (error) throw error;
      await check();
    } catch { setError("That code wasn't accepted. Please try again."); }
    finally { setBusy(false); }
  }}>
    <h1 className="font-display text-xl">Two-factor authentication</h1>
    {factor && <><label htmlFor="mfa-code" className="block text-sm text-muted-foreground">Authenticator code</label><Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /><Button disabled={busy || code.length !== 6} className="w-full">{busy ? "Verifying…" : "Verify"}</Button></>}
    {error && <><p role="alert" className="text-sm text-destructive">{error}</p><Button type="button" variant="outline" onClick={check}>Retry</Button></>}
    <Button type="button" variant="ghost" onClick={() => supabase.auth.signOut({ scope: "local" })}>Cancel and sign out</Button>
  </form></main>;
}