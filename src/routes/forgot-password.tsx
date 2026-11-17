import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { requestPasswordReset } from "@/lib/access-control.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LegalFooter } from "@/components/legal-footer";
export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [
    { title: "Forgot password — SHILLINGITRACK" },
    { name: "description", content: "Request secure password recovery for SHILLINGITRACK." },
    { property: "og:title", content: "Forgot password — SHILLINGITRACK" },
    { property: "og:description", content: "Request secure password recovery for SHILLINGITRACK." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ForgotPassword,
});
function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = useServerFn(requestPasswordReset);
  return <div className="flex min-h-screen flex-col"><main className="flex flex-1 items-center justify-center p-4">
    <form className="card-surface w-full max-w-sm space-y-4 p-6" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError("");
      try { await send({ data: { email, redirectTo: `${window.location.origin}/reset-password` } }); setSent(true); }
      catch { setError("Couldn't request instructions. Please try again."); } finally { setBusy(false); }
    }}>
      <h1 className="font-display text-xl font-semibold">Forgot password</h1>
      {sent ? <><p role="status" className="text-sm text-muted-foreground">If an account exists, we have sent instructions</p>
        <Button asChild className="w-full"><Link to="/reset-password" search={{ email }}>Enter recovery code</Link></Button></> : <>
        <label htmlFor="recovery-email" className="block text-sm text-muted-foreground">Email</label>
        <Input id="recovery-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button disabled={busy} className="w-full">{busy ? "Sending…" : "Send instructions"}</Button></>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button asChild variant="ghost" className="w-full"><Link to="/auth">Back to sign in</Link></Button>
    </form></main><LegalFooter /></div>;
}