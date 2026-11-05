# Sollelio Events V2

Greenfield multi-tenant SaaS for event-service businesses. V2 is independent of
Sollelio Events V1 and must not read from, write to, or depend on V1 or its
production database.

**Status:** foundation scaffold and minimum Design System. No product features,
authentication, database schema, or infrastructure exist yet.

## Stack

- Next.js 16 (App Router, Turbopack), React 19
- TypeScript (`strict`)
- Tailwind CSS v4
- shadcn/ui (Radix base)
- PostgreSQL / Supabase — planned, not yet integrated
- Single-repository modular monolith (no workspace packages)

## Requirements

- Node.js `>=20.9.0` (developed on Node 26, see `.nvmrc`)
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
| `npm run check`        | Typecheck + lint + format check          |

## Layout

```
docs/                 Product and architecture documentation (start at docs/README.md)
src/app/              Next.js App Router routes; globals.css holds the design tokens
src/app/explore/      Checkpoint 07 design exploration — local reference, untracked, not production
src/components/ui/    shadcn/ui components (added on demand via the shadcn CLI)
src/components/brand/ Official Sollelio Events logo assets and the product lockup
src/components/appearance/  Light / dark / system preference
src/lib/              Shared utilities
```

Design System decisions: `docs/decisions/0002-design-system-foundation.md`.

Product module boundaries are not defined yet; they are part of the Minimum
Correct Technical Foundation step (see `docs/decisions/0001-foundation-scaffold.md`).

## Documentation

See [`docs/README.md`](docs/README.md). The approved
[Essential UX Blueprint](docs/ESSENTIAL_UX_BLUEPRINT_V0.1.md) is canonical for
Vertical Slice 1 UX decisions.
