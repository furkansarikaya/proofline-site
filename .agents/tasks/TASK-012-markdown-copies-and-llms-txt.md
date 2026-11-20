# Task: TASK-012 - Markdown copies and /llms.txt

---
origin: prd:site
type: feature
size: S
depends_on:
  - TASK-011
prd: site
---

## Goal

An agent that reads the documentation can fetch the Markdown of every synced page at the page's address with `.md`, and `/llms.txt` lists every one of those pages with the address of its Markdown, each address existing in the build and answering 200 from the local server of the build check.

## Context

- Source requirements in `/docs/product/site/PRD.md`: FR-15 (an index file for agents and a Markdown version of every synced page) and the user story AC-34 (`/llms.txt` lists every synced page with its Markdown address; each listed address exists in the build output and answers status 200 from the local server of the build check).
- ADR `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 6: the Markdown of a synced page is at the page address with `.md` (`/docs/guides/daily-use.md`, `/tr/docs/guides/gunluk-kullanim.md`); the content is the upstream text with only link targets rewritten, offset-based on mdast positions, comments kept as upstream wrote them; `/llms.txt` at the root lists every synced page with title and Markdown address; site-written pages get no Markdown version in v1. ADR `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` point 2 (machine files in the address table). Architecture components C16 and C19.
- Inputs: the page manifest of TASK-011 (`src/lib/synced.ts`, which lists every synced document with its address, language, title and source) and the link map of TASK-009. The manifest holds all synced documents, the two Turkish guides included; the HTML pages of the Turkish guides arrive in TASK-013, but their Markdown copies belong here because the copy depends on the manifest only.
- Existing: `scripts/serve-dist.mjs` exports `startServer`, used by `tests/site.test.mjs` and `tests/axe.mjs` to serve `dist/`; there is no `llms.txt` and no Markdown copy.
- Expected scope (6 paths): `src/pages/[...path].md.ts`, `src/pages/llms.txt.ts`, `src/lib/synced.ts`, `scripts/lib/markdown-copy.mjs` (link-target rewriting by source position), `tests/markdown-copies.test.mjs`, `tests/fixtures/markdown-copies/`.
- Assumption: `/llms.txt` starts with the line `# proofline`, then one line `- [{title}]({address})` for each synced page, where the title is the page's H1 and the address is the root-relative Markdown address, sorted by address; the format is chosen by this task (the PRD names only the content).
- Assumption: the link targets in a Markdown copy are rewritten to the same addresses the HTML page uses (the link map of TASK-009), so a copy read by an agent leads to site pages and GitHub addresses, not to repository paths.

## Acceptance criteria

- AC-1: The site is built from the committed lock -> for every synced document of the manifest a file exists at its page address with `.md` instead of the trailing slash (`dist/docs/guides/daily-use.md`, `dist/docs/concepts/workflow.md`, `dist/docs/proof.md`, `dist/docs/skills/tdd-proof.md`, `dist/tr/docs/guides/gunluk-kullanim.md`), and the number of `.md` files in `dist/` equals the number of manifest entries.
  Covers: FR-15
- AC-2: `dist/` is listed -> it holds 0 Markdown copies for the home, get-started, trust, Claude Code and Codex, contact and not-found pages or for any index page (no file whose name is `index.md` or whose address is not in the manifest).
  Covers: FR-15
- AC-3: A fixture document without relative links is copied -> its Markdown copy equals the source byte for byte, including the frontmatter and every HTML comment.
  Covers: FR-15
- AC-4: A fixture document with three relative links, one of them inside a table cell and one with an anchor, is copied -> the copy differs from the source only in the three link targets, each target equals the address the link map returns for it, and replacing each target by the original one gives the source bytes again.
  Covers: FR-15
- AC-5: `dist/llms.txt` is read -> its first line is `# proofline`, and it holds exactly one line `- [{title}]({address})` for each manifest entry, sorted by address, with the page's H1 as the title and the Markdown address of AC-1 as the address.
  Satisfies: AC-34.
  Covers: FR-15
- AC-6: The addresses listed in `dist/llms.txt` are requested from `scripts/serve-dist.mjs` serving `dist/` -> each exists in `dist/` and answers status 200 with the bytes of its file; an address of the file that is not in `dist/` makes the test fail and names it.
  Satisfies: AC-34.
  Covers: FR-15
- AC-7: A fixture lock gains one concept document -> the build adds its Markdown copy and one line in `llms.txt` with no change to the site code.
  Covers: FR-15
- AC-8: `npm run check:links` and `npm run check:determinism` run on the built site -> both exit 0.
  Satisfies: AC-47.
- AC-9: Failure criterion (anti-goal): the task is not done if `llms.txt` lists an address that answers anything but 200, if a Markdown copy loses the frontmatter or an upstream comment, if a link target in a copy is left as a repository path, or if a Markdown copy exists for a page written for the site, even when the HTML pages are unchanged and green.

## Out of scope

- The `Content-Type: text/markdown; charset=utf-8` and `nosniff` headers for `.md` and the `text/plain` header for `/llms.txt` (`vercel.json`, TASK-027), and the serving parity in `scripts/serve-dist.mjs`.
- The links to `/llms.txt` and to the Markdown version from the docs home and the page foot (TASK-017, TASK-014).
- Markdown versions of pages written for the site (revisited at the evaluation of FR-30).
- The HTML pages of the Turkish guides (TASK-013) and the check of `llms.txt` against the whole `dist/` (TASK-029).

## Constraints

- ADR 0003 point 6: the Markdown content is the upstream text with only link targets rewritten, offset-based on mdast positions; comments are kept because Markdown is not rendered by the site.
- ADR 0001: plain `.mjs`/TypeScript, no dependency added; the build does not fetch or read a clock.

## Risks

- The offset-based rewriting is the one place where a Markdown copy can drift from the source by more than link targets; AC-3 and AC-4 pin it with byte comparisons.
- `.md` paths do not get the trailing-slash redirect on the host (ADR 0002 evidence V7); the hosting header check is TASK-027's.
- `llms.txt` lists addresses of Turkish guide copies before the Turkish HTML pages exist if TASK-013 is later; the copies exist in `dist/`, so AC-6 still holds.

## Pre-existing defects

none

## Suggested class

STANDARD - bounded change: two endpoints and one rewriting helper over an existing manifest, no new integration or boundary

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
