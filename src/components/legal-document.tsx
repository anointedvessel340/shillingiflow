import type { LegalDoc } from "@/lib/legal-content";

export function LegalDocumentView({ doc }: { doc: LegalDoc }) {
  return (
    <article className="mx-auto w-full max-w-[68ch] px-5 py-14 md:py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {doc.title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">{doc.lastUpdated}</p>
      <div className="mt-6 space-y-2 border-t border-[color:var(--color-hairline)] pt-6">
        {doc.intro.map((p) => (
          <p key={p} className="text-[15px] leading-8 text-foreground/90">
            {p}
          </p>
        ))}
      </div>

      {doc.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          {section.heading && (
            <h2 className="font-display text-lg font-semibold text-[color:var(--color-gold)]">
              {section.heading}
            </h2>
          )}
          <div className="mt-3 space-y-4">
            {section.paragraphs.map((p, i) => (
              <p key={i} className="text-[15px] leading-8 text-foreground/90">
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-14 border-t border-[color:var(--color-hairline)] pt-6 text-xs leading-6 text-muted-foreground">
        {doc.footer}
      </p>
    </article>
  );
}
