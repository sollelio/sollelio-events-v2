# Documentation

| Document                                                      | Status   | Purpose                                                                                                  |
| ------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| [Essential UX Blueprint v0.1](ESSENTIAL_UX_BLUEPRINT_V0.1.md) | Approved | Canonical UX decisions for Vertical Slice 1                                                              |
| [Technical Foundation v0.1](TECHNICAL_FOUNDATION_V0.1.md)     | Approved | Canonical architecture, access, domain boundaries, invariants, delivery sequence and design requirements |
| [decisions/](decisions/)                                      | —        | Architecture decision records (ADRs), numbered                                                           |

## Authority

1. Canonical product context (domain and architectural invariants) — maintained
   outside this repository.
2. Approved documents in this folder: the UX Blueprint (canonical for UX) and
   the Technical Foundation (canonical for technical and architectural
   decisions). Neither silently overrides the other; a conflict is raised for a
   product decision.
3. ADRs in `decisions/`, which record technical choices and must not contradict
   1 or 2.

Open decisions listed in the UX Blueprint (§12) and open implementation details
in the Technical Foundation (§10) must be resolved deliberately in scoped
specifications; implementation must not settle them silently.

## Conventions

- Approved documents are preserved verbatim (excluded from Prettier). Revisions
  create a new versioned file rather than editing an approved one in place.
- ADRs are named `NNNN-short-title.md` and record context, decision,
  consequences and what is deliberately deferred.
