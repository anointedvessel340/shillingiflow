import { Link } from "@tanstack/react-router";

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`flex flex-col items-center justify-between gap-1.5 border-t border-[color:var(--color-hairline)] px-5 py-3 text-[11px] text-muted-foreground sm:flex-row ${className}`}
    >
      <span>© 2026 AV Productions. All rights reserved.</span>
      <nav className="flex items-center gap-4">
        <Link to="/privacy" className="transition-colors hover:text-foreground">
          Privacy Policy
        </Link>
        <Link to="/terms" className="transition-colors hover:text-foreground">
          Terms of Service
        </Link>
      </nav>
    </footer>
  );
}
