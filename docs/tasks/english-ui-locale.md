# Task: English as a second interface locale

**Status:** Proposed, not started. Bounded task for after the repository is
shared.
**Why:** both developers must be able to explore, test and review the whole
product independently. pt-PT stays the default and remains complete.
**Decision record:** this settles part of Technical Foundation §10.4 (locale
and internationalization approach), extending ADR 0005. The implementation PR
records it in a new ADR. Until then, this document is a proposal.

## What exists today

- **One dictionary:** a single typed object, `ptPT`, in
  `src/messages/pt-PT.ts`, with `Messages = typeof ptPT`.
- **Locale is fixed:** `getMessages()` takes no locale, and
  `LOCALE = "pt-PT"` is a constant (`src/messages/index.ts`). That constant
  drives `<html lang>`, date formatting (`local-date-time.tsx`), country names
  and sorting (`countries.ts`, `active-organization.ts`).
- **Client components receive copy as props** (type-only imports), so no
  dictionary reaches the browser bundle. Exception:
  `src/app/onboarding/error.tsx`, a client error boundary, calls
  `getMessages()` directly.
- **Errors are keys, not strings.** Server Functions and validation return
  keys (`FieldErrorKey`, `InquiryFormErrorKey`, `AnswerErrorKey`, …), rendered
  through the dictionary. Validation, errors and confirmations therefore need
  translations, not code changes.
- **Metadata is fixed at module load.** 13 files (12 pages and the root
  layout) declare `export const metadata` with copy from `getMessages()`,
  evaluated once.
- **One hard-coded string:** the hidden honeypot label in
  `src/components/public-forms/public-form.tsx`.
- **Database-originated text:** the default Inquiry form's title, intro,
  questions and help text are created in pt-PT by
  `private.create_default_inquiry_form`. They are organization data.

## Scope (in priority order)

### P1 — Every screen available in English

1. **Dictionary:** add `src/messages/en.ts`, exporting `en: Messages`. The
   type forces the same keys as pt-PT, so a missing translation fails
   `npm run check`. Use British English to match the European market.
2. **Locale model** (`src/messages/index.ts`):
   - `SUPPORTED_LOCALES = ["pt-PT", "en-GB"]`, with `DEFAULT_LOCALE = "pt-PT"`
   - `getLocale()`, server-only, reads the `locale` cookie and falls back to
     the default for a missing or unknown value
   - `getMessages(locale)`
3. **Persistence:** a cookie named `locale`. It holds no personal data and is
   set by a small Server Function, with `SameSite=Lax`, a one-year lifetime
   and `Path=/`. The page then refreshes.
   - Not a URL prefix (`/en/…`): no route restructuring, and public form links
     stay stable.
   - Not `localStorage` like appearance, because the server needs the locale
     to render text.
   - No automatic detection from `Accept-Language`, so client-facing pages
     stay pt-PT unless someone explicitly chooses English.
4. **Switcher:** a language control (Português / English) beside the
   appearance switcher in the account menu, and on the signed-out auth and
   onboarding pages.
5. **Server rendering:**
   - pages and layouts call `getMessages(await getLocale())` and pass `copy`
     to client components as today
   - the 13 static `metadata` exports become `generateMetadata`
   - `<html lang>` comes from the locale
   - `LOCALE` is replaced by the resolved locale wherever it is used for
     formatting (dates, country names, sorting)
6. **The client error boundary:** pass it the resolved copy through a minimal
   provider in the root layout, or derive it from
   `document.documentElement.lang`. Choose the smaller option during
   implementation.
7. **Accessibility:**
   - every `aria-*` label and visually hidden text comes from the dictionary
     (true today; keep it so)
   - move the honeypot label into the dictionary
   - verify `lang` changes with a screen reader spot check

### P2 — Public pages

The public form, confirmation and unavailable pages use the same mechanism.
That gives a visitor's form chrome (buttons, "(optional)", validation and
error messages, the privacy notice, the confirmation) in the chosen locale.

**Never translated:** form title, intro, questions, help text and choice
options. These are organization data and are rendered exactly as stored. An
English-locale viewer of a pt-PT form therefore sees English chrome around
pt-PT questions. That is expected and acceptable for testing.

### Out of scope (open decisions, not part of this task)

- **A per-user language stored in the database** (requires a profile table;
  backend decision).
- **An organization-level language:**
  - the language of the default form when it is created
  - the default locale of that organization's public pages

  Product decision; until it is made, the default form is created in pt-PT.

- **Supabase Auth emails** (confirmation): templates are configured in the
  Supabase dashboard, in one language.
- **Translating any user or business data:** organization names, inquiry
  messages, staff summaries, form questions and answers. Never translated.
- **Locale-specific formats beyond `Intl`** (currencies, addresses), because
  no screen needs them yet.

## Done when

- [ ] Every screen in `src/app/` (signed in, signed out, public) renders fully
      in English after switching, and fully in pt-PT by default and after
      switching back. No mixed chrome.
- [ ] A missing or unknown `locale` cookie falls back to pt-PT.
- [ ] `en` and `ptPT` have identical keys (enforced by type), and no value is
      empty (unit test).
- [ ] Validation, Server Function errors, confirmations, page titles and
      accessibility labels are localized; `<html lang>` matches.
- [ ] Organization-configured form content is unchanged in both locales.
- [ ] `npm run check` and `npm run build` pass; screenshots of key screens in
      both locales (mobile and desktop, light and dark) are in the PR.
- [ ] An ADR records the locale approach (§10.4).

## Split and size

| Part                                                                    | Lead   | Size                                           |
| ----------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| Locale model, cookie Server Function, `getLocale()`, `generateMetadata` | Hélio  | Small                                          |
| `en.ts` wording, switcher UI, accessibility pass, screenshots           | Ahmad  | Medium (~420 lines of copy)                    |
| Replacing `LOCALE` and threading the locale through pages               | Either | Small (19 files use `getMessages` or `LOCALE`) |

**Suggested order:**

1. The locale model and the switcher, with `en.ts` initially copying the pt-PT
   values.
2. Translate section by section.

No database change is needed.
