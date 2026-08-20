import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/components/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { AppErrorBoundary, CalmScreen, PrimaryAction, SecondaryAction } from "@/components/error-boundary";

function NotFoundComponent() {
  return (
    <CalmScreen title="This page doesn't exist" body="The link may be out of date, or the address was mistyped.">
      <PrimaryAction href="/dashboard">Go to Dashboard</PrimaryAction>
    </CalmScreen>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[SHILLINGITRACK] route error:", error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <CalmScreen
      title="Something went wrong"
      body="We couldn't load this screen. Your data is safe — nothing was changed."
    >
      <PrimaryAction onClick={() => { router.invalidate(); reset(); }}>Try again</PrimaryAction>
      <SecondaryAction href="/dashboard">Go to Dashboard</SecondaryAction>
    </CalmScreen>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#14161B" },
      { title: "SHILLINGITRACK — Personal & business financial OS" },
      { name: "description", content: "A quiet, confident money tracker. Log an entry in plain language, see every number recompute instantly." },
      { name: "author", content: "SHILLINGITRACK" },
      { property: "og:title", content: "SHILLINGITRACK — Personal & business financial OS" },
      { property: "og:description", content: "A quiet, confident money tracker. Log an entry in plain language, see every number recompute instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SHILLINGITRACK — Personal & business financial OS" },
      { name: "twitter:description", content: "A quiet, confident money tracker. Log an entry in plain language, see every number recompute instantly." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e76ade1f-0c8c-4fa5-9bfe-5eafd0f6d5e6/id-preview-c8445951--d09c75ab-fd34-4810-bb3f-e5d64354d144.lovable.app-1782945586028.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e76ade1f-0c8c-4fa5-9bfe-5eafd0f6d5e6/id-preview-c8445951--d09c75ab-fd34-4810-bb3f-e5d64354d144.lovable.app-1782945586028.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppErrorBoundary>
          <Outlet />
        </AppErrorBoundary>
        <Toaster theme="dark" position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
