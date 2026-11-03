# 0001 — Foundation scaffold

**Status:** Accepted (scaffold only)
**Date:** 2026-11-03

## Context

Sollelio Events V2 is a greenfield multi-tenant SaaS. The approved technical
direction is Next.js 16 App Router, strict TypeScript, Tailwind CSS,
shadcn/ui with Radix, PostgreSQL/Supabase (later), and a modular monolith in one
repository without workspace packages. The Essential UX Blueprint v0.1 is the
canonical UX reference for Vertical Slice 1.

This ADR records only what the initial scaffold established. It is not the
Minimum Correct Technical Foundation (Blueprint §13, step 2).

## Decision

- Scaffolded with `create-next-app@16.4.4` (App Router, `src/` directory,
  `@/*` import alias, empty template, Turbopack Tailwind loader as generated).
- TypeScript `strict`, plus `noUncheckedIndexedAccess` and
  `noFallthroughCasesInSwitch`.
- shadcn/ui initialised with `shadcn@4.23.0` using the Radix base and the
  `radix-nova` style, neutral base colour, CSS variables. Components are added
  on demand; only the generated `Button` exists.
- ESLint via `eslint-config-next` (core-web-vitals + typescript), as generated.
- Prettier with `prettier-plugin-tailwindcss` for formatting and class sorting.
- npm as the package manager; `package-lock.json` is committed.
- `npm run typecheck` runs `next typegen` before `tsc --noEmit`, because Next.js
  16 global route types (`LayoutProps`, `PageProps`) are generated.

## Deliberately deferred

To be decided in the Minimum Correct Technical Foundation step, not here:

- Product module boundaries and directory conventions for the modular monolith.
- Tenant isolation, authentication and RLS strategy; Supabase project setup.
- Database migrations tooling and workflow (no schema exists).
- Locale, i18n, money and audit conventions. `<html lang>` is left at the
  template default (`en`) until the i18n approach is chosen.
- Test runner(s) and minimum test gates; CI.
- Local/staging environment workflow, environment variables and hosting/Node
  runtime version.
- Theme/branding tokens (organization branding is distinct from user
  appearance, per Blueprint §4).

## Consequences

- The app builds and renders a single placeholder page; there is no product
  functionality.
- `eslint` is pinned to v9 by the template for `eslint-config-next`
  compatibility; `npm audit` reports moderate advisories in that dev-only lint
  toolchain (transitive `minimatch`). Revisit when `eslint-config-next` supports
  newer versions.
