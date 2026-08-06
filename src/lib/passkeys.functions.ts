import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Friendly device label derived from the UA captured at registration time. */
function labelFromUA(ua: string): string {
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown device";
  return `${browser} on ${os}`;
}

function rpFromRequest(): { rpID: string; origin: string } {
  const origin =
    getRequestHeader("origin") ??
    (getRequestHeader("referer") ? new URL(getRequestHeader("referer")!).origin : null) ??
    `https://${getRequestHeader("host") ?? "localhost"}`;
  return { rpID: new URL(origin).hostname, origin };
}

const b64 = {
  toBuffer: (s: string) => new Uint8Array(Buffer.from(s, "base64url")),
  fromBuffer: (b: Uint8Array) => Buffer.from(b).toString("base64url"),
};

/** List the signed-in user's registered credentials (RLS-scoped). */
export const listPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("passkeys")
      .select("id, device_label, created_at, last_used_at, backed_up")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Step 1 of adding a device — returns WebAuthn creation options. */
export const startPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = rpFromRequest();
    const claims = context.claims as { email?: string };
    const email = (claims.email ?? "user").toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("passkeys")
      .select("credential_id, transports")
      .eq("user_id", context.userId);

    const options = await generateRegistrationOptions({
      rpName: "SHILLINGITRACK",
      rpID,
      userName: email,
      userID: new TextEncoder().encode(context.userId),
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c) => ({ id: c.credential_id })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    });

    const { error } = await supabaseAdmin.from("webauthn_challenges").insert({
      user_id: context.userId,
      email,
      challenge: options.challenge,
      purpose: "registration",
    });
    if (error) throw new Error(error.message);
    return options;
  });

/** Step 2 of adding a device — verifies the attestation and stores the credential. */
export const finishPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { response: unknown }) => z.object({ response: z.any() }).parse(input))
  .handler(async ({ data, context }) => {
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = rpFromRequest();

    const { data: chal } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", context.userId)
      .eq("purpose", "registration")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!chal || new Date(chal.expires_at) < new Date()) {
      throw new Error("Registration expired. Please try again.");
    }
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", chal.id);

    const verification = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: data.response as any,
      expectedChallenge: chal.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Could not verify this device.");
    }

    const { credential, credentialBackedUp } = verification.registrationInfo;
    const ua = getRequestHeader("user-agent") ?? "";

    const { error } = await supabaseAdmin.from("passkeys").insert({
      user_id: context.userId,
      credential_id: credential.id,
      public_key: b64.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      device_label: labelFromUA(ua),
      user_agent: ua,
      backed_up: credentialBackedUp,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("security_log").insert({
      user_id: context.userId,
      event_type: "passkey_added",
      device_info: ua,
    });
    return { ok: true as const };
  });

/** Remove one credential. */
export const revokePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("passkeys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("security_log").insert({
      user_id: context.userId,
      event_type: "passkey_revoked",
      device_info: getRequestHeader("user-agent") ?? null,
    });
    return { ok: true as const };
  });

/** PUBLIC — step 1 of passkey sign-in. Allowlist is enforced before any options are issued. */
export const startPasskeyAuthentication = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) =>
    z.object({ email: z.string().email().transform((s) => s.toLowerCase()) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = rpFromRequest();

    const { data: approved } = await supabaseAdmin
      .from("approved_emails")
      .select("status")
      .eq("email", data.email)
      .maybeSingle();
    if (!approved || approved.status !== "active") {
      return { ok: false as const, message: "Access is restricted." };
    }

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const target = list?.users.find((u) => (u.email ?? "").toLowerCase() === data.email);
    if (!target) return { ok: false as const, message: "Access is restricted." };

    const { data: creds } = await supabaseAdmin
      .from("passkeys")
      .select("credential_id, transports")
      .eq("user_id", target.id);
    if (!creds || creds.length === 0) {
      return { ok: false as const, message: "No passkey is registered for this account yet." };
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transports: (c.transports ?? []) as any,
      })),
    });

    await supabaseAdmin.from("webauthn_challenges").insert({
      email: data.email,
      user_id: target.id,
      challenge: options.challenge,
      purpose: "authentication",
    });
    return { ok: true as const, options };
  });

/** PUBLIC — step 2 of passkey sign-in. Returns a one-time token the client exchanges for a session. */
export const finishPasskeyAuthentication = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; response: unknown }) =>
    z.object({
      email: z.string().email().transform((s) => s.toLowerCase()),
      response: z.any(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = rpFromRequest();
    const ua = getRequestHeader("user-agent") ?? null;

    const fail = async (reason: string) => {
      await supabaseAdmin.from("login_attempts").insert({
        email: data.email, success: false, reason, device_info: ua,
      });
      return { ok: false as const, message: "Access is restricted." };
    };

    const { data: chal } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at, user_id")
      .eq("email", data.email)
      .eq("purpose", "authentication")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!chal || new Date(chal.expires_at) < new Date()) return fail("passkey_challenge_expired");
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", chal.id);

    const credentialId = (data.response as { id?: string }).id;
    if (!credentialId) return fail("passkey_malformed");

    const { data: cred } = await supabaseAdmin
      .from("passkeys")
      .select("id, user_id, credential_id, public_key, counter, transports")
      .eq("credential_id", credentialId)
      .maybeSingle();
    if (!cred || cred.user_id !== chal.user_id) return fail("passkey_unknown_credential");

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response: data.response as any,
        expectedChallenge: chal.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: cred.credential_id,
          publicKey: b64.toBuffer(cred.public_key),
          counter: Number(cred.counter),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transports: (cred.transports ?? []) as any,
        },
      });
    } catch {
      return fail("passkey_verification_error");
    }
    if (!verification.verified) return fail("passkey_rejected");

    await supabaseAdmin
      .from("passkeys")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", cred.id);

    // Mint a session: generate a one-time email token the browser exchanges via verifyOtp.
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
    });
    if (linkErr || !link?.properties?.hashed_token) return fail("passkey_session_error");

    await supabaseAdmin.from("login_attempts").insert({
      email: data.email, success: true, reason: "passkey", device_info: ua,
    });
    await supabaseAdmin.from("security_log").insert({
      user_id: cred.user_id,
      event_type: "passkey_login",
      device_info: ua,
    });

    return { ok: true as const, tokenHash: link.properties.hashed_token };
  });
