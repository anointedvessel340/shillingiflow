import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const verifyStepUpPassword = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: { password: string }) => z.object({ password: z.string().min(1).max(1024) }).parse(input))
  .handler(async ({ data, context }) => {
    const email = context.claims.email;
    if (typeof email !== "string") throw new Error("Please sign in again.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allowed, error: limitError } = await supabaseAdmin.rpc("reserve_auth_request", { p_subject: context.userId, p_purpose: "stepup_password" });
    if (limitError || !allowed) throw new Error("Please wait before trying again.");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Verification is unavailable.");
    const verifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: result, error } = await verifier.auth.signInWithPassword({ email, password: data.password });
    if (error || result.user?.id !== context.userId) throw new Error("Incorrect password.");
    if (result.session) await verifier.auth.signOut({ scope: "local" });
    const { issueProof } = await import("./step-up.server");
    return issueProof(context, "password");
  });

export const sendStepUpEmail = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: allowed } = await supabaseAdmin.rpc("reserve_auth_request", { p_subject: context.userId, p_purpose: "stepup_email" });
  if (!allowed) throw new Error("Please wait before requesting another code.");
  const token = getRequestHeader("authorization")?.replace(/^Bearer /, "");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !token) throw new Error("Please sign in again.");
  const response = await fetch(`${url}/auth/v1/reauthenticate`, { method: "GET", headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Could not send a code. Please try later.");
  return { ok: true };
});

// Reauthentication nonces are verified by Cloud Auth only during password changes.
// Never claim that merely sending a code is successful step-up verification.
export const disableMFA = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: { factorId: string; proof: string }) => z.object({ factorId: z.string().uuid(), proof: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireProof } = await import("./step-up.server");
    await requireProof(context, data.proof);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: factors, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: context.userId });
    if (error || !factors.factors.some((f) => f.id === data.factorId)) throw new Error("Authenticator not found.");
    const { error: removeError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: context.userId, id: data.factorId });
    if (removeError) throw new Error("Could not remove the authenticator.");
    void supabaseAdmin.from("security_log").insert({ user_id: context.userId, event_type: "2fa_disabled" }).then(() => undefined);
    return { ok: true };
  });