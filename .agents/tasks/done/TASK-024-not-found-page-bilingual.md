# Task: TASK-024 - Not-found page, bilingual

**Status:** done

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

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-024 -->
- run: TASK-024
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-23T23:55:24Z
- runtime: claude
- session: 8303465e-75e9-456e-b28c-83159dca7957
- estimate: size S
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-024 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-024 -->
# Completion Report: TASK-024

<!-- proofline:summary:begin -->
Changed: the one bilingual not-found page (an English block and a Turkish block, each with its own lang and home link), with the header language link omitted and the footer line in both languages on that page only.
Verify: `npm run build && npm test`
<!-- proofline:summary:end -->

## Implementation Summary

`src/pages/404.astro` is the one not-found page. It holds an English block (`lang="en"`, the H1 "Page not found", a sentence, the home link) and a Turkish block (`lang="tr"`, an H2 heading, a sentence, the Turkish home link). `src/lib/not-found.ts` holds the texts and `notFoundLinks(pairs)`: the two home links are always listed, and the docs links appear only when the docs pair (`/docs/` and `/tr/docs/`) is registered in the translation index, the same existence rule as the header menu. This follows the user's decision of 2026-11-24 (conditional docs links) because the docs pages do not exist yet and a link to a missing page fails the link check; so the docs part of AC-3 and AC-8 holds only in the state with the pair, which the tests prove with explicit pair lists, and today's real build links the two home pages only. `Header.astro` prints no language link on this page (the language link would be untrue when both languages are on the page); `Footer.astro` has a bilingual variant that `Base.astro` selects for this page only: one footer paragraph holding an English span and a Turkish span, each with its own lang (the design rule and the architecture decision want one footer paragraph, so the plan sentence that said two paragraphs was superseded by AC-6 and the rule; the reviews noted it). The page loads no script, links no stylesheet of its own, has no hreflang, canonical, refresh or redirect, and the local server answers an unknown path with status 404 and the body of this page. The title is the English title with the site suffix and `og:title` equals it.

## TDD Evidence

Worker evidence holds RED then GREEN per scope path with the plan commands. The fix round for the footer added tests that require exactly one footer paragraph on every built page, the two language spans in order with the notice text of both languages word for word, and the unchanged footers on all other pages, each proven non-hollow by a local mutation.

## Verification

All plan commands passed on the final tree in the verifier's own evidence worktree: tests, build, determinism check, link check and the accessibility check. Every acceptance criterion AC-1 to AC-8 maps to a passing named test. The copy of the headings and sentences in both languages is a human check recorded in the QA report.

## Assumptions

- AS-1 (low): the copy of the headings and sentences is chosen by the plan and checked by the review; the Turkish heading is an H2 because a page has one H1 — unverified
- AS-2 (low): the docs pair registration is the existence signal for the docs links, as for the menu — unverified

## Review Result

- REVIEW_PLAN: pass; REVIEW_PLAN-1 and REVIEW_PLAN-2 info rows (the docs links are judged under the user's conditional-links decision; the plan wording of two footer paragraphs is superseded by the design rule).
- REVIEW_RULES: pass after a fix round; the first run failed on one blocking finding (the not-found footer had two paragraphs while the design says one), closed by the fix; REVIEW_RULES-1 and REVIEW_RULES-2 are info rows (the plan wording, the footer line spacing on a phone).
- REVIEW_TESTS: pass; no blocking finding; informational notes on one unexplained single failure that did not repeat and on a test file that hangs when a name selection matches none of its cases.
- SECURITY: pass, no findings.
- Fix rounds: see the Facts block.

## QA Result

QA gate: waived by the user for the three design rows; all frozen scenarios passed in the last QA run. Findings of QA: QA-1, QA-2 and QA-3 blocking and waived (below); QA-4, QA-5, QA-6, QA-7 and QA-8 info rows (the axe command that runs a single check, the plan wording of the footer, the footer wrapping on a phone, the conditional docs links, a human copy check). The design group focus is waived with the same rows.
- VERIFY: pass; VERIFY-1 info row named a design-document line that the knowledge step then updated.

## Unsupported Checks

none

## Waivers

| Finding | Gate | Reason | Approval |
|---|---|---|---|
| QA-1 | QA | the page is plain text by design, so the first screen holds no drawing; the same rule fails on the base placeholder | user, approve qa-1 |
| QA-2 | QA | headline to body ratio 1.95 at 390 px, the same value as the base placeholder and the home pages (user option A) | user, approve qa-2 |
| QA-3 | QA | no animated element by design; the same rule fails on the base placeholder | user, approve qa-3 |

NOT_RERUN lines:

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)

## Execution

Generated from the decision records by `agent.sh report-execution TASK-024` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| reviewer | plan | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | rules | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| verifier | - | claude | sonnet | medium | large_diff | agent path |

## Amendments

none

## Reopen History

none

## Known Limitations / Follow-up

- The docs links on this page appear by themselves once the docs pair is registered (TASK-011, TASK-014, TASK-017); then the page needs no change, but the link check will cover them.
- The theme button stays hidden on this page because it loads no script; a theme saved on another page is not applied here.
- `tests/axe.mjs` scans only the two home pages; the gates scanned the not-found page separately.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 8)
- Gate REVIEW_PLAN: ran on the final tree: pass (gate REVIEW_PLAN, record 9)
- Gate REVIEW_RULES: ran on the final tree: pass (gate REVIEW_RULES, record 11)
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 14)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 10)
- Gate QA: ran on the final tree: pass (gate QA, record 13)
- Visual/browser check: failed on the final tree and was waived by the user (visual/browser check, gate QA:visual, record 12)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 15)

Final message line (paste it unchanged): Verification claims (from the ledger): 7 of 7 gates hold a record for the final tree; visual/browser check: failed on the final tree and was waived by the user (gate QA:visual, record 12).
Claims-hash: bef03fe546fb6da60e02d77954214a625a4ef17248a3863586c2b87c6e03bbcd
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-024` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: STANDARD
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1 REVIEW_PLAN-2
- Gate REVIEW_RULES: pass; findings: REVIEW_RULES-1 REVIEW_RULES-2
- Gate REVIEW_TESTS: pass; findings: none
- Gate SECURITY: pass; findings: none
- Gate QA: waived; findings: QA-1 QA-2 QA-3
  - Focus QA:visual: waived; findings: QA-1 QA-2 QA-3 QA-4 QA-5 QA-6 QA-7 QA-8
- Gate VERIFY: pass; findings: VERIFY-1
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 1 of 2
- Refreezes: 0
- Files changed (task-owned paths): 8
- Worker-evidence run records: total 13, ended pass 10, ended fail 3 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-024 -->
