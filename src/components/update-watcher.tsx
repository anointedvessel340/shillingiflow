import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION, isChunkLoadError, isOlderThan } from "@/lib/app-version";

const CHECK_MS = 5 * 60_000;
const RELOAD_GUARD_KEY = "sf-chunk-reload-at";

/** True while the user is mid-edit: an open dialog or a focused text field. */
function userIsBusy() {
  if (typeof document === "undefined") return false;
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  const el = document.activeElement as HTMLInputElement | null;
  if (!el) return false;
  return el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && el.type !== "checkbox" && el.type !== "radio" && el.type !== "button");
}

function reloadClean() {
  window.location.reload();
}

/** Reload once for stale-chunk errors; a sessionStorage stamp prevents loops. */
function tryAutoReloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  reloadClean();
  return true;
}

export function UpdateWatcher() {
  const [available, setAvailable] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Version polling: on focus + every 5 minutes.
  useEffect(() => {
    if (APP_VERSION === "dev") return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const { version } = (await res.json()) as { version?: string };
          if (!cancelled && version && version !== APP_VERSION) setAvailable(true);
        }
      } catch { /* offline — try later */ }
      try {
        const { data } = await supabase.from("app_config").select("min_supported_version").eq("id", 1).maybeSingle();
        if (!cancelled && isOlderThan(APP_VERSION, data?.min_supported_version)) setBlocked(true);
      } catch { /* ignore */ }
    };
    void check();
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(check, CHECK_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, []);

  // Stale-chunk errors from an old tab requesting files of a previous build.
  useEffect(() => {
    const handle = (err: unknown) => {
      if (!isChunkLoadError(err)) return;
      if (!userIsBusy() && tryAutoReloadOnce()) return;
      setAvailable(true);
    };
    const onPreload = (e: Event) => { e.preventDefault(); handle((e as Event & { payload?: unknown }).payload ?? new Error("Unable to preload CSS")); };
    const onRejection = (e: PromiseRejectionEvent) => handle(e.reason);
    const onError = (e: ErrorEvent) => handle(e.error ?? e.message);
    window.addEventListener("vite:preloadError", onPreload);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("vite:preloadError", onPreload);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  if (blocked) {
    return (
      <div role="alertdialog" aria-modal="true" aria-labelledby="sf-update-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-xl border border-border bg-card p-6 text-center">
          <h2 id="sf-update-title" className="font-display text-xl text-foreground">Please update to continue</h2>
          <p className="mt-2 text-sm text-muted-foreground">This version of Shilingi Flow is no longer supported. Updating takes a second and keeps all your data.</p>
          <button onClick={reloadClean} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground">
            <RefreshCw className="h-4 w-4" /> Update now
          </button>
        </div>
      </div>
    );
  }

  if (!available) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-3 z-[90] mx-auto flex w-[min(92vw,30rem)] items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 animate-in slide-in-from-top-2">
      <p className="flex-1 text-sm text-foreground">A new version of Shilingi Flow is available.</p>
      <button onClick={() => setAvailable(false)} className="h-11 px-2 text-sm text-muted-foreground hover:text-foreground">Later</button>
      <button onClick={reloadClean} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Update</button>
    </div>
  );
}
