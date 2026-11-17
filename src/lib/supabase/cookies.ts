import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Auth cookie options shared by every Supabase client. The library defaults
 * (path "/", SameSite=Lax) stay; cookies are Secure in production. They are
 * not HttpOnly because @supabase/ssr's browser client must be able to read
 * them.
 */
export const supabaseCookieOptions: CookieOptionsWithName = {
  secure: process.env.NODE_ENV === "production",
};
