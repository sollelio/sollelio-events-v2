import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseCookieOptions } from "@/lib/supabase/cookies";
import { getSupabaseEnv, type SupabaseEnv } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase session before rendering, because Server Components
 * cannot write cookies. This is NOT an authorization boundary: it never
 * redirects or blocks. Pages, Server Functions and Route Handlers verify the
 * user themselves (src/lib/auth/session.ts), and RLS protects the data.
 */
export async function proxy(request: NextRequest) {
  let env: SupabaseEnv;
  try {
    env = getSupabaseEnv();
  } catch {
    // Misconfiguration surfaces where a client is created, with its own error.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Validates the access token and refreshes it when needed. Do not add code
  // between client creation and this call.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Everything except build assets, image optimisation and static files.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
