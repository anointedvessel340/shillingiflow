import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Workspace = "personal" | "business";

type Ctx = {
  workspace: Workspace;
  setWorkspace: (w: Workspace) => Promise<void>;
  currency: string;
  loading: boolean;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [workspace, setWs] = useState<Workspace>("personal");
  const [currency, setCurrency] = useState("KES");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("active_workspace, currency")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setWs((data.active_workspace as Workspace) ?? "personal");
        setCurrency(data.currency ?? "KES");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const setWorkspace = async (w: Workspace) => {
    setWs(w);
    await supabase.from("profiles").update({ active_workspace: w }).eq("id", userId);
  };

  return (
    <WorkspaceCtx.Provider value={{ workspace, setWorkspace, currency, loading }}>
      {children}
    </WorkspaceCtx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace must be inside WorkspaceProvider");
  return ctx;
}
