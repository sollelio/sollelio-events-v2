# 0007 — Application shell, Home and active organization

**Status:** Accepted (Increment 1, Step 4C)
**Date:** 2026-11-17 (accepted 2026-11-17)

## Context

UX Blueprint §3 and §10 approve five primary destinations (Home, Pedidos,
Eventos, Contactos, Definições): a desktop sidebar and, on mobile, a bottom
bar for the first four with Definições reached from the header. §4–5 ask for
an operational Home that, for an empty organization, gives first-action
guidance without invented data. Technical Foundation §3.4 makes the active
organization application context, never proof of authorization. ADR 0006
showed the oldest organization as an interim rule.

This step builds the shell and Home only. No database, Auth or migration
change; no inquiry, contact or event functionality.

## Decision

### Active organization

| Active organizations (RLS) | Result                                                        |
| -------------------------- | ------------------------------------------------------------- |
| None, some suspended       | `/access-suspended` (not onboarding)                          |
| None otherwise             | `/onboarding` (never a member, or only removed/invited)       |
| One                        | Selected automatically                                        |
| Several, valid preference  | The preferred one                                             |
| Several, no valid one      | `/select-organization`: the viewer chooses                    |
| Counted but unreadable     | Error (fail closed), never a loop between Home and onboarding |

- **Source of truth:** `memberships` with `status = 'active'`, embedded with
  `organizations`, read with the user's session. RLS returns only the
  viewer's own memberships, and an organization only while that membership is
  active; the filter is repeated in code. Suspended, removed and invited
  memberships never select an organization.
- **Suspended access:** `getViewer()` also reports a suspended membership.
  A verified user with no active membership but a suspended one sees
  `/access-suspended`: a minimal notice to contact the organization, with
  sign-out. They are not offered onboarding, and the onboarding page and its
  Server Function refuse them. The organization is not named there, because
  RLS hides it while the membership is suspended. An active membership in
  any organization takes precedence.
- **Preference:** the httpOnly cookie `sollelio-active-organization`
  (SameSite=Lax, Secure in production, about 180 days) holds an organization
  id. It is only a hint: it is used when it names one of the viewer's active
  organizations and ignored otherwise. Editing it cannot reach another
  tenant, and no data is read by its value.
- **Selection:** `selectOrganization` (Server Function) re-reads the viewer
  and their active organizations, accepts the submitted id only if it is in
  that list, then sets the cookie. Sign-out deletes it.
- **Every page in the shell** calls `requireActiveOrganization()`; the
  `(app)` layout calls it too, to render the frame. Both are memoised per
  request. The layout is not the authorization boundary.
- Logic is dependency-free (`src/lib/organizations/active-organization.ts`)
  and tested with `node:test`.

### Shell

- **Desktop (≥ 1024 px):** 248 px sidebar with the product lockup, the
  organization (name and monogram; a link to switch only when there are
  several), the five destinations, and the account menu.
- **Mobile:** sticky header with the product symbol, the organization and the
  account menu; fixed bottom bar with Home, Pedidos, Eventos and Contactos.
  Definições is in the account menu.
- **Safe areas:** the root viewport uses `viewport-fit=cover`. The header pads
  by the top and side insets, the bar by the bottom and side insets, and
  `<main>` by the side insets plus, below `lg`, the bar's height, its inset
  and 1.5rem, so the end of every page stays above the bar. `scroll-padding`
  on `<html>` keeps focused and scrolled-to content clear of both bars (WCAG
  2.2 SC 2.4.11). `AuthShell` gutters never go below the insets.
- **Page container:** the shell's `<main>` is full width. Each page sets its
  gutters (`px-4 sm:px-6 lg:px-10`) and a wide cap (`max-w-[100rem]`),
  left-aligned beside the sidebar, so operational pages can use the space.
  Home caps its empty-state grid at 72rem, with a 16rem side column (22rem
  from `xl`), so the cards stop growing on large screens.
- **Unfinished destinations** are shown with "Em breve" and are not links:
  nothing to follow, nothing to focus. Only Home is a link (`aria-current`).
- **Account menu** (Radix Popover): the email, organization switching, the
  appearance preference and sign-out. Focus moves to the panel on open; Escape
  returns it to the trigger.
- **Keyboard:** a skip link to `<main>`; visible focus everywhere; the
  appearance options are a single tab stop.

### Home

- The organization's name and country, a "Próxima ação" card with
  **Registar primeiro pedido** and a short "Como funciona" (pedido → evento e
  proposta → confirmação), and an empty "Atenção" list.
- Registering inquiries does not exist yet, so the next action is shown as
  information, not as a control: a dashed panel with a clock, the action's
  name, "Disponível numa próxima versão." and "Em breve". Nothing is
  focusable or clickable. It becomes a real button with the inquiry step.
- Nothing operational is shown that does not exist.

### Separation

- **Appearance** is a per-device user preference in the account menu.
- **Organization identity** is name, country and monogram. The monogram uses
  the organization brand token (`--org-brand`) at its neutral fallback until
  branding exists; it never uses the product identity or the user's
  appearance.

### Design System

- Built from the existing tokens and primitives (AppearanceSwitcher,
  SignOutButton, AuthShell, ProductLockup) and Radix Popover from the existing
  `radix-ui` dependency. New components are specific to the shell
  (`src/components/app-shell/`); there is no general component library.
- `ProductSymbol` (in `product-logo.tsx`) renders the official symbol:
  `02-symbol/svg/sollelio-events-symbol-color.svg` on light and
  `-mono-white.svg` on dark, copied unmodified from
  `sollelio-events-logo-assets-v1.0.zip`. The pack was authenticated by its
  lockups being byte-identical to the ones already in production (ADR 0002).
- `/explore/refined` was used as the visual reference only.

## Deviations from the reference

- **Unfinished destinations carry no counts** and are not links.
- **The mobile header shows the organization's name** where the reference
  showed the section; the organization tile stays in the desktop sidebar.

## Deliberately deferred

- The inquiry, event, contact and settings destinations.
- Role and permission display (Blueprint §12.4).
- Account-level persistence of the appearance preference.
- Remembering the last organization across devices (the preference is per
  browser).

## Verification

- **Isolated:** unit tests for zero, one and several organizations;
  suspended-only, suspended plus active, removed and unreadable memberships;
  manipulated preferences and submitted ids; a stale preference cookie naming
  an organization whose membership is now suspended (never selected, never
  accepted by the selection Server Function, even if its row were readable);
  the selection page; the fail-closed case.
- **Headless Chrome** (real shell and Home, fixture data; light and dark):
  tab order, skip link and account menu focus at 390 and 1440 px; emulated
  safe-area insets (390×844 with 47/34 px, 844×390 landscape with 47/21 px)
  and a 320×568 screen, where the last content clears the bar by 46–55 px;
  desktop widths 1024–2560 px, where content stays left-aligned and the
  Home cards stop growing (780/352 px).
- **Production build, no session:** `/`, `/select-organization`,
  `/access-suspended` and a forged preference cookie redirect to sign-in.
- **Real account on `events-v2`:** Product reviewed desktop and mobile
  screenshots of the shell and Home (2026-11-17) before the final corrections
  (informational next action, suspended access, safe areas, page width,
  mobile symbol), which were approved from the headless captures.
- **Not verified:** several organizations for one user (only possible today
  through the API), a real suspended membership, and safe areas on a
  physical device (emulated only).
