import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  locked: boolean;
  unlock: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const autoLockMinutesRef = useRef(15);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    // Subscribe first, then read initial session (docs recipe)
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") setLocked(false);
      if (event === "SIGNED_IN") {
        // Fire-and-forget audit
        void supabase.from("security_log").insert({
          user_id: s!.user.id,
          event_type: "sign_in",
          device_info: navigator.userAgent,
        });
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load auto-lock preference
  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from("profiles")
      .select("auto_lock_minutes")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.auto_lock_minutes) autoLockMinutesRef.current = data.auto_lock_minutes;
      });
  }, [session?.user?.id]);

  // Auto-lock inactivity timer
  useEffect(() => {
    if (!session) return;
    const bump = () => { lastActivityRef.current = Date.now(); };
    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs > autoLockMinutesRef.current * 60_000 && !locked) setLocked(true);
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(interval);
    };
  }, [session, locked]);

  const value = useMemo<Ctx>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    locked,
    unlock: async (password) => {
      if (!session?.user?.email) return { error: "No email on session" };
      const { error } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password,
      });
      if (error) return { error: error.message };
      setLocked(false);
      lastActivityRef.current = Date.now();
      return { error: null };
    },
    signOut: async () => {
      if (session?.user) {
        await supabase.from("security_log").insert({
          user_id: session.user.id,
          event_type: "sign_out",
          device_info: navigator.userAgent,
        });
      }
      await supabase.auth.signOut();
    },
  }), [session, loading, locked]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
