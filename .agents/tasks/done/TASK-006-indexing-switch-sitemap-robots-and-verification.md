# Task: TASK-006 - Indexing switch, sitemap, robots and verification tags

**Status:** done

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-004
prd: site
---

## Goal

The build opens the site to search engines only when it is a production build or is explicitly told so, and then publishes an https sitemap with reciprocal `hreflang` entries, a `robots.txt` that allows all, canonical addresses and the optional ownership verification tags; in every other build the whole site stays closed, and each build says in its log which mode it chose.

## Context

- Source requirements in `/docs/product/site/PRD.md`: FR-21 (sitemap, robots, canonical https addresses, reciprocal hreflang only for translated pages), FR-23 and FR-24 (verification tags from the environment, log lines without values), NFR-3 (no secret or verification value in a log line), and the user stories AC-26, AC-32, AC-33, AC-46.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` point 3 (own sitemap endpoint reading the translation index, not `@astrojs/sitemap`), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 3 (sitemap without `lastmod`), `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` (closed previews), `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 3 (both indexing variants asserted in CI, TASK-033).
- Existing (TASK-001 closed mode): `src/layouts/Base.astro` prints `<meta name="robots" content="noindex, nofollow">` on every page; `public/robots.txt` holds `User-agent: *` and `Disallow: /`; no sitemap exists; `tests/site.test.mjs` asserts these.
- Expected scope (8 paths): `src/lib/indexing.ts`, `src/layouts/Base.astro`, `src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts`, `public/robots.txt` (removed, replaced by the endpoint), `astro.config.mjs` (the build-log lines), `tests/indexing.test.mjs`, `tests/site.test.mjs` (only if an assertion needs the new log lines).
- Facts: the production origin is `https://proofline.technology`; the Bing verification meta tag is named `msvalidate.01` and the Google one `google-site-verification` (the names the two consoles define).
- Assumption: the verification tags are printed in the head of every HTML page (the layout is shared), and independently of the indexing mode.
- Assumption: the log lines are `indexing: blocked (` + a reason + `)` and `indexing: allowed`, and one line per console `verification tag: present (google)`, `verification tag: absent (google)`, `verification tag: present (bing)`, `verification tag: absent (bing)`; the PRD sets the text "verification tag: present|absent" and the service name in parentheses is added to tell the two apart.
- Assumption: only the value `1` of `SITE_INDEXABLE` opens the site; any other value (empty, `0`, `true`) leaves it closed.
- Assumption: the canonical link is printed only in an indexable build, on every page except the not-found page.

## Acceptance criteria

- AC-1: The site is built without `VERCEL_ENV=production` and without `SITE_INDEXABLE=1` -> every built page holds `<meta name="robots" content="noindex, nofollow">`, `dist/robots.txt` holds `User-agent: *` and `Disallow: /`, `dist/sitemap.xml` does not exist, and the build log holds one line `indexing: blocked (` followed by a reason that names `VERCEL_ENV` and `SITE_INDEXABLE` and `)`.
  Satisfies: AC-46.
  Covers: FR-21
- AC-2: The site is built with `VERCEL_ENV=production` -> 0 built pages hold a `robots` meta tag, `dist/robots.txt` allows all agents and points to `https://proofline.technology/sitemap.xml`, `dist/sitemap.xml` exists, and the log holds the line `indexing: allowed`.
  Satisfies: AC-46, AC-32.
  Covers: FR-21
- AC-3: The site is built with `SITE_INDEXABLE=1` and `VERCEL_ENV` unset, and again with `VERCEL_ENV=preview` and `SITE_INDEXABLE=1` -> both builds produce the same indexable output as AC-2; with `VERCEL_ENV=preview` alone, or `SITE_INDEXABLE` set to `0`, `true` or empty, the output is the closed output of AC-1.
  Satisfies: AC-46.
  Covers: FR-21
- AC-4: An indexable build is read -> `sitemap.xml` lists exactly the built HTML pages except `404.html`, the `pagefind` files and the Markdown copies, every address starts with `https://proofline.technology/` and ends with a slash, the file holds 0 `http://` addresses, and no entry has a `lastmod` element.
  Satisfies: AC-32.
  Covers: FR-21
- AC-5: An indexable build with the pair `/` and `/tr/` is read -> the sitemap entry of `/` lists `xhtml:link` alternates for `en`, `tr` and `x-default` and the entry of `/tr/` lists the same three, the alternates equal the `link rel="alternate"` tags of the same page, and a page with no pair has 0 alternates in the sitemap and 0 in its head.
  Satisfies: AC-33.
  Covers: FR-21
