# 0004 — Organization and membership database foundation

**Status:** Accepted (Increment 1, Step 3C). Applied to `events-v2`
(`icgsujzpcafqnqjozslj`) and verified there, as reported by Product (recorded
2026-11-17).
**Date:** 2026-11-14 (revised 2026-11-16, accepted 2026-11-16)

## Context

Technical Foundation v0.1 §3 approves organizations created atomically with
their initial Owner, organization-specific memberships, three roles (Owner,
Manager, Member), the lifecycle `invited` / `active` / `suspended` / `removed`,
protection of the last active Owner, RLS with default deny, server-side
authorization and auditing of sensitive operations. §5 adds: no duplicate
effects from repeated critical operations, and no cross-tenant access.

Step 3A prepared the migration and tests. Step 3B applied these product
decisions:

1. Removed memberships are historical. Rejoining creates a new membership,
   with at most one current membership per user and organization.
2. Future invitations may target email addresses without an account. There
   is no invitation workflow yet.
3. Owner and Manager will see the organization's member list; a Member sees
   only their own membership. Implement only what this slice needs.
4. An organization stores its name and an ISO 3166-1 alpha-2 country. Locale,
   timezone and currency stay separate concepts.
5. Organization creation itself requires a verified email address.
6. Authorship and historical memberships are preserved. No account deletion
   or anonymisation workflow yet.
7. Organizations are not physically deleted in the MVP.
8. Audit events are protected and avoid unnecessary sensitive data.
9. Idempotency stays; no general rate limiting in this slice.
10. An invitation address is immutable after insertion. A mistaken invitation
    is removed and recreated, preserving history. Email addresses are not
    recorded in audit details.

Nothing is applied to `events-v2` by accepting this record.

## Decision

### Schema

Migration `supabase/migrations/20261114133030_organizations_and_memberships.sql`.

| Object                  | Contents                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `public.organizations`  | `id`, `name` (trimmed, 1–120), `country_code` (→ `private.country_codes`), `created_by` (→ `auth.users`), `creation_request_id`, `created_at`. Unique `(created_by, creation_request_id)`. |
| `public.memberships`    | `id`, `organization_id`, `user_id` (→ `auth.users`, null only for an email invitation), `invited_email` (lower-case, trimmed, immutable), `role`, `status`, `created_at`.                  |
| `membership_role`       | `owner`, `manager`, `member`                                                                                                                                                               |
| `membership_status`     | `invited`, `active`, `suspended`, `removed`                                                                                                                                                |
| `private` schema        | Not exposed by the Data API; no privileges for any API role.                                                                                                                               |
| `private.country_codes` | The 249 officially assigned ISO 3166-1 alpha-2 codes (Debian iso-codes 4.20.1). Updating the list is a data migration.                                                                     |
| `private.audit_events`  | Append-only: organization, actor user, actor role, action, subject, details.                                                                                                               |
| `create_organization()` | `(organization_name text, country_code text, request_id uuid) → uuid`; the only client write path.                                                                                         |

Locale, timezone and currency are not stored and not derived from the
country. They will be separate settings when onboarding defines them.

### Membership identity and uniqueness

- `memberships_identity_check`: a membership needs a `user_id`, unless it is
  an email invitation (`invited_email` set) whose status is `invited` or
  `removed`. An email-only invitation can therefore be removed, but it cannot
  become `active` or `suspended` without an account.
- `memberships_current_user_key`: unique `(organization_id, user_id)` where
  `status <> 'removed'`. That gives at most one current membership per account
  and organization, while removed rows remain as history.
- `memberships_pending_email_key`: unique `(organization_id, invited_email)`
  for pending email-only invitations.
- `user_id` may be set once (linking an email invitation to an account) and
  never changed.
- `invited_email` is fixed at insertion (decision 10). It cannot be changed,
  cleared or added later, including after the invitation is linked to an
  account. A mistaken invitation is set to `removed` and a new invitation is
  created; the removed row keeps its original address as history.
- The database cannot match an email invitation against an existing account
  holding the same address. The future acceptance workflow must check this.

### Invariants and enforcement

