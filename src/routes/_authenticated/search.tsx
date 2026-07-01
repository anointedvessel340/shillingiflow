import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — SHILLINGITRACK" }] }),
  component: () => (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[color:var(--color-surface-2)]">
        <SearchIcon className="h-5 w-5 text-[color:var(--color-gold)]" />
      </div>
      <h1 className="font-display text-xl font-semibold">Global search</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        A cross-entity search over transactions, categories, goals and debts is coming with the next build. For now, use the search field on the Transactions screen.
      </p>
    </div>
  ),
});
