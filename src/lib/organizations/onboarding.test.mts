import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Viewer } from "../auth/viewer.ts";
import {
  createOrganizationErrorKey,
  onboardingAccess,
  submitOnboarding,
  type CreateOrganizationArgs,
  type CreateOrganizationResult,
  type OnboardingDependencies,
} from "./onboarding.ts";
import { parseOrganizationForm, parseRequestId } from "./validation.ts";

const REQUEST_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const anonymous: Viewer = { status: "anonymous" };
const unverified: Viewer = { status: "unverified" };
const newUser: Viewer = {
  status: "verified",
  userId: "user-1",
  email: "owner@example.test",
  hasActiveMembership: false,
  hasSuspendedMembership: false,
};
const member: Viewer = { ...newUser, hasActiveMembership: true };
const suspended: Viewer = { ...newUser, hasSuspendedMembership: true };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const validForm = () =>
  form({ name: "Do Luxo à Mesa", country: "AO", requestId: REQUEST_ID });

/**
 * Stand-in for `create_organization()`: idempotent per (user, request id), as
 * the database is. A repeated id with different values fails with 23505.
 * Membership becomes active once an organization exists.
 */
function fakeDatabase(user: Viewer = newUser) {
  const organizations = new Map<string, CreateOrganizationArgs>();
  const calls: CreateOrganizationArgs[] = [];
  let ids = 0;
  const deps: OnboardingDependencies = {
    async loadViewer() {
      return user.status === "verified" && organizations.size > 0
        ? { ...user, hasActiveMembership: true }
        : user;
    },
    async createOrganization(args): Promise<CreateOrganizationResult> {
      calls.push(args);
      const existing = organizations.get(args.request_id);
      if (!existing) {
        organizations.set(args.request_id, args);
        return { ok: true };
      }
      return existing.organization_name === args.organization_name &&
        existing.country_code === args.country_code
        ? { ok: true }
        : { ok: false, code: "23505" };
    },
    newRequestId: () => `00000000-0000-4000-8000-00000000000${++ids}`,
  };
  return { deps, organizations, calls };
}

describe("onboardingAccess (membership routing)", () => {
  it("sends anonymous visitors to sign-in, returning to onboarding", () => {
    assert.deepEqual(onboardingAccess(anonymous), {
      allowed: false,
      redirectTo: "/sign-in?next=%2Fonboarding",
    });
  });

  it("sends unverified sessions to sign-in with a notice", () => {
    assert.deepEqual(onboardingAccess(unverified), {
      allowed: false,
      redirectTo: "/sign-in?status=unverified",
    });
  });

  it("sends members home: onboarding is already complete", () => {
    assert.deepEqual(onboardingAccess(member), {
      allowed: false,
      redirectTo: "/",
    });
  });

  it("sends suspended-only users to the suspended-access state, not onboarding", () => {
    assert.deepEqual(onboardingAccess(suspended), {
      allowed: false,
      redirectTo: "/access-suspended",
    });
  });

  it("lets verified users without an active membership in", () => {
    assert.deepEqual(onboardingAccess(newUser), {
      allowed: true,
      viewer: newUser,
    });
  });
});

