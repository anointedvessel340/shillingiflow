import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";
import { LockScreen } from "@/components/lock-screen";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, locked } = useAuth();
  if (!user) return null;
  return (
    <WorkspaceProvider userId={user.id}>
      <AppShell>
        <Outlet />
      </AppShell>
      {locked && <LockScreen />}
    </WorkspaceProvider>
  );
}