- AC-6: An indexable build is read -> every page except `404.html` holds exactly one `link rel="canonical"` whose address is the page's own `https://proofline.technology/` address, and a closed build holds 0 canonical links.
  Covers: FR-21
- AC-7: The site is built with `GOOGLE_SITE_VERIFICATION` set to a test value and with it empty -> the first build puts `meta name="google-site-verification"` with that value in the head of every HTML page and logs `verification tag: present (google)`; the second prints no such tag and logs `verification tag: absent (google)`; the same pair of results holds for `BING_SITE_VERIFICATION` with the tag `msvalidate.01` and the lines `(bing)`.
  Satisfies: AC-26.
  Covers: FR-23, FR-24
- AC-8: A build runs with both variables set to distinct test values -> no line of the build's standard output or error output holds either value, and in `dist/` each value appears only inside its own verification meta tag (0 matches in `sitemap.xml`, `robots.txt`, scripts and styles).
  Satisfies: AC-26.
  Covers: NFR-3, FR-24
- AC-9: A closed build and an indexable build both run with `GOOGLE_SITE_VERIFICATION` set -> both builds print the google verification tag in the head of every page, so the tags depend on the two variables only and not on the indexing mode.
  Covers: FR-23
- AC-10: Failure criterion (anti-goal): the task is not done if a closed build writes a sitemap or leaves any page without the `noindex` tag, if an indexable build leaves `noindex` on any page, if a log line holds a verification value, or if the sitemap alternates and the page tags disagree, even when every test of TASK-001 is green.

## Out of scope

- The check of the sitemap against all pages written later (TASK-029) and the CI assertion of both variants (TASK-033).
- The DNS record and the console verification (TASK-046), the launch-day sitemap submission (TASK-049).
- `vercel.json` and the Markdown content type (TASK-027); the search index files under `/pagefind/` (TASK-028).
- The translation index and the `hreflang` tags in the head, which TASK-004 provides; this task reuses them.

## Constraints

- ADR 0002 point 3: the sitemap is an own Astro endpoint that reads the translation index, so the sitemap and the page tags cannot drift.
- ADR 0003 point 3: the sitemap has no `lastmod` (build determinism, AC-47 of the PRD).
- ADR 0001: no dependency is added; the sitemap is not produced by `@astrojs/sitemap`.
- The closed mode of TASK-001 stays the default when no variable is set (a preview build must never be indexable).

## Risks

- `VERCEL_ENV` is set by the hosting only on its own builds; a local production-like check needs `SITE_INDEXABLE=1`.
- The sitemap lists the pages that exist when it is built, so pages added by later tasks appear without a change here; TASK-029 compares it with the full page set.
- Removing `public/robots.txt` for an endpoint changes where the file comes from; AC-1 and AC-2 assert the built file in both modes.

## Pre-existing defects

none

## Suggested class

COMPLEX - public contract (sitemap, robots, hreflang and canonical addresses that search engines read) across the layout, two endpoints and the build configuration

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-006 -->
- run: TASK-006
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-23T09:29:41Z
- runtime: claude
- session: 8303465e-75e9-456e-b28c-83159dca7957
- estimate: size M
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-006 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-006 -->
# Completion Report: TASK-006