describe("parseOrganizationForm", () => {
  it("accepts a valid form and normalises its values", () => {
    assert.deepEqual(
      parseOrganizationForm(
        form({
          name: "  Café Central  ",
          country: " pt ",
          requestId: REQUEST_ID.toUpperCase(),
        }),
      ),
      {
        ok: true,
        name: "Café Central",
        countryCode: "PT",
        requestId: REQUEST_ID,
      },
    );
  });

  it("requires a name and a country", () => {
    const result = parseOrganizationForm(form({ name: "   ", country: "" }));
    assert.equal(result.ok, false);
    assert.deepEqual(!result.ok && result.fieldErrors, {
      name: "nameRequired",
      country: "countryRequired",
    });
  });

  it("limits the name to 120 characters, counted like the database", () => {
    const ok = parseOrganizationForm(
      form({ name: "🎉".repeat(120), country: "PT" }),
    );
    assert.equal(ok.ok, true);
    const tooLong = parseOrganizationForm(
      form({ name: "a".repeat(121), country: "PT" }),
    );
    assert.deepEqual(!tooLong.ok && tooLong.fieldErrors, {
      name: "nameTooLong",
    });
  });

  it("rejects control characters in the name", () => {
    for (const name of ["Line\nbreak", "Nul\u0000byte", "Tab\tinside"]) {
      const result = parseOrganizationForm(form({ name, country: "PT" }));
      assert.deepEqual(!result.ok && result.fieldErrors, {
        name: "nameInvalid",
      });
    }
  });

  it("rejects country codes that are not in the list", () => {
    for (const country of ["XX", "PRT", "P", "eu", "<script>"]) {
      const result = parseOrganizationForm(form({ name: "Acme", country }));
      assert.deepEqual(!result.ok && result.fieldErrors, {
        country: "countryInvalid",
      });
    }
  });

  it("accepts only well-formed request ids", () => {
    assert.equal(parseRequestId(REQUEST_ID), REQUEST_ID);
    assert.equal(parseRequestId("not-a-uuid"), undefined);
    assert.equal(parseRequestId(`${REQUEST_ID} `), undefined);
    assert.equal(parseRequestId(undefined), undefined);
  });
});

describe("createOrganizationErrorKey", () => {
  it("maps the function's SQLSTATEs", () => {
    assert.equal(createOrganizationErrorKey("42501"), "notAllowed");
    assert.equal(createOrganizationErrorKey("22023"), "invalid");
    assert.equal(createOrganizationErrorKey("23505"), "requestReused");
  });

  it("treats an expired or invalid JWT as not allowed", () => {
    assert.equal(createOrganizationErrorKey("PGRST301"), "notAllowed");
  });

  it("treats network failures and anything unexpected as retryable", () => {
    assert.equal(createOrganizationErrorKey(undefined), "unavailable");
    assert.equal(createOrganizationErrorKey(""), "unavailable");
    assert.equal(createOrganizationErrorKey("57014"), "unavailable");
    assert.equal(createOrganizationErrorKey("PGRST000"), "unavailable");
  });
});

describe("submitOnboarding (authorization)", () => {
  for (const [label, viewer, to] of [
    ["anonymous", anonymous, "/sign-in?next=%2Fonboarding"],
    ["unverified", unverified, "/sign-in?status=unverified"],
    ["an existing member", member, "/"],
    ["a suspended-only", suspended, "/access-suspended"],
  ] as const) {
    it(`does not create anything for ${label} viewers`, async () => {
      const db = fakeDatabase(viewer);
      const outcome = await submitOnboarding(validForm(), db.deps);
      assert.deepEqual(outcome, { kind: "redirect", to });
      assert.equal(db.calls.length, 0);
    });
  }

  it("sends only name, country and request id: never an owner or user id", async () => {
    const db = fakeDatabase();
    const data = validForm();
    data.set("userId", "someone-else");
    data.set("ownerId", "someone-else");
    data.set("organizationId", "00000000-0000-4000-8000-000000000000");
    const outcome = await submitOnboarding(data, db.deps);
    assert.deepEqual(outcome, { kind: "redirect", to: "/" });
    assert.deepEqual(db.calls, [
      {
        organization_name: "Do Luxo à Mesa",
        country_code: "AO",
        request_id: REQUEST_ID,
      },
    ]);
  });

  it("does not call the database when validation fails", async () => {
    const db = fakeDatabase();
    const outcome = await submitOnboarding(
      form({ name: "", country: "PT", requestId: REQUEST_ID }),
      db.deps,
    );
    assert.deepEqual(outcome, {
      kind: "form",
      state: {
        requestId: REQUEST_ID,
        name: "",
        countryCode: "PT",
        fieldErrors: { name: "nameRequired" },
      },
    });
    assert.equal(db.calls.length, 0);
  });

  it("does not submit without a valid request id, and issues a new one", async () => {
    const db = fakeDatabase();
    const outcome = await submitOnboarding(
      form({ name: "Acme", country: "PT", requestId: "forged" }),
      db.deps,
    );
    assert.equal(db.calls.length, 0);
    assert.equal(outcome.kind, "form");
    assert.equal(outcome.kind === "form" && outcome.state.formError, "generic");
    assert.match(
      outcome.kind === "form" ? outcome.state.requestId : "",
      /^00000000-/,
    );
  });

  it("sends a signed-out or unverified session to sign-in when the database refuses", async () => {
    const db = fakeDatabase();
    let calls = 0;
    db.deps.loadViewer = async () => (calls++ === 0 ? newUser : unverified);
    db.deps.createOrganization = async () => ({ ok: false, code: "42501" });
    const outcome = await submitOnboarding(validForm(), db.deps);
    assert.deepEqual(outcome, {
      kind: "redirect",
      to: "/sign-in?status=unverified",
    });
  });
});

describe("submitOnboarding (retries and duplicate submissions)", () => {
  it("keeps the same request id and values after a network failure", async () => {
    const db = fakeDatabase();
    db.deps.createOrganization = async () => ({ ok: false, code: "" });
    const outcome = await submitOnboarding(validForm(), db.deps);
    assert.deepEqual(outcome, {
      kind: "form",
      state: {
        requestId: REQUEST_ID,
        name: "Do Luxo à Mesa",
        countryCode: "AO",
        formError: "unavailable",
      },
    });
  });

  it("creates one organization when a lost response is retried", async () => {
    const db = fakeDatabase();
    const real = db.deps.createOrganization;
    // First attempt commits, but the response never arrives.
    db.deps.createOrganization = async (args) => {
      await real(args);
      return { ok: false, code: undefined };
    };
    const first = await submitOnboarding(validForm(), db.deps);
    assert.equal(first.kind === "form" && first.state.formError, "unavailable");

    // The retry comes from a page that still shows the form.
    db.deps.createOrganization = real;
    db.deps.loadViewer = async () => newUser;
    const retryForm = form({
      name: "Do Luxo à Mesa",
      country: "AO",
      requestId: first.kind === "form" ? first.state.requestId : "",
    });
    const retry = await submitOnboarding(retryForm, db.deps);
    assert.deepEqual(retry, { kind: "redirect", to: "/" });
    assert.equal(db.organizations.size, 1);
    assert.deepEqual(
      db.calls.map((call) => call.request_id),
      [REQUEST_ID, REQUEST_ID],
    );
  });

  it("creates one organization for concurrent double submissions", async () => {
    const db = fakeDatabase();
    // Both requests pass the membership check before either commits.
    db.deps.loadViewer = async () => newUser;
    const outcomes = await Promise.all([
      submitOnboarding(validForm(), db.deps),
      submitOnboarding(validForm(), db.deps),
    ]);
    for (const outcome of outcomes) {
      assert.deepEqual(outcome, { kind: "redirect", to: "/" });
    }
    assert.equal(db.calls.length, 2);
    assert.equal(db.organizations.size, 1);
  });

  it("sends the viewer home when an edited retry finds the organization already created", async () => {
    const db = fakeDatabase();
    await db.deps.createOrganization({
      organization_name: "Do Luxo à Mesa",
      country_code: "AO",
      request_id: REQUEST_ID,
    });
    // The first check still ran before the commit became visible.
    let calls = 0;
    db.deps.loadViewer = async () => (calls++ === 0 ? newUser : member);
    const outcome = await submitOnboarding(
      form({ name: "Edited name", country: "AO", requestId: REQUEST_ID }),
      db.deps,
    );
    assert.deepEqual(outcome, { kind: "redirect", to: "/" });
    assert.equal(db.organizations.size, 1);
  });

  it("issues a new request id when the old one can never succeed", async () => {
    const db = fakeDatabase();
    db.deps.loadViewer = async () => newUser;
    db.deps.createOrganization = async () => ({ ok: false, code: "23505" });
    const outcome = await submitOnboarding(validForm(), db.deps);
    assert.equal(outcome.kind, "form");
    if (outcome.kind !== "form") return;
    assert.equal(outcome.state.formError, "requestReused");
    assert.notEqual(outcome.state.requestId, REQUEST_ID);
  });
});
