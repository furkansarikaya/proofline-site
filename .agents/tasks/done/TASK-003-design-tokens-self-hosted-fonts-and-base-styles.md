# Task: TASK-003 - Design tokens, self-hosted fonts and base styles

**Status:** done

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-001
prd: site
---

## Goal

Every page of the site loads one stylesheet that holds the design tokens of `DESIGN.md` for light and dark, the three self-hosted font families with their licence texts, and the base typography and spacing rules, with no font or style coming from another host.

## Context

- Source requirement: NFR-1 of `/docs/product/site/PRD.md` (no page loads anything from a third-party host; fonts are self-hosted). This task adds no page content.
- Design documents: `/docs/design/DESIGN.md` sections "Tokens", "Typography", "Spacing", "Colour roles and contrast" and "Accessibility baseline"; surface document `/docs/design/DESIGN-marketing.md` (rule R-1, "The red is only the blocked slab"). Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html`; the font files and OFL texts are in `/docs/design/references/direction-c/fonts/`. Where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0001-astro-static-site-and-toolchain.md` (plain `.mjs` tests, Astro 7.4.13); `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (`style-src 'self'`, so `build.inlineStylesheets: 'never'`; no third-party host).
- Existing: `src/layouts/Base.astro` has no stylesheet; `astro.config.mjs` has no `build.inlineStylesheets`; `.gitignore` already ignores `dist/` and `.astro/`.
- Expected scope (7 paths): `src/styles/tokens.css`, `src/styles/base.css`, `public/fonts/` (ten `.woff2` files and three `OFL-*.txt` files), `src/layouts/Base.astro`, `astro.config.mjs`, `tests/design.test.mjs`, `tests/fixtures/design/` (only if a test needs a fixture).
- Assumption: the custom property names are the token names of `DESIGN.md` unchanged (`--bg`, `--surface`, `--frame`, `--ink`, `--muted`, `--accent`, `--block`, `--rule`, `--grid`, `--hatch`), and the type steps are the custom properties `--step-head`, `--step-h2`, `--step-lead`, `--step-body`, `--step-small`, `--step-mono` (the step names of the `DESIGN.md` type scale).
- Assumption: the theme attribute is `data-theme` on the `html` element with the values `light` and `dark`, as in the approved sample `controls.js` (`d.dataset.theme`); the script that sets it is TASK-005.
- Assumption: the ten font files keep the file names they have in `/docs/design/references/direction-c/fonts/` (Stack Sans Headline 400 and Stack Sans Text 400 and 500 each in `latin` and `latin-ext`, JetBrains Mono 400 and 500 each in `latin` and `latin-ext`, which gives 2 + 4 + 4 files), as the "planned" paths in `DESIGN.md` Typography name them.

## Acceptance criteria

- AC-1: The token table of `docs/design/DESIGN.md` ("Tokens") is read by a test and compared with `src/styles/tokens.css` -> all 10 token names exist, and each light and each dark value equals the table value when both are parsed as colours (same red, green, blue and alpha numbers).
- AC-2: `src/styles/tokens.css` is read as rules -> the file sets the light values when no `data-theme` attribute exists, sets the dark values under `prefers-color-scheme: dark` when `data-theme` is absent, and sets the light values for `data-theme="light"` and the dark values for `data-theme="dark"` whatever the system setting is.
- AC-3: `public/fonts/` is listed -> it holds the 10 `.woff2` files named in the Context assumption, each starting with the bytes `wOF2`, and three licence texts `OFL-jetbrains-mono.txt`, `OFL-stack-sans-headline.txt` and `OFL-stack-sans-text.txt`, each containing the text "SIL OPEN FONT LICENSE Version 1.1".
  Covers: NFR-1
- AC-4: The glyph table of the font files is read (not the CSS) -> for each of the three families at least one of its files contains a glyph for every one of the 12 letters `ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü`.
- AC-5: The font-face rules are read -> every file of `public/fonts/` has exactly one rule naming its family and weight; each `latin-ext` rule has a unicode range that includes U+011E, U+011F, U+0130, U+0131, U+015E and U+015F, and each `latin` rule has one that includes U+00C7, U+00E7, U+00D6, U+00F6, U+00DC and U+00FC.
- AC-6: The source styles and the built `dist/` are scanned -> they hold 0 `http://` or `https://` addresses, 0 `@import` rules and 0 `url(` values that do not start with `/fonts/` or `/_astro/`.
  Covers: NFR-1
