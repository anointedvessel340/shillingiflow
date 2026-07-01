import { useState } from "react";
import { useAuth } from "./auth-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export function LockScreen() {
  const { unlock, user, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await unlock(password);
    setBusy(false);
    if (error) setError(error); else setPassword("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <form onSubmit={submit} className="card-surface w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--color-surface-2)]">
            <Lock className="h-4 w-4 text-[color:var(--color-gold)]" />
          </div>
          <div>
            <h2 className="font-medium">Session locked</h2>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <p className="text-sm text-[color:var(--color-negative)]">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={signOut} className="flex-1">Sign out</Button>
          <Button type="submit" disabled={busy || !password} className="flex-1 bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
        </div>
      </form>
    </div>
  );
}