| Invariant                                            | Enforcement                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization and first active Owner created together | One transaction in `create_organization()`; a deferred constraint trigger rejects, at commit, any organization without an active Owner (all roles).                                                                                                                                |
| Only verified users create organizations             | `create_organization()` requires `auth.users.email_confirmed_at IS NOT NULL` and `deleted_at IS NULL`, independently of the Auth "Confirm email" setting. This also rejects anonymous users, who have no email.                                                                    |
| Retries and double submissions create nothing new    | `request_id` unique per creator; `ON CONFLICT DO NOTHING`, then the existing organization is returned. Reuse with a different name or country → `23505`.                                                                                                                           |
| At least one active Owner remains                    | `BEFORE UPDATE` trigger. It locks the organization row, then the other active Owners: READ COMMITTED sees the latest state; REPEATABLE READ fails with a serialization error.                                                                                                      |
| Removed memberships are history                      | Any change to a removed membership is rejected. Rejoining inserts a new row.                                                                                                                                                                                                       |
| No deletion, moving or rewriting of authorship       | Row deletes of organizations and memberships are rejected for all roles, as is `TRUNCATE` of either table or the audit log. A membership keeps its organization, creation time and invitation address. An organization keeps `created_by`, `creation_request_id` and `created_at`. |
| Audit evidence                                       | Triggers record `organization.created`, `membership.created` and `membership.changed` (role and status before and after; `account_linked`). Audit rows are immutable.                                                                                                              |

The triggers protect against data changes (DML) by any role, including
`service_role` and future server-side workflows. They do not stop schema
changes (DDL) such as `DROP TABLE`. Those remain owner-level operations,
controlled by migration review.

### Authorization and RLS

- **Default deny.** RLS is enabled on all four tables. `anon` has no table
  privileges. `authenticated` has `SELECT` only on `organizations` and
  `memberships`, and no access to `private`. There are no write policies.
  Supabase's default grants to API roles are revoked explicitly.
- **Read policies:**
  - A user reads their **own** memberships, in any status, including history.
  - A user reads an organization only while their membership in it is
    **active**.
- **No recursion.** The organizations policy reads `memberships`, whose policy
  (`user_id = auth.uid()`) reads nothing else.
- **Member list (decision 3), not implemented in this slice.** The future
  Owner/Manager policy on `memberships` must not query `memberships` inline,
  because that would recurse. It should call a `private`, `SECURITY DEFINER`,
  `STABLE` helper with an empty `search_path`, which checks the caller's
  active Owner or Manager membership.
- **`create_organization()`** is `SECURITY DEFINER` with `search_path = ''`
  and fully qualified names. `EXECUTE` is revoked from `public` and `anon` and
  granted to `authenticated`.
  - The owner is always `auth.uid()`.
  - No organization or user id is accepted from the client.
  - It reads `auth.users` only for the caller's own row.
- **Trigger functions** live in `private`, with an empty `search_path` and
  `EXECUTE` revoked from `public`. They are `SECURITY DEFINER` only where they
  must see all rows: the Owner guard, the initial-Owner check and the audit
  writers.
- **No staff bypass.** Sollelio internal staff have no memberships and no RLS
  bypass.
- **No service role for clients.** The browser and normal user operations
  never use the service role.

### Auth user references

`organizations.created_by` and `memberships.user_id` reference `auth.users`
with `ON DELETE RESTRICT`, which preserves authorship and history
(decision 6).

- **Hard deletion is blocked.** Deleting a referenced user, from the Dashboard
  or the Admin API, fails with `23503` (a foreign key violation).
- **Soft deletion still works.** Supabase Auth's soft delete keeps the row, and
  `create_organization()` then refuses that user.
- **Erasure and anonymisation remain open.**

`audit_events.actor_user_id` has no foreign key, so audit evidence never
blocks Auth operations.

### Audit data minimisation

Audit details hold roles, statuses and flags only. They contain no
organization names, countries, email addresses or invited addresses.
`actor_user_id` is the only personal identifier.

### Errors (for the application layer)

| SQLSTATE | Meaning                                                                   |
| -------- | ------------------------------------------------------------------------- |
| `42501`  | Not authenticated, unverified, soft-deleted or anonymous, or no privilege |
| `22023`  | Invalid name, invalid country code, or missing `request_id`               |
| `23505`  | `request_id` reused for a different organization                          |
| `23514`  | Owner, lifecycle, deletion, authorship or audit protection                |

## Verification (2026-11-14, isolated database only)

- **Environment:** a disposable Supabase Postgres 17.11.0.004 container on an
  internal Docker network, with no published ports, removed afterwards.
  - Its `auth` schema came from **GoTrue v2.197.0's own migrations** (75
    applied), the same Auth version the remote reports.
  - `auth.uid()`, `auth.jwt()` and `auth.users` are therefore the real Supabase
    Auth objects. Nothing is mocked.
  - In this database `postgres` is not a superuser, has `BYPASSRLS`, and has
    `SELECT` and `REFERENCES` on `auth.users`.
