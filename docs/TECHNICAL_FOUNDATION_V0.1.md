# Sollelio Events V2 — Technical Foundation v0.1

**Status:** Approved technical foundation decisions; implementation details
explicitly open where stated
**Date:** 2026-11-03
**Audience:** Product, architecture and Claude Code implementation review

## 1. Purpose and authority

This document records the approved technical foundation decisions for Sollelio
Events V2 (Essential UX Blueprint §13, step 2: _Minimum Correct Technical
Foundation_). It is canonical for architecture, identity and access, domain
boundaries, core invariants, delivery sequence and design-foundation
requirements.

It is **not** a database schema, permission matrix, API contract, component
specification or infrastructure plan. Where this document lists a matter as
open (§10), an implementation agent must not silently decide it.

Each section separates three kinds of statement:

- **Approved decisions** — binding unless revised through a new approved
  version of this document.
- **Open implementation details** — collected in §10; resolved just-in-time in
  scoped specifications.
- **Non-goals** — collected in §11; not authorized by this document.

Relationship to other documents:

- **Essential UX Blueprint v0.1** remains canonical for Slice 1 UX decisions.
  This document does not alter it; its open decisions (Blueprint §12) remain
  open unless explicitly resolved here.
- **ADR 0001 (foundation scaffold)** recorded the initial tooling. Items ADR
  0001 deferred are decided here only where this document states an approved
  decision; the rest remain open (§10).

## 2. Architecture — approved decisions

- **Greenfield and independent.** V2 is a new SaaS. It does not read from,
  write to, or depend on Sollelio Events V1 or its production database.
- **Application stack.** Next.js 16 (App Router), React, TypeScript in `strict`
  mode, Tailwind CSS, shadcn/ui (with Radix).
- **Backend direction.** PostgreSQL via Supabase is the intended backend
  direction.
- **Pragmatic modular monolith in one repository.** One deployable application,
  organized by logical domain boundaries (§4). No workspace packages.
- **No premature distribution or generality.** No microservices, internal
  packages, generic engines or abstractions introduced ahead of a concrete,
  present need.

## 3. Identity, organizations and access — approved decisions

### 3.1 Authentication

- Email/password authentication with email verification.

### 3.2 Organizations and memberships

- An Organization and its initial Owner are created **atomically**: either both
  exist or neither does.
- Memberships are **organization-specific**. One user may hold memberships in
  multiple organizations.
- Users join an organization through organization-specific **invitations**.
- **Membership lifecycle:** `invited`, `active`, `suspended`, `removed`.
- The **last active Owner** of an organization cannot be removed.

### 3.3 Roles, capabilities and scope

- **Three initial roles:** Owner, Manager, Member.
- Authorization is based on **explicit capabilities** and **resource scope**,
  not on role names alone.
- Owner and Manager have **organization-level scope**, according to their
  permissions.
- Members access **assigned resources only**, with explicitly granted
  capabilities where supported.

### 3.4 Context versus authorization

- The **active Organization** is application context (which organization the
  user is currently working in). It is **not proof of authorization**; every
  operation is authorized against the user's actual membership, capabilities
  and resource scope.

### 3.5 Separate actor populations

- **Sollelio internal staff** are separate from customer-organization
  memberships. Internal staff access is not modelled as a membership in a
  customer organization.
- **External event customers** use secure portal access (Client Access, §4)
  without SaaS accounts or memberships, consistent with Blueprint §8.

### 3.6 Enforcement

- **Row-level security with default deny** in the database.
- **Server-side authorization** for every protected read and mutation. Client
  checks are presentation only, and authorization is identical across screen
  sizes.
- **Sensitive operations are audited.**

## 4. Domain boundaries — approved decisions

The application is organized around these **logical** boundaries:

| Boundary                  | Responsibility (summary)                                                        |
| ------------------------- | ------------------------------------------------------------------------------- |
| **Organization & Access** | Organizations, memberships, invitations, roles, capabilities, scope             |
| **Contacts**              | Real persons and organizations, and their relationship to Events                |
| **Inquiries**             | Intake and triage; preservation of the original request                         |
| **Events**                | Prospective and confirmed Events; the Event Workspace as the event centre       |
| **Quotes**                | Structured quote drafting, publication and immutable versions                   |
| **Payments**              | Commercial obligations, manually recorded payments, corrections, derived totals |
| **Confirmation**          | Organization confirmation conditions, eligibility and explicit confirmation     |
| **Client Access**         | Secure external customer portal access and customer decisions                   |

These are logical boundaries, **not** mandatory empty packages or directories.
Code for a boundary appears when a delivery step needs it.

The following concepts remain **distinct** and must not be conflated in code,
data or UI:

- **Inquiry** and **Event** — an Inquiry may lead to a Prospective Event; the
  Inquiry remains intact and linked.
- **Contact** — a genuine person or organization, not a placeholder combining
  several people.
- **Commercial state** and **confirmation state** of an Event — shown and held
  separately (Blueprint §3). Quote acceptance is not Event confirmation.
- **Operational execution** — a separate concern from commercial and
  confirmation state. No operational-execution module is authorized for the
  current delivery steps (see §11).

## 5. Core invariants — approved decisions

1. **Inquiry originals are preserved** when a Prospective Event is created from
   an Inquiry.
2. **Published Quote versions are immutable.** Revisions create new versions.
3. **Client acceptance references an exact, valid, published Quote version.**
4. **Payments are auditable facts; balances are derived** from them, never
   stored as independently edited values.
5. **Payment corrections preserve history.** Financial facts are not silently
   rewritten.
6. **Event confirmation is explicit, authorized, validated and transactionally
   consistent.** Eligibility never confirms an Event automatically.
