# Task: TASK-004 - Translation index, page head metadata and preview image

**Status:** done

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-003
prd: site
---

## Goal

Every page head is built from one place: titles and descriptions follow the name-plus-phrase rules, `hreflang` alternates and the language-switcher target come from one translation index and appear only on pages that have a translation, a staleness check compares Turkish pages with their English source, and one preview image with a localized alternative text is attached to every page.

## Context

- Source requirements in `/docs/product/site/PRD.md`: FR-16 (name always with the descriptive phrase), FR-17 (no `/tr/` address without a translation, `hreflang` only on translated pages), FR-18 (staleness of Turkish pages), and the user stories AC-10, AC-13 and AC-14.
- ADR `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` points 3 to 7: the translation index module (point 3), `translatedFrom` frontmatter and `npm run translation:stamp` (point 4), the title and description builders and the 40-character cap (point 5), the title-rule match semantics (point 6, checked later by TASK-029), the preview image (point 7). Architecture components C18 and C26 in `/docs/design/ARCHITECTURE.md` ("Containers and components").
- Existing: `src/layouts/Base.astro` takes `lang` and `title` and prints a fixed `noindex` robots meta (the indexing switch is TASK-006); `src/pages/index.astro`, `src/pages/tr/index.astro` and `src/pages/404.astro` are placeholders; `tests/site.test.mjs` asserts "0 script elements" on the built pages.
- Expected scope (13 paths): `src/lib/translations.ts`, `src/lib/meta.ts`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/pages/tr/index.astro`, `src/pages/404.astro`, `scripts/translation-stamp.mjs`, `package.json`, `public/og-default.png`, `tests/translations.test.mjs`, `tests/meta.test.mjs`, `tests/fixtures/translations/`, `tests/site.test.mjs`.
- Facts used by the builders: the English phrase is "a deterministic engineering team for Claude Code and Codex"; the Turkish phrase is "Claude Code ve Codex için deterministik bir mühendislik ekibi". The title suffix is 72 characters in English and 75 in Turkish; the description suffix is 71 and 74.
- Assumption: the `og:image:alt` text is the name and phrase of the page language ("proofline: a deterministic engineering team for Claude Code and Codex" and "proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi"); the image is text-free, so the alternative text states what the site is, and no design document gives other wording.
- Assumption: `og:image` is the absolute address `https://proofline.technology/og-default.png`.
- Assumption: the two home pages are the first pair registered in the index; every later page task registers its own pair in the same index (one entry per pair).
- Assumption: the notice that a Turkish page written for the site is stale has no designed wording yet, so this task builds the staleness data and the warning only; the notice of Turkish guides is TASK-013.

## Acceptance criteria

- AC-1: The title builder gets the page title "Get started" for an English site-written page -> it returns "Get started | proofline: a deterministic engineering team for Claude Code and Codex"; for the Turkish page title "Başlarken" it returns "Başlarken | proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi".
  Satisfies: AC-10.
  Covers: FR-16
- AC-2: The builder gets a site-written page title of 41 characters -> the build fails and the message names the page; a title of exactly 40 characters passes.
  Satisfies: AC-10.
  Covers: FR-16
- AC-3: The builder gets the home page of each language -> it returns the name and phrase only: "proofline: a deterministic engineering team for Claude Code and Codex" and "proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi", and no title it returns ends with the name alone.
  Satisfies: AC-10.
  Covers: FR-16
- AC-4: The builder gets the H1 of a synced page, 48 characters long -> the title holds all 48 characters followed by " | proofline: " and the phrase of the page language; a title above 120 characters prints a warning naming the page and the build exits 0; a title of exactly 120 characters prints no warning.
  Satisfies: AC-10.
  Covers: FR-16
- AC-5: The description builder gets a lead text of 20, 120 and 400 characters in each language -> the description it returns is a lead cut at a word boundary with "…" only when needed, followed by " proofline: " and the phrase and ".", and its total length is between 70 and 160 characters in all six cases.
  Satisfies: AC-10.
  Covers: FR-16
- AC-6: Every page is built -> its head holds a meta description, `og:title` equal to the title element, `og:description` equal to the description, `og:image` equal to `https://proofline.technology/og-default.png` and a non-empty `og:image:alt` in the page language that carries the name and the phrase of that language.
  Satisfies: AC-10.
  Covers: FR-16
