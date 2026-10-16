import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./auth-client";
export const attachAppAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});