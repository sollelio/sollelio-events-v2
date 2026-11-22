# 0009 — Versioned public forms and public Inquiry intake

**Status:** Proposed (Increment 2, Step 2.2a); formal acceptance pending.
Migration `20261118120000` applied to `events-v2` on 2026-11-20 and verified
read-only (catalog, function definitions and role privileges identical to the
tested reference). `public_form_service` is still NOLOGIN, so public forms are
not yet live.
**Date:** 2026-11-18 (server-only role: 2026-11-20)

## Context

Prospective clients must be able to send inquiries without signing in,
through an organization-specific link and later through the organization's
own website. Organizations must be able to configure their own questions,
and the same capability must later serve other purposes (event briefings,
follow-up questionnaires). ADR 0008 defines the Inquiry domain.

Approved model and corrections (2026-11-18):

1. Organization-owned forms with distinct purposes; draft and immutable
   published versions; typed questions; immutable submitted answers.
2. Public links point to forms, not versions.
3. Published Inquiry forms create Inquiries; other answers stay with their
   form version; no assumption that every submission is an Inquiry.
4. Public submissions go through a controlled Next.js server endpoint, with
   a narrowly scoped, server-only capability. No privileged credential
   reaches clients; RLS and authorization are not weakened. On 2026-11-20
   this was settled as a dedicated least-privilege PostgreSQL role used only
   by the Next.js server (replacing a shared-secret-gated `anon` function).
5. Default Inquiry form: message required; at least one of email or phone;
   name, event date and guests optional. Organizations may be stricter.
6. Core field bindings and their types are validated when publishing.
7. A bounded compatibility window for submissions against a previous
   version.
8. Draft editing and publishing only through server/database operations.
9. Anti-abuse protection beyond per-link quotas; no minimum completion time;
   no silent discarding of legitimate submissions.
10. Manual Inquiry registration, audits and tenant isolation unchanged.

No form editor in this step; the default form works without it.

## Decision

### Model

Migration `supabase/migrations/20261118120000_public_forms.sql`.

