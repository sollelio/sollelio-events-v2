# Sollelio Events V2

Multi-tenant SaaS for event-service businesses (caterers, venues, planners):
inquiries, prospective events, quotes, a client portal, payments and event
confirmation. V2 is a greenfield product, independent of Sollelio Events V1. It
must not read from, write to, or depend on V1 or its production database.

New to the project? Start with
[`docs/DEVELOPER_ONBOARDING.md`](docs/DEVELOPER_ONBOARDING.md).

## Status

Delivery follows the Technical Foundation (§6). Step 1 (operational foundation
and minimum Design System) is done; step 2 (Inquiry, Contact and Prospective
Event) is in progress.

| Area                                                                  | State                                                                        | Decision |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| Design System (Precision Refined; light, dark, system)                | Implemented                                                                  | ADR 0002 |
| Organizations and memberships (database, RLS, audit)                  | Implemented; migration applied                                               | ADR 0004 |
| Email/password authentication with email confirmation                 | Implemented                                                                  | ADR 0005 |
| First organization onboarding                                         | Implemented                                                                  | ADR 0006 |
| App shell, active organization, operational Home                      | Implemented                                                                  | ADR 0007 |
| Inquiries (Pedidos): manual registration, list, detail, close, reopen | Implemented; migration applied                                               | ADR 0008 |
| Versioned public forms; default public Inquiry form at `/f/{key}`     | Implemented; migration applied; **not live yet** (below)                     | ADR 0009 |
| Interface language: pt-PT (default); English as a second locale       | pt-PT implemented; English planned ([task](docs/tasks/english-ui-locale.md)) | ADR 0005 |
| Contacts, Events, Quotes, Client Portal, Payments, Confirmation       | Not started                                                                  | —        |

**Deployment:** the application is not deployed. The hosting platform is
still open (Technical Foundation §10.6). The database is the Supabase project
`events-v2`, which has migrations `20261114133030`, `20261117190000` and
`20261118120000` applied. Public forms go live once the
`public_form_service` database login and its server variables are configured
for a hosted environment (ADR 0009, operator steps).

## Stack and architecture

- Next.js 16 (App Router, Turbopack), React 19, TypeScript (`strict`)
- Tailwind CSS v4, shadcn/ui (Radix base)
- PostgreSQL on Supabase (`@supabase/ssr`), SQL migrations with the Supabase
  CLI, database tests with pgTAP
- One deployable modular monolith, organized by the logical domain boundaries
  in Technical Foundation §4. No workspace packages; code for a domain appears
  when a delivery step needs it

**Data flow:**

- **Reads:** pages (Server Components) read through `src/lib/<domain>/queries.ts`.
- **Writes:** forms submit to Server Functions in `src/lib/<domain>/actions.ts`.
- **Authorization:** enforced on the server (`requireVerifiedViewer()`) and in
  the database (RLS and `SECURITY DEFINER` functions). The UI never decides
  access, and client components do not query Supabase directly.

## Requirements

- Node.js 26 (`.nvmrc`; at least 22)
- npm (the lockfile is `package-lock.json`)

