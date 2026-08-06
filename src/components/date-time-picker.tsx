import { CalendarDays, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Parses a YYYY-MM-DD string as a LOCAL date (avoids UTC-shift bucketing bugs). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function labelFor(date: string, time: string): string {
  const d = parseLocalDate(date);
  const t = todayISO();
  const base = date === t
    ? "Today"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  return `${base} · ${time}`;
}

/**
 * Date + time override for a transaction.
 * Defaults to now; the picker only changes the transaction's own date/time,
 * never the record's created_at.
 */
export function DateTimePicker({
  date,
  time,
  onChange,
  className,
}: {
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  className?: string;
}) {
  const isNow = date === todayISO();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Set transaction date and time"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--color-hairline)] px-2.5 py-1.5 text-xs transition-colors hover:bg-[color:var(--color-surface-2)]",
            isNow ? "text-muted-foreground" : "border-[color:var(--color-gold)]/50 text-[color:var(--color-gold)]",
            className,
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="num">{labelFor(date, time)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 p-3 pointer-events-auto">
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</label>
          <input
            type="date"
            value={date}
            max="2999-12-31"
            onChange={(e) => e.target.value && onChange({ date: e.target.value, time })}
            className="w-full rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => e.target.value && onChange({ date, time: e.target.value })}
            className="w-full rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => onChange({ date: todayISO(), time: nowHHMM() })}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[color:var(--color-hairline)] px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Reset to now
        </button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Backdated entries are counted in the month they actually happened.
        </p>
      </PopoverContent>
    </Popover>
  );
}
