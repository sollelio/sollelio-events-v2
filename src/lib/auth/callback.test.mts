import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCallbackParams } from "./callback.ts";

const parse = (query: string) =>
  parseCallbackParams(new URLSearchParams(query));

describe("parseCallbackParams", () => {
  it("accepts a PKCE code", () => {
    assert.deepEqual(parse("code=2f0c4b6e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"), {
      kind: "code",
      code: "2f0c4b6e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    });
  });

  it("accepts a confirmation token hash", () => {
    assert.deepEqual(parse("token_hash=abc123&type=email"), {
      kind: "token_hash",
      tokenHash: "abc123",
      type: "email",
    });
    assert.deepEqual(parse("token_hash=abc123&type=signup"), {
      kind: "token_hash",
      tokenHash: "abc123",
      type: "signup",
    });
  });

  it("rejects token types that are not email confirmation", () => {
    for (const type of [
      "recovery",
      "invite",
      "magiclink",
      "email_change",
      "",
    ]) {
      assert.deepEqual(parse(`token_hash=abc123&type=${type}`), {
        kind: "invalid",
      });
    }
  });

  it("rejects malformed or missing tokens", () => {
    assert.deepEqual(parse("code="), { kind: "invalid" });
    assert.deepEqual(parse("code=has%20space"), { kind: "invalid" });
    assert.deepEqual(parse(`code=${"a".repeat(513)}`), { kind: "invalid" });
    assert.deepEqual(parse("type=email"), { kind: "invalid" });
    assert.deepEqual(parse("token_hash=abc123"), { kind: "invalid" });
    assert.deepEqual(parse(""), { kind: "invalid" });
  });

  it("reports Supabase errors, distinguishing expired links", () => {
    assert.deepEqual(
      parse(
        "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid",
      ),
      { kind: "error", reason: "expired" },
    );
    assert.deepEqual(parse("error=server_error"), {
      kind: "error",
      reason: "failed",
    });
  });

  it("lets an error win over a code in the same URL", () => {
    assert.deepEqual(parse("code=abc&error=access_denied"), {
      kind: "error",
      reason: "failed",
    });
  });
});