## Commands

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm ci`               | Install dependencies from the lockfile   |
| `npm run dev`          | Start the development server             |
| `npm run build`        | Production build                         |
| `npm run start`        | Serve the production build               |
| `npm run typecheck`    | Generate Next.js route types, then `tsc` |
| `npm run lint`         | ESLint (`eslint-config-next`)            |
| `npm run format`       | Format with Prettier                     |
| `npm run format:check` | Verify formatting                        |
| `npm run test`         | Unit tests (`node:test`, `*.test.mts`)   |
| `npm run check`        | Typecheck + lint + format check + tests  |

Every change passes `npm run check` and `npm run build` before review. CI
(`.github/workflows/ci.yml`) runs `npm ci`, `npm run check` and `npm run build`
on every pull request into `dev` or `main` and on every push to them. It needs
no secrets and never touches the database or deploys.

## Layout

```
docs/                        Product and architecture documentation (start at docs/README.md)
src/app/                     App Router routes; globals.css holds the design tokens
src/app/(app)/               Signed-in application: Home, Pedidos
src/app/f/                   Public form pages (no sign-in)
src/app/explore/             Design exploration — local only, untracked, never committed
src/proxy.ts                 Session refresh only (not an authorization boundary)
src/components/ui/           shadcn/ui components (added on demand)
src/components/brand/        Official Sollelio Events logo assets and lockup
src/components/appearance/   Light / dark / system preference
src/components/app-shell/    Navigation, organization and account menu
src/components/auth/         Authentication screens
src/components/onboarding/   Organization onboarding form
src/components/inquiries/    Pedidos: form, list, detail, public form link card
src/components/public-forms/ Client-facing public form
src/messages/                Interface copy (pt-PT dictionary)
src/lib/supabase/            Supabase server and browser clients
src/lib/auth/                Session checks and auth Server Functions
src/lib/organizations/       Onboarding and active organization
src/lib/inquiries/           Inquiry validation, queries and Server Functions
src/lib/public-forms/        Public forms: server-only database role, tokens, answers
supabase/migrations/         SQL migrations (committed; never edited once applied)
supabase/tests/database/     Database security tests (pgTAP)
```

Tests sit next to the code as `*.test.mts`.

## Environment

1. `cp .env.example .env.local` (git-ignored).
2. Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the project's **publishable**
   key (`sb_publishable_…`, Dashboard → Project Settings → API Keys).
3. Restart `npm run dev`. `NEXT_PUBLIC_*` values are inlined at build time.

The `PUBLIC_FORMS_*` variables are server-only. They are needed only where the
public form must work, and are documented in `.env.example` and ADR 0009.
Without them, `/f/{key}` shows "Formulário indisponível".

The project target is hardcoded in `src/lib/supabase/env.ts` as a deliberate
safety restriction. It will be revisited when additional environments are
introduced; today there is one Supabase project, used as production. A missing
variable, another project's URL or a non-publishable key throws
`Supabase configuration error: …`, which names the variable but never shows
its value. No Supabase secret or `service_role` key is used. Never put a
secret in a `NEXT_PUBLIC_` variable.

## Supabase

One remote project, **`events-v2`** (ref `icgsujzpcafqnqjozslj`); no local
Supabase stack. Decisions: ADR 0003.

### Authentication

Email/password with email confirmation (ADR 0005). In the Dashboard →
Authentication → URL Configuration, the redirect allow list must contain each
environment's callback, for example `http://localhost:3000/auth/callback`.
Without it, confirmation links fall back to the Site URL, and the user signs in
manually after confirming.

### Migrations

Migrations are written, reviewed and applied by the backend owner, only when a
reviewed step authorizes it.

```sh
npx supabase migration new <name>                     # create an empty SQL file; edit and commit it
npx supabase login                                    # once per machine (personal access token)
npx supabase migration list --remote=icgsujzpcafqnqjozslj   # compare local files with the remote history
npx supabase db push --remote=icgsujzpcafqnqjozslj --dry-run --skip-vault   # show what would be applied
npx supabase db push --remote=icgsujzpcafqnqjozslj --skip-vault             # apply (asks for confirmation)
```

Rules:

- Never edit an applied migration.
- Never run `supabase config push` or `supabase db reset --remote`:
  `supabase/config.toml` describes a local stack, not the remote project.
- pgTAP tests in `supabase/tests/database/` run only against an isolated,
  disposable database, never the remote project. A committed runner for them
  does not exist yet.

## Documentation

- [`docs/DEVELOPER_ONBOARDING.md`](docs/DEVELOPER_ONBOARDING.md): roles,
  setup, branches, pull requests, first-day checklist
- [`docs/README.md`](docs/README.md): document map and authority
- [Essential UX Blueprint v0.1](docs/ESSENTIAL_UX_BLUEPRINT_V0.1.md): canonical
  for Slice 1 UX
- [Technical Foundation v0.1](docs/TECHNICAL_FOUNDATION_V0.1.md): canonical
  for architecture, access, domain boundaries and delivery sequence
- [`docs/decisions/`](docs/decisions/): ADRs 0001–0009
- [`docs/tasks/`](docs/tasks/): proposed bounded tasks, such as the
  [English UI locale](docs/tasks/english-ui-locale.md)
- [`AGENTS.md`](AGENTS.md): rules for AI coding assistants