- AC-7: `public/og-default.png` is read -> it holds a PNG of exactly 1200 by 630 pixels, and `dist/og-default.png` exists after the build.
- AC-8: The home pages `/` and `/tr/` are built -> each holds exactly one `application/ld+json` block with a `WebSite` whose `name` equals "proofline: a deterministic engineering team for Claude Code and Codex" (Turkish page: the Turkish phrase form), and every other built page holds 0 such blocks and 0 other script elements.
  Satisfies: AC-10.
  Covers: FR-16
- AC-9: The index holds the pair `/` and `/tr/` and the pages are built -> each of the two pages holds `link rel="alternate"` tags for `en`, `tr` and `x-default` with the absolute addresses `https://proofline.technology/`, `https://proofline.technology/tr/` and `https://proofline.technology/` (the English address), and the set on one page equals the set on the other.
  Satisfies: AC-13.
  Covers: FR-17
- AC-10: A page with no pair in the index is built (the 404 page, and a fixture page) -> it holds 0 `hreflang` tags, and every built page has a `lang` attribute on its `html` element equal to the language of its address.
  Satisfies: AC-13.
  Covers: FR-17
- AC-11: The switcher target is asked for a paired page, a docs page without a pair and any other page without a pair -> it returns the address of the other language for the pair, `/tr/docs/` for the unpaired docs page and `/tr/` for the other, and it flags the unpaired pages as having no Turkish version.
  Satisfies: AC-13.
  Covers: FR-17
- AC-12: A fixture pair is added to the index by one entry -> both pages of the fixture carry the three alternate tags and the switcher target of each page returns the other address, with no other file changed.
  Covers: FR-17
- AC-13: A Turkish guide fixture records a `translated-from` blob id that differs from the blob id of its English file -> `isStale` returns true and the build prints a warning naming the page and exits 0; with equal blob ids `isStale` returns false and no warning is printed.
  Satisfies: AC-14.
  Covers: FR-18
- AC-14: A site-written Turkish page fixture records `translatedFrom: { page, hash }` -> `isStale` returns true after one character of its English content file changes, and false after only the line endings (CRLF against LF) or the leading and trailing white space of that English file change, because the hash is the sha256 of the file with LF line ends and trimmed.
  Satisfies: AC-14.
  Covers: FR-18
- AC-15: `npm run translation:stamp` runs with the path of a Turkish content file -> the file's `translatedFrom.hash` equals the current hash of its English file, every other frontmatter key and the body stay byte for byte as they were, and a second run changes nothing; with a path that is not a Turkish content file the command exits non-zero and names the path.
  Covers: FR-18
- AC-16: A stale fixture page is built -> its HTML holds neither the recorded blob id or hash nor the current one.
  Satisfies: AC-14.
  Covers: FR-18
- AC-17: Failure criterion (anti-goal): the task is not done if any page without a translation carries an `hreflang` tag, if a title carries the name without the phrase of its language, if a site-written title longer than 40 characters passes the build, or if the head tags and the switcher read from different sources, even when the build is green.

## Out of scope

- The indexing switch, the `robots` meta variants, canonical links, the sitemap and the verification tags (TASK-006); the `noindex` meta stays as it is.
- The header, footer and language-switcher markup (TASK-005); this task only provides the target.
- The notice text for stale Turkish pages and the Turkish guide pages (TASK-013); the check of the title rules over the whole `dist/` (TASK-029).
- Registering the pairs of the pages written later; each page task adds its own entry.
- The look of the preview image beyond its size; runtime image generation.

## Constraints

- Expected test exception: `public/og-default.png` is a binary drawing with no test-first RED. What is tested instead: its pixel size (AC-7), that it ships to `dist/`, and that every page points to it with the alternative text of AC-6.
- ADR 0002 point 3: the sitemap and the switcher read the same index (the sitemap itself is TASK-006); point 4: the hash is the sha256 of the English content file with LF line ends, trimmed; point 5: the 40-character cap applies to site-written titles only.
- ADR 0006: the JSON-LD block is the only inline script-type element allowed (`type="application/ld+json"`, not executed).
- ADR 0001: plain `.mjs` scripts and `node --test`; no dependency is added.

## Risks

