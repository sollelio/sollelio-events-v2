/**
 * Supabase connection settings, validated before any client is created.
 *
 * Both values are public by design (`NEXT_PUBLIC_*`) and are inlined into the
 * browser bundle at build time, so they must be read with literal
 * `process.env.NEXT_PUBLIC_…` expressions. Privileged keys never go here.
 *
 * Errors name the variable and the expectation, never the configured value.
 */

/**
 * The only approved Supabase project (`events-v2`). Pointing the application
 * at any other project is a deliberate, reviewed code change, not an
 * environment edit.
 *
 * Deliberate initial safety restriction: revisit when additional environments
 * are introduced (see docs/decisions/0003-supabase-integration-foundation.md).
 */
export const SUPABASE_PROJECT_REF = "icgsujzpcafqnqjozslj";

const PUBLISHABLE_KEY_PREFIX = "sb_publishable_";

export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

function configurationError(message: string): Error {
  return new Error(
    `Supabase configuration error: ${message} See .env.example and README.md.`,
  );
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw configurationError("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }
  if (!publishableKey) {
    throw configurationError(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw configurationError("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
  const expectedOrigin = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
  if (parsed.origin !== expectedOrigin || parsed.pathname !== "/") {
    throw configurationError(
      `NEXT_PUBLIC_SUPABASE_URL must be ${expectedOrigin} (project ${SUPABASE_PROJECT_REF}).`,
    );
  }

  // Rejects secret keys (`sb_secret_…`) and legacy JWT keys, including
  // `service_role`, so a privileged key can never reach browser code.
  if (!publishableKey.startsWith(PUBLISHABLE_KEY_PREFIX)) {
    throw configurationError(
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key (${PUBLISHABLE_KEY_PREFIX}…).`,
    );
  }

  return { url: expectedOrigin, publishableKey };
}
