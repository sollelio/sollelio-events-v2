import type postgres from "postgres";

/**
 * Connection rules for the public forms database role (ADR 0009). Pure, so
 * they can be tested; the connection itself is in database.ts.
 */

export const SERVICE_ROLE_NAME = "public_form_service";

export type ServiceDatabaseConfig = { url: string; caCert: string };

/**
 * Accepts only a postgres URL whose user is the service role (plain, or as
 * `role.<project-ref>` for the Supabase pooler), so a more privileged
 * connection string cannot be configured by mistake.
 */
export function isServiceDatabaseUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return false;
  }
  const user = decodeURIComponent(url.username);
  return (
    (user === SERVICE_ROLE_NAME || user.startsWith(`${SERVICE_ROLE_NAME}.`)) &&
    url.password !== "" &&
    url.hostname !== ""
  );
}

/** Connection options; exported for the isolated connection tests. */
export function serviceDatabaseOptions(caCert: string) {
  return {
    // Verify the server certificate and host name against the given CA.
    ssl: { ca: caCert, rejectUnauthorized: true },
    // Transaction pooling cannot keep prepared statements between queries.
    prepare: false,
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    connection: { application_name: "sollelio-public-forms" },
  } satisfies postgres.Options<Record<string, postgres.PostgresType>>;
}
