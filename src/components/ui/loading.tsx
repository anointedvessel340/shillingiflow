import { cn } from "@/lib/utils";
import { AlertCircle, RotateCw } from "lucide-react";

/** Signature gold ring that fills clockwise. Use everywhere content is loading. */
export function GoldRing({ size = 32, className }: { size?: number; className?: string }) {
  const stroke = Math.max(2, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0", className)}
      role="status"
      aria-label="Loading"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ ["--ring-c" as string]: `${c}`, animation: "gold-ring-fill 1.4s ease-in-out infinite" } as React.CSSProperties}
      />
    </svg>
  );
}

export function LoadingBlock({ label, className, size }: { label?: string; className?: string; size?: number }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-10", className)}>
      <GoldRing size={size} />
      {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
    </div>
  );
}

export function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div style={style} className={cn("rounded-md bg-[color:var(--color-surface-2)] shimmer", className)} />;
}

/** Faint placeholder rows shaped like list content. */
export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <ul className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Shimmer className="h-7 w-7 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Shimmer className="h-3 w-1/2" />
              <Shimmer className="h-2.5 w-1/3" />
            </div>
          </div>
          <Shimmer className="h-3 w-16" />
        </li>
      ))}
    </ul>
  );
}

export function SkeletonChart({ className, height = 256 }: { className?: string; height?: number }) {
  return (
    <div className={cn("flex items-end gap-2", className)} style={{ height }} aria-hidden>
      {[45, 70, 35, 85, 55, 65, 40, 75].map((h, i) => (
        <Shimmer key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** Inline, card-scoped failure state. Never renders the raw error. */
export function ErrorState({
  message = "Couldn't load this right now.",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-8 text-center", className)} role="alert">
      <AlertCircle className="h-5 w-5 text-[color:var(--color-negative)]" />
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-hairline)] px-3 py-1.5 text-xs hover:bg-[color:var(--color-surface-2)]"
        >
          <RotateCw className="h-3 w-3" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

/**
 * One helper for the three states a card can be in.
 * Returns null when the data is ready so the caller renders its own content.
 */
export function QueryState({
  isLoading,
  isError,
  onRetry,
  errorMessage,
  skeleton,
  loadingLabel,
}: {
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  errorMessage?: string;
  skeleton?: React.ReactNode;
  loadingLabel?: string;
}) {
  if (isError) return <ErrorState message={errorMessage} onRetry={onRetry} />;
  if (isLoading) return <>{skeleton ?? <LoadingBlock label={loadingLabel} />}</>;
  return null;
}
