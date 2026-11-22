import "server-only";

import { isServiceDatabaseUrl, type ServiceDatabaseConfig } from "./connection";
import { parseTrustedProxyHops } from "./token";

/**
 * Server-only configuration for public forms (ADR 0009). Never NEXT_PUBLIC_.
 * - PUBLIC_FORMS_DATABASE_URL: pooler connection string for the
 *   `public_form_service` role (any other user is refused).
 * - PUBLIC_FORMS_DATABASE_CA_CERT: PEM of the CA that signs the database
 *   certificate (Supabase: Database settings, SSL certificate).
 * - PUBLIC_FORMS_SIGNING_SECRET: signs render tokens and derives client
 *   fingerprints.
 * - PUBLIC_FORMS_TRUSTED_PROXY_HOPS (optional): how many trusted proxies
 *   append to X-Forwarded-For. Unset: no client address is trusted and the
 *   per-client limit is not applied.
 * While a required value is missing or invalid, public forms are unavailable.
 */
export type PublicFormsEnv = {
  database: ServiceDatabaseConfig;
  signingSecret: string;
  trustedProxyHops: number | null;
};

const MIN_SECRET_LENGTH = 32;

export function getPublicFormsEnv(): PublicFormsEnv | null {
  const url = process.env.PUBLIC_FORMS_DATABASE_URL ?? "";
  // Hosts that cannot store multi-line values may use literal "\n".
  const caCert = (process.env.PUBLIC_FORMS_DATABASE_CA_CERT ?? "").replace(
    /\\n/g,
    "\n",
  );
  const signingSecret = process.env.PUBLIC_FORMS_SIGNING_SECRET ?? "";
  if (
    !isServiceDatabaseUrl(url) ||
    !caCert.includes("-----BEGIN CERTIFICATE-----") ||
    signingSecret.length < MIN_SECRET_LENGTH
  ) {
    return null;
  }
  return {
    database: { url, caCert },
    signingSecret,
    trustedProxyHops: parseTrustedProxyHops(
      process.env.PUBLIC_FORMS_TRUSTED_PROXY_HOPS,
    ),
  };
}
