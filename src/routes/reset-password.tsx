import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/auth-client";
import { finishPasswordRecovery } from "@/lib/recovery.functions";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({ email: typeof search.email === "string" ? search.email : "" }),
  head: () => ({ meta: [
    { title: "Reset password — SHILLINGITRACK" }, { name: "description", content: "Recover your SHILLINGITRACK account securely." },
    { property: "og:title", content: "Reset password — SHILLINGITRACK" }, { property: "og:description", content: "Recover your SHILLINGITRACK account securely." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ResetPassword,
});
function ResetPassword() {
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const finish = useServerFn(finishPasswordRecovery);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.has("error")) setError("This reset link is invalid or expired. Request new instructions.");
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setReady(true); });
    if (hash.get("type") === "recovery") {
      void supabase.auth.getUser().then(({ data, error }) => { if (data.user && !error) setReady(true); else setError("This reset link is invalid or expired."); });
    }
    return () => data.subscription.unsubscribe();
  }, []);
  return <main className="flex min-h-screen items-center justify-center p-4"><form className="card-surface w-full max-w-sm space-y-4 p-6" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (!ready) {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
        if (error) { setError("This code is invalid or expired. Request new instructions."); return; }
        setReady(true); return;
      }
      if (password !== confirm) { setError("Passwords do not match."); return; }
      await finish({ data: { password } });
      await supabase.auth.signOut({ scope: "local" }); setDone(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn't reset your password. Please try again."); }
    finally { setBusy(false); }
  }}>
    <h1 className="font-display text-xl font-semibold">{done ? "Password updated" : ready ? "Set a new password" : "Reset password"}</h1>
    {done ? <><p role="status" className="text-sm text-muted-foreground">Your password has changed and other sessions have been signed out. Two-factor authentication remains enabled.</p><Button asChild className="w-full"><Link to="/auth">Sign in</Link></Button></> : <>
      {ready ? <><label htmlFor="new-password" className="block text-sm">New password</label><PasswordInput id="new-password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        <label htmlFor="confirm-password" className="block text-sm">Confirm password</label><PasswordInput id="confirm-password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></> : <>
        <label htmlFor="reset-email" className="block text-sm">Email</label><Input id="reset-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="reset-code" className="block text-sm">Recovery code</label><Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button disabled={busy} className="w-full">{busy ? "Please wait…" : ready ? "Update password" : "Verify code"}</Button>
      <Button asChild variant="ghost" className="w-full"><Link to="/forgot-password">Request new instructions</Link></Button></>}
  </form></main>;
}