- `tests/site.test.mjs` asserts "0 script elements" (TASK-001 AC-3); this task changes that assertion to allow the JSON-LD block only, and TASK-005 changes it again for the controls script.
- Site-written Turkish pages need a stamp after every English change; a forgotten stamp shows as a warning, by design (ADR 0002 consequences).
- The `og:image:alt` wording is an assumption (Context); the owner may want other text at the design review.

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (index, builders, layout, stamp script) and a public contract (hreflang tags and head metadata that search engines read)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-004 -->
- run: TASK-004
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-22T20:42:36Z
- runtime: claude
- session: 539cc842-8fd6-4aa6-9892-b38539b7c09f
- estimate: size L
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-004 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-004 -->
# Completion Report: TASK-004

<!-- proofline:summary:begin -->
Changed: one translation index and one set of head builders now feed every page head (titles, descriptions, og tags, alternate links, JSON-LD on the two home pages), plus a staleness check, a stamp command and a preview image.
Verify: `npm test`
<!-- proofline:summary:end -->

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-004 — Translation index, page head metadata and preview image; class COMPLEX; tier full; branch `proofline/TASK-004-translation-index-page-head-metadata-and-preview`
- Changed: src/lib/meta.ts (AC-1 to AC-6, AC-8), src/lib/translations.ts (AC-9 to AC-14, AC-16, AC-17), src/layouts/Base.astro (AC-6, AC-8, AC-9, AC-10, AC-16, AC-17), src/pages/index.astro, src/pages/tr/index.astro (AC-6, AC-8, AC-9, AC-10), src/pages/404.astro (AC-6, AC-10), scripts/translation-stamp.mjs and package.json (AC-15), public/og-default.png (AC-7), tests/meta.test.mjs, tests/translations.test.mjs, tests/site.test.mjs, tests/design.test.mjs (scope added by amendment 001) and the fixtures under tests/fixtures/translations/.
- Knowledge step: ADR 0011 was published as accepted at the product owner's request (docs/adr/0011-translation-index-pairs-are-index-entries.md, listed in docs/adr/README.md and docs/design/ARCHITECTURE.md); the switcher sentence in docs/design/DESIGN.md (header controls rule 3) now follows ADR 0002 point 3 and ADR 0011; the C18 boundary row of docs/design/ARCHITECTURE.md lists `isStale(source, options)` and `checkStale(page, source, options)`.

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| src/lib/meta.ts, tests/meta.test.mjs | `node --test tests/meta.test.mjs` fails on assertions (builders absent at base) | `npm test` passes | implementer |
| src/lib/translations.ts, tests/translations.test.mjs | `node --test tests/translations.test.mjs` fails on assertions | `npm test` passes | implementer |
| scripts/translation-stamp.mjs, package.json | stamp tests fail on assertions | `npm test` passes | implementer |
| src/layouts/Base.astro, src/pages/index.astro, src/pages/tr/index.astro, src/pages/404.astro, tests/site.test.mjs | built-page tests fail on assertions | `npm test` passes | implementer |
| tests/design.test.mjs | host scan test fails on the required absolute addresses | `npm test` passes | implementer |
| public/og-default.png | exempt (binary drawing); its size and copy to dist are tested in tests/site.test.mjs | `npm test` passes | implementer |
| tests/fixtures/translations/ (guide and content data files) | exempt (fixture data read by tests/translations.test.mjs) | `npm test` passes | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm ci`, `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links`, `npm run test:axe`

## Assumptions

none

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 0 | none |
| REVIEW_PLAN | pass | high | 0 | none |
| REVIEW_RULES | pass | high | 0 | REVIEW_RULES-1 REVIEW_RULES-2 |
| REVIEW_TESTS | pass | medium | 0 | REVIEW_TESTS-1 |
| SECURITY | pass | high | 0 | SECURITY-1 SECURITY-2 SECURITY-3 |
| QA | pass | high | 0 | QA-1 QA-2 QA-3 QA-4 |
| VERIFY | pass | high | 0 | VERIFY-1 |

Fix rounds used: 0 of 2 (the numbers of the Facts block).

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_RULES:contract: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- SECURITY:dependencies: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)
- QA:visual: not reproduced (NOT_RERUN)

Findings by id (all info):

- REVIEW_RULES: REVIEW_RULES-1 info a description lead that starts with a one-letter word and one very long word is cut to the short word plus the ellipsis; the 70 to 160 range still holds. REVIEW_RULES-2 info the Base props change is covered by the plan contracts and every in-repo caller uses the new props.
- REVIEW_TESTS: REVIEW_TESTS-1 info a clock read in tests/site.test.mjs is unchanged since the base and was cleared as a false positive.
- SECURITY: SECURITY-1 info the npm audit tool was unavailable to this role, so known vulnerabilities were not checked; the dependency set is unchanged. SECURITY-2 info the new named script is not a lifecycle hook. SECURITY-3 info no license policy is configured, so no license check was done.
- QA: QA-1 info a leading byte order mark does not change the content hash. QA-2 info a 40-letter fixture title looks like a hash run but is page text. QA-3 info the stamp refuses an empty hash value and leaves the file unchanged. QA-4 info no scenario failed and the page bodies equal the base build.
- VERIFY: VERIFY-1 info design-sync drift of 38 claims in the design documents that name later-task paths or an extractor limit.

## QA Result

QA: PASS (high); scenarios 34/34.

## Waivers

None.

## Amendments

001-design-test-host-scan.md: added tests/design.test.mjs to the scope so its host scan skips only the og content, the alternate link addresses and the JSON-LD block; approval kind scope, given by the user.

## Execution

Generated from the decision records by `agent.sh report-execution TASK-004` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| explorer | - | claude | sonnet | medium | none | agent path |
| architect | - | claude | opus | high | none | agent path |
| designer | - | claude | sonnet | medium | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| qa | - | claude | opus | medium | large_diff | escalated (ESCALATED_MODEL); agent path |
| implementer | - | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | contract | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| security_reviewer | dependencies | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| verifier | - | claude | sonnet | medium | large_diff | agent path |

## Known Limitations / Follow-up

- The `translated-from` header form used by the guide fixtures (tests/fixtures/translations/guides/tr-fresh.md) is an assumption; TASK-013 must confirm it.
- The host scan of tests/design.test.mjs still reads src/layouts/Base.astro without a skip, so later layout tasks keep absolute addresses in src/lib/.
- The page task that registers the next pair adds one entry to `PAIRS` in src/lib/translations.ts.
- The og:image:alt wording is the task assumption; the owner may change it at the design review.
- The three design rationales hairline-newspaper, mono-labels and numbered-steps were accepted for this batch only (30 pre-existing lint findings in docs/design/references/).
- The 38 design-sync drift claims name paths that later tasks create.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 1)
- Gate REVIEW_PLAN: ran on the final tree: pass (gate REVIEW_PLAN, record 5)
- Gate REVIEW_RULES: ran on the final tree: pass (gate REVIEW_RULES, record 3)
- Check REVIEW_RULES:contract: ran on the final tree: pass (focus REVIEW_RULES:contract, record 2)
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 6)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 4)
- Check SECURITY:dependencies: ran on the final tree: pass (focus SECURITY:dependencies, record 7)
- Gate QA: ran on the final tree: pass (gate QA, record 8)
- Visual/browser check: ran on the final tree: pass (visual/browser check, gate QA:visual, record 9)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 10)

Final message line (paste it unchanged): Verification claims (from the ledger): 7 of 7 gates hold a record for the final tree; visual/browser check: ran on the final tree: pass (gate QA:visual, record 9).
Claims-hash: 21377ff5c6699cb99cbb93e55d04577b084ef77928ec417f222e7610807b00d6
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-004` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: none
- Gate REVIEW_RULES: pass; findings: REVIEW_RULES-1
  - Focus REVIEW_RULES:contract: pass; findings: REVIEW_RULES-1 REVIEW_RULES-2
- Gate REVIEW_TESTS: pass; findings: REVIEW_TESTS-1
- Gate SECURITY: pass; findings: SECURITY-1 SECURITY-2
  - Focus SECURITY:dependencies: pass; findings: SECURITY-1 SECURITY-2 SECURITY-3
- Gate QA: pass; findings: QA-1 QA-2 QA-3 QA-4
  - Focus QA:visual: pass; findings: none
- Gate VERIFY: pass; findings: VERIFY-1
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 0 of 2
- Refreezes: 1
- Files changed (task-owned paths): 26
- Worker-evidence run records: total 29, ended pass 17, ended fail 12 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-004 -->
