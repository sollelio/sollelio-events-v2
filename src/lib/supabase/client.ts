import "client-only";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

/**
 * Supabase client for Client Components. Uses the publishable key only; the
 * session lives in cookies shared with the server client. `@supabase/ssr`
 * returns one instance per browser tab.
 *
 * Authorization is never decided here: RLS and server-side checks enforce it.
 */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