- AC-7: `/` and `/tr/` are built -> each page links one same-origin stylesheet, and `dist/` pages hold 0 `style` elements and 0 `style=` attributes.
- AC-8: The base styles are read -> headings render in Stack Sans Headline at weight 400, text renders in Stack Sans Text at weights 400 and 500, and JetBrains Mono is set only on `code`, `pre`, `kbd` and `samp`.
- AC-9: The base styles are read -> the six type steps hold the values of the `DESIGN.md` type scale: head 28 to 40 px on mobile and at most 70 px on desktop, h2 26 and 36, lead 17, body 15.5 to 17, small 13.5 to 15, mono 13.5 to 14.
- AC-10: The base styles are read -> the page grid has 12 columns with 1px hairlines in `--grid`, a maximum width of 1400px and 20px side gutters, the breakpoints are 820px and 1000px, and the files hold 0 `border-radius` values other than 0, 0 `box-shadow` values other than `none` and 0 gradient functions.
- AC-11: The source styles are searched for the two values `#c4152b` and `#e0354a` and for `var(--block)` -> the two values appear only in `src/styles/tokens.css` and `var(--block)` appears 0 times (the diagram rule that may use it is TASK-018).
- AC-12: `npm test`, `npm run check:links` and `npm run test:axe` run on the built site -> they exit 0 and the axe run reports 0 violations on `/` and `/tr/` with the new styles.
- AC-13: Failure criterion (anti-goal): the task is not done if one token value differs from `DESIGN.md` by a single digit, if the dark values are computed from the light ones instead of being listed, if any font, stylesheet or image is requested from a host other than the site, or if the stylesheet is inlined into a page, even when the build is green.

## Out of scope

- The header, footer, theme button and `controls.js` (TASK-005) and every page content.
- The `--install-bg`, `--code-bg` and `--measure` tokens and the 1180px breakpoint of the docs surface (TASK-015).
- The diagram styles and the one allowed use of `--block` (TASK-018).
- The `style-src` CSP header itself (TASK-027); this task only makes the built pages compatible with it.
- Preloading fonts, subsetting or converting font files, and any font other than the three families of `DESIGN.md`.

## Constraints

- Expected test exception: the font binaries have no test-first RED (they are binary files copied from the approved sample). What is tested instead: the files exist, the signature bytes, the licence texts, the glyph coverage of the 12 Turkish letters read from the font files, the font-face rules, the absence of an external host, and the token names and values read from `DESIGN.md`.
- `DESIGN.md` Typography: all faces are self-hosted from the project (no CDN) under OFL-1.1; the licence texts are kept next to the fonts.
- ADR 0006: no inline `style` element or `style=` attribute; `astro.config.mjs` gets `build.inlineStylesheets: 'never'`.
- ADR 0001: tests are plain `.mjs` under `node --test`; no dependency is added by this task.

## Risks

- Astro inlines small stylesheets by default; without the config option the CSP of TASK-027 would block the page styles (AC-7).
- A font file with a missing Turkish glyph would fall back to a system font only for that letter; AC-4 reads the glyph table so the gap is found at build time.
- The dark values are separate designs, not derived (`DESIGN.md` "Tokens"); AC-1 compares them one by one against the document.

## Pre-existing defects

none

## Suggested class

STANDARD - bounded presentation-layer change (styles, static font assets, one layout and one build option) with no integration, persistence or security boundary of its own

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-003 -->
- run: TASK-003
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-20T12:59:30Z
- runtime: claude
- session: 8bfe83d7-18e5-44d1-9008-a045f052b9c8
- estimate: size M
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-003 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-003 -->
# Completion Report: TASK-003

<!-- proofline:summary:begin -->
Changed: design tokens (light and dark), three self-hosted font families with their licence texts and the base styles now load as one same-origin stylesheet on every page, with tests that read the design document, the fonts and the built pages.
Verify: `npm test`
<!-- proofline:summary:end -->

