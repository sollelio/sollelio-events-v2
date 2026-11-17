import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { signInErrorKey, signUpOutcome } from "./errors.ts";
import { parseCredentials } from "./validation.ts";
import { destinationFor, signInNotice } from "./viewer.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("auth state transitions (destinationFor)", () => {
  it("sends anonymous visitors to sign-in", () => {
    assert.equal(destinationFor({ status: "anonymous" }), "/sign-in");
  });

  it("sends unverified sessions to sign-in with a notice", () => {
    assert.equal(
      destinationFor({ status: "unverified" }),
      "/sign-in?status=unverified",
    );
  });

  it("sends verified users without an active membership to onboarding", () => {
    assert.equal(
      destinationFor({
        status: "verified",
        userId: "u1",
        email: "a@example.test",
        hasActiveMembership: false,
        hasSuspendedMembership: false,
      }),
      "/onboarding",
    );
  });

  it("sends verified members home", () => {
    assert.equal(
      destinationFor({
        status: "verified",
        userId: "u1",
        email: "a@example.test",
        hasActiveMembership: true,
        hasSuspendedMembership: false,
      }),
      "/",
    );
  });
});

describe("suspended memberships (destinationFor)", () => {
  const base = {
    status: "verified",
    userId: "u1",
    email: "a@example.test",
  } as const;

  it("sends suspended-only users to the suspended-access state", () => {
    assert.equal(
      destinationFor({
        ...base,
        hasActiveMembership: false,
        hasSuspendedMembership: true,
      }),
      "/access-suspended",
    );
  });

  it("lets an active membership win over a suspended one", () => {
    assert.equal(
      destinationFor({
        ...base,
        hasActiveMembership: true,
        hasSuspendedMembership: true,
      }),
      "/",
    );
  });

  it("keeps sending removed- or invited-only users to onboarding", () => {
    // Removed and invited memberships set neither flag.
    assert.equal(
      destinationFor({
        ...base,
        hasActiveMembership: false,
        hasSuspendedMembership: false,
      }),
      "/onboarding",
    );
  });
});

describe("signInNotice", () => {
  it("accepts only known notices", () => {
    assert.equal(signInNotice("signed-out"), "signed-out");
    assert.equal(signInNotice("link-expired"), "link-expired");
    assert.equal(signInNotice("<script>"), undefined);
    assert.equal(signInNotice(undefined), undefined);
    assert.equal(signInNotice(["signed-out"]), undefined);
  });
});

describe("parseCredentials", () => {
  it("accepts valid sign-in credentials and trims the email", () => {
    assert.deepEqual(
      parseCredentials(
        form({ email: " a@example.test ", password: "x" }),
        "sign-in",
      ),
      {
        ok: true,
        email: "a@example.test",
        password: "x",
      },
    );
  });

  it("does not apply the sign-up length rules to sign-in", () => {
    assert.equal(
      parseCredentials(
        form({ email: "a@example.test", password: "short" }),
        "sign-in",
      ).ok,
      true,
    );
  });

  it("reports missing and malformed fields", () => {
    assert.deepEqual(parseCredentials(form({}), "sign-in"), {
      ok: false,
      email: "",
      fieldErrors: { email: "emailRequired", password: "passwordRequired" },
    });
    const invalid = parseCredentials(
      form({ email: "not-an-email", password: "x" }),
      "sign-in",
    );
    assert.equal(invalid.ok, false);
    assert.equal(!invalid.ok && invalid.fieldErrors.email, "emailInvalid");
  });

  it("enforces the sign-up password length", () => {
    const short = parseCredentials(
      form({ email: "a@example.test", password: "1234567" }),
      "sign-up",
    );
    assert.equal(!short.ok && short.fieldErrors.password, "passwordTooShort");
    assert.equal(
      parseCredentials(
        form({ email: "a@example.test", password: "12345678" }),
        "sign-up",
      ).ok,
      true,
    );
    // 25 three-byte characters = 75 bytes, over bcrypt's 72-byte limit.
    const long = parseCredentials(
      form({ email: "a@example.test", password: "€".repeat(25) }),
      "sign-up",
    );
    assert.equal(!long.ok && long.fieldErrors.password, "passwordTooLong");
  });

  it("never returns the password when validation fails", () => {
    const result = parseCredentials(
      form({ email: "bad", password: "secret-value" }),
      "sign-up",
    );
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes("secret-value"), false);
  });
});

describe("Auth error mapping", () => {
  it("maps sign-in errors without exposing details", () => {
    assert.equal(
      signInErrorKey({ code: "invalid_credentials", status: 400 }),
      "invalidCredentials",
    );
    assert.equal(
      signInErrorKey({ code: "email_not_confirmed", status: 400 }),
      "emailNotConfirmed",
    );
    assert.equal(
      signInErrorKey({ code: "over_request_rate_limit", status: 429 }),
      "rateLimited",
    );
    assert.equal(signInErrorKey({ status: 429 }), "rateLimited");
    assert.equal(
      signInErrorKey({ code: "user_banned", status: 400 }),
      "generic",
    );
    assert.equal(signInErrorKey({}), "generic");
  });

  it("treats an existing address like a new sign-up (no account enumeration)", () => {
    assert.equal(signUpOutcome({ code: "user_already_exists" }), "accepted");
    assert.equal(signUpOutcome({ code: "email_exists" }), "accepted");
  });

  it("maps other sign-up errors", () => {
    assert.equal(signUpOutcome({ code: "weak_password" }), "weakPassword");
    assert.equal(
      signUpOutcome({ code: "email_address_invalid" }),
      "emailInvalid",
    );
    assert.equal(
      signUpOutcome({ code: "over_email_send_rate_limit" }),
      "rateLimited",
    );
    assert.equal(
      signUpOutcome({ code: "signup_disabled" }),
      "signUpUnavailable",
    );
    assert.equal(
      signUpOutcome({ code: "unexpected_failure", status: 500 }),
      "generic",
    );
  });
});
