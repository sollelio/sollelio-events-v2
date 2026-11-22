# Developer onboarding

A practical guide for working on Sollelio Events V2. Read it once end to end;
afterwards use it as a reference. It describes how we work. It does not change
product or architecture decisions: those live in the documents listed under
[What to read](#what-to-read).

## The product in one paragraph

Sollelio Events V2 is a multi-tenant SaaS for event-service businesses
(caterers, venues, planners). An organization receives inquiries, turns them
into prospective events, sends quotes, lets the client accept them in a portal,
records payments and confirms events. It is a new product, fully independent of
Sollelio Events V1: never read from, write to or depend on V1 or its database.

## Who does what

| Area                                                                                                                                   | Lead                   | The other developer                                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| Frontend, UX and design: screens, components, tokens, motion, accessibility, UI copy                                                   | Ahmad                  | Reviews data use and Server Function calls                         |
| Backend, database, security and APIs: migrations, RLS, Supabase, auth, Server Functions, queries, domain logic                         | Hélio                  | Reviews anything that changes what users see                       |
| Cross-boundary contracts: what a screen needs from the server, the shape of a query or action, error keys, UX that depends on security | Both, decided together | —                                                                  |
| `docs/` canonical documents and ADRs                                                                                                   | Hélio maintains        | Proposes changes (see [Changing a decision](#changing-a-decision)) |

Leading an area means deciding and reviewing in it; it doesn't mean being the
only one who may touch it. Changes that cross the boundary are welcome, and
the lead reviews them.

### Where the boundary sits in the code

| Path                                      | Who                                     | What lives there                                         |
| ----------------------------------------- | --------------------------------------- | -------------------------------------------------------- |
| `src/app/**/page.tsx`, `layout.tsx`       | Ahmad (Hélio for auth and data loading) | Routes. Server Components by default                     |
| `src/components/**`                       | Ahmad                                   | UI. `ui/` holds shadcn/ui components, added on demand    |
| `src/app/globals.css`                     | Ahmad                                   | Design tokens (ADR 0002)                                 |
| `src/messages/pt-PT.ts`                   | Ahmad (wording), Hélio (error keys)     | All interface copy                                       |
| `src/lib/<domain>/queries.ts`             | Hélio                                   | Server-side reads; return typed records for pages        |
| `src/lib/<domain>/actions.ts`             | Hélio                                   | Server Functions (`"use server"`) used by forms          |
| `src/lib/<domain>/*.ts` (other)           | Hélio                                   | Validation and domain logic, unit-tested in `*.test.mts` |
| `src/lib/auth/`, `src/lib/supabase/`      | Hélio                                   | Session checks and Supabase clients                      |
| `supabase/migrations/`, `supabase/tests/` | Hélio                                   | SQL migrations and database security tests               |

### How frontend and backend meet

- **Pages get data on the server.** A page calls a function from
  `src/lib/<domain>/queries.ts` and passes typed records to components. Client
  components never query Supabase directly. Today no client component
  imports the Supabase client, and that is intentional.
- **Forms submit to Server Functions** in `src/lib/<domain>/actions.ts`,
  usually with `useActionState`. A Server Function returns a typed state
  (field errors, a form error key, values to re-display) or redirects.
  Example: `src/lib/inquiries/actions.ts` with
  `src/components/inquiries/inquiry-form.tsx`.
- **Authorization lives on the server and in the database**, never in the UI.
  Hiding a button is presentation only. Protected pages call
  `requireVerifiedViewer()` (`src/lib/auth/session.ts`). `src/proxy.ts` only
  refreshes the session.
- **Need new data or a new action?** Agree the shape (fields, types, error
  keys) in the issue or PR first. Hélio adds the query or action; Ahmad builds
  the screen against it. A typed stub with fixture data is fine for UI work,
  but keep it on your branch: stubs and fixtures are never merged.

## Rules that always apply

- **Language:** code, comments, commits, PRs, issues and documentation are in
  English.
  - **Interface:** today it is European Portuguese only (`pt-PT`, ADR 0005).
    English is planned as a second supported locale
    ([task](tasks/english-ui-locale.md)); pt-PT stays the default.
  - **UI text:** all of it goes in the dictionary (`src/messages/`), never
    inline in components.
  - **Data is never translated:** organization names, inquiry text, and
    organization-configured form questions are shown exactly as entered.
- **Design:** use the tokens and components that already exist (ADR 0002,
  Precision Refined). Light, dark and system modes, desktop and mobile, and
  accessibility are requirements (Technical Foundation §7), not polish.
- **Canonical documents win.** The UX Blueprint decides Slice 1 UX; the
  Technical Foundation decides architecture and access. Their open decisions
  (Blueprint §12, Technical Foundation §10) are resolved deliberately, agreed
  and recorded, never quietly in code.
- **No secrets in the repository**, in PRs or in screenshots. `.env.local` is
  git-ignored. Only `NEXT_PUBLIC_` values reach the browser, so never put a
  secret in one.
- **Databases are Hélio's call.** Only Hélio writes and applies migrations, and
  only after review. An applied migration is never edited. Never run
  `supabase db push`, `db reset --remote` or `config push`.
- **No speculative work:** no placeholder modules, unused components or
  abstractions "for later".
- **This is Next.js 16.** APIs differ from older versions. Check
  `node_modules/next/dist/docs/` before relying on memory. AI assistants follow
  `AGENTS.md`.

## Changing a decision

Both developers are encouraged to propose improvements to existing decisions,
including accepted ADRs, the Design System and the configurable forms
architecture. Challenge them with evidence and alternatives; never replace them
silently.

1. **Raise it:** open an issue or a draft PR describing the problem, the
   evidence (a screenshot, a measurement, a failing case, a user need), at
   least one alternative, and what it would cost to change.
2. **Discuss it** with the other developer. Product-level questions go to the
   product owner.
3. **Record it:** if the change is approved, record it in a new ADR that
   supersedes or amends the old one, or a new version of a canonical document.
   Then implement it.

Until a change is approved and recorded, the accepted ADR remains
authoritative, and code follows it. Proposed ADRs (such as 0009 today) are
open for comment in the same way.

## Configurable forms in brief

The first architecture you will build screens on. The details, rules and
security analysis are in
[ADR 0009](decisions/0009-versioned-public-forms.md); this is the overview.

**Why configurable instead of a fixed form.**

- Every organization asks prospective clients different things (a venue asks
  about the room, a caterer about dietary needs).
- The same mechanism must later serve other purposes, such as event briefings
  and follow-up questionnaires.
- A fixed form would need a code change and deployment per customer, and would
  have forced every organization into one set of fields.

**The model.**

- **Form:** belongs to one organization and has a **purpose**. Today the only
  purpose is `inquiry`, with one form per purpose.
- **Version:** a numbered draft, then published. Publishing is one-way, and a
  **published version never changes**. To change a form, you publish a new
  version.
- **Question:** typed (short text, long text, number, date, single or multiple
  choice), with label, help text, required flag and options. It belongs to one
  version.
- **Submission:** one completed form from the public. It records exactly which
  version was answered. It can't be edited or deleted.
- **Answer:** one typed value per answered question, tied to that version's
  question. Historical answers always make sense, even after the form changes.

**Bound fields versus custom answers.** Some questions are **bound** to core
Inquiry fields: name, email, phone, message, event date and guests. Bound
answers fill the Inquiry itself, so Pedidos and the rest of the product
see one consistent Inquiry regardless of how each form is worded. Unbound
questions are custom: they are kept as answers and shown in the Inquiry detail
under "Respostas do formulário".

Publishing validates the bindings: an Inquiry form must have a required message
and an email or phone question. The default form asks for the message plus
email or phone; everything else is optional.

**Public intake.**

- An organization enables a **public link** (`/f/{key}`) from Pedidos.
- The link points to the form, not a version, so it always shows the current
  published version. A submission against the previous version is still
  accepted for 24 hours after a new one is published.
- Links can be rotated or disabled.
- Visitors don't sign in. Their submission goes to a Next.js Server Function,
  never directly to the database.

**Server-only database access.**

- The server talks to the database as a dedicated PostgreSQL role,
  `public_form_service`. It can execute exactly two functions (read a
  published form, submit answers) and nothing else: no tables, no other
  functions, no other roles.
- Browsers and Supabase API keys can't use it. Its password exists only in the
  server environment.
- The database enforces the limits, validation, idempotent retries and audit.
- Staff read forms and answers through normal row-level security, as Owners
  and Managers.

**Today versus later.**

- **Today:** the default Inquiry form (pt-PT), the link card on Pedidos, the
  public form and confirmation pages, and answers in the Inquiry detail.
- **Later:** the form editor (drafts, questions, publishing); data model and
  database rules already support it.
- **Not live yet:** the migration is applied, but the role's login and the
  server variables are configured only once the app is hosted.

**Known trade-offs and open points.**

- **Rollback:** the migration can't be rolled back once a public submission
  exists. Recovery is forward-only.
- **Per-client rate limits** are off until hosting guarantees a trustworthy
  client IP address. Only the per-link limits apply.
- **Default form language:** the default questions are pt-PT organization data
  and won't follow the interface language. A per-organization form language
  is an open decision.
- **Not built yet:** retention and anonymisation, staff notifications, website
  embedding and CAPTCHA.
- **Priority:** the commercial priority is a hosted, working demo of this flow
  before any of the above.

## Setup

1. Install Node.js 26 (`.nvmrc`; at least 22) and use npm. The lockfile is
   `package-lock.json`.
2. Clone and install:
   ```sh
   git clone git@github.com:sollelio/sollelio-events-v2.git
   cd sollelio-events-v2
   npm ci
   ```
3. `cp .env.example .env.local` and set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   Hélio sends the value privately; it is a publishable key, but it belongs to
   our only Supabase project. Leave the `PUBLIC_FORMS_*` variables empty.
4. `npm run dev` and open <http://localhost:3000>.

**There is only one Supabase project (`events-v2`), and it is production.**
Signing up locally creates a real account there. Use only the test account
agreed with Hélio, and don't create organizations or inquiries beyond it. The
public form at `/f/{key}` shows "Formulário indisponível" locally, because it
needs server-only database credentials. For UI work on it, use fixture data on
your branch.

## Daily commands

| Command          | When                                                           |
| ---------------- | -------------------------------------------------------------- |
| `npm run dev`    | Develop                                                        |
| `npm run check`  | Before every push: typecheck, lint, Prettier check, unit tests |
| `npm run build`  | Before opening or updating a PR                                |
| `npm run format` | Fix formatting                                                 |

Database security tests (pgTAP, `supabase/tests/database/`) run only against
an isolated, disposable database, never the remote project. Hélio runs them for
database changes.

## Branches

| Branch      | Purpose                                                    | Who merges              |
| ----------- | ---------------------------------------------------------- | ----------------------- |
| `main`      | Stable. What is (or will be) deployed for demos and trials | Hélio, from `dev`       |
| `dev`       | Integration of finished work                               | PR author, after review |
| `feature/*` | One feature or screen, e.g. `feature/inquiry-list-filters` | —                       |
| `fix/*`     | One bug fix, e.g. `fix/sidebar-focus-ring`                 | —                       |

- Branch from `dev`, keep branches short-lived (days, not weeks) and small.
- Bring `dev` into your branch by rebasing before you ask for review:
  `git fetch && git rebase origin/dev`.
- Never push directly to `main` or `dev`. Never force-push a shared branch.
- An urgent production fix branches from `main` as `fix/*`, merges into `main`,
  and is then merged back into `dev`.

## Pull requests

1. Open the PR into `dev` early as a draft if you want feedback; mark it ready
   when done.
2. Title in Conventional Commit style, like the history: `feat: …`, `fix: …`,
   `chore: …`, `docs: …`, `refactor: …`, `test: …`.
3. In the description, say:
   - what changed and why, and the issue if there is one
   - how you verified it
   - for UI changes, screenshots at mobile (390 px) and desktop widths, in
     light and dark mode
4. Before asking for review:
   - `npm run check` and `npm run build` pass
   - no secrets, `.env*` files, fixtures or stubs, or `src/app/explore/` in the
     diff
   - UI copy is in the dictionary (`src/messages/`)
5. **Review:** the other developer reviews every PR. The lead of an area
   (see above) must approve changes to it, and cross-boundary contracts need
   both. Database, auth and security changes always need Hélio's approval and
   include their test evidence. Frontend, UX and design changes need Ahmad's.
6. **Merge:** squash-merge into `dev` and delete the branch.
7. **Release:** Hélio opens `dev` → `main` when `dev` is verified for a demo or
   release, and merges it with a merge commit.

## First-day checklist

- [ ] Access to the GitHub repository (`sollelio/sollelio-events-v2`)
- [ ] Node.js 26, `npm ci` and `npm run dev` working
- [ ] `.env.local` with the publishable key and the agreed test account
- [ ] `npm run check` and `npm run build` pass on a clean `dev`
- [ ] Read: this guide, `README.md`, `docs/README.md`, the UX Blueprint and
      ADR 0002 (Design System). Skim the Technical Foundation §§2, 4 and 7
- [ ] Walk through the app: sign in, Home, Pedidos (list, new, detail), the
      account menu, light and dark mode, mobile width
- [ ] Open a first small PR, e.g. a visual fix, to try the workflow end to end

## What to read

| Document                                                                                                  | Why                                                |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [`README.md`](../README.md)                                                                               | Status, stack, setup, commands, Supabase           |
| [`docs/README.md`](README.md)                                                                             | Which document decides what                        |
| [UX Blueprint v0.1](ESSENTIAL_UX_BLUEPRINT_V0.1.md)                                                       | Canonical Slice 1 UX: navigation, screens, flows   |
| [Technical Foundation v0.1](TECHNICAL_FOUNDATION_V0.1.md)                                                 | Architecture, access, domains, design requirements |
| [ADR 0002](decisions/0002-design-system-foundation.md)                                                    | Tokens, typography, components, motion             |
| [ADR 0005](decisions/0005-authentication.md), [0007](decisions/0007-app-shell-and-active-organization.md) | Auth screens, language, shell and navigation       |
| [ADR 0008](decisions/0008-inquiry-registration.md), [0009](decisions/0009-versioned-public-forms.md)      | Pedidos and public forms                           |
| [English UI locale (task)](tasks/english-ui-locale.md)                                                    | Planned second interface language                  |