- **Migration:** applied as `postgres` in one transaction.
- **pgTAP:** `supabase/tests/database/organizations_and_memberships.test.sql`,
  97 of 97 passing (2026-11-16). This includes changing, clearing or adding an
  invitation address before and after linking (all rejected), and correcting a
  mistaken invitation by removing and recreating it.
- **Defect found and fixed (2026-11-16).** The first version of
  `memberships_identity_check` allowed an account-less membership only with
  status `invited`. That made removing an email-only invitation impossible,
  which the remove-and-recreate rule needs. The check now also allows
  `removed`.
- **Concurrency (two real sessions):**
  - Same `request_id` submitted concurrently: one organization, one
    membership.
  - Two Owners demoted concurrently: the second fails (READ COMMITTED:
    last-Owner error; REPEATABLE READ: serialization failure); one active
    Owner remains.
- **`plpgsql_check`:** no issues in all eight PL/pgSQL functions.
- **Rollback:** the rollback below ran with data present and removed every
  object. Re-applying then passed 97 of 97.

**Remaining limitations:**

- **API layer not exercised.** Requests were not sent through PostgREST or
  with signed JWTs. Tests switch role and claims the way PostgREST does after
  verifying a token.
- **Exact image build.** The remote runs PostgreSQL 17.11, the same version
  tested. The exact Supabase image build was not compared.

## Remote prerequisites (read-only)

**Verified by Claude through the public APIs with the publishable key
(2026-11-14):**

- Auth is GoTrue v2.197.0.
- The email provider is enabled, auto-confirm is off (confirmation required),
  and anonymous sign-ins are off.
- `organizations`, `memberships`, `audit_events` and `create_organization` do
  not exist in the Data API schema cache.

**Verified by Product in the Dashboard SQL editor (reported 2026-11-16):**

- PostgreSQL 17.11.
- The `private` schema does not exist.
- `postgres` has `SELECT` and `REFERENCES` on `auth.users`.
- `supabase_migrations.schema_migrations` does not exist, so there is no remote
  migration history. The CLI creates it on the first push.

`gen_random_uuid()` is built into PostgreSQL 13 and later.

## Impact, rollback and recovery

- **The first remote application is effectively a production change.** It is
  additive, and touches nothing existing except foreign keys to `auth.users`.
- **It fails safely.** The CLI applies the migration in one transaction; if
  any statement fails, nothing is applied. The known conflict, an existing
  `private` schema, has been ruled out.
- **The first push creates migration history.** It creates
  `supabase_migrations.schema_migrations` and records this version.
- **Auth user hard deletion becomes restricted** for users with organizations
  or memberships.
- **Prefer a forward fix.** With data present, correct problems with a new
  migration.
- **Manual rollback**, only while no real data exists; it destroys all
  organization, membership and audit data. After running it, mark the version
  reverted with
  `supabase migration repair --status reverted 20261114133030 --remote`.

```sql
begin;
drop policy "Active members can read their organizations" on public.organizations;
drop function public.create_organization(text, text, uuid);
drop table private.audit_events;
drop table public.memberships;
drop table public.organizations;
drop table private.country_codes;
drop function private.record_audit_event(uuid, text, uuid, jsonb);
drop function private.audit_organization_insert();
drop function private.audit_membership_change();
drop function private.guard_organization_change();
drop function private.guard_membership_change();
drop function private.require_initial_owner();
drop function private.prevent_audit_mutation();
drop function private.prevent_truncate();
drop type public.membership_status;
drop type public.membership_role;
drop schema private;
commit;
```

## Deployment

Product applied the migration to `events-v2` after accepting this record and
verified it there (reported 2026-11-17). The application first uses
`create_organization()` in onboarding (ADR 0006).

## Still open

- **Owner/Manager member-list policy** (decision 3): approach above; build it
  with the screen that needs it.
- **Membership transitions other than "removed is final"** (TF §10.2).
- **Invitation workflow:** delivery, expiry, acceptance (including matching an
  invited address to an existing account), revocation.
- **Account erasure and anonymisation** (decision 6) and organization
  offboarding (decision 7).
- **Audit retention and read access.**
- **Rate limiting** (decision 9).
- **Database test gate** for future steps and CI (TF §10.6).