| Entity                | Rules                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forms`               | Organization, `purpose` (`inquiry` only), name. One form per purpose and organization for now. Never deleted                                                   |
| `form_versions`       | Numbered; draft while `published_at` is null (at most one per form); publishing is one-way; published versions are immutable                                   |
| `form_questions`      | `kind`: short text, long text, number, date, single choice, multiple choice; `required`; position 1–30; choice options (≤ 20, unique keys); optional `binding` |
| `public_form_links`   | Form (not version); 22-character random key (122 bits); at most one active per form; revoked links stay                                                        |
| `form_submissions`    | Link, answered version, request id, payload hash. Immutable                                                                                                    |
| `form_answers`        | One typed value (`text`, `number`, `date` or `choices`) per answered question. Immutable                                                                       |
| `inquiries` (changed) | `submission_channel` (`staff_entry` or `public_form`), `form_submission_id`; author and source empty only for `public_form`                                    |

- Composite foreign keys make cross-organization links impossible, and tie
  every answer to a question of the version its submission answered.
- `binding` maps a question to an Inquiry column (name, email, phone,
  message, event date, guests), at most once per version. Bound answers fill
  the Inquiry columns, which stay authoritative; all answers are also kept
  as form answers. Unbound answers exist only as form answers.
- Publishing an Inquiry form requires a required long-text message, an
  email or phone question, and the matching kind for every binding. Each
  submission requires at least one of email or phone.
- Manual registration (`create_inquiry`) is unchanged; its rows are
  `staff_entry`, with author and source required.

### Default form and links

- `enable_public_inquiry_form(organization)` (Owner/Manager) creates the
  default form on first use, publishes version 1 through the same validation,
  and creates an active link if none exists. Calling again changes nothing.
- Default questions (pt-PT, all bound): Nome, Email, Telefone, Mensagem
  (required), Data pretendida, N.º de convidados.
- `rotate_public_form_link` replaces the key (the old one stops working);
  `revoke_public_form_link` disables it. Pedidos shows a card to enable,
  copy, open, rotate or disable the link.

### Server-only database role

The public functions are not callable through the Data API at all. The
Next.js server reaches them with its own PostgreSQL login.

- **Role `public_form_service`** (created by the migration): `NOLOGIN`,
  `NOINHERIT`, no superuser, `CREATEDB`, `CREATEROLE`, replication or
  `BYPASSRLS`; connection limit 10; role defaults `statement_timeout = 5s`,
  `lock_timeout = 3s`, `idle_in_transaction_session_timeout = 10s`. It is a
  member of no role and no role inherits it. It is not granted to
  `authenticator`, so no JWT can switch the Data API to it.
- **Schema `form_service`** (not exposed by the Data API) holds
  `get_public_form(p_public_key)` and `submit_public_form(p_public_key,
p_form_version_id, p_request_id, p_fingerprint, p_answers)`, both
  `SECURITY DEFINER` with an empty `search_path`. `public_form_service` has
  USAGE on the schema and EXECUTE on the two functions, and no other grant.
  EXECUTE is revoked from PUBLIC, `anon`, `authenticated` and
  `service_role`.
- **Login is an operator step**, never a migration: `alter role
public_form_service with login password '…'` per environment, run once
  with explicit authorization. No password exists in the repository,
  migrations or logs. Until then, and while the server variables are
  missing, public forms show "Formulário indisponível".
- **Connection:** `src/lib/public-forms/database.ts` (server-only) uses
  `postgres` 3.4.9 (no dependencies) through the Supabase shared pooler in
  transaction mode (port 6543, user `public_form_service.<project-ref>`,
  IPv4 on every plan). It disables prepared statements, verifies TLS
  against the configured CA and host name, keeps at most 2 connections per
  server instance, and closes idle ones after 20 s. The connection string
  is accepted only if its user is `public_form_service`, so a privileged URL
  cannot be configured by mistake.
- **Rejected:** the service-role key, which bypasses RLS on everything; the
  JWT signing secret, which can mint any role; and the shared-secret-gated
  `anon` functions, which were still anonymously executable.

Effective privileges (verified, including inherited and PUBLIC):

| Object                            | `public_form_service` can                                                     |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Functions                         | Execute exactly the two `form_service` functions (outside the system catalog) |
| Tables, views, sequences, columns | Nothing it can reach                                                          |
| Schemas                           | USAGE on `form_service` and, through PUBLIC, `public`; CREATE nowhere         |
| Database                          | CONNECT and TEMPORARY, both through PUBLIC; no CREATE                         |
| Roles                             | Become no other role; alter neither its attributes nor its connection limit   |
| Default privileges                | None grant future objects to it or to PUBLIC                                  |

Residual, inherent to PostgreSQL and accepted:

- It can create temporary tables in its own session (PUBLIC's TEMPORARY).
- It can change its own session defaults (`alter role … set`, or `set`).
  The timeouts guard against our own runaway queries, not against a holder
  of the password. The connection limit, which it cannot change, bounds
  that case.
- It can read the system catalog (object names and definitions), as every
  role can.
- **Future functions** created in `public` are executable by PUBLIC unless
  revoked, which every migration here does explicitly. A function
  forgotten that way would become executable by this role. The
  effective-privilege pgTAP test lists everything the role can execute
  and fails on any addition.

### Anti-abuse

| Layer               | Where    | What                                                                                                                  |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| Server-only role    | Database | Only the Next.js server holds a login that can call the public functions                                              |
| Signed render token | Next.js  | HMAC over link, version and render time: maximum 24 h; no minimum completion time; cannot be forged                   |
| Honeypot            | Next.js  | A weak signal only: a filled hidden field asks for one more click and is then removed; it never discards a submission |
| Client limit        | Database | 5 per 10 minutes and 20 per day per client fingerprint, **only with a trusted client address** (below)                |
| Link limit          | Database | 20 per hour and 100 per day per link, always; serialised per link so concurrent requests stay exact                   |
| Payload limits      | Both     | Answers ≤ 64 KB; short text ≤ 2,000, long text ≤ 5,000; only the version's questions; typed values                    |
| Retries             | Database | Same request id and answers: accepted once; different answers: refused                                                |

- **Feedback is always truthful.** A rate-limited submission is not stored
  and says so ("O pedido não foi enviado…"); an expired or invalid token
  issues a fresh one; a filled honeypot says "O pedido ainda não foi
  enviado…". In every case the answers stay in the form and the request id
  is reused. Only a real submission reaches the confirmation page.

### Client address and privacy

- `PUBLIC_FORMS_TRUSTED_PROXY_HOPS` (1–5) names how many trusted proxies
  append to `X-Forwarded-For`. The client is the entry that many places from
  the right; anything further left is ignored. `X-Real-IP` is never used.
- **Unset (the default until hosting is decided):** no address is trusted,
  no fingerprint is sent, and only the per-link limits apply.
- **Hosting guarantee required before setting it:**
  - The application must be reachable only through those proxies.
  - The outermost proxy must overwrite or append the header from the TCP
    connection.
  - **Vercel as the outermost edge:** `1`.
  - **Behind another CDN:** the CDN must be a verified proxy, or every
    client looks the same.
  - **`next start` exposed directly must not set it.** Verified: Next.js
    passes a client-supplied header through unchanged, so a spoofed value
    would be trusted.
- **Fingerprints are pseudonymous personal data:**
  - a keyed HMAC of the address; the address is never stored
  - kept in `private.form_rate_events`, unreadable by API roles
  - pruned after two days on later submissions
  - changing the signing secret makes old fingerprints unlinkable

  The privacy notice must cover abuse prevention (legitimate interest),
  pending legal review.

### Versions

A submission may answer the current published version, or a previous one
for **24 hours** after its successor was published (`SF002` otherwise).

### Security summary

- **anon:** nothing on forms. **authenticated:** SELECT on the six form
  tables (RLS: `authz.can_manage_forms`, verified active Owner or Manager)
  and execute on enable, rotate and revoke; no direct writes.
  **public_form_service:** the two public functions only.
- **Writes** only through `SECURITY DEFINER` functions with an empty
  `search_path`; drafts and publishing are database operations (the editor
  will add draft operations).
- **Immutability:** triggers reject changes to published versions and their
  questions, submissions, answers, link keys, and deletion of forms, links,
  submissions and answers; TRUNCATE is rejected. The inquiry guard also
  freezes `submission_channel` and `form_submission_id`.
- **Audit:**
  - `form.published` (version), `public_form_link.created` and
    `public_form_link.revoked`.
  - Public inquiries appear as `inquiry.created` with actor role
    `public_form_service` (the login role) and no user.
  - No answers or contact details are recorded.

### Errors

| SQLSTATE | Meaning                                                      |
| -------- | ------------------------------------------------------------ |
| `42501`  | Not allowed (wrong role, or staff operation not allowed)     |
| `SF001`  | Link unknown, revoked or without a published version         |
| `SF002`  | Version not accepted (outside the window, or another form)   |
| `SF003`  | Rate limited                                                 |
| `22023`  | Invalid answers or draft                                     |
| `23505`  | Request id reused with different answers                     |
| `57014`  | Statement timeout (5 s); shown as unavailable, safe to retry |

## Deliberately deferred

- The form editor (drafts, questions, publishing) — the next step.
- Website embedding (needs allowed origins and a frame policy), CAPTCHA,
  notifications to staff or clients, organization branding, conditional
  logic, uploads, further purposes.
- Retention and anonymisation of submissions, answers and inquiries.

## Verification (2026-11-20, isolated)

- **Environment:**
  - disposable Supabase Postgres 17.11.0.004 on an internal Docker network
  - `auth` from GoTrue v2.197.0
  - PgBouncer 1.25.2 in transaction mode with `max_prepared_statements = 0`
    and client TLS from a test CA, published on 127.0.0.1 only
  - all removed afterwards
- **pgTAP:** `organizations_and_memberships` 97/97, `inquiries` 82/82
  (unchanged) and `public_forms` 108/108. These include the
  effective-privilege audit of `public_form_service` and refusal of `anon`
  and `authenticated`.
- **Real connections**, from Node with the app's `database.ts`, as
  `public_form_service`, through the pooler with TLS:
  - **Login:** refused while NOLOGIN. The pooler's auth lookup
    (`pgbouncer.get_auth`) returns the role only once LOGIN is enabled.
  - **TLS:** the right CA connects. Another CA, a host-name mismatch and
    plaintext are refused.
  - **Identity and settings:** `session_user` is `public_form_service`;
    the timeouts apply (`pg_sleep(6)` is cancelled).
  - **Reads and submissions:** the form is read; submission, retry,
    different answers (23505) and invalid answers (22023) behave as
    designed. 50 consecutive calls succeed without prepared statements.
  - **Concurrency:** the same request from two connections at once gives
    one submission. At the client limit, two simultaneous requests accept
    exactly one.
  - **29 unauthorized statements refused with 42501:**
    - reading inquiries, answers, organizations, memberships, audit, rate
      events, `auth.users` and `pg_authid`
    - direct inserts
    - staff, private and `authz` functions
    - creating tables, schemas and functions
    - `set role` to postgres, anon, authenticated or service_role, and
      `set session authorization`
    - altering its own connection limit
    - `pg_read_file`, `copy … to program`, `extensions` and `graphql`

    Allowed, as documented: a temporary table, and changing its own
    statement timeout default.
- **End to end:** the Next.js production build, headless Chrome →
  Server Action → pooler/TLS → database.
  - A valid submission reaches the confirmation and is audited as
    `public_form_service`.
  - With no trusted proxy configured, a spoofed `X-Forwarded-For` records
    nothing.
  - A filled honeypot says "not sent", keeps the answers, removes the field
    and sends on the next click.
- **`plpgsql_check`:** no issues in the 15 PL/pgSQL functions involved.
- **Application:** unit and contract tests (token, trusted address, URL
  guard, connection options, answers, checks, error mapping, function
  signatures). No server variable or role name appears in client bundles.
- **Not verified:** the Supabase shared pooler (Supavisor) itself, its
  certificate chain and host name, and anything on `events-v2`.

## Migration impact and recovery

- Additive except for `inquiries`:
  - two new columns (existing rows become `staff_entry`)
  - `created_by` and `source` now nullable under `inquiries_channel_check`
  - a new foreign key
  - a redefined guard
  - the audit action check replaced by a superset
- **Cluster-level effect:** one new role, `public_form_service`, NOLOGIN.
- Catalog effect in `public`, `private` and `authz`: 129 entries added
  (7 tables and a sequence, 4 types, 14 functions, 14 triggers, 6 policies,
  26 indexes, 57 constraints), 1 replaced. In addition: the schema
  `form_service` with its 2 functions.
- **Rollback is possible only before the first public submission.**
  - A public inquiry has no author or source, and inquiries cannot be
    changed or deleted, so `created_by` cannot be made NOT NULL again.
  - **Rehearsed with a public inquiry present:** the rollback fails and
    changes nothing.
  - **Rehearsed without one:** it succeeds and drops the role, leaving only
    the extended audit check (append-only evidence). The earlier suites
    pass afterwards, and re-applying passes 108/108.
  - After the first public submission, recovery is forward fixes only.

  Rollback SQL (rehearsed; review again before any use):

```sql
begin;
-- Possible only while no public inquiry exists. Destroys forms, links,
-- submissions and answers. Audit events stay (append-only), so the
-- extended action check stays too.
drop function form_service.submit_public_form(text, uuid, uuid, text, jsonb);
drop function form_service.get_public_form(text);
drop schema form_service;
drop function public.rotate_public_form_link(uuid);
drop function public.revoke_public_form_link(uuid);
drop function public.enable_public_inquiry_form(uuid);
drop function private.new_public_form_link(uuid, uuid, uuid);
drop function private.create_default_inquiry_form(uuid, uuid);
drop function private.publish_form_version(uuid, uuid);

