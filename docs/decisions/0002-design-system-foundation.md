# 0002 — Design System foundation

**Status:** Accepted (minimum Design System foundation approved)
**Date:** 2026-11-05

## Context

Technical Foundation v0.1 §6 makes "operational foundation and minimum Design
System" the first delivery step, and §7 sets the design requirements (light,
dark and system appearance; accessibility; restrained, meaningful motion;
organization branding separate from user appearance). Its §10.5 lists the
Design System details as open.

Checkpoint 07 approved **Precision Refined (A+)** as the visual direction, with
the official Sollelio Events logo pack v1.0, and set the typography: Geist
Semibold for operational headings, Newsreader only for selective editorial
content.

## Decision

### Tokens

Defined once in `src/app/globals.css`. Each colour is a `light-dark()` pair,
resolved by `color-scheme` on `<html>`. shadcn/ui names are kept so its
components work unchanged; Sollelio additions are marked †.

| Role                    | Tokens                                                                           | Light / dark                    |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| Canvas                  | `background`, `foreground`                                                       | `#f5f4f1` / `#0d0d0c` (warm)    |
| Surfaces                | `card`, `popover`, `muted` (= `secondary`, `accent`)                             | white, raised, subtle fill      |
| Secondary text          | `muted-foreground`                                                               | `#5f5a52` / `#a6a29a`           |
| Primary action          | `primary`, `primary-foreground`, `primary-hover`†                                | ink `#151412` / `#efede8`       |
| Lines                   | `border`, `border-strong`†, `input` (form-field boundary, ≥ 3:1)                 | `#e8e5df`, `#d5d0c7`, `#8a8478` |
| Focus and product cue   | `ring`, `info`†, `info-foreground`†, `info-soft`†                                | Mineral Indigo `#3030a8` / tint |
| Status                  | `success`†, `warning`†, `destructive` (+ `-soft`†, `destructive-foreground`†)    | AA on card and soft fills       |
| Organization brand      | `org-brand`†, `org-brand-foreground`†                                            | fixed; see below                |
| Navigation surface      | `sidebar-*` (shadcn contract, mapped to the tokens above)                        | —                               |
| Radius                  | `sm` 4, `md` 6, `lg` 8 (controls), `xl` 12 (cards), `2xl` 16 px                  | —                               |
| Elevation               | `shadow-card` (resting), `shadow-raised` (popovers, floating bars)               | —                               |
| Motion                  | `ease-standard` (deceleration), `ease-spring` (press); 150 / 240 / 420 ms        | —                               |
| Type roles (`@utility`) | `type-display` 24→30 px, `type-title` 19→21 px (Geist 600), `type-eyebrow` 11 px | —                               |

- The primary action is ink, never a hue, so it never competes with status
  colours or an organization's brand. `accent` is shadcn's neutral hover fill,
  not a brand colour.
- Mineral Indigo is the only product hue in the interface (focus, informational
  emphasis). Events Teal stays in the logo.
- Type roles are named `type-*` because the `cn` class merger treats unknown
  `text-*` names as colours and would drop one of the two.
- Spacing is Tailwind's 4 px scale.

### Appearance (light / dark / system)

- A per-device preference in `localStorage` (`sollelio.appearance`); "system" is
  the default and removes the key.
- An inline script in `<head>` resolves the preference and sets
  `<html data-theme="light|dark">` before first paint, so there is no theme
  flash and no dependency on hydration. Without the attribute (no JavaScript)
  the tokens and the `dark:` variant follow the OS.
- `AppearanceController` re-applies the attribute after React's development
  remount, follows OS changes while the preference is "system", and follows
  changes from other tabs.
- `AppearanceSwitcher` is a native radio group. A second inline script, placed
  right after its radios, checks the stored option before first paint; React
  hydration keeps that live `checked` state, so the control never shows a
  stale "System".

### Product identity

- Official files, unmodified, in `src/components/brand/assets/`. Favicon, SVG
  icon and Apple touch icon come from the pack's `06-web-ready/` folder via the
  Next.js file conventions in `src/app/`.
- `ProductLockup` renders the colour lockup on light and the mono-white lockup
  on dark, and never goes below the pack's minimum (214 px canvas, about 140 px
  visible). The isolated symbol will be added when a screen needs it.
- **Known defect:** the pack's `reverse-transparent-outlined` lockup is
  byte-identical to `reverse-midnight` and has an opaque `#11152D` background.
  Mono-white is the interim dark variant. Swap one import once a corrected file
  exists.

### Organization branding

- `--org-brand` / `--org-brand-foreground` are an organization setting, not
  appearance-dependent, with a neutral fallback (`#27272a` / white).
- Product tokens and the product logo never reference them, and the user's
  appearance never changes them.

### Accessibility and motion

- Every text pair meets WCAG 2.2 AA (4.5:1) in both themes; focus ring and
  form-field boundaries meet 3:1.
- Focus is a global 2 px `ring` outline with a 2 px offset.
- Motion is limited to state transitions and a spring press (`press`
  utility). Under `prefers-reduced-motion` all transitions and animations
  collapse and the press scale is off.

### Primitives

Only what the current application needs: `Button` (shadcn, retuned to the
tokens: ink primary, 36 / 40 px heights, global focus, `press`),
`ProductLockup`, and `AppearanceSwitcher` with its controller. The navigation
shell and other components are built with the first real screens (Technical
Foundation §7: no speculative component libraries).

### Typography

Geist is the interface and heading face. Newsreader is reserved for editorial
content (for example a client's own words or portal narrative). It is loaded
only by a surface that uses it, so it is not loaded today; the same applies to
Geist Mono for references.

### Exploration code

`src/app/explore/` stays available locally (untracked) as the Checkpoint 07
reference. It is not production code. ESLint forbids production modules from
importing it.

## Resolves (Technical Foundation §10.5)

- Design tokens (colour, typography, spacing, radius, elevation, motion).
- Theme switching mechanism and per-device persistence of the appearance
  preference.

## Still open

- Account-level persistence of the appearance preference (needs
  authentication; §10.2).
- How organization branding is applied on client-facing surfaces: colour
  validation, foreground contrast for arbitrary colours, logo upload.
- Formal accessibility target, verification method and performance budgets.
  WCAG 2.2 AA is the working baseline used for verification here.
- UI language and `<html lang>` (§10.4). Foundation copy is English for now.
- A Content Security Policy will need a nonce for the inline appearance
  scripts.
- Whether `/explore` is ever committed or shipped; today it is a local,
  untracked reference.

## Consequences

- New components use the semantic tokens, never raw colours, and inherit
  appearance automatically.
- `light-dark()` is compiled by Lightning CSS into a fallback for older
  browsers; the source stays one line per token.
- Adding shadcn components that ship their own CSS variables requires mapping
  those variables onto these tokens rather than adding separate `.dark` blocks.
