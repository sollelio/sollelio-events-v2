# Sollelio Events V2 — Essential UX Blueprint v0.1

**Status:** Approved conceptual blueprint for Vertical Slice 1; technical details explicitly deferred  
**Scope:** Inquiry → Confirmed Event  
**Date:** 2026-11-01  
**Audience:** Product, UX, architecture and Claude Code implementation review

## 1. Purpose and authority

This document consolidates UX decisions approved in product discussions. It guides high-fidelity design and implementation of **Vertical Slice 1**; it is not a database schema, component specification, API contract, or permission matrix. The broader canonical product context remains authoritative for domain and architectural invariants. Where this document identifies an unresolved matter, an implementation agent must not silently decide it as product policy.

**Delivery objective:** Launch a commercially usable, secure, multi-tenant SaaS for small and medium-sized event-service businesses. V2 is greenfield and must not alter or depend on the running V1 production database. Do Luxo à Mesa provides domain evidence, not universal SaaS policy. The product is structurally multi-country, with possible sequential market launches. A consistent responsive web experience serves desktop and mobile.

## 2. Slice 1 journey

Organization creation and initial setup → sign-in → Home → public or internal Inquiry → identify/reuse Contact → create Prospective Event → work in Event Workspace → draft and publish versioned Quote → client views branded portal → client accepts verified Quote **or** requests changes → record commercial obligations → manually record payments → evaluate organization's confirmation conditions → authorized user explicitly confirms Event → preserve audit/history and surface new next action.

The journey is a reference happy path, **not** a mandatory linear state machine. An Inquiry may become a Prospective Event early. Inquiry, Event, Contact, Quote, Payment, and Confirmation remain distinct domain concepts. Quote acceptance is not Event confirmation. The client-facing Portal is a view/action surface, not a parallel system of record.

## 3. Information architecture

### Primary navigation

- **Home:** attention and next work.
- **Pedidos / Inquiries:** intake, triage and preserved original request.
- **Eventos / Events:** prospective and confirmed events; access to each Event Workspace.
- **Contactos / Contacts:** real persons/organizations and their event history.
- **Definições / Settings:** organization profile, branding, access and essential policies.

Do not add standalone primary navigation for every domain entity or copy V1's module menu. Quotes, payments and history initially live in the context of an Event Workspace. The Inquiry list is **not** a second sales funnel or competing commercial source of truth. Calendar, advanced analytics, workforce, materials and logistics are not needed as autonomous primary navigation for Slice 1.

### Event Workspace

**Default entry:** Visão geral / Overview. Header shows event identity and date, Commercial State and Confirmation State separately, and contextual next action. A prospective/confirmed indication is visible without conflating distinct domain statuses.

- **Overview:** essential event information, directly editable when simple; missing/provisional/confirmed information made legible; contextual attention, current commercial summary and recent activity.
- **Propostas / Quotes:** structured editing, preview, publishing and version history.
- **Pagamentos / Payments:** agreed obligations, received amount, derived balance, due dates, manual receipts.
- **Histórico / History:** important decisions, revisions, payments and confirmations with traceability.

Complex event information may receive a dedicated area as needed rather than overloading Overview. The same canonical Event Workspace must open from Home, Pedidos and Eventos. Do not implement Journey as a replacement for domain state, nor place every possible future module in the first Workspace.

## 4. Organization onboarding

An initial two-step onboarding, followed by an actionable real-data Home:

1. **Organization:** name and country; suggest (but do not hard-code) locale, timezone and default currency. The values must be adjustable.
2. **Branding:** optional logo and main colour, with a professional neutral fallback. End-user branding is distinct from user appearance/theme.
3. **Home:** prompt to register the first Inquiry; no invented business records or fake dashboards.

Defer nonessential settings. Before publishing a Quote or taking a commercial commitment, require the specific essential commercial conditions to be defined and validated. Organization creation, first administrator assignment and configuration writes must be authorized on the server. No creation of artificial/sample events as a prerequisite.

## 5. Home / attention model

