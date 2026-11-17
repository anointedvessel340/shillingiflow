import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recoverySessionAllowed } from "./auth-rules";
export const finishPasswordRecovery = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: { password: string }) => z.object({ password: z.string().min(8).max(1024) }).parse(input))
  .handler(async ({ data, context }) => {
    const methods = context.claims.amr as { method: string }[] | undefined;
    if (!recoverySessionAllowed(methods ?? [])) throw new Error("Request a new password reset first.");
    const token = getRequestHeader("authorization")?.replace(/^Bearer /, "");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !token) throw new Error("Password reset is unavailable.");
    const response = await fetch(`${url}/auth/v1/user`, { method: "PUT", headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password: data.password }) });
    if (!response.ok) throw new Error("Could not update the password. Request a new reset and try again.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.signOut(token, "others");
    if (error) throw new Error("Password changed, but other sessions could not be signed out. Please try again.");
    const { error: logError } = await supabaseAdmin.from("security_log").insert({ user_id: context.userId, event_type: "password_reset" });
    if (logError) console.error("Password reset audit could not be recorded");
    return { ok: true };
  });