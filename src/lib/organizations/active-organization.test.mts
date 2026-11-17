import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Viewer } from "../auth/viewer.ts";
import {
  activeOrganizations,
  appEntry,
  findOrganization,
  monogram,
  organizationChoice,
  resolveActiveOrganization,
  type MembershipRow,
  type OrganizationSummary,
} from "./active-organization.ts";

const lumen: OrganizationSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Atelier Lumen",
  countryCode: "PT",
  role: "owner",
};
const mesa: OrganizationSummary = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Do Luxo à Mesa",
  countryCode: "AO",
  role: "owner",
};
/** Someone else's organization: never in this viewer's list. */
const foreign: OrganizationSummary = {
  id: "99999999-9999-4999-8999-999999999999",
  name: "Outra Empresa",
  countryCode: "BR",
  role: "owner",
};

const anonymous: Viewer = { status: "anonymous" };
const unverified: Viewer = { status: "unverified" };
const verified = (
  hasActiveMembership: boolean,
  hasSuspendedMembership = false,
): Viewer => ({
  status: "verified",
  userId: "user-1",
  email: "owner@example.test",
  hasActiveMembership,
  hasSuspendedMembership,
});

const active = (organization: OrganizationSummary): MembershipRow => ({
  status: "active",
  organization,
});

describe("activeOrganizations", () => {
  it("keeps only active memberships with a readable organization", () => {
    const rows: MembershipRow[] = [
      active(mesa),
      { status: "suspended", organization: foreign },
      { status: "removed", organization: foreign },
      { status: "invited", organization: foreign },
      // RLS hides the organization of a non-active membership.
      { status: "active", organization: null },
    ];
    assert.deepEqual(activeOrganizations(rows, "pt-PT"), [mesa]);
  });

  it("lists each organization once, sorted by name", () => {
    assert.deepEqual(
      activeOrganizations([active(mesa), active(lumen), active(mesa)], "pt-PT"),
      [lumen, mesa],
    );
  });
});

describe("resolveActiveOrganization", () => {
  it("has nothing to select without an active organization", () => {
    assert.deepEqual(resolveActiveOrganization([], lumen.id), {
      kind: "none",
    });
  });

  it("selects the only organization automatically", () => {
    for (const preference of [undefined, mesa.id, foreign.id, "garbage"]) {
      assert.deepEqual(resolveActiveOrganization([lumen], preference), {
        kind: "selected",
        organization: lumen,
        organizations: [lumen],
      });
    }
  });

  it("asks the viewer to choose between several without a preference", () => {
    assert.deepEqual(resolveActiveOrganization([lumen, mesa], undefined), {
      kind: "choose",
      organizations: [lumen, mesa],
    });
  });

  it("uses the preference when it names one of the viewer's organizations", () => {
    assert.deepEqual(
      resolveActiveOrganization([lumen, mesa], mesa.id.toUpperCase()),
      { kind: "selected", organization: mesa, organizations: [lumen, mesa] },
    );
  });

  it("ignores a manipulated preference for an organization outside the list", () => {
    for (const preference of [
      foreign.id,
      "not-a-uuid",
      `${mesa.id} `,
      "",
      ["x"],
    ]) {
      assert.deepEqual(resolveActiveOrganization([lumen, mesa], preference), {
        kind: "choose",
        organizations: [lumen, mesa],
      });
    }
  });

  it("cannot select an organization whose membership is suspended", () => {
    const organizations = activeOrganizations(
      [active(lumen), { status: "suspended", organization: mesa }],
      "pt-PT",
    );
    assert.deepEqual(resolveActiveOrganization(organizations, mesa.id), {
      kind: "selected",
      organization: lumen,
      organizations: [lumen],
    });
  });
});

