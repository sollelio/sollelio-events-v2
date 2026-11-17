# 0005 — Authentication (email and password)

**Status:** Accepted (Increment 1, Step 4A)
**Date:** 2026-11-16 (accepted 2026-11-17)

## Context

Technical Foundation v0.1 §3.1 approves email/password authentication with
email verification. §3.6 requires server-side authorization for every
protected read and mutation, with client checks as presentation only. ADR 0003
deferred `proxy.ts` session refresh until authentication existed. ADR 0004
deployed organizations and memberships on `events-v2`.

This step adds:

- registration
- email confirmation
- sign-in and sign-out
- server-side session checks
- a minimal entry state for users without an active membership

It does not change the database schema or the Auth Dashboard configuration.

## Decision

### Routes

| Route                  | Purpose                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `/sign-in`             | Email and password. `?next=` (sanitised) and `?status=` (fixed notice keys only).       |
| `/sign-up`             | Email and password (at least 8 characters, at most 72 bytes).                           |
| `/sign-up/check-email` | Shown after every accepted sign-up.                                                     |
| `/auth/callback`       | Completes confirmation links (`code`, or `token_hash` with `type` `email` or `signup`). |
| `/onboarding`          | Verified user without an active membership. Organization creation comes later.          |
| `/`                    | Routes by state: sign-in, onboarding, or a placeholder for members.                     |

Paths are English and locale-neutral; only the interface copy is localised.

### Session handling

- **`src/proxy.ts` only refreshes the session.** It calls
  `supabase.auth.getClaims()` and writes refreshed cookies, plus the
  library's no-cache headers. It never redirects or blocks, and it is not an
  authorization boundary.
- **`src/lib/auth/session.ts` is the boundary** for pages and Server
  Functions.
  - `getViewer()` calls `supabase.auth.getUser()`, which validates the session
    with Supabase Auth on every call.
  - Anything other than a confirmed, non-anonymous user with an email is
    treated as `anonymous` or `unverified`.
  - It then counts the viewer's active memberships, under RLS.
  - It is memoised per request.
  - Network or service failures throw (fail closed); they do not silently
    sign the user out.
- **`requireVerifiedViewer()`** redirects anonymous visitors to sign-in, with
  a return path chosen by the server, and unverified sessions to a notice.
- **Membership is only a routing hint.** Authorization of data stays with RLS
  and server-side checks.
- **Cookies** keep `@supabase/ssr`'s defaults (path `/`, SameSite=Lax, not
  HttpOnly because the browser client must read them) and are `Secure` in
  production.

### Sign-up, confirmation and sign-in

- **Server Functions** (`src/lib/auth/actions.ts`) do the work, used through
  `useActionState`. Forms post without JavaScript too (progressive
  enhancement).
- **No raw Auth errors reach the user.** Errors map to fixed message keys.
- **No account enumeration.** An already registered address gets the same
  check-your-email screen as a new one.
- **Sign-in rejects unconfirmed addresses itself.** If the result has no
  `email_confirmed_at`, the session is discarded, independently of the hosted
  "Confirm email" setting. `create_organization()` in the database checks
  verification independently as well (ADR 0004).
- **Confirmation links.** Supabase's default email uses PKCE, so a link
  completes sign-in only in the browser that signed up.
  - In another browser the address is still confirmed by Supabase; the
    callback shows a notice and the user signs in.
  - The callback also accepts `token_hash`, ready for a future email
    template that links straight to the app.
- **Sign-out** is a POST Server Function with `scope: "local"`, which ends
  only the current device's session.
- **Redirect safety.** `next` is accepted only as a same-origin path, checked
  after URL normalisation. Absolute and protocol-relative URLs, backslashes,
  control characters, dot segments that resolve to `//host`, and `/auth/*`
  are all rejected.
  - The sign-up `emailRedirectTo` is built from the request's `Origin`, which
    Next.js verifies for Server Functions. Supabase only honours redirect URLs
    on the project allow list.

### Interface and language

- **European Portuguese (`pt-PT`)** is the initial UI language, and
  `<html lang="pt-PT">` is set. The Blueprint's navigation labels ("Pedidos",
  "Contactos") are European Portuguese.
- **Copy** lives in a typed dictionary, `src/messages/pt-PT.ts`, reached
  through `getMessages()`. Message keys come from the auth modules, so a
  missing translation is a type error. Adding a locale means adding a
  dictionary of the same shape.
- **Screens use the approved tokens and `Button`.** The only new primitive is
  `Input` (40px, 16px text on mobile, `input` boundary token, global focus
  ring).
- **Accessibility:** labels, `aria-invalid` and `aria-describedby` on
  errors, `role="alert"` for errors and `role="status"` for notices, focus
  moved to the first problem after a failed submission, and a disabled,
  `aria-busy` submit button while pending.
- **`AppearanceSwitcher`** now takes its labels from the dictionary.

### Tests

- **Security-relevant logic** lives in dependency-free modules: redirect
  sanitising, callback parsing, credential validation, Auth error mapping and
  the state-to-destination router.
- **They are tested with Node's built-in `node:test`.** Node 26 runs the
  TypeScript directly, so there is no new dependency. `npm run test` is part
  of `npm run check`.
- **tsconfig:** `allowImportingTsExtensions` is enabled only so the test
  files can import `.ts` modules as Node requires.

## Resolves (Technical Foundation §10)

- §10.2, partly: session handling with Supabase Auth through `@supabase/ssr`.
- §10.4, partly: the initial UI language is `pt-PT`, with a dictionary
  structure. Formatting, timezone and further locales remain open.
- §10.6, partly: unit tests use `node:test`. CI and end-to-end gates remain
  open.

## Deliberately deferred

- Password recovery, MFA, and resending the confirmation email.
- A custom email template (`token_hash` flow, which works across devices) and
  custom SMTP. Both are Auth Dashboard changes.
- The Auth password policy is not changed. The app requires 8 characters at
  sign-up, which can be stricter than the project setting.
- Organization creation, invitations and role management.
- Content Security Policy. The appearance pre-paint scripts need a nonce
  (ADR 0002).
- End-to-end tests with real accounts on an isolated Auth stack. The
  application's pinned project target (ADR 0003) prevents pointing it at a
  local stack without a code change.
- Performance: `getUser()` is an Auth request on each protected render. Revisit
  with `getClaims()` plus a verified-email claim if it matters.

## Consequences

- Every new protected page or Server Function must call `getViewer()` or
  `requireVerifiedViewer()`. The proxy does not protect anything.
- The Auth Dashboard redirect allow list must include each environment's
  `/auth/callback` URL. Otherwise Supabase falls back to the Site URL and the
  user signs in manually after confirming.
