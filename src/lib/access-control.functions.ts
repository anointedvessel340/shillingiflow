import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const WINDOW_MIN = 15;
const MAX_FAIL = 5;

async function logAttempt(
  admin: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server")>>["supabaseAdmin"],
  row: { email: string; success: boolean; reason?: string; ip?: string; device?: string },
) {
  await admin.from("login_attempts").insert({
    email: row.email,
    success: row.success,
    reason: row.reason ?? null,
    ip: row.ip ?? null,
    device_info: row.device ?? null,
  });
}

function reqMeta() {
  let ip: string | undefined;
  let device: string | undefined;
  try { ip = getRequestIP({ xForwardedFor: true }) ?? undefined; } catch { /* noop */ }
  try { device = getRequestHeader("user-agent") ?? undefined; } catch { /* noop */ }
  return { ip, device };
}

/**
 * PUBLIC endpoint — no auth middleware. Enforces:
 *   1. Rate limit per email (5 fails / 15 min → 15 min lockout)
 *   2. Allowlist check against approved_emails
 *   3. Server-side password sign-in (only then returns session tokens)
 * Every attempt is written to login_attempts.
 */
export const attemptSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) =>
    z.object({
      email: z.string().email().transform((s) => s.toLowerCase()),
      password: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { email, password } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = reqMeta();

    // 1. Rate limit
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("login_attempts")
      .select("success")
      .eq("email", email)
      .gte("created_at", since)
      .limit(50);
    const fails = (recent ?? []).filter((r) => !r.success).length;
    if (fails >= MAX_FAIL) {
      await logAttempt(supabaseAdmin, { email, success: false, reason: "rate_limited", ...meta });
      return { ok: false as const, code: "rate_limited", message: "Too many attempts. Try again in 15 minutes." };
    }

    // 2. Allowlist
    const { data: row } = await supabaseAdmin
      .from("approved_emails")
      .select("status")
      .eq("email", email)
      .maybeSingle();
    if (!row || row.status !== "active") {
      await logAttempt(supabaseAdmin, {
        email, success: false,
        reason: row ? "revoked" : "not_on_allowlist",
        ...meta,
      });
      // Generic message — do not reveal existence
      return { ok: false as const, code: "denied", message: "Access is restricted." };
    }

    // 3. Server-side password sign-in
    const url = process.env.SUPABASE_URL;
    const pub = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !pub) throw new Error("Server misconfigured");
    const supa = createClient<Database>(url, pub, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error } = await supa.auth.signInWithPassword({ email, password });
    if (error || !signIn.session) {
      await logAttempt(supabaseAdmin, { email, success: false, reason: "bad_credentials", ...meta });
      return { ok: false as const, code: "denied", message: "Access is restricted." };
    }
    await logAttempt(supabaseAdmin, { email, success: true, ...meta });
    return {
      ok: true as const,
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    };
  });

/** Server-side reset trigger (uses admin API, keeps behavior consistent with sign-in). */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; redirectTo: string }) =>
    z.object({
      email: z.string().email().transform((s) => s.toLowerCase()),
      redirectTo: z.string().url(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Silently no-op if not on allowlist — do not reveal.
    const { data: row } = await supabaseAdmin
      .from("approved_emails")
      .select("status")
      .eq("email", data.email)
      .maybeSingle();
    if (!row || row.status !== "active") return { ok: true as const };
    const url = process.env.SUPABASE_URL;
    const pub = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !pub) throw new Error("Server misconfigured");
    const supa = createClient<Database>(url, pub, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    await supa.auth.resetPasswordForEmail(data.email, { redirectTo: data.redirectTo });
    return { ok: true as const };
  });

/** Middleware: signed-in + aal2 + owner role. Used for invite/revoke. */
const requireOwner2FA = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const claims = context.claims as { aal?: string; email?: string };
    if (claims.aal !== "aal2") throw new Error("Two-factor authentication required.");
    const email = (claims.email ?? "").toLowerCase();
    if (!email) throw new Error("No email on session.");
    const { data: row, error } = await context.supabase
      .from("approved_emails")
      .select("role, status")
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.role !== "owner" || row.status !== "active") {
      throw new Error("Owner access required.");
    }
    return next({ context });
  });

export const inviteAdmin = createServerFn({ method: "POST" })
  .middleware([requireOwner2FA])
  .inputValidator((input: { email: string; redirectTo?: string }) =>
    z.object({
      email: z.string().email().transform((s) => s.toLowerCase()),
      redirectTo: z.string().url().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("approved_emails")
      .upsert(
        { email: data.email, role: "admin", status: "active", added_by: context.userId },
        { onConflict: "email" },
      );
    if (upErr) throw new Error(upErr.message);

    const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      data.redirectTo ? { redirectTo: data.redirectTo } : undefined,
    );
    if (invErr && !/already/i.test(invErr.message)) {
      return { ok: true as const, invited: false, warning: invErr.message };
    }
    return { ok: true as const, invited: true };
  });

export const setAccessStatus = createServerFn({ method: "POST" })
  .middleware([requireOwner2FA])
  .inputValidator((input: { id: string; status: "active" | "revoked" }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["active", "revoked"]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("approved_emails")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("email, role")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    if (row.role === "owner" && data.status === "revoked") {
      // Undo — safety net; the DB has no such trigger but we defend here too.
      await supabaseAdmin.from("approved_emails").update({ status: "active" }).eq("id", data.id);
      throw new Error("Cannot revoke the owner.");
    }
    if (data.status === "revoked") {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const target = list?.users.find((u) => (u.email ?? "").toLowerCase() === row.email);
      if (target) {
        await supabaseAdmin.auth.admin.signOut(target.id, "global").catch(() => undefined);
      }
    }
    return { ok: true as const };
  });
