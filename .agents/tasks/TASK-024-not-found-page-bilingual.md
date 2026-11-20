# Task: TASK-024 - Not-found page, bilingual

---
origin: prd:site
type: feature
size: S
depends_on:
  - TASK-004
  - TASK-005
prd: site

---

## Goal

A visitor who reaches an address the site does not define sees one page, `404.html`, with an English block and a Turkish block, each in its own language, each with links to the home page and to the documents in its language.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-19 (one not-found page, English and Turkish text, links to the home page and the documents in both languages), FR-17 (the not-found page is one page with an English block and a Turkish block, each with its own `lang`), AC-28 (the build part: the page content; the status 404 itself is proven live in TASK-047 and TASK-049).

- Design: `/docs/design/DESIGN-marketing.md` (the not-found page is in the surface list; it follows the rules of "Layout rules" and "Copy rules"; no page-specific design exists); `/docs/design/DESIGN.md` sections "Typography" and "Spacing". Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html` (header, type and the plain-paragraph treatment of the limits text). A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (address table row "not found": `/404.html`, one page with an `lang="en"` block and a `lang="tr"` block; point 5 titles), the later check of the page in the dist checker is `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 4 (links to `/`, `/tr/`, `/docs/`, `/tr/docs/`).
- Today: `src/pages/404.astro` exists from TASK-001 as a placeholder on the shared Base layout and `scripts/serve-dist.mjs` serves it with status 404; TASK-004 gives the title builders; TASK-005 gives the header and footer.
- Assumption: the html element carries `lang="en"`, the English block carries `lang="en"` and the Turkish block carries `lang="tr"` (the design says only that each block has its own `lang`).
- Assumption: the headings are "Page not found" and "Sayfa bulunamadı"; the link texts are "Home" and "Docs" in the English block and "Ana sayfa" and "Belgeler" in the Turkish block (the copy is not designed; the menu word "Docs" and the tree title "Belgeler" exist in the design documents).
- Assumption: the page title is the English page title plus the English suffix of ADR 0002 point 5, `Page not found | proofline: a deterministic engineering team for Claude Code and Codex`, because the html element is English.
- Assumption: the header language link is left out of this page, because both languages are on the page and the link text "TR: read this page in Turkish" would be untrue; the theme and GitHub controls stay.
- Expected scope: `src/pages/404.astro`, `src/styles/not-found.css`, `tests/not-found.test.mjs`. 3 paths.

## Acceptance criteria

- AC-1: The site is built -> `dist/404.html` is present, and the build output holds no other file named `404.html` or `404/index.html`, and no `/tr/404.html`.
  Covers: FR-19
- AC-2: `dist/404.html` is read -> it holds one block with `lang="en"` and one block with `lang="tr"`, the English block holds an H1 "Page not found" and the Turkish block a heading "Sayfa bulunamadı", and neither block's text is inside an element of the other language.
  Covers: FR-17, FR-19
- AC-3: The English block is read -> it links to `/` (text "Home") and `/docs/` (text "Docs"); the Turkish block links to `/tr/` (text "Ana sayfa") and `/tr/docs/` (text "Belgeler"); all four targets exist in the build output.
  PRD ids: AC-28
  Covers: FR-19
- AC-4: `dist/404.html` is read -> it holds no `hreflang` alternate, no meta refresh, no script element other than `controls.js`, and no redirect of any kind (FR-19: old addresses are not redirected).
  Covers: FR-19
- AC-5: `dist/404.html` is read -> its title is `Page not found | proofline: a deterministic engineering team for Claude Code and Codex`, `og:title` equals it, and neither contains "evidence" or "kanıt".
  PRD ids: AC-10
  Covers: FR-16
- AC-6: `dist/404.html` is read -> the header holds the brand, the menu, the GitHub link and the theme button, holds no language link, and the footer line of the Turkish and English texts of PRD note N-3 is present.
  Covers: FR-17
- AC-7: `scripts/serve-dist.mjs` serves a path the site does not define (`/old-page/`) -> it returns status 404 with a body equal to the content of `dist/404.html`.
  PRD ids: AC-28
  Covers: FR-19
- AC-8: Failure criterion (anti-goal): the task is not done if the page is two pages (a separate Turkish 404), if either block lacks its own `lang`, if a block has no link to its home page or its docs, or if the page redirects, even when the build is green.

## Out of scope

- The 404 status on the real host and the answers of the 94 old addresses (TASK-041, TASK-047, TASK-049).
- The local server's routing and headers (TASK-027).
- The sitemap, which excludes this page (TASK-006), and the dist check of the page (TASK-029, TASK-030).
- Redirects from old addresses (FR-19 forbids them).
- A search box or a list of suggested pages.

## Constraints

- Expected test exception: none; the page content and the local server response have a RED.
- One page only, per the address table (ADR 0002): no per-language 404 files.
- Turkish text keeps its letters (`ğ ş ı ü ö ç`) and is not transliterated.
- No new dependency; no inline style or script (ADR 0006).

## Risks

- The hosting may not serve `404.html` with status 404; this is proven by a live check right after the switch (TASK-047), not here.
- The copy of the headings and links is not designed; a reviewer must read both blocks.
- Leaving out the language link is a decision of this task; if the product owner wants the link, it goes to the Turkish home page and its text must not say "read this page in Turkish".

## Pre-existing defects

none

## Suggested class

STANDARD - one page and a small stylesheet on the existing layout; no integration, persistence or security boundary

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
