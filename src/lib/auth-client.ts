import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase as generated } from "@/integrations/supabase/client";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";

const MODE = "shillingitrack:auth-persistence";
let browserClient: ReturnType<typeof createClient<Database>> | undefined;
export function setRememberMe(remember: boolean) {
  localStorage.setItem(MODE, remember ? "persistent" : "session");
}
export function remembersSession() {
  return localStorage.getItem(MODE) !== "session";
}
function client() {
  if (typeof window === "undefined") return generated;
  if (browserClient) return browserClient;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const persistent = brokeredPreviewStorage() ?? localStorage;
  browserClient = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, key, {
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
    auth: {
      persistSession: true, autoRefreshToken: true,
      storage: {
        getItem: (k) => remembersSession() ? persistent.getItem(k) : sessionStorage.getItem(k),
        setItem: async (k, value) => {
          if (remembersSession()) { sessionStorage.removeItem(k); await persistent.setItem(k, value); }
          else { await persistent.removeItem(k); sessionStorage.setItem(k, value); }
        },
        removeItem: async (k) => { sessionStorage.removeItem(k); await persistent.removeItem(k); },
      },
    },
  });
  return browserClient;
}
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get: (_, property) => Reflect.get(client(), property),
});