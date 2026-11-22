import "server-only";

import postgres from "postgres";

import {
  serviceDatabaseOptions,
  type ServiceDatabaseConfig,
} from "./connection.ts";

/**
 * The server-only database connection for public forms (ADR 0009). It logs
 * in as `public_form_service`, which can execute the two functions in schema
 * `form_service` and nothing else. Never imported by client code.
 *
 * Built for Supabase's shared pooler in transaction mode: no prepared
 * statements, TLS verified against the configured CA, few connections.
 */

const cache = globalThis as typeof globalThis & {
  __publicFormsDatabase?: { key: string; sql: postgres.Sql };
};

/** One small client per server process (also across dev reloads). */
export function serviceDatabase(config: ServiceDatabaseConfig): postgres.Sql {
  const key = `${config.url}\n${config.caCert}`;
  if (cache.__publicFormsDatabase?.key !== key) {
    void cache.__publicFormsDatabase?.sql.end({ timeout: 5 });
    cache.__publicFormsDatabase = {
      key,
      sql: postgres(config.url, serviceDatabaseOptions(config.caCert)),
    };
  }
  return cache.__publicFormsDatabase.sql;
}

/** The SQLSTATE of a database error, if any. */
export function databaseErrorCode(error: unknown): string | undefined {
  if (error instanceof postgres.PostgresError) return error.code;
  return undefined;
}

export async function selectPublicForm(
  sql: postgres.Sql,
  key: string,
): Promise<unknown> {
  const [row] = await sql`select form_service.get_public_form(${key}) as form`;
  return row?.form ?? null;
}

export async function callSubmitPublicForm(
  sql: postgres.Sql,
  args: {
    key: string;
    formVersionId: string;
    requestId: string;
    fingerprint: string | null;
    answers: Record<string, unknown>;
  },
): Promise<void> {
  await sql`
    select form_service.submit_public_form(
      ${args.key},
      ${args.formVersionId}::uuid,
      ${args.requestId}::uuid,
      ${args.fingerprint},
      ${sql.json(args.answers as postgres.JSONValue)}
    )`;
}
