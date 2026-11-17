# Sollelio Events V2

Greenfield multi-tenant SaaS for event-service businesses. V2 is independent of
Sollelio Events V1 and must not read from, write to, or depend on V1 or its
production database.

**Status:** foundation scaffold, minimum Design System and Supabase connection.
Organizations and memberships are deployed on `events-v2`. Email/password
authentication (sign-up, email confirmation, sign-in, sign-out) and first
organization onboarding (name and country, then a minimal organization Home)
are implemented; product features are not yet.

## Stack

- Next.js 16 (App Router, Turbopack), React 19
- TypeScript (`strict`)
- Tailwind CSS v4
- shadcn/ui (Radix base)
- PostgreSQL / Supabase (`@supabase/ssr`, Supabase CLI for migrations)
- Single-repository modular monolith (no workspace packages)

## Requirements

- Node.js `>=22` (developed on Node 26, see `.nvmrc`)
- npm (the lockfile is `package-lock.json`)

## Commands

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm install`          | Install dependencies                     |
| `npm run dev`          | Start the development server             |
| `npm run build`        | Production build                         |
| `npm run start`        | Serve the production build               |
| `npm run typecheck`    | Generate Next.js route types, then `tsc` |
| `npm run lint`         | ESLint (`eslint-config-next`)            |
| `npm run format`       | Format with Prettier                     |
| `npm run format:check` | Verify formatting                        |
| `npm run test`         | Unit tests (`node:test`, `*.test.mts`)   |
| `npm run check`        | Typecheck + lint + format check + tests  |

## Layout

```
docs/                 Product and architecture documentation (start at docs/README.md)
src/app/              Next.js App Router routes; globals.css holds the design tokens
src/app/explore/      Checkpoint 07 design exploration — local reference, untracked, not production
src/components/ui/    shadcn/ui components (added on demand via the shadcn CLI)
src/components/brand/ Official Sollelio Events logo assets and the product lockup
src/components/appearance/  Light / dark / system preference
src/lib/              Shared utilities
src/proxy.ts          Session refresh only (not an authorization boundary)
src/lib/supabase/     Supabase browser (client.ts) and server (server.ts) clients
src/lib/auth/         Session checks, Server Functions and pure auth logic (with tests)
src/lib/organizations/  Onboarding (organization creation) and Home queries (with tests)
src/messages/         Interface copy (pt-PT dictionary)
src/components/auth/  Authentication screens and form parts
src/components/onboarding/  Organization onboarding form
supabase/             Supabase CLI config, SQL migrations and database tests (pgTAP)
```

Design System decisions: `docs/decisions/0002-design-system-foundation.md`.

Product module boundaries are not defined yet; they are part of the Minimum
Correct Technical Foundation step (see `docs/decisions/0001-foundation-scaffold.md`).

## Supabase

The application connects to one remote Supabase project, **`events-v2`**
(ref `icgsujzpcafqnqjozslj`). There is no local Supabase stack. Decisions:
`docs/decisions/0003-supabase-integration-foundation.md`.

### Environment

1. `cp .env.example .env.local` (git-ignored).
2. In the Supabase Dashboard → Project Settings → API Keys, copy the
   **publishable** key (`sb_publishable_…`) into
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Restart `npm run dev`. `NEXT_PUBLIC_*` values are inlined at build time.

The project target is hardcoded in `src/lib/supabase/env.ts` as a deliberate
initial safety restriction; it will be revisited when additional environments
are introduced. Creating a client with a missing variable, another project's
URL, or a non-publishable key throws `Supabase configuration error: …`. The message names
the variable but never shows its value. Never put a secret or `service_role`
key in a `NEXT_PUBLIC_` variable.

Use `@/lib/supabase/server` in Server Components, Server Functions and Route
Handlers. Use `@/lib/supabase/client` in Client Components.

### Authentication

Email/password with email confirmation; decisions in
`docs/decisions/0005-authentication.md`. Protected pages and Server Functions
verify the user with `getViewer()` / `requireVerifiedViewer()`
(`src/lib/auth/session.ts`); `src/proxy.ts` only refreshes the session.
Onboarding and Home routing are described in
`docs/decisions/0006-first-organization-onboarding.md`.

In the Supabase Dashboard → Authentication → URL Configuration, the redirect
allow list must contain each environment's callback, for example
`http://localhost:3000/auth/callback`. Without it, confirmation links fall back
to the Site URL and the user signs in manually after confirming.

### Migrations

SQL migrations live in `supabase/migrations/` and are committed. The CLI is a
pinned dev dependency. It targets the local stack unless `--remote` is given.

```sh
npx supabase migration new <name>                     # create an empty SQL file; edit and commit it
npx supabase login                                    # once per machine (personal access token)
npx supabase link --project-ref icgsujzpcafqnqjozslj  # once per clone; prompts for the DB password
npx supabase migration list --remote                  # compare local files with the remote history
npx supabase db push --remote --dry-run               # show exactly what would be applied
npx supabase db push --remote                         # apply (asks for confirmation)
```

Database security tests live in `supabase/tests/database/` (pgTAP). Run them
only against an isolated database (for example, `npx supabase test db` on a
local stack), never against the remote project.

Apply migrations only when a reviewed step authorises it. Never edit an applied
migration. Never run `supabase config push` or `supabase db reset --remote`:
`supabase/config.toml` describes the local stack, not the remote project.

## Documentation

See [`docs/README.md`](docs/README.md). The approved
[Essential UX Blueprint](docs/ESSENTIAL_UX_BLUEPRINT_V0.1.md) is canonical for
Vertical Slice 1 UX decisions.
