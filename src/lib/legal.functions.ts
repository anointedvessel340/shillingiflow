import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEGAL_VERSION } from "@/lib/legal-content";

export const DOCUMENT_TYPES = ["privacy_policy", "terms_of_service"] as const;
export type LegalDocumentType = (typeof DOCUMENT_TYPES)[number];

/** Current version of each document. Bump a value here to force re-acceptance of only that document. */
export const CURRENT_VERSIONS: Record<LegalDocumentType, string> = {
  privacy_policy: LEGAL_VERSION,
  terms_of_service: LEGAL_VERSION,
};

export type LegalStatus = {
  versions: Record<LegalDocumentType, string>;
  /** Document types that still require acceptance at their current version. */
  pending: LegalDocumentType[];
};

/** Server-side source of truth: which documents this user still has to accept. */
export const getLegalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LegalStatus> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("legal_acceptances")
      .select("document_type, version")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const accepted = new Set((data ?? []).map((r) => `${r.document_type}:${r.version}`));
    const pending = DOCUMENT_TYPES.filter(
      (t) => !accepted.has(`${t}:${CURRENT_VERSIONS[t]}`),
    );
    return { versions: CURRENT_VERSIONS, pending };
  });

/** Records acceptance for the given document types at their current server-known version. */
export const acceptLegal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documents: LegalDocumentType[] }) =>
    z
      .object({ documents: z.array(z.enum(DOCUMENT_TYPES)).min(1) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<LegalStatus> => {
    const { supabase, userId } = context;

    let ip: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      ip = null;
    }

    const rows = Array.from(new Set(data.documents)).map((t) => ({
      user_id: userId,
      document_type: t,
      version: CURRENT_VERSIONS[t],
      ip_address: ip,
    }));

    const { error } = await supabase
      .from("legal_acceptances")
      .upsert(rows, { onConflict: "user_id,document_type,version", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    const { data: existing, error: readErr } = await supabase
      .from("legal_acceptances")
      .select("document_type, version")
      .eq("user_id", userId);
    if (readErr) throw new Error(readErr.message);

    const accepted = new Set((existing ?? []).map((r) => `${r.document_type}:${r.version}`));
    return {
      versions: CURRENT_VERSIONS,
      pending: DOCUMENT_TYPES.filter((t) => !accepted.has(`${t}:${CURRENT_VERSIONS[t]}`)),
    };
  });
