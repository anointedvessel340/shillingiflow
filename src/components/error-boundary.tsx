import { Component, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-1)] ${className}`}
      aria-hidden
    >
      <span className="num text-lg text-[color:var(--color-gold)]">S</span>
    </div>
  );
}

export function CalmScreen({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <BrandMark />
        <h1 className="mt-6 text-lg font-medium">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}

export function PrimaryAction({ onClick, href, children }: { onClick?: () => void; href?: string; children: ReactNode }) {
  const cls =
    "inline-flex items-center justify-center rounded-lg bg-[color:var(--color-gold)] px-4 py-2 text-sm font-medium text-[color:var(--color-gold-foreground)] hover:opacity-90";
  return href ? <a href={href} className={cls}>{children}</a> : <button onClick={onClick} className={cls}>{children}</button>;
}

export function SecondaryAction({ onClick, href, children }: { onClick?: () => void; href?: string; children: ReactNode }) {
  const cls =
    "inline-flex items-center justify-center rounded-lg border border-[color:var(--color-hairline)] px-4 py-2 text-sm hover:bg-[color:var(--color-surface-2)]";
  return href ? <a href={href} className={cls}>{children}</a> : <button onClick={onClick} className={cls}>{children}</button>;
}

type Props = { children: ReactNode };
type State = { hasError: boolean; key: number };

/** Catches unexpected render crashes. Logs detail to the console, never to the UI. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, key: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("[SHILLINGITRACK] render error:", error, info);
    reportLovableError(error, { boundary: "app_error_boundary" });
  }

  render() {
    if (this.state.hasError) {
      return (
        <CalmScreen
          title="Something went wrong"
          body="This screen stopped unexpectedly. Your data is safe — nothing was changed."
        >
          <PrimaryAction onClick={() => this.setState((s) => ({ hasError: false, key: s.key + 1 }))}>
            Try again
          </PrimaryAction>
          <SecondaryAction href="/dashboard">Go to Dashboard</SecondaryAction>
        </CalmScreen>
      );
    }
    return <div key={this.state.key} className="contents">{this.props.children}</div>;
  }
}
