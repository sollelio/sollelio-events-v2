# Design handoff

For the frontend, UX and design lead: what has been designed and built, how
settled each part is, and how to propose changes. It decides nothing new.

**Authorities:**

- the [UX Blueprint](ESSENTIAL_UX_BLUEPRINT_V0.1.md): screens, navigation and
  flows (§3, §10)
- the [Technical Foundation](TECHNICAL_FOUNDATION_V0.1.md) §7: design
  requirements
- [ADR 0002](decisions/0002-design-system-foundation.md): the Design System
- [ADR 0007](decisions/0007-app-shell-and-active-organization.md): the shell
  and navigation

If this guide and those documents disagree, they win.

## How to start

1. **Inspect before deciding.** Look through the implemented screens (below,
   or run the app), the approved direction, the historical explorations and
   the canonical documents.
2. **Then recommend** what to do, screen by screen or interaction by
   interaction:
   - keep and refine what exists
   - redesign selected screens or interactions
   - how to work: in code, in Figma, or both
3. **Propose changes through the agreed process** (see
   [Changing a decision](DEVELOPER_ONBOARDING.md#changing-a-decision)). The
   product requirements and design constraints below stay in force until a
   change is approved and recorded.

There is no required deliverable format. Figma is optional.

## 1. Approved visual direction: Precision Refined (A+)

Approved at Checkpoint 07 and implemented as tokens in ADR 0002.

- **Character:** calm, dense and precise. A warm neutral canvas (`#f5f4f1`
  light, `#0d0d0c` dark), white or raised surfaces, thin warm lines.
  Information first.
- **Colour:**
  - the primary action is **ink**, never a hue
  - **Mineral Indigo** (`#3030a8`) is the only interface hue, used for focus
    and informational emphasis
  - Events Teal appears only in the logo
  - status colours meet AA
- **Organization brand is separate.** `org-brand` is for client-facing
  surfaces, with a neutral fallback. The user's appearance never changes it.
- **Typography:** Geist for the interface and headings (`type-display`,
  `type-title`, `type-eyebrow`). Newsreader only for editorial text, such as
  the client's own words.
- **Shape, depth, motion:** radius 4/6/8 px for controls, 12 px for cards;
  two shadows; restrained motion that switches off under
  `prefers-reduced-motion`.
- **Appearance:** light, dark and system, as a per-device preference. Every
  component works in both themes.
- **Tokens:** defined once, by name, in `src/app/globals.css`. If you use a
  design tool, mirror those names.

**Reference images:** the Checkpoint 07 screenshot packs (below) show the
direction applied to one screen, the Event Workspace Overview, with fictional
data. Treat them as the visual language, not a specification (Blueprint §12).

## 2. Currently implemented UI

The running app is the source of truth for these screens. The captures use
**synthetic data only** ("Atelier Exemplo Eventos", `example.test`
addresses), taken from a local build with no production access.

| Screen                     | Desktop                                                    | Mobile                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in                    | [light](design/screens/01-sign-in-desktop-light.webp)      | [dark](design/screens/02-sign-in-mobile-dark.webp)                                                                                                                                       |
| Home (shell, next action)  | [light](design/screens/03-home-desktop-light.webp)         | [light](design/screens/04-home-mobile-light.webp), [account menu](design/screens/05-account-menu-mobile-light.webp)                                                                      |
| Pedidos list and link card | [light](design/screens/06-pedidos-list-desktop-light.webp) | [dark](design/screens/07-pedidos-list-mobile-dark.webp)                                                                                                                                  |
| Inquiry detail             | [dark](design/screens/08-inquiry-detail-desktop-dark.webp) | [light](design/screens/09-inquiry-detail-mobile-light.webp)                                                                                                                              |
| New inquiry                | —                                                          | [light](design/screens/10-new-inquiry-mobile-light.webp)                                                                                                                                 |
| Public form (no shell)     | [dark](design/screens/12-public-form-desktop-dark.webp)    | [light](design/screens/11-public-form-mobile-light.webp), [errors](design/screens/13-public-form-errors-mobile-light.webp), [sent](design/screens/14-public-form-sent-mobile-light.webp) |

**Also built, not captured:** sign-up and "check your email"; onboarding (step
1 of the Blueprint's two: name and country; branding is deferred in ADR
0006); access suspended; choose organization.

**Shell (ADR 0007):**

- **Desktop (≥ 1024 px):** a 248 px sidebar.
- **Mobile:** a sticky header (symbol, organization, account menu) and a
  bottom bar with Home, Pedidos, Eventos and Contactos. Definições is in the
  account menu.
- Unbuilt destinations show "Em breve".

**Recurring patterns:**

- an eyebrow over the page title, and cards on the canvas
- field errors under the field, with focus moving to the first error
- a form-level alert
- pending buttons with a spinner
- visible focus, a skip link, and safe-area insets

**Implemented means current, not final.** These screens can be refined or
redesigned through the proposal process.

## 3. Historical and superseded material

| Material                                                                                                                | Status                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Concepts A (Precision and Clarity), B (Expressive and Fluid), C (Calm and Editorial): `sollelio-design-exploration.zip` | **Superseded** by A+; context only                                               |
| Live explorations: `src/app/explore/` (A, B, C, A+)                                                                     | **Reference only.** Its tokens predate ADR 0002; don't copy code or token values |
| Earlier checkpoint mockups (01–05D)                                                                                     | Not available; their decisions are recorded in the Blueprint's approval ledger   |
| Older Sollelio masterbrand logos                                                                                        | **Not for this product.** Use logo pack v1.0                                     |

**Approved but kept outside Git:**

- `sollelio-precision-refined.zip`, `sollelio-brand-review.zip` and the
  official logo pack v1.0 (`sollelio-events-logo-assets-v1.0.zip`, 143 files)
- the four logo SVGs and the app icons in the repository come from the pack,
  byte for byte

**Getting them:** Hélio shares the archives and the `/explore` folder
privately. They are never committed (binary, large, partly superseded).

**Running `/explore`:** it needs no Supabase configuration and imports no
production code. Exclude it from Git **before** copying it in:

```sh
echo '/src/app/explore/' >> .git/info/exclude
```

Then run `npm run dev` and open `/explore`. ESLint blocks production imports
from it, and the PR checklist forbids it in a diff.

## 4. Screens not yet designed

There are no designs at all for:

- Eventos (list)
- the Event Workspace tabs other than Overview: Propostas, Pagamentos,
  Histórico (Overview exists only as the A+ exploration)
- Contactos
- Definições, including organization branding (onboarding step 2)
- the client Portal and verified acceptance
- payment recording and explicit confirmation

The Blueprint (§3–§10) defines what each must do, not how it looks.

## 5. Constraints that apply to all design work

**Languages.**

- pt-PT and English are the intended interface languages. pt-PT is the
  default and the only one implemented.
- The switcher and the English translation are not built yet
  ([task](tasks/english-ui-locale.md)).
- Designs must work in both: labels, buttons and navigation must tolerate
  longer English text without truncation or layout breaks.
- Organization data (names, inquiry text, form questions) is never
  translated.

**Mobile is a first-class target, not a resized desktop.**

- **Navigation:** the Blueprint §10 model (bottom bar for the four main
  destinations, Definições through the header). Each screen's mobile layout
  is designed on purpose, not inherited.
- **Primary actions:** always reachable without hunting. Docked above the
  bottom bar on long pages (as in the A+ brand review); secondary actions in
  menus or sheets.
- **Forms:**
  - progressive where long, with field-appropriate keyboards and input types
  - errors next to the field, with focus on the first error
  - entered values kept after an error
- **Touch:** no hover-only information or actions, and spacing between
  adjacent targets. Controls meet WCAG 2.2's 24 px minimum today, and ADR 0002
  sets 36 and 40 px buttons. Larger mobile targets (44 px is common platform
  guidance) would be a proposal to change ADR 0002.
- **Layout:** no horizontal scrolling at 390 px; safe areas respected. Check
  at 390, 768, 1024 and 1440 px.
- **Continuity:** the same record and next action on every screen size.
  Drafts survive navigation, and after an action the user lands on the
  updated record.

**Accessibility and states (all sizes).**

- WCAG 2.2 AA in both themes (4.5:1 for text, 3:1 for focus and field
  boundaries).
- Components need these states: default, hover, focus-visible, pressed,
  disabled, pending, error.
- Pages need these states: empty, loading, error, no access.
- Never colour alone to carry meaning. Keyboard order matches visual order.

**Architecture stays a server-rendered Next.js app.**

- **Today:** pages render on the server, forms use Server Actions, and the
  session uses cookies. Design within that: there is no offline mode, and data
  is always current on load.
- **PWA (future, not approved):** feasible later with a manifest (Next.js file
  convention) and the pack's 192 and 512 px icons. Offline caching of
  signed-in tenant data would be a separate, risky decision.
- **Capacitor (future, not approved):** a bundled app needs a static export,
  which cannot support cookies, the Proxy, Server Actions or per-request
  dynamic routes. All of them are in use. The options would be a native shell
  around the hosted app, or a separate API-based client. Both need an ADR
  first.
- **Free today:** purpose-designed mobile layouts, safe areas, touch-friendly
  controls and an always-visible way back keep both options open.

**Optional: Figma or another design tool.**

- If you use Figma, keep the file in a Sollelio-owned team or project.
- Mirror the `globals.css` token names as variables, with Light and Dark
  modes.
- Name components like the code (`Button`, `Input`, …), with state variants.
- For screens already built, the running app stays the reference unless a
  change is approved.

## 6. Open decisions you may challenge

Each is either recorded as open, or could be challenged with evidence through
the proposal process.

| Topic                                                                                                  | Where it stands                                                   |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Any implemented screen or interaction                                                                  | Current, not final; propose refinements or redesigns              |
| Mobile touch-target size (36/40 px buttons)                                                            | ADR 0002; open to a proposal                                      |
| How organization branding appears on client-facing surfaces (colour validation, contrast, logo upload) | Open (ADR 0002)                                                   |
| Formal accessibility target, verification method, performance budgets                                  | Open (ADR 0002; WCAG 2.2 AA is the working baseline)              |
| Account-level appearance preference                                                                    | Open (ADR 0002)                                                   |
| Language switcher placement and behaviour                                                              | Proposed in the [English locale task](tasks/english-ui-locale.md) |
| Organization-level language for default forms and public pages                                         | Open (product decision)                                           |
| Mobile layout and navigation details for unbuilt screens                                               | Blueprint §10 sets the model; details are yours to propose        |
| Event Workspace layout beyond the A+ Overview exploration                                              | Not designed                                                      |
| Whether `/explore` is ever committed or shipped                                                        | Open (ADR 0002); today it stays local                             |
| The pack's dark "reverse-transparent" lockup has an opaque background                                  | Known defect (ADR 0002); mono-white is used meanwhile             |

**Not open without a product decision:**

- the Blueprint's navigation model and approved journeys
- the separation of Inquiry, Event, Commercial State and Confirmation State
- organization branding kept apart from user appearance
- accessibility and both themes as requirements
