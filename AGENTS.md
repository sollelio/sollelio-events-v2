<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules — Sollelio Events V2

- Read `docs/README.md` first. The Essential UX Blueprint
  (`docs/ESSENTIAL_UX_BLUEPRINT_V0.1.md`) is canonical for Slice 1 UX; do not
  redefine its approved decisions or silently resolve its open decisions (§12).
- The Technical Foundation (`docs/TECHNICAL_FOUNDATION_V0.1.md`) is canonical
  for architecture, access, domain boundaries, core invariants and delivery
  sequence. Do not silently resolve its open implementation details (§10).
- Work only within the scoped task, report facts and evidence, and stop at the
  agreed boundary. Do not start the next slice or step.
- Never touch Sollelio Events V1 or its production database. Do not provision,
  connect to, or modify infrastructure, and do not deploy, unless explicitly
  asked.
- No speculative abstractions or placeholder modules.
- Before finishing, run `npm run check` and `npm run build`.
