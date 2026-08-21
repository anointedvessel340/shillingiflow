import { formatCurrency } from "@/lib/format";

export type TopCategory = { id: string; name: string; value: number };

/** Horizontal bar list of top expense categories. Shared by Dashboard and Reports. */
export default function TopCategoriesList({
  items,
  currency,
  emptyLabel = "No spending in this period.",
}: {
  items: TopCategory[];
  currency: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = items[0].value || 1;
  return (
    <ul className="space-y-3">
      {items.map((c) => (
        <li key={c.id} className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="truncate pr-2">{c.name}</span>
            <span className="num text-muted-foreground">{formatCurrency(c.value, { currency })}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
            <div
              className="h-full rounded-full bg-[color:var(--color-negative)]"
              style={{ width: `${(c.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
