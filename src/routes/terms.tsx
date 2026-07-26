import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentView } from "@/components/legal-document";
import { LegalFooter } from "@/components/legal-footer";
import { TERMS_OF_SERVICE } from "@/lib/legal-content";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — SHILLINGITRACK" },
      {
        name: "description",
        content:
          "The terms governing use of SHILLINGITRACK, a personal and business financial record-keeping tool by AV Productions.",
      },
      { property: "og:title", content: "Terms of Service — SHILLINGITRACK" },
      {
        property: "og:description",
        content:
          "The terms governing use of SHILLINGITRACK, a personal and business financial record-keeping tool.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <LegalDocumentView doc={TERMS_OF_SERVICE} />
      </main>
      <LegalFooter />
    </div>
  );
}
