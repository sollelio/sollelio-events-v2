import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  CLOSE_REASONS,
  INQUIRY_SOURCES,
  submitInquiry,
  type CreateInquiryArgs,
} from "./inquiry.ts";

/*
 * The application calls the inquiry functions through PostgREST with named
 * arguments, and cannot reach the isolated test database (its Supabase project
 * is pinned, ADR 0003). These tests keep the names and enum values the
 * application sends identical to the migration.
 */

const MIGRATION = new URL(
  "../../../supabase/migrations/20261117190000_inquiries.sql",
  import.meta.url,
);

async function sql(): Promise<string> {
  return readFile(MIGRATION, "utf8");
}

function parameterNames(source: string, fn: string): string[] {
  const match = new RegExp(`create function public\\.${fn}\\(([^)]*)\\)`).exec(
    source,
  );
  assert.ok(match?.[1], `${fn} not found`);
  return match[1]
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

function enumValues(source: string, type: string): string[] {
  const match = new RegExp(
    `create type public\\.${type} as enum \\(([^)]*)\\)`,
  ).exec(source);
  assert.ok(match?.[1], `${type} not found`);
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? "");
}

describe("database contract", () => {
  it("create_inquiry receives exactly the arguments the application sends", async () => {
    let sent: CreateInquiryArgs | undefined;
    const form = new FormData();
    form.set("source", "phone");
    form.set("staffSummary", "x");
    form.set("requestId", "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b");
    await submitInquiry(form, {
      organizationId: "0a000000-0000-4000-8000-00000000000a",
      now: new Date(),
      newRequestId: () => "unused",
      async createInquiry(args) {
        sent = args;
        return { ok: true, data: "id" };
      },
    });
    assert.deepEqual(
      Object.keys(sent ?? {}).sort(),
      parameterNames(await sql(), "create_inquiry").sort(),
    );
  });

  it("close_inquiry and reopen_inquiry take the names used by the Server Functions", async () => {
    const source = await sql();
    assert.deepEqual(parameterNames(source, "close_inquiry"), [
      "p_inquiry_id",
      "p_reason",
    ]);
    assert.deepEqual(parameterNames(source, "reopen_inquiry"), [
      "p_inquiry_id",
    ]);
  });

  it("sources and close reasons match the database enums", async () => {
    const source = await sql();
    assert.deepEqual(enumValues(source, "inquiry_source"), [
      ...INQUIRY_SOURCES,
    ]);
    assert.deepEqual(enumValues(source, "inquiry_close_reason"), [
      ...CLOSE_REASONS,
    ]);
  });
});