Home prioritizes **actions over charts**: incoming Inquiries, client change requests, pending commercial decisions, payment conditions, impending deadlines and eligible Events awaiting explicit confirmation. Distinguish **action required**, **waiting for third party**, **deadline approaching** and **ready for decision** rather than marking all as urgent.

Each attention item links to the source record and a clear next action. Items are projections from canonical facts, not independently edited pseudo-statuses. The user sees only authorized organization scope. An empty organization gets useful first-action guidance, not synthetic analytics. AI prioritization and a complex rule engine are outside Slice 1.

## 6. Inquiry, Contact and prospective Event

A public or internally entered Inquiry preserves source, original message/answers, receipt time and authorship. Staff can identify or create a genuine Contact (no combined fake person for multiple people). One Contact can relate to multiple Events. After minimum triage, staff may create a Prospective Event and continue work in its Workspace; the Inquiry remains intact and linked. The system must not automatically create an Event for spam or every unqualified message. The precise entry form and intake fields are to be specified during implementation design.

## 7. Quotes / Proposals

The Quote editor is **structured commercial editing with a preview**, not a general-purpose Word-like editor. It supports individual services, packages or a mixture; descriptions, quantities, prices, discount rules, narrative presentation and relevant commercial terms, including expiry and payment obligations. Company branding is applied to the client-facing presentation. Amounts use safe decimal money handling and explicit currency/rounding semantics.

**Draft → review/preview → explicit publish → immutable published version.** A subsequent revision creates a new draft/version and never silently rewrites what was published or accepted. Publishing, sharing/delivery, viewing and acceptance are distinct events; publishing must not imply the customer received a WhatsApp message.

Requests for changes are distinct from rejection. The customer submits a description against a specific version; staff may clarify, decline or draft a revision. Publication of a new version makes it current for future decisions as appropriate, without deleting prior versions. A previously accepted version cannot be silently voided by later publication: post-acceptance amendment semantics require explicit business treatment.

## 8. Client Portal and acceptance

The end customer sees a **responsive, organization-branded** page with services, prices, commercial conditions, validity and decision actions. A SaaS account/password is **not required by default**. Secure token-based entry is acceptable, with identity/authorization checks for sensitive operations. Portal actions update the canonical business records.

**Acceptance flow:** inspect exact published version → review summary/terms → explicit consent → one-time identity verification for Slice 1 → validate authorization, eligibility and current version → atomically record decision/evidence → show clear result and next step. Possession of a forwarded link is insufficient by itself to accept a commercially consequential Quote. Store who acted, when, what exact version/terms were accepted and appropriate verification evidence; enforce expiry, retry/rate limits and idempotency. Proposal acceptance **must not** be worded as an Event reservation/confirmation if conditions remain outstanding.

**Change request:** accept free-text description with clear reassurance that the published Quote is not automatically modified; create an auditable review item linked to the relevant version, and surface a next action to staff. Never infer acceptance from a view.

## 9. Payments and confirmation

Payments are recorded manually for the first release; no gateway is required. The Event has agreed financial obligations/payment-plan terms, valid receipts and **derived** received/remaining balances. Support partial payments and preserve corrections/history instead of silently rewriting financial facts. Do not hard-code a 50/50 split or any Angola/Portugal-specific policy.

Confirmation policy is a small, understandable set of organization-configured conditions, potentially including proposal acceptance, minimum payment, validated signature or manual approval; no universal automation/rule engine. Policy satisfaction determines **eligibility**, never automatically confirms an Event. An authorized actor explicitly confirms it, with revalidation and atomic audit. The Workspace remains the same after confirmation, but attention shifts toward information and operational preparation.

Events sharing a date do not necessarily conflict. Block confirmation only for a grounded applicable restriction; unknown availability must be presented as requiring human review rather than fabricated certainty. Do not provide a casual universal “force confirmation” bypass. Legitimate changes to terms preserve old conditions and rationale; more elaborate exception/risk workflows are later scope.

## 10. Responsive UX and navigation continuity