<!-- proofline:summary:begin -->
Changed: the site is built closed by default and opens to search engines only for a production build or an explicit switch, with an own sitemap, robots file, canonical links and optional ownership verification tags.
Verify: `npm test`
<!-- proofline:summary:end -->

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-006 — Indexing switch, sitemap, robots and verification tags; class COMPLEX; tier full; branch `proofline/TASK-006-indexing-switch-sitemap-robots-and-verification`
- Changed: `src/lib/indexing.ts` (AC-1 to AC-9), `src/layouts/Base.astro` (AC-1, AC-2, AC-6, AC-7, AC-9), `src/pages/sitemap.xml.ts` (AC-1, AC-2, AC-4, AC-5), `src/pages/robots.txt.ts` (AC-1, AC-2), `public/robots.txt` removed (AC-1, AC-2), `astro.config.mjs` (AC-1, AC-2, AC-7), `tests/indexing.test.mjs` (AC-1 to AC-10), `tests/site.test.mjs` (AC-1, AC-10), `tests/design.test.mjs` (AC-2, AC-6)
- AC-4 is read as the plan states: no `http://` address in any `loc` or `href` value; the two namespace names in the sitemap root are not addresses.
- The verification meta values are printed entity-escaped through a helper, a hardening found by QA scenario QA-13 and inside AC-7 and AC-8.

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| src/lib/indexing.ts, Base.astro, the two endpoints, astro.config.mjs, the three test files | the indexing, site and design tests fail against a stub that returns neutral values | `npm test` passes | implementer |
| tests/indexing.test.mjs (every `escapeXml` rule) | `npm test` fails with `escapeXml` reduced to the identity | `npm test` passes | implementer |
| tests/indexing.test.mjs (`pageAddresses` rules, verification meta escaping) | `npm test` fails with three mutants applied | `npm test` passes | implementer |
| public/robots.txt | tdd_exemption: static file removed in favour of the endpoint, asserted by the indexing and closed-mode tests | not applicable | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links`, `npm run test:axe`

## Assumptions

- AS-1 (low): Astro writes `sitemap.xml.ts` and `robots.txt.ts` as `dist/sitemap.xml` and `dist/robots.txt` and a closed build writes no sitemap file — unverified (the builds of the gates observed it, the register row was not updated)
- AS-2 (low): the log line may read `indexing: allowed (VERCEL_ENV=production)` as ADR 0005 point 6 gives it — unverified
- AS-3 (low): the canonical tags of ADR 0005 point 6 always point to the apex address, and AC-6 keeps the tag out of closed builds — unverified
- AS-4 (low): build log lines reach standard output and the tests read both streams — unverified
- AS-5 (low): the variant builds of the indexing test run in a before hook so per-test budgets measure assertions only — unverified
- AS-6 (low): a closed build prints an Astro warning that it skipped writing the sitemap — unverified

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 2 | none |
| REVIEW_PLAN | pass | high | 2 | none |
| REVIEW_RULES | pass (unsupported: contract) | high | 2 | REVIEW_RULES-1 |
| REVIEW_TESTS | pass | medium | 2 | none |
| SECURITY | pass | medium | 2 | none |
| QA | pass | high | 2 | none |
| VERIFY | pass | high | 2 | VERIFY-1 |

Fix rounds used: 2 of 2 (the numbers of the Facts block).

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)
- QA:visual: not reproduced (NOT_RERUN)
- REVIEW_RULES: REVIEW_RULES-1 info the build prints an Astro warning in a closed build that the sitemap was skipped; this is how the sitemap stays absent and it is not a contract line
- VERIFY: VERIFY-1 info the C19 row of docs/design/ARCHITECTURE.md named only an indexing switch; fixed in the knowledge step

## QA Result

QA: PASS (high); scenarios 22/22.

## Unsupported Checks

- REVIEW_RULES:contract: the contract checker recognized no changed contract file because robots.txt, sitemap.xml, the head tags and the build log lines are not schema contracts; not proven: the checker's own verdict on those contracts (the reviewer's real builds in both modes matched every line of the plan's contract section)

## Execution

Generated from the decision records by `agent.sh report-execution TASK-006` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| architect | - | claude | opus | high | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| implementer | - | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | plan | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | contract | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | contract | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | plan | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | rules | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | contract | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff,fix_round_2 | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| qa | visual | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| verifier | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |

## Known Limitations / Follow-up

- Three design rationales were approved by the user for this run: mono-labels, hairline-newspaper and numbered-steps.
- The first contract-focus review recorded PASS although the checker said UNSUPPORTED; the re-runs recorded UNSUPPORTED as the skill requires.
- A closed build prints an Astro warning that it skipped writing the sitemap.
- TASK-029 and TASK-033 compare and assert the output of this task later; the log line formats are their input.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 13)
- Gate REVIEW_PLAN: ran on the final tree: pass (gate REVIEW_PLAN, record 14)
- Gate REVIEW_RULES: ran on the final tree: pass (gate REVIEW_RULES, record 15)
- Check REVIEW_RULES:contract: unsupported: it could not run here (focus REVIEW_RULES:contract, record 16); nothing is claimed
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 18)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 17)
- Gate QA: ran on the final tree: pass (gate QA, record 19)
- Visual/browser check: ran on the final tree: pass (visual/browser check, gate QA:visual, record 20)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 21)

Final message line (paste it unchanged): Verification claims (from the ledger): 7 of 7 gates hold a record for the final tree; visual/browser check: ran on the final tree: pass (gate QA:visual, record 20).
Claims-hash: ff41ca6084ec78005b69461eefd33014aabd7ae620ef8a76edf8a91e677176d4
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-006` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: none
- Gate REVIEW_RULES: pass (unsupported: contract); findings: none
  - Focus REVIEW_RULES:contract: unsupported; findings: REVIEW_RULES-1
- Gate REVIEW_TESTS: pass; findings: none
- Gate SECURITY: pass; findings: none
- Gate QA: pass; findings: none
  - Focus QA:visual: pass; findings: none
- Gate VERIFY: pass; findings: VERIFY-1
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 2 of 2
- Refreezes: 0
- Files changed (task-owned paths): 9
- Worker-evidence run records: total 7, ended pass 4, ended fail 3 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-006 -->