-- Inquiries back to the 2.1 shape (fails if any public inquiry exists).
alter table public.inquiries drop constraint inquiries_channel_check;
alter table public.inquiries alter column created_by set not null;
alter table public.inquiries alter column source set not null;
create or replace function private.guard_inquiry_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'inquiries are never deleted; close them instead'
      using errcode = '23514';
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.source is distinct from old.source
     or new.client_message is distinct from old.client_message
     or new.staff_summary is distinct from old.staff_summary
     or new.received_at is distinct from old.received_at
     or new.requester_name is distinct from old.requester_name
     or new.requester_phone is distinct from old.requester_phone
     or new.requester_email is distinct from old.requester_email
     or new.requested_event_date is distinct from old.requested_event_date
     or new.estimated_guests is distinct from old.estimated_guests
     or new.created_by is distinct from old.created_by
     or new.creation_request_id is distinct from old.creation_request_id
     or new.created_at is distinct from old.created_at then
    raise exception 'the original intake and authorship of an inquiry cannot change'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
alter table public.inquiries drop column form_submission_id;
alter table public.inquiries drop column submission_channel;

drop table public.form_answers;
drop table public.form_submissions;
drop table private.form_rate_events;
drop table public.public_form_links;
drop table public.form_questions;
drop table public.form_versions;
drop table public.forms;
drop function private.guard_form_change();
drop function private.guard_form_version_change();
drop function private.guard_form_question_change();
drop function private.guard_public_form_link_change();
drop function private.prevent_submission_change();
drop function private.audit_form_version_publish();
drop function private.audit_public_form_link_change();
drop function authz.can_manage_forms(uuid);
drop type public.inquiry_submission_channel;
drop type public.form_binding;
drop type public.form_question_kind;
drop type public.form_purpose;
-- Last: the role owns nothing and holds only the grants dropped above. If an
-- operator enabled LOGIN, end its sessions first (pooler connections).
drop role public_form_service;
commit;
```

- **Operator steps per environment**, each explicitly authorized:
  1. Apply the migration.
  2. Run `alter role public_form_service with login password '<generated>'`
     in a database session, not in a file. Optionally add `valid until`
     for rotation.
  3. Set on the server:
     - `PUBLIC_FORMS_DATABASE_URL`: the shared pooler, transaction mode,
       user `public_form_service.<project-ref>`
     - `PUBLIC_FORMS_DATABASE_CA_CERT`: the project's CA certificate from
       the dashboard
     - `PUBLIC_FORMS_SIGNING_SECRET`
     - optionally `PUBLIC_FORMS_TRUSTED_PROXY_HOPS`, only once the hosting
       guarantee above holds
- **Rotation:** set a new password with `alter role`, then update the server
  variable. Pooled connections may fail briefly while the pooler refreshes
  its cached credentials. For an immediate cut-off, use `alter role
public_form_service nologin`.