Written by the lead from run evidence only.

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-003 — Design tokens, self-hosted fonts and base styles; class STANDARD; tier full; branch `proofline/TASK-003-design-tokens-self-hosted-fonts-and-base-styles`
- Changed: `src/styles/tokens.css` (AC-1, AC-2, AC-10, AC-11, AC-13), `src/styles/base.css` (AC-5, AC-6, AC-8, AC-9, AC-10, AC-11), ten font files and three OFL texts under `public/fonts/` (AC-3, AC-4, AC-5), `src/layouts/Base.astro` (AC-7, AC-12), `astro.config.mjs` (AC-7), `tests/design.test.mjs` (AC-1 to AC-11, AC-13), `docs/design/DESIGN.md` (AC-10, amendment 001)
- Amendment 001: the scope gained `docs/design/DESIGN.md`, section Pattern justifications only. The source lint of the repository found 30 blocking findings in committed design reference files this task did not touch (mono-labels, hairline-newspaper, numbered-steps). The user approved three justification lines, one per pattern, with the reasons they stated, and the lint then reports the 30 findings as justified.
- Scope size: 18 code paths exceed the STANDARD limit of 15; the task was not split, on the user's batch answer.
- Knowledge step: `docs/design/DESIGN.md` still marks the token and font paths as `planned`. Updating them is a change to a path in the plan scope, which would have voided the passed gates, so it is left for the next task that touches that file (follow-up below).

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| `src/styles/tokens.css` | token and theme tests fail before the file exists | `npm test` passes | implementer |
| `src/styles/base.css` | font-face, type step, grid and ban tests fail before the file exists | `npm test` passes | implementer |
| `src/layouts/Base.astro` | built-page stylesheet test fails before the imports | `npm test` passes | implementer |
| `astro.config.mjs` | inline stylesheet test fails before the build option | `npm test` passes | implementer |
| `tests/design.test.mjs` | the breakpoint check was strengthened after a QA finding | `npm test` passes | implementer |
| `public/fonts/*.woff2` and `OFL-*.txt` | exempt: binary and licence files copied unchanged from the approved sample | `npm test` passes | implementer |
| `docs/design/DESIGN.md` | exempt: design document, no executable behaviour | source lint rerun passes | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm ci`, `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links`, `npm run test:axe`

## Assumptions

- AS-1 (low): the ten font files hold every one of the twelve Turkish letters in at least one file per family — unverified in the plan register; proven by the AC-4 test, which passed.
- AS-2 (low): Astro with inlineStylesheets never emits one same-origin stylesheet per page — unverified in the plan register; proven by the AC-7 test, which passed.
- AS-3 (low): the new test builds into its own output directory without racing the other test file — unverified in the plan register; see the intermittent run noted under Known Limitations.

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 0 | none |
| REVIEW_PLAN | pass | high | 0 | REVIEW_PLAN-1 REVIEW_PLAN-2 |
| REVIEW_RULES | pass | high | 0 | REVIEW_RULES-1 |
| REVIEW_TESTS | pass | high | 0 | REVIEW_TESTS-1 REVIEW_TESTS-2 REVIEW_TESTS-3 REVIEW_TESTS-4 REVIEW_TESTS-5 REVIEW_TESTS-6 |
| SECURITY | pass | high | 0 | none |
| QA | pass | high | 0 | QA-1 QA-2 |
| VERIFY | pass | high | 0 | VERIFY-1 |

Fix rounds used: 0 of 2.

- REVIEW_PLAN: REVIEW_PLAN-1 info the custom property `--nav-gap` is defined and unused, no criterion names it; REVIEW_PLAN-2 info amendment 001 applied exactly.
- REVIEW_RULES: REVIEW_RULES-1 info the same unused `--nav-gap` property.
- REVIEW_TESTS: REVIEW_TESTS-1 to REVIEW_TESTS-6 info, survivors and slow tests: a block red written as `rgb(196, 21, 43)` would pass the AC-11 test, a low-contrast dark `--ink` survives the axe test but is caught by the AC-1 and AC-2 tests, and the built-pages test is slow (about 167 ms).
- QA: QA-1 info an unchanged site test failed intermittently in 2 of about 26 full runs while other gate roles were working in the same tree (a 404 on the home page, read as a race on `dist`, not proven); QA-2 info the lint trims a trailing space on a justification line, while the exact-text check catches it.
- VERIFY: VERIFY-1 info `docs/design/DESIGN.md` still marks the token and font paths as `planned`.

The earlier gate rounds found a missing check for an extra width breakpoint (fixed in a fix round), hollow tests and a mutation budget that ran out (budget raised to the batch cap), and the lint scope question (amendment 001). The final gate records ran on the final tree. The mutation counter of the tests gate was started again for the final tree by the reviewer, because the content changed by the one amendment section; it counted 37 of 40 on that tree.

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)
- QA:visual: not reproduced (NOT_RERUN)

## QA Result

QA: PASS (high); all frozen scenarios passed, including the scenarios for amendment 001.

## Amendments

- 001-pattern-justifications: added `docs/design/DESIGN.md` (section Pattern justifications only) to the scope with the user's scope approval; the user then approved the three justification lines one by one; the QA plan was written again for the new plan hash.

## Execution

Generated from the decision records by `agent.sh report-execution TASK-003` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| designer | - | claude | sonnet | medium | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | runtime set by the operator |
| implementer | - | claude | opus | high | large_diff | runtime set by the operator; escalated (ESCALATED_MODEL) |
| reviewer | plan | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | runtime set by the operator |
| implementer | - | claude | sonnet | high | large_diff | runtime set by the operator |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | runtime set by the operator |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| verifier | - | claude | sonnet | medium | large_diff | agent path |

## Known Limitations / Follow-up

- `docs/design/DESIGN.md` Tokens and Typography still say `planned` for the paths that now exist, and its note that nothing is built is stale; update them in the next task that touches that file.
- The new `--step-*` custom properties are named in this report only; DESIGN.md names the steps but not the properties.
- Running other checks in the same working tree while the axe test runs can produce a false red (the build output is rewritten); gate roles should use their own evidence copy.
- Observation of the implementer: the local-server tests need a sandbox that allows binding 127.0.0.1.

## Execution

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 10)
- Gate REVIEW_PLAN: ran on the final tree: pass (gate REVIEW_PLAN, record 11)
- Gate REVIEW_RULES: ran on the final tree: pass (gate REVIEW_RULES, record 13)
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 17)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 14)
- Gate QA: ran on the final tree: pass (gate QA, record 16)
- Visual/browser check: ran on the final tree: pass (visual/browser check, gate QA:visual, record 12)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 15)

Final message line (paste it unchanged): Verification claims (from the ledger): 7 of 7 gates hold a record for the final tree; visual/browser check: ran on the final tree: pass (gate QA:visual, record 12).
Claims-hash: 8656dbe1b1985553bb3dec17f8462a0d3ee3e1d86fbf07ed80964292cf3fe969
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-003` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: STANDARD
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1 REVIEW_PLAN-2
- Gate REVIEW_RULES: pass; findings: REVIEW_RULES-1
- Gate REVIEW_TESTS: pass; findings: REVIEW_TESTS-1 REVIEW_TESTS-2 REVIEW_TESTS-3 REVIEW_TESTS-4 REVIEW_TESTS-5 REVIEW_TESTS-6
- Gate SECURITY: pass; findings: none
- Gate QA: pass; findings: QA-1 QA-2
  - Focus QA:visual: pass; findings: none
- Gate VERIFY: pass; findings: VERIFY-1
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: not_applicable; not_applicable reason: batch default (A291): no knowledge page was written, the suggestion to the user is in the report
- Suggestion to the user (knowledge): TASK-003: no knowledge note was written and nothing was changed under docs/, in skills or in rules; the task changed docs/design/DESIGN.md, a documentation path; if you want it kept, write a wiki page or a design-document change yourself, or ask for a documentation task
- Fix rounds: 0 of 2
- Refreezes: 1
- Files changed (task-owned paths): 19
- Worker-evidence run records: total 13, ended pass 9, ended fail 4 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-003 -->