7. **Repeated critical operations do not produce duplicate effects.**
8. **No cross-tenant access or mutations.**

## 6. Delivery strategy — approved decisions

Delivery proceeds in this order. Each step is scoped, inspected, tested and
reviewed, and work stops at its agreed boundary.

1. **Operational foundation and minimum Design System.**
2. **Inquiry, Contact and Prospective Event.**
3. **Quotes, Client Portal and customer decisions.**
4. **Payments and explicit Event Confirmation.**
5. **Commercial beta readiness.**

Steps 2–4 together deliver Vertical Slice 1 (Blueprint §2). Step 5 corresponds
to the commercial beta gate (Blueprint §13, step 4).

## 7. Design requirements — approved decisions

- **Quality bar:** premium, sophisticated, contemporary UI/UX.
- **Appearance modes:** native light mode, dark mode, and following the system
  preference.
- **Responsive:** first-class desktop and mobile experiences (navigation model
  per Blueprint §10).
- **Accessibility:** strong accessibility is a requirement, not a later polish
  item.
- **Performance:** strong performance is a requirement.
- **Motion and interaction:** meaningful motion and polished interaction states.
- **Branding versus appearance:** organization branding (applied to
  client-facing surfaces) remains separate from each user's appearance
  preferences.
- **Foundations first:** design foundations are established before real product
  screens are built (delivery step 1).
- **No speculative design work:** no speculative component libraries and no
  prolonged mockup-only development; components are built when real screens
  need them.

## 8. Existing foundation (for reference)

The scaffold recorded in ADR 0001 already provides: Next.js 16.4 (App Router,
`src/` directory), React 19, TypeScript `strict` (plus
`noUncheckedIndexedAccess`), Tailwind CSS v4, shadcn/ui (Radix base), ESLint,
Prettier and npm. No database, authentication or product code exists.

## 9. Traceability to the UX Blueprint

| This document                                   | Blueprint reference |
| ----------------------------------------------- | ------------------- |
| Distinct Inquiry / Event / Contact (§4)         | §2, §6              |
| Commercial vs confirmation state (§4)           | §3, §9              |
| Immutable Quote versions; exact acceptance (§5) | §7, §8              |
| Derived balances; preserved corrections (§5)    | §9                  |
| Explicit confirmation (§5)                      | §9                  |
| Portal without SaaS membership (§3.5)           | §8                  |
| Branding vs appearance (§7)                     | §4                  |
| Responsive navigation (§7)                      | §10                 |

## 10. Open implementation details

These are **not** decided by this document. Resolve each deliberately, in a
scoped specification, at the delivery step that needs it.

### 10.1 Carried forward from the UX Blueprint (§12)

1. Client verification delivery (code transport, expiry, retries, recovery,
   market availability).
2. Availability rules before confirmation (blockers vs warnings).
3. Financial corrections and post-acceptance commercial amendments.
4. Permission matrix and roles — concrete operations per role (see 10.2).
5. Quote structure, pricing, discount and rounding rules, publication guards.
6. Home attention rules and ordering.
7. Onboarding defaults and configuration guards.

### 10.2 Identity and access

- The concrete capability catalogue and its assignment to Owner, Manager and
  Member.
- How resources are assigned to Members, and which capabilities can be
  explicitly granted to them.
- Invitation mechanics (delivery, expiry, acceptance, resending, revocation).
- Allowed membership state transitions and their effects on active sessions.
- How Sollelio internal staff access is granted, scoped and audited.
- Client Access token issuance, scope, expiry and revocation.
- Authentication provider configuration (for example, whether Supabase Auth
  provides email/password and verification) and session handling.
- RLS policy design and the server-side authorization structure.

### 10.3 Data and persistence

- Database schema (none exists; to be designed per delivery step, not up front).
- Migration tooling and workflow.
- Audit record design, retention and which operations count as sensitive.
- Mechanism for preventing duplicate effects (idempotency) on critical
  operations.
- Money representation, currency and rounding conventions.

### 10.4 Application structure

- Directory and module conventions for the logical domain boundaries.
- Locale and internationalization approach (UI language, formatting, the
  `lang` attribute), timezone handling.

### 10.5 Design System

- Design tokens (colour, typography, spacing, radius, elevation, motion).
- Theme switching mechanism and persistence of user appearance preference.
- How organization branding (logo, main colour) is applied on client-facing
  surfaces with a neutral fallback.
- Accessibility targets and verification method; performance budgets.

### 10.6 Delivery operations

- Test runner(s), minimum test gates and CI.
- Local, staging and production environment workflow; environment variables.
- Hosting platform and Node.js runtime version.
- Supabase project provisioning (not to be done without explicit approval).

## 11. Explicit non-goals

This document does not authorize:

- Any dependency on, or change to, Sollelio Events V1 or its database.
- Microservices, workspace packages or internal libraries.
- Generic engines: workflow/BPMN engines, universal rule engines, generic
  permission frameworks or other speculative abstractions.
- Empty or placeholder modules for domain boundaries.
- A full up-front database schema, or any production infrastructure change.
- SaaS accounts or memberships for external event customers.
- Treating the active Organization as authorization.
- Automatic Event confirmation, or a casual universal "force confirmation"
  bypass.
- Operational-execution modules (workforce/payroll, materials, fleet,
  logistics, supplier procurement) and the other Blueprint §11 non-goals:
  advanced analytics, document editors, country tax engines, payment gateways,
  automated SaaS billing, cross-product platform abstractions.
- Speculative component libraries or prolonged mockup-only development.
- Native mobile apps or offline support for Slice 1.
