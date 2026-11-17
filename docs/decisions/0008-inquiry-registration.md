# 0008 — Inquiry registration

**Status:** Accepted (Increment 2, Step 2.1). Migration `20261117190000`
applied to `events-v2` and verified (see "Remote application and
verification").
**Date:** 2026-11-17 (accepted 2026-11-17)

## Context

UX Blueprint §6 asks that an Inquiry preserve its source, original
message, receipt time and authorship, and stay distinct from Contacts and
Events. §3 says the Inquiry list must not become a second sales funnel.
Technical Foundation §3.3 limits Members to assigned resources, and §5
requires no duplicate effects and no cross-tenant access. ADR 0004 provides
organizations, memberships and the audit log; ADR 0007 the shell and the
active organization.

Product decisions for this step (2026-11-17):

1. Inquiry, Contact and Event stay separate. This step builds manual
   registration, list, detail, close and reopen; Contacts and prospective
   Events come later.
2. A verbatim client message and a staff-written summary are distinct; at
   least one is required. Everything else may be missing.
3. Original intake is preserved and never silently overwritten.
4. Active Owners and Managers have access; Members need a future assignment
   mechanism.
5. Eight sources: phone, WhatsApp, email, social media, in person, website,
   referral, other.
6. Status is open or closed only. Closing an inquiry implies nothing about
   any Event.
7. Instants are stored in UTC; event dates are date-only. The organization
   time zone remains a future setting.

## Decision

### Schema

Migration `supabase/migrations/20261117190000_inquiries.sql`.

| Column                                                 | Rule                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `organization_id`                                      | Required; never changes                                                 |
| `source`                                               | `inquiry_source` enum (8 values)                                        |
| `client_message`                                       | Verbatim, 1–10 000 characters, not blank                                |
| `staff_summary`                                        | Staff-written, 1–5000 characters, not blank                             |
| —                                                      | At least one of the two (`inquiries_description_check`)                 |
| `received_at`                                          | `timestamptz`; from 2000; at most one hour after registration           |
| `requester_name`, `requester_phone`, `requester_email` | Optional, trimmed, as given; not a Contact                              |
| `requested_event_date`                                 | Optional `date` (2000–2100)                                             |
| `estimated_guests`                                     | Optional, 1–100 000                                                     |
| `status`                                               | `open` or `closed`                                                      |
| `close_reason`, `closed_at`, `closed_by`               | All set when closed, all null when open (`inquiries_closure_check`)     |
| `created_by`, `creation_request_id`, `created_at`      | Authorship; unique `(organization_id, created_by, creation_request_id)` |

Close reasons: spam, duplicate, not pursued, registered in error. Index
`(organization_id, status, received_at desc, id desc)` serves the lists.

### Invariants

| Invariant                                   | Enforcement                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Original intake and authorship never change | `private.guard_inquiry_change` (BEFORE UPDATE): every column except the closure fields is frozen, for all roles |
| Never deleted                               | The same trigger rejects DELETE; `prevent_truncate` rejects TRUNCATE                                            |
| A description exists                        | Table check and `create_inquiry` validation                                                                     |
| Retries create nothing new                  | Unique request id; `ON CONFLICT DO NOTHING`, then the same inquiry; different intake → `23505`                  |
| Closing is complete and reversible          | Closure check; `close_inquiry` / `reopen_inquiry`; history in the audit log                                     |
| No direct client writes                     | No INSERT, UPDATE or DELETE grants or policies for API roles                                                    |

### Authorization

- **One predicate:** `authz.can_access_inquiries(organization_id)`. It is true
  only for a verified (`email_confirmed_at`), non-deleted, non-anonymous user
  with an **active Owner or Manager** membership in that organization.
  `SECURITY DEFINER`, `STABLE`, empty `search_path`; it reads only the
  caller's own rows.
- **Why a new `authz` schema:** RLS runs with the caller's privileges and the
  caller cannot read `auth.users`, so the verification check needs a definer
  function. Putting it in `private` would have broken ADR 0004's invariant that
  `private` is closed to API roles (its tests caught this). `authz` holds only
  this predicate; `authenticated` has usage on it and execute on the function;
  it is not exposed by the Data API.
- **Read:** one SELECT policy, `using (authz.can_access_inquiries(organization_id))`.
  `anon` has no privileges; `authenticated` has SELECT only. `service_role`
  keeps the full table rights that Supabase's default privileges give it in
  `public` (as for the ADR 0004 tables); it bypasses RLS but is still bound
  by the guard trigger, so it cannot change intake or delete either.
- **Write:** `public.create_inquiry`, `public.close_inquiry`,
  `public.reopen_inquiry`: `SECURITY DEFINER`, empty `search_path`, owned by
  `postgres`. EXECUTE is revoked from `PUBLIC` and `anon` and granted to
  `authenticated`; `service_role` also has it through Supabase's default
  privileges, but without a user identity (`auth.uid()` is null) every call
  is refused. Each function checks the predicate. The author is always
  `auth.uid()`. The organization id comes from the server-resolved active
  organization and is re-checked in the database.
- **Not found and forbidden are the same error** (`42501`) for close and
  reopen, so inquiry ids from other tenants reveal nothing. Both functions
  lock the row before checking access; for a forbidden caller the lock lasts
  only until the function raises, and nothing is read back or changed.
- **The helper itself** can be called by any signed-in user with any
  organization id (only through SQL, never the Data API) and answers only
  whether _that caller_ has access; it reveals nothing about other users or
  whether an organization exists. It does not check Supabase Auth bans
  (`banned_until`); a banned user's existing session is bounded by token
  expiry, as everywhere else in the application.
- **Application:** every page and Server Function resolves the active
  organization and role on the server (ADR 0007). Queries also filter by the
  active organization, so a viewer of several organizations sees one at a
  time; an inquiry of another organization is "not found". Members see a
  "no access" page.

| SQLSTATE | Meaning                                                  |
| -------- | -------------------------------------------------------- |
| `42501`  | Not allowed, not found, or not authenticated             |
| `22023`  | Invalid input (no description, length, range, no reason) |
| `23505`  | Request id reused for different intake                   |
| `23514`  | Protection: immutable intake, no delete, closure rules   |

### Audit

Actions `inquiry.created` (`{"source"}`), `inquiry.closed` (`{"reason"}`) and
`inquiry.reopened` (`{"previous_reason"}`) are added to
`audit_events_action_check`. No message text, names, phone numbers or email
addresses are recorded. Retries and repeated close or reopen add nothing.

### Time

- `received_at` is an instant in UTC. "Agora" lets the database stamp
  `now()` (and keeps it on retries). "Outra data e hora" is entered in the
  device's time zone, sent with its IANA name, and converted to UTC on the
  server (DST handled without a dependency).
- Instants are shown in the device's time zone; event dates are shown
  date-only, with no time-zone conversion.

### Interface

- Routes `/inquiries` (open and closed tabs, newest first, up to 100 with a
  notice beyond), `/inquiries/new`, `/inquiries/[id]`. Pedidos is a real
  destination in the sidebar and bottom bar.
- **Form:** source chips; "Mensagem do cliente" and "Resumo da equipa" with
  the at-least-one rule; "Agora" or another date and time; requester and
  event details optional. One idempotency key per visit (rendered per
  request), kept on every retry. Values are kept and focus moves to the first
  problem after an error.
- **Detail:** the verbatim message in Newsreader (ADR 0002, "a client's own
  words") with line breaks kept; the staff summary labelled as not the
  client's words; requester details with `tel:` and `mailto:` links; close
  (reason required, "does not cancel any event") or reopen.
- **Home:** the real "Registar primeiro pedido" action; once inquiries exist,
  "Registar pedido" and "Ver pedidos"; "Atenção" shows "N pedidos em aberto"
  when any are open (no ranking; Blueprint §12.6 stays open).
- New primitive: `Textarea` (Input styling).

## Deliberately deferred

- Contacts and linking (step 2.2); prospective Events (step 2.3).
- Editing or annotating an inquiry after registration; a mistaken one is
  closed as "registered in error" and registered again.
- Search, pagination beyond 100, assignment, Member access, reference
  numbers, attachments, public intake, channel integrations, notifications.
- Organization time zone; erasure or anonymisation of personal data in
  inquiries (needed before the commercial beta).

## Verification before application (2026-11-17, isolated database)

- **Environment:** disposable Supabase Postgres 17.11.0.004 container on an
  internal Docker network with no published ports, `auth` schema from GoTrue
  v2.197.0's migrations, removed afterwards. No existing local stack was
  used or touched. `postgres` is not a superuser and has `BYPASSRLS`, as in
  ADR 0004.
- **pgTAP:** `organizations_and_memberships.test.sql` 97 of 97 (unchanged)
  and `inquiries.test.sql` 82 of 82, in the same database after both
  migrations. Covered: privileges; Owner and Manager access; refusal for
  Member, suspended, unverified, soft-deleted and anonymous-sign-in
  accounts, other tenants, forged and unknown organization ids, and anon;
  validation; idempotency (including "now" retries); RLS reads per role;
  close and reopen, their retries and their authorization; immutability of
  every intake column for privileged sessions; no delete or truncate; audit
  content without personal data.
- **Concurrency:** two committed sessions with the same request id → one
  inquiry, one audit event, the same id returned to both.
- **`plpgsql_check`:** no issues in the five PL/pgSQL functions.
- **Rollback rehearsal** with committed data: every inquiry object removed;
  ADR 0004 tests still 97 of 97; migration re-applied cleanly; inquiry tests
  82 of 82 again.
- **Application:** unit tests for validation, time conversion (including
  DST), idempotent submission and retries, error mapping and access; a
  contract test that the RPC argument names and enum values match the
  migration. Screens checked in headless Chrome at 390 and 1440 px, light and
  dark, with fixture data: no horizontal overflow, focus on errors, stable
  request id across a failed retry, device time-zone display, keyboard order.
- **Not verifiable locally:** PostgREST and the application against a real
  database (the application is pinned to `events-v2`, ADR 0003). See the
  remote verification and manual test below.

## Migration impact and recovery

- **Additive.** New types, table, schema `authz`, functions and policy. The
  only change to an existing object is replacing `audit_events_action_check`
  with a superset. Re-adding it validates the existing audit rows (all
  within the superset) under a brief ACCESS EXCLUSIVE lock on
  `private.audit_events`. One transaction; any failure applies nothing.
- **Exact catalog effect** (isolated database, before and after): 33
  objects added and one replaced. Added: schema `authz`; types
  `inquiry_source`, `inquiry_status`, `inquiry_close_reason`; table
  `public.inquiries` with 15 constraints and 3 indexes; functions
  `authz.can_access_inquiries`, `public.create_inquiry`, `close_inquiry`,
  `reopen_inquiry`, `private.guard_inquiry_change`, `audit_inquiry_change`;
  triggers `guard_inquiry_change`, `audit_inquiry_change`, `prevent_truncate`
  on `inquiries`; one policy. Replaced: `audit_events_action_check`.
  Nothing else in `public`, `private` or `authz` changes.
- **Prefer a forward fix** once real inquiries exist.
- **The rollback is partial by design.** It removes every inquiry object and
  every inquiry, but it cannot return the database to its exact previous
  state once any inquiry has been audited:
  - Inquiry audit events stay. They are append-only (ADR 0004): DELETE and
    UPDATE are rejected by `prevent_audit_mutation` and TRUNCATE by
    `prevent_truncate`, and they must not be removed to make a rollback
    tidy. Their `subject_id` then points at inquiries that no longer exist
    (no foreign key, by design).
  - The previous `audit_events_action_check` therefore cannot be restored:
    re-adding the three-action definition fails with `23514` ("violated by
    some row"). The superset stays. It is harmless: after rollback nothing
    writes `inquiry.*` actions.
  - A `NOT VALID` narrower constraint would be possible but is not part of
    the procedure; it would leave an unvalidated constraint describing rows
    that contradict it.
  - Before any inquiry exists (and so before any inquiry audit event), the
    previous definition could also be restored, but this is not needed.
- **Manual rollback SQL** (destroys every inquiry; leaves the audit events and
  the extended action check):

```sql
begin;
drop policy "Owners and managers can read their organization's inquiries" on public.inquiries;
drop function public.create_inquiry(uuid, uuid, public.inquiry_source, text, text, timestamptz, text, text, text, date, integer);
drop function public.close_inquiry(uuid, public.inquiry_close_reason);
drop function public.reopen_inquiry(uuid);
drop table public.inquiries;
drop function private.guard_inquiry_change();
drop function private.audit_inquiry_change();
drop function authz.can_access_inquiries(uuid);
drop schema authz;
drop type public.inquiry_close_reason;
drop type public.inquiry_status;
drop type public.inquiry_source;
commit;
```

Then mark the version reverted with
`supabase migration repair --status reverted 20261117190000 --remote`, which
is itself a remote write. Rehearsed with committed inquiry and audit data:
the catalog afterwards differs from the pre-migration state only in the
extended action check; re-applying the migration produces a catalog
identical to the first application and passes 82 of 82 again.

- **Deployment order:** apply the migration before deploying application code
  that uses it; until then, Pedidos pages would fail to load.

## Remote preflight (2026-11-17, read-only)

Run with `supabase db query --remote=icgsujzpcafqnqjozslj --read-only`, which
executes as `supabase_read_only_user` in a read-only transaction, and one
anonymous GET to the Data API. Nothing was written.

- **Target:** `events-v2` (`icgsujzpcafqnqjozslj`), us-west-2,
  ACTIVE_HEALTHY, PostgreSQL 17.11 (17.11.0.019). The login also sees other
  projects, so every command names the ref explicitly.
- **Migration history:** only `20261114133030 organizations_and_memberships`.
  Pending: exactly `20261117190000_inquiries.sql`.
- **No conflicting objects:** no schema `authz`, no `public.inquiries`, no
  `inquiry*` types, functions or policies.
- **Audit constraint:** the ADR 0004 definition (three actions), validated.
  Existing audit events: one `organization.created`, one
  `membership.created`.
- **Roles and owners:** `postgres` is not a superuser, has `BYPASSRLS`, is a
  member of `authenticated` and can read `auth.users`; it owns `private`,
  `private.audit_events`, `public.memberships` and the shared private
  functions. `auth.users` has `email_confirmed_at`, `deleted_at` and
  `is_anonymous`.
- **Default privileges:** only for schema `public` (roles `postgres` and
  `supabase_admin`); none global. `pg_graphql` is not installed.
- **Data API:** exposes only `public` and `graphql_public` (`PGRST106` for
  `authz` and `private`).
- **Drift:** a catalog snapshot of `public`, `private` and `authz` (objects,
  owners, ACLs, default privileges, constraints, triggers, policies) is
  byte-identical to the isolated database on which the migration and both
  test suites ran.
- **`supabase db push --dry-run` was not run.** Without `--password`, this
  CLI version (3.1.0) needs the `database_write` scope to create a login
  role on the remote database, which is a write. A non-mutating dry run
  needs the database password: `supabase db push --remote=icgsujzpcafqnqjozslj --dry-run --skip-vault`
  with `SUPABASE_DB_PASSWORD` set.

## Remote application and verification (2026-11-17)

- **Applied** by Product to `events-v2` (`icgsujzpcafqnqjozslj`) with the
  Supabase CLI, which reported success.
- **Post-migration verification (read-only,** `supabase db query
--remote=icgsujzpcafqnqjozslj --read-only`, as `supabase_read_only_user`
  in read-only transactions, plus anonymous Data API requests):
  - Migration history holds exactly `20261114133030` and `20261117190000`.
    The 38 recorded statements of `20261117190000` are identical, in order
    and content, to `supabase/migrations/20261117190000_inquiries.sql`
    (comments and whitespace normalised).
  - The catalog of `public`, `private` and `authz` (objects, owners, ACLs,
    default privileges, constraints, triggers, policies) is byte-identical
    to the isolated database on which both test suites passed, and all 15
    function definitions in those schemas hash identically.
  - The change between the pre-migration snapshot of `events-v2` and the
    deployed state is exactly the migration's own diff: 33 objects added,
    `audit_events_action_check` replaced. ADR 0004 objects are unchanged.
  - The audit check accepts the three original actions and the three
    inquiry actions.
  - The Data API refuses `authz` (`PGRST106`; only `public` and
    `graphql_public` are exposed) and gives `anon` no access to
    `inquiries` (`42501`).
  - `public.inquiries` was empty before manual testing.
- **Controlled manual test** by Product with the existing account (one
  inquiry registered, closed and reopened). Audit events afterwards,
  confirmed read-only: `organization.created` 1, `membership.created` 1,
  `inquiry.created` 1, `inquiry.closed` 1, `inquiry.reopened` 1. The
  inquiry exists once and is open. This exercises the three write
  functions through the application and PostgREST with a real session. No
  separate review of the screens on `events-v2` is recorded here.