describe("appEntry (routing for application pages)", () => {
  it("sends anonymous and unverified viewers to sign-in", () => {
    assert.deepEqual(appEntry(anonymous, { kind: "none" }), {
      kind: "redirect",
      to: "/sign-in",
    });
    assert.deepEqual(appEntry(unverified, { kind: "none" }), {
      kind: "redirect",
      to: "/sign-in?status=unverified",
    });
  });

  it("sends viewers without an active organization to onboarding", () => {
    assert.deepEqual(appEntry(verified(false), { kind: "none" }), {
      kind: "redirect",
      to: "/onboarding",
    });
  });

  it("never grants a suspended organization through a stale remembered-organization cookie", () => {
    // The cookie still names Mesa from before the suspension. The rows assume
    // the worst case: Mesa readable despite RLS, so only the code's own status
    // filter stands between the cookie and the organization.
    const staleCookie = mesa.id;
    const suspendedMesa: MembershipRow = {
      status: "suspended",
      organization: mesa,
    };

    // Suspended only: the suspended-access state, never Mesa.
    const suspendedOnly = activeOrganizations([suspendedMesa], "pt-PT");
    const onlyResolution = resolveActiveOrganization(
      suspendedOnly,
      staleCookie,
    );
    assert.deepEqual(appEntry(verified(false, true), onlyResolution), {
      kind: "redirect",
      to: "/access-suspended",
    });
    assert.deepEqual(
      organizationChoice(verified(false, true), onlyResolution),
      { kind: "redirect", to: "/access-suspended" },
    );
    // Re-submitting the id to the selection Server Function is refused too.
    assert.equal(findOrganization(suspendedOnly, staleCookie), undefined);

    // Suspended in Mesa, active in Lumen: Lumen renders, Mesa never does.
    const mixed = activeOrganizations([suspendedMesa, active(lumen)], "pt-PT");
    assert.deepEqual(
      appEntry(
        verified(true, true),
        resolveActiveOrganization(mixed, staleCookie),
      ),
      { kind: "render", organization: lumen, canSwitch: false },
    );
    assert.equal(findOrganization(mixed, staleCookie), undefined);
  });

  it("sends a viewer whose only membership is suspended to the suspended-access state", () => {
    const resolution = resolveActiveOrganization(
      activeOrganizations(
        [{ status: "suspended", organization: null }],
        "pt-PT",
      ),
      mesa.id,
    );
    assert.deepEqual(appEntry(verified(false, true), resolution), {
      kind: "redirect",
      to: "/access-suspended",
    });
    assert.deepEqual(organizationChoice(verified(false, true), resolution), {
      kind: "redirect",
      to: "/access-suspended",
    });
  });

  it("keeps sending a viewer whose only membership was removed to onboarding", () => {
    const resolution = resolveActiveOrganization(
      activeOrganizations([{ status: "removed", organization: null }], "pt-PT"),
      mesa.id,
    );
    assert.deepEqual(appEntry(verified(false, false), resolution), {
      kind: "redirect",
      to: "/onboarding",
    });
  });

  it("works normally in the active organization despite another suspended membership", () => {
    const resolution = resolveActiveOrganization(
      activeOrganizations(
        [active(lumen), { status: "suspended", organization: null }],
        "pt-PT",
      ),
      undefined,
    );
    assert.deepEqual(appEntry(verified(true, true), resolution), {
      kind: "render",
      organization: lumen,
      canSwitch: false,
    });
  });

  it("fails closed when a counted membership has no readable organization", () => {
    assert.deepEqual(appEntry(verified(true), { kind: "none" }), {
      kind: "inconsistent",
    });
  });

  it("renders one organization, without switching", () => {
    assert.deepEqual(
      appEntry(verified(true), resolveActiveOrganization([mesa], undefined)),
      { kind: "render", organization: mesa, canSwitch: false },
    );
  });

  it("sends a viewer with several organizations and no valid preference to selection", () => {
    assert.deepEqual(
      appEntry(
        verified(true),
        resolveActiveOrganization([lumen, mesa], foreign.id),
      ),
      { kind: "redirect", to: "/select-organization" },
    );
  });

  it("renders the preferred organization and allows switching", () => {
    assert.deepEqual(
      appEntry(
        verified(true),
        resolveActiveOrganization([lumen, mesa], mesa.id),
      ),
      { kind: "render", organization: mesa, canSwitch: true },
    );
  });
});

describe("organizationChoice (selection page)", () => {
  it("lists several organizations, marking the current one", () => {
    assert.deepEqual(
      organizationChoice(
        verified(true),
        resolveActiveOrganization([lumen, mesa], mesa.id),
      ),
      { kind: "choose", organizations: [lumen, mesa], currentId: mesa.id },
    );
    assert.deepEqual(
      organizationChoice(
        verified(true),
        resolveActiveOrganization([lumen, mesa], undefined),
      ),
      { kind: "choose", organizations: [lumen, mesa], currentId: undefined },
    );
  });

  it("sends a single-organization viewer home and others where they belong", () => {
    assert.deepEqual(
      organizationChoice(
        verified(true),
        resolveActiveOrganization([mesa], undefined),
      ),
      { kind: "redirect", to: "/" },
    );
    assert.deepEqual(organizationChoice(verified(false), { kind: "none" }), {
      kind: "redirect",
      to: "/onboarding",
    });
    assert.deepEqual(organizationChoice(anonymous, { kind: "none" }), {
      kind: "redirect",
      to: "/sign-in",
    });
  });
});

describe("findOrganization (selection Server Function)", () => {
  it("accepts only an id from the viewer's own active organizations", () => {
    assert.equal(findOrganization([lumen, mesa], mesa.id), mesa);
    assert.equal(findOrganization([lumen, mesa], foreign.id), undefined);
    assert.equal(findOrganization([lumen, mesa], null), undefined);
    assert.equal(findOrganization([lumen, mesa], "' or 1=1 --"), undefined);
    assert.equal(findOrganization([], mesa.id), undefined);
  });
});

describe("monogram", () => {
  it("uses up to two initials", () => {
    assert.equal(monogram("Atelier Lumen Eventos"), "AL");
    assert.equal(monogram("teste events"), "TE");
    assert.equal(monogram("Ócio"), "Ó");
    assert.equal(monogram("  & Co  "), "C");
    assert.equal(monogram("—"), "·");
  });
});
