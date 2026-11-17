import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseCookieOptions } from "./cookies";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Functions and Route Handlers,
 * acting as the signed-in user (publishable key + the user's session cookies,
 * so RLS applies). Create one per request; never share it between requests.
 */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes the
          // session before rendering, so nothing is lost here.
        }
      },
    },
  });
}