Desktop uses the five primary destinations in a sidebar. Mobile uses a bottom bar for Home, Pedidos, Eventos, Contactos; Settings is accessible via the header/secondary navigation. Critical actions remain available on mobile, with contextual controls and progressive forms. On navigation, preserve draft input and context when reasonable; after a mutation, land on an updated source record with clear result. The same server-side authorization applies on all screen sizes. A responsive web app is sufficient for Slice 1; native app/offline work is not a prerequisite.

## 11. Non-goals and guardrails

This blueprint does not authorize broad V1 module reconstruction or implementation of advanced analytics, BPMN/workflow engines, document editors, supplier procurement, materials, fleet, workforce/payroll, country tax engines, payment gateways, automated SaaS billing, or cross-product platform abstractions. It does not authorize starting a database schema or production mutation. Use TypeScript, PostgreSQL, strong RLS/default-deny, server/database authorization, migrations, audit and focused tests as the approved **architectural direction**, subject to minimum-foundation specification.

## 12. Open implementation decisions — must be resolved deliberately

1. **Client verification delivery:** verified contact provenance, one-time code transport (no assumed SMS/WhatsApp integration), expiry/retries, recovery and availability in target markets.
2. **Availability:** minimum information required before confirmation, actual blockers versus warnings, and whether any policy needs explicit owner review.
3. **Financial corrections and post-acceptance commercial amendments:** precise edit/correction semantics, authorization, reconciliation of obligations and treatment of existing commitments.
4. **Permission matrix and roles:** concrete authorized operations for administrators, organization staff and external clients.
5. **Quote structure:** minimum field set, pricing/discount/rounding rules, required terms and publication guards.
6. **Home attention rules:** minimal deterministic rules and ordering rather than a broad workflow engine.
7. **Onboarding defaults and configuration guards:** safe initial policies and exact point at which missing settings block publishing/confirmation.

Resolve these just-in-time in scoped implementation specifications. Do not treat illustrative names, prices or percentages in prior mockups as canonical requirements.

## 13. Delivery sequence and checkpoints

1. **Consolidate this UX blueprint** and review it against canonical Product Scope and approved decisions.
2. **Minimum Correct Technical Foundation:** choose repository/tooling and module boundaries, tenant/auth/RLS strategy, locale/money/audit conventions, local/staging workflow and minimum test gates. Produce implementation-ready constraints, **not** an entire speculative schema.
3. **Slice 1 implementation:** build the coherent business path progressively, integrating user-visible UX with real secure backend behavior; inspect, test, review results and stop at each explicitly agreed boundary.
4. **Commercial beta gate:** safe onboarding, support, backup/recovery confidence, privacy/terms, observability and verified real-business workflow.

**Operating model:** Product decisions and review in ChatGPT with the user; Claude Code inspects, implements and tests within scoped prompts, reports facts/evidence, and stops. No autonomous redefining of closed decisions or jumping to the next slice.

## 14. Approval ledger

- **Checkpoint 01:** primary navigation; Inquiry preserved; early prospective Event; Workspace as event centre; distinct Commercial/Confirmation State.
- **Checkpoint 02:** Overview-first Workspace; clear next action; context editing; specialized Quotes/Payments/History areas.
- **Checkpoint 03:** structured Quote editor, preview, explicit publication, frozen versions, branded portal, verified acceptance and auditable customer change requests/revisions.
- **Checkpoint 04:** manual payments, payment plans, derived balances, configurable eligibility, explicit confirmation, partial-payment and availability-conflict UX.
- **Checkpoint 05A:** progressive two-step onboarding; first real-data Home.
- **Checkpoint 05B:** operational attention-driven Home.
- **Checkpoint 05C:** compact mobile navigation, responsive core workflows and cross-screen continuity.
- **Checkpoint 05D:** integrated conceptual consistency review; three implementation-sensitive areas carried forward, not silently resolved.

**Current state:** UX Blueprint v0.1 conceptually approved, captured in this document. Not yet implemented or tested with real users.
