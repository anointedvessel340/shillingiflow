import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { PasswordConfirmDialog } from "@/components/password-confirm";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Fingerprint, Trash2, Smartphone } from "lucide-react";
import {
  listPasskeys,
  startPasskeyRegistration,
  finishPasskeyRegistration,
  revokePasskey,
} from "@/lib/passkeys.functions";

export function PasskeyManager() {
  const qc = useQueryClient();
  const list = useServerFn(listPasskeys);
  const start = useServerFn(startPasskeyRegistration);
  const finish = useServerFn(finishPasskeyRegistration);
  const revoke = useServerFn(revokePasskey);

  const [confirmAdd, setConfirmAdd] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  const supported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  const { data: passkeys = [], isLoading, error } = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => list({}),
  });

  const add = useMutation({
    mutationFn: async () => {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const options = await start({});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await startRegistration({ optionsJSON: options as any });
      await finish({ data: { response } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["passkeys"] });
      qc.invalidateQueries({ queryKey: ["seclog-full"] });
      toast.success("Device registered", { description: "You can now unlock with this device's biometrics." });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Could not register this device";
      toast.error(/NotAllowed/i.test(msg) ? "Registration cancelled or timed out." : msg);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["passkeys"] });
      qc.invalidateQueries({ queryKey: ["seclog-full"] });
      toast.success("Passkey removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove passkey"),
  });

  return (
    <section className="card-surface space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Fingerprint className="h-4 w-4 text-[color:var(--color-gold)]" /> Biometric &amp; passkeys
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Each passkey is bound to one device and unlocked by that device&apos;s own fingerprint, face or PIN — enforced by the operating system.
          </p>
        </div>
        <Button
          size="sm"
          disabled={!supported || add.isPending}
          onClick={() => setConfirmAdd(true)}
          className="shrink-0 bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90"
        >
          {add.isPending ? "Waiting…" : "Add this device"}
        </Button>
      </div>

      {!supported && (
        <p className="text-xs text-[color:var(--color-negative)]">
          This browser does not support passkeys. Try Safari, Chrome or Edge on a device with biometrics.
        </p>
      )}

      {isLoading ? (
        <p className="py-4 text-sm text-muted-foreground">Loading devices…</p>
      ) : error ? (
        <p className="py-4 text-sm text-[color:var(--color-negative)]">
          Could not load your passkeys. Refresh and try again.
        </p>
      ) : passkeys.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No devices registered yet.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--color-hairline)]">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-gold)]">
                  <Smartphone className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm">{p.device_label}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {formatDate(p.created_at)} · Last used {p.last_used_at ? formatDate(p.last_used_at) : "never"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRevokeTarget(p.id)}
                disabled={remove.isPending}
                aria-label="Revoke passkey"
                className="rounded p-1.5 text-muted-foreground transition-colors hover:text-[color:var(--color-negative)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <PasswordConfirmDialog
        open={confirmAdd}
        onOpenChange={setConfirmAdd}
        title="Add a new passkey?"
        description="Confirm your password. Your browser will then ask for this device's fingerprint, face or PIN."
        confirmLabel="Continue"
        onConfirmed={async () => { await add.mutateAsync(); }}
      />

      <PasswordConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(v) => !v && setRevokeTarget(null)}
        title="Remove this passkey?"
        description="That device will no longer be able to sign in with biometrics. This cannot be undone."
        confirmLabel="Remove"
        onConfirmed={async () => { if (revokeTarget) await remove.mutateAsync(revokeTarget); }}
      />
    </section>
  );
}
