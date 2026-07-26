import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { acceptLegal, getLegalStatus, type LegalStatus } from "@/lib/legal.functions";

const LABELS: Record<string, string> = {
  privacy_policy: "Privacy Policy",
  terms_of_service: "Terms of Service",
};

/**
 * Blocks the app until the signed-in account has a server-recorded acceptance row
 * for the current version of every legal document. The check is a server function
 * reading the database — the client cannot bypass it, and the row itself is the record.
 */
export function LegalGate({ children }: { children: React.ReactNode }) {
  const fetchStatus = useServerFn(getLegalStatus);
  const submitAccept = useServerFn(acceptLegal);
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<LegalStatus>({
    queryKey: ["legal-status"],
    queryFn: () => fetchStatus(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const accept = useMutation({
    mutationFn: () => submitAccept({ data: { documents: data!.pending } }),
    onSuccess: (next) => {
      queryClient.setQueryData(["legal-status"], next);
      if (next.pending.length === 0) toast.success("Thanks — your acceptance has been recorded.");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not record your acceptance."),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-surface max-w-sm p-6 text-center">
          <h1 className="font-display text-lg font-semibold">Couldn't verify your agreement</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-5 w-full bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90"
          >
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </div>
    );
  }

  if (data.pending.length === 0) return <>{children}</>;

  const pendingLabels = data.pending.map((d) => LABELS[d] ?? d);
  const both = data.pending.length === 2;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-semibold">
            {both ? "Before continuing" : `Updated ${pendingLabels[0]}`}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {both
              ? "Before continuing, please review and accept the Privacy Policy and Terms of Service."
              : `Our ${pendingLabels[0]} has been updated. Please review and accept it to continue.`}
          </p>
        </div>

        <div className="card-surface space-y-5 p-6">
          <div className="flex flex-wrap gap-3 text-sm">
            {data.pending.includes("privacy_policy") && (
              <Link
                to="/privacy"
                target="_blank"
                className="text-[color:var(--color-gold)] hover:underline"
              >
                Read the Privacy Policy →
              </Link>
            )}
            {data.pending.includes("terms_of_service") && (
              <Link
                to="/terms"
                target="_blank"
                className="text-[color:var(--color-gold)] hover:underline"
              >
                Read the Terms of Service →
              </Link>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--color-hairline)] p-3 text-sm leading-6">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <span>
              {both
                ? "I have read and agree to the Privacy Policy and Terms of Service."
                : `I have read and agree to the ${pendingLabels[0]}.`}
            </span>
          </label>

          <Button
            onClick={() => accept.mutate()}
            disabled={!checked || accept.isPending}
            className="w-full bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90"
          >
            {accept.isPending ? "Recording…" : "Continue"}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Version {data.versions.privacy_policy} · your acceptance is recorded with a timestamp.
          </p>
        </div>
      </div>
    </div>
  );
}
