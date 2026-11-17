import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyStepUpPassword } from "@/lib/step-up.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-provider";

export function PasswordConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirmed: (proof: string) => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifyPassword = useServerFn(verifyStepUpPassword);

  const submit = async () => {
    if (!user?.email) return;
    setBusy(true); setError(null);
    try {
      const { proof } = await verifyPassword({ data: { password } });
      await onConfirmed(proof);
      setPassword("");
      onOpenChange(false);
    } catch (err) {
      setError("Couldn't verify or complete this action. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="card-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <label className="text-xs text-muted-foreground">Confirm your password</label>
          <PasswordInput
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {error && <p className="text-sm text-[color:var(--color-negative)]">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!password || busy}>
            {busy ? "Verifying…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
