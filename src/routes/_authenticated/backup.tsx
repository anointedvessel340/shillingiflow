import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordConfirmDialog } from "@/components/password-confirm";
import { toast } from "sonner";
import { Download, Upload, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({ meta: [{ title: "Backup — SHILLINGITRACK" }] }),
  component: BackupPage,
});

const TABLES = ["profiles", "accounts", "categories", "transactions", "tags", "budgets", "goals", "goal_contributions", "debts", "debt_payments", "clients", "projects", "invoices", "invoice_items", "invoice_payments", "equipment", "equipment_maintenance", "recurring_rules"] as const;

async function collectData(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  const anyDb = supabase as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: unknown[] | null }> } };
  for (const t of TABLES) {
    const { data } = await anyDb.from(t).select("*");
    out[t] = data ?? [];
  }
  return out;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

async function encryptAESGCM(passphrase: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" }, baseKey,
    { name: "AES-GCM", length: 256 }, false, ["encrypt"],
  );
  const pt = new Uint8Array(plaintext.byteLength);
  pt.set(plaintext);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
  const out = new Uint8Array(4 + 16 + 12 + cipher.length);
  out.set(new TextEncoder().encode("STK1"), 0);
  out.set(salt, 4); out.set(iv, 20); out.set(cipher, 32);
  return out;
}

async function decryptAESGCM(passphrase: string, ct: Uint8Array): Promise<Uint8Array> {
  const magic = new TextDecoder().decode(ct.slice(0, 4));
  if (magic !== "STK1") throw new Error("Not an encrypted STK backup");
  const salt = ct.slice(4, 20), iv = ct.slice(20, 32), data = ct.slice(32);
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" }, baseKey,
    { name: "AES-GCM", length: 256 }, false, ["decrypt"],
  );
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data));
}

function BackupPage() {
  const { user } = useAuth();
  const [passphrase, setPassphrase] = useState("");
  const [encrypt, setEncrypt] = useState(true);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePass, setRestorePass] = useState("");
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [pendingRestore, setPendingRestore] = useState<Record<string, unknown[]> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doExport = async () => {
    if (encrypt && !passphrase) { toast.error("Enter a passphrase or uncheck encrypt."); return; }
    toast.info("Preparing backup…");
    const data = await collectData();
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("data.json", JSON.stringify(data, null, 2));
    for (const [t, rows] of Object.entries(data)) zip.file(`${t}.csv`, toCSV(rows as Record<string, unknown>[]));
    const blob = await zip.generateAsync({ type: "uint8array" });
    let out: Uint8Array = blob; let ext = "zip"; let mime = "application/zip";
    if (encrypt) { out = await encryptAESGCM(passphrase, blob); ext = "stk"; mime = "application/octet-stream"; }
    const copy = new Uint8Array(out.byteLength); copy.set(out);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([copy.buffer], { type: mime }));
    a.download = `shillingitrack-backup-${Date.now()}.${ext}`; a.click();
    URL.revokeObjectURL(a.href);
    await supabase.from("security_log").insert({ user_id: user!.id, event_type: encrypt ? "backup_created_encrypted" : "backup_created", device_info: navigator.userAgent });
    toast.success("Backup ready");
  };

  const prepareRestore = async () => {
    if (!restoreFile) return;
    try {
      let bytes = new Uint8Array(await restoreFile.arrayBuffer());
      const magic = new TextDecoder().decode(bytes.slice(0, 4));
      if (magic === "STK1") {
        if (!restorePass) { toast.error("Passphrase required."); return; }
        bytes = await decryptAESGCM(restorePass, bytes);
      }
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(bytes);
      const json = await zip.file("data.json")!.async("string");
      const data = JSON.parse(json) as Record<string, unknown[]>;
      const counts: Record<string, number> = {};
      for (const k of Object.keys(data)) counts[k] = (data[k] as unknown[]).length;
      setPreview(counts); setPendingRestore(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read backup");
    }
  };

  const commitRestore = async () => {
    if (!pendingRestore || !user) return;
    const order = ["invoice_payments", "invoice_items", "invoices", "projects", "clients", "goal_contributions", "goals", "debt_payments", "debts", "budgets", "recurring_rules", "equipment_maintenance", "equipment", "category_learnings", "transactions", "tags", "categories", "accounts"];
    const anyDb = supabase as unknown as { from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<unknown> }; insert: (rows: unknown[]) => Promise<unknown> } };
    for (const t of order) await anyDb.from(t).delete().eq("user_id", user.id);
    for (const t of Object.keys(pendingRestore)) {
      const rows = (pendingRestore[t] as Array<Record<string, unknown>>).map((r) => ({ ...r, user_id: user.id }));
      if (rows.length) await anyDb.from(t).insert(rows);
    }
    await supabase.from("security_log").insert({ user_id: user.id, event_type: "backup_restored", device_info: navigator.userAgent });
    toast.success("Restore complete");
    setPreview(null); setPendingRestore(null); setRestoreFile(null); setRestorePass("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <h1 className="font-display text-xl font-semibold">Backup & restore</h1>

      <section className="card-surface p-6 space-y-4">
        <h2 className="text-sm font-medium flex items-center gap-2"><Download className="h-4 w-4" /> Export</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
          <Lock className="h-3 w-3" /> Encrypt with passphrase (AES-GCM)
        </label>
        {encrypt && (
          <Input type="password" placeholder="Passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
        )}
        {encrypt && <p className="text-xs text-muted-foreground">If you lose this passphrase, the backup cannot be recovered — there is no reset.</p>}
        <Button onClick={doExport} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">Download backup</Button>
      </section>

      <section className="card-surface p-6 space-y-4">
        <h2 className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Restore</h2>
        <input type="file" accept=".zip,.stk" onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <Input type="password" placeholder="Passphrase (if encrypted)" value={restorePass} onChange={(e) => setRestorePass(e.target.value)} />
        <Button variant="outline" onClick={prepareRestore} disabled={!restoreFile}>Preview</Button>
        {preview && (
          <div className="rounded-md border border-[color:var(--color-hairline)] p-3 text-xs">
            <p className="mb-2 font-medium">Preview — record counts:</p>
            <ul className="grid grid-cols-2 gap-1">
              {Object.entries(preview).map(([t, n]) => <li key={t}>{t}: {n}</li>)}
            </ul>
            <Button size="sm" className="mt-3 bg-[color:var(--color-negative)]" onClick={() => setConfirmOpen(true)}>Overwrite my data</Button>
          </div>
        )}
      </section>

      <PasswordConfirmDialog
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Overwrite all your data?"
        description="This deletes every row you own and replaces it with the backup. This cannot be undone."
        confirmLabel="Overwrite"
        onConfirmed={commitRestore}
      />
    </div>
  );
}
