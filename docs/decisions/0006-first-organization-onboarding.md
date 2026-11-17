# 0006 — First organization onboarding

**Status:** Accepted (Increment 1, Step 4B)
**Date:** 2026-11-17 (accepted 2026-11-17)

## Context

UX Blueprint §4 approves a two-step onboarding (organization, then
branding) followed by a real-data Home. ADR 0004 deployed
`public.create_organization(organization_name, country_code, request_id)` on
`events-v2`. ADR 0005 added authentication and a temporary `/onboarding`
state.

This step implements only step 1 (organization) and a minimal Home. It does
not change the database, the Auth settings or any migration.

## Decision

### Journey

| Route         | Who                                        | Behaviour                                                                           |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `/onboarding` | Verified user without an active membership | Form: organization name and country. Anyone else is redirected (see below).         |
| `/`           | Verified member                            | Organization Home: the organization's name and country. No operational data exists. |

Routing is decided on the server for every request, from `getViewer()` and
RLS. Client navigation is never an authorization step.

- Anonymous → `/sign-in?next=%2Fonboarding` (or `/sign-in` from Home).
- Unverified → `/sign-in?status=unverified`.
- Verified without an active membership → `/onboarding`.
- Verified with an active membership → `/` (onboarding is complete).

### Creation

- **Server Function** `createOrganization` (`src/lib/organizations/actions.ts`)
  calls `create_organization()` through the user's own session, so RLS and
  the function's checks apply. The function makes `auth.uid()` the Owner; the
  form carries no user, owner or organization id.
- **The Server Function re-checks access** before calling the database. A
  member (for example after creating the organization in another tab) is sent
  Home without a second call.
- **Validation** mirrors the database and is repeated there: name trimmed
  (NFC), 1–120 characters counted as code points, no control characters;
  country in the migration's ISO 3166-1 alpha-2 list. A test keeps the
  application's list identical to `private.country_codes`.
- **Logic** lives in a dependency-free module
  (`src/lib/organizations/onboarding.ts`), tested with `node:test`.

### Idempotency

- The page issues one `request_id` (UUID) per visit, in a hidden field. Every
  retry of that form, including after errors, sends the same id; double
  submissions and a retry after a lost response return the same organization.
- A request id is replaced only when it can no longer succeed: a malformed
  id (nothing was sent) or `23505` (the id was used with other values).
- Reloading the page issues a new id, but only after the server has checked
  that no active membership exists; an organization created by an earlier
  attempt sends the user Home instead.
- **Residual race:** two separate page loads (two tabs) submitted at the same
  moment carry different ids and can both pass the membership check, creating
  two organizations. The database does not limit organizations per user, and
  this step does not add that rule.

### Errors

| Situation                                        | Result                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Invalid field                                    | Field message, value kept, focus on the field                           |
| `22023` (database validation)                    | Form message                                                            |
| `42501` or a rejected JWT                        | Viewer re-checked: redirect to sign-in, otherwise a form message        |
| `23505` (request id reused)                      | Viewer re-checked: member → Home; otherwise a new id and a form message |
| Network failure or unexpected error              | Retryable form message; same id, values kept                            |
| Session check fails or the server is unreachable | `src/app/onboarding/error.tsx`; retrying re-runs the server checks      |

No raw database or Auth error text is shown.

### Home

- `getHomeOrganization()` reads `organizations` under RLS, which returns only
  organizations with the viewer's active membership.
- **Interim rule:** if a user has several organizations (possible only
  through the API, not this UI), Home shows the oldest. Choosing an active
  organization (Technical Foundation §3.4) is not designed yet.
- If a membership exists but its organization is not readable, Home fails
  closed with an error rather than redirecting back to onboarding.

### Separation of concerns

- **Organization identity:** name and country only, as stored by ADR 0004.
- **Regional preferences:** the country does not set the interface language,
  timezone or currency. The interface stays `pt-PT`; country names are shown
  in the interface language, not the organization's.
- **Appearance:** remains a per-device user preference, unrelated to the
  organization.

### Interface

- `AuthShell`, `FormField`, `FormMessage` and `Button` are reused. The only
  new primitive is `NativeSelect` (Input styling; native picker on mobile).
- Accessibility follows ADR 0005: labels, `aria-invalid`, `aria-describedby`,
  `role="alert"`, focus moved to the first problem, and a disabled,
  `aria-busy` submit while pending.

## Deliberately deferred

- **Blueprint §4 suggestions** of locale, timezone and default currency from
  the country. They need storage that does not exist, and the defaults are an
  open decision (Blueprint §12.7).
- **Onboarding step 2 (branding)**, the first-Inquiry prompt on Home, and
  primary navigation. Their destinations do not exist yet.
- Active-organization selection and any per-user limit on organizations.
- Editing the organization afterwards (Settings).

## Verification

- **Isolated:** unit tests for validation, access and routing, error mapping,
  retries and concurrent double submissions against an idempotent stand-in
  for the database; the country list against the migration. Layouts were
  checked in headless Chrome at 390 px and 1440 px, light and dark, with the
  real form and logic and an unreachable stand-in database.
- **Database idempotency** is the function's own behaviour, verified by the
  pgTAP and concurrency tests of ADR 0004 on an isolated database.
- **Manual test on `events-v2` (reported by Product, 2026-11-17):** the
  existing verified account completed onboarding. The database holds one
  organization (country `AO`) with one `owner` / `active` membership, and one
  `organization.created` and one `membership.created` audit event. Home showed
  the organization's name and country.
- **Not exercised on `events-v2`:** the error paths, retries and double
  submissions; they are covered by the isolated tests only.
