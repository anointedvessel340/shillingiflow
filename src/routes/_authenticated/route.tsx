import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";
import { LockScreen } from "@/components/lock-screen";
import { LegalGate } from "@/components/legal-gate";
import { LoadingBlock } from "@/components/ui/loading";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  pendingMs: 0,
  pendingComponent: FullScreenLoading,
  component: AuthedLayout,
});

function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingBlock label="Loading your workspace…" />
    </div>
  );
}

function AuthedLayout() {
  const { user, locked } = useAuth();
  if (!user) return <FullScreenLoading />;
  return (
    <LegalGate>
      <WorkspaceProvider userId={user.id}>
        <AppShell>
          <Outlet />
        </AppShell>
        {locked && <LockScreen />}
      </WorkspaceProvider>
    </LegalGate>
  );
}

