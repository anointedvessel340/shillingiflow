import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { STEP_UP_MS, proofIsValid } from "./auth-rules";
type Context = { supabase: SupabaseClient<Database>; userId: string; claims: Record<string, unknown> };
export async function issueProof(context: Context, method: string) {
  const sessionId = context.claims.session_id;
  if (typeof sessionId !== "string") throw new Error("Please sign in again.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expiresAt = Date.now() + STEP_UP_MS;
  const { data, error } = await supabaseAdmin.from("auth_verification_proofs").insert({ user_id: context.userId, session_id: sessionId, method, expires_at: new Date(expiresAt).toISOString() }).select("id").single();
  if (error) throw new Error("Could not record verification.");
  return { proof: data.id };
}
export async function requireProof(context: Context, id: string) {
  const sessionId = context.claims.session_id;
  if (typeof sessionId !== "string") throw new Error("Please sign in again.");
  const { data, error } = await context.supabase.from("auth_verification_proofs").select("user_id,session_id,expires_at").eq("id", id).maybeSingle();
  if (error || !data || !proofIsValid({ userId: data.user_id, sessionId: data.session_id, expiresAt: Date.parse(data.expires_at) }, context.userId, sessionId, Date.now())) throw new Error("Verification expired. Please confirm again.");
}