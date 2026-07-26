import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentView } from "@/components/legal-document";
import { LegalFooter } from "@/components/legal-footer";
import { PRIVACY_POLICY } from "@/lib/legal-content";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SHILLINGITRACK" },
      {
        name: "description",
        content:
          "How SHILLINGITRACK collects, stores, and protects the financial records you enter. We never sell your data or connect to your bank.",
      },
      { property: "og:title", content: "Privacy Policy — SHILLINGITRACK" },
      {
        property: "og:description",
        content:
          "How SHILLINGITRACK collects, stores, and protects the financial records you enter.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <LegalDocumentView doc={PRIVACY_POLICY} />
      </main>
      <LegalFooter />
    </div>
  );
}
