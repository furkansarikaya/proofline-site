# Task: TASK-005 - Site header, footer and controls script

**Status:** done

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-003
  - TASK-004
  - TASK-007
prd: site
---

## Goal

Every page of the marketing surface has the header (brand, menu, GitHub icon link, language link, theme button), the one-line footer, and a copyable command component, all driven by one small same-origin controls script that remembers the theme and runs the copy button, and every control still works or degrades as designed when that script does not run.

## Context

- Source requirements in `/docs/product/site/PRD.md`: N-3 (footer line), N-4 (header controls), N-5 (one controls script of at most 2048 bytes), NFR-1 (no cookie, no counting script).
- Design documents: `/docs/design/DESIGN.md` sections "Header controls (rules)" rules 1 to 7, "Components (shared)" and "Accessibility baseline"; `/docs/design/DESIGN-marketing.md` sections "Footer (one line, ADR 0006)" and "States of the first screen". Approved sample: `/docs/design/references/direction-c/c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html`, with `controls.js` (1462 bytes) and `icons/` (`github.svg`, `sun.svg`, `moon.svg`) in the same folder. Where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (point 3 referrer, amendment of 2026-11-20 on the controls script), `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (address table, point 8 navigation), `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` (amendment: browser case with the script blocked).
- Existing: `src/layouts/Base.astro` has no header or footer and no script; `tests/axe.mjs` runs axe with Playwright against `dist/` served by `scripts/serve-dist.mjs`; `tests/site.test.mjs` asserts "0 script elements" on the built pages (changed by TASK-004 to allow the JSON-LD block).
- Expected scope (14 paths): `src/components/marketing/Header.astro`, `src/components/marketing/Footer.astro`, `src/components/marketing/CommandBlock.astro`, `src/lib/nav.ts`, `src/assets/icons/` (three SVG files), `public/assets/controls.js`, `src/styles/components.css`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/pages/tr/index.astro`, `tests/header-footer.test.mjs`, `tests/controls.mjs`, `tests/site.test.mjs`, `package.json` (script `test:controls`).
- The menu entries are Home, Get started, Docs, Trust, Claude Code + Codex (ADR 0002 point 8, in this order) with the addresses of the ADR 0002 address table. The "Contact" entry is not part of this task (TASK-026 adds it).
- Assumption: most menu targets do not exist yet when this task is done (`/get-started/`, `/docs/`, `/trust/`, `/claude-code-and-codex/` arrive in later tasks), so the menu lists an entry only when its page exists in the build, and the link check keeps passing at every step; the full five-entry menu is asserted with a fixture list of existing pages.
- Assumption: Turkish menu labels are "Ana sayfa", "Başlarken", "Belgeler", "Güven" and "Claude Code ve Codex" ("Başlarken", "Güven" and "Claude Code ve Codex" are in the approved Turkish sample; "Belgeler" is the docs name in `DESIGN-docs.md`; "Ana sayfa" is not in any design document).
- Assumption: the texts of the copy button come from the approved sample: button "Copy" / "Kopyala", done "Copied" / "Kopyalandı", clipboard refused "Could not copy; the command is selected, copy it by hand" / "Kopyalanamadı; komut seçildi, elle kopyalayın".
- Assumption: the footer LICENSE link needs the pinned commit of `sync/pin.json`, which TASK-007 creates and on which this task depends; if that file is missing the link goes to the `main` branch address, and when the file exists it uses its commit. TASK-007 should land before the launch; the full check of the pinned address is AC-8.
- Assumption: the two home placeholders show the copyable command component with the two Claude Code install lines of the approved sample (`/plugin marketplace add furkansarikaya/proofline` and `/plugin install proofline@proofline`) so the component and the script can be tested on a built page; TASK-019 replaces the content.

## Acceptance criteria

- AC-1: A page is built in English -> the header holds, in this order, the brand "proofline" linking to `/`, the menu links, the GitHub icon link, the language link and the theme button, and on a Turkish page the same order with `/tr/` as the brand target.
  Satisfies: N-4.
- AC-2: The set of existing pages is declared as all five menu pages -> the menu shows "Home", "Get started", "Docs", "Trust", "Claude Code + Codex" in that order with the addresses `/`, `/get-started/`, `/docs/`, `/trust/`, `/claude-code-and-codex/`, and in Turkish "Ana sayfa", "Başlarken", "Belgeler", "Güven", "Claude Code ve Codex" with `/tr/`, `/tr/baslarken/`, `/tr/docs/`, `/tr/guven/`, `/tr/claude-code-ve-codex/`; with only the home page existing the menu shows the home entry and no link to an address missing from `dist/`.
  Satisfies: N-4.
- AC-3: The GitHub icon link is read in the built page -> it points to `https://github.com/furkansarikaya/proofline`, has the accessible name "proofline on GitHub" (Turkish "GitHub'da proofline"), carries no `rel` value containing `noreferrer`, and the page sets no referrer policy of `no-referrer`.
  Satisfies: N-4.
- AC-4: The language link is read -> on an English page it shows only "TR", on a Turkish page only "EN", its target is the switcher target of TASK-004 for that page, its accessible name is "TR: read this page in Turkish" (Turkish page: "EN: bu sayfayı İngilizce oku"), and it carries `lang` and `hreflang` of the target language.
  Satisfies: N-4.
- AC-5: The theme button is read in the built page -> it holds a sun cell and a moon cell, it is hidden until the script adds the `js` class to the `html` element, and its accessible name is "Theme: light. Switch to dark" (Turkish "Tema: açık. Koyu temaya geç") while the theme is light.
  Satisfies: N-4.
- AC-6: The page is opened in a real browser at 390 and 1440 pixels wide -> the GitHub link, the language link and the theme button measure at least 44 by 44 CSS pixels (the theme button 88 by 44), the copy button is at least 44 high, each shows a 2px focus ring in `--accent` with a 3px offset when reached with the keyboard, and the tab order is brand, menu links, GitHub, language, theme.
  Satisfies: N-4.
- AC-7: The SVG icon files are read -> `github.svg`, `sun.svg` and `moon.svg` exist in `src/assets/icons/`, draw with `currentColor`, and no file holds a fixed fill or stroke colour.
- AC-8: The footer is read on an English page and on a Turkish page -> it holds exactly "No cookies and no analytics scripts. The host keeps ordinary request logs. MIT licensed (LICENSE). Built with proofline." and "Çerez ve analitik betiği yok. Barındırıcı olağan istek günlüklerini tutar. MIT lisanslı (LICENSE). proofline ile yapıldı." as one paragraph; "LICENSE" links to `https://github.com/furkansarikaya/proofline/blob/{commit}/LICENSE` with the commit of `sync/pin.json` (the `main` address while that file does not exist), and "Built with proofline" / "proofline ile yapıldı" links to `https://github.com/furkansarikaya/proofline-site`.
  Satisfies: N-3.
- AC-9: `public/assets/controls.js` is measured and every built page of this task is read -> the file is at most 2048 bytes, the page holds exactly one same-origin script for it (plus the JSON-LD block of TASK-004 on the home pages), placed in the head, with no `async` or `defer` attribute and no inline script body.
  Satisfies: N-5.
  Covers: NFR-1
- AC-10: The source of `controls.js` is searched -> it holds 0 uses of `document.cookie`, `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` and `eval`, and its only storage key is `theme`.
  Covers: NFR-1
- AC-11: In a real browser with the script running, the theme button is pressed on a system-light page -> `data-theme="dark"` is set on `html`, the key `theme` holds `dark` in local storage, the button's accessible name becomes "Theme: dark. Switch to light", and after a reload the attribute is set before the body is parsed.
  Satisfies: N-5.
- AC-12: In a real browser with no saved choice -> the page follows the system setting at first (light and dark emulation give the `--bg` values of `DESIGN.md`) and follows a later change of the system setting.
  Satisfies: N-5.
- AC-13: In a real browser with `/assets/controls.js` blocked -> each of `/` and `/tr/` still follows the system colour theme in light and dark emulation, the theme button and the copy button are hidden, the language link and the menu navigate, and the install command can be selected by hand.
  Satisfies: N-5.
- AC-14: In a real browser the copy button is pressed -> the clipboard holds the two command lines exactly as shown, a polite live region says "Copied" (Turkish "Kopyalandı"), the button shows a check mark and returns to "Copy" in under 2 seconds; when the clipboard write is refused the command is selected and the region says "Could not copy; the command is selected, copy it by hand" (Turkish "Kopyalanamadı; komut seçildi, elle kopyalayın").
  Satisfies: N-5.
- AC-15: The command component is read in the built page -> the command block carries `lang="en"` and `translate="no"` also on the Turkish page.
- AC-16: Failure criterion (anti-goal): the task is not done if the controls script is larger than 2048 bytes, if it is loaded with `async` or `defer`, if a control is smaller than 44 by 44 CSS pixels, if the GitHub link has `noreferrer`, if the theme or copy button is visible without the script, or if the menu links to an address that does not exist in `dist/`, even when `npm run test:axe` is green.

## Out of scope

- The "Contact" menu entry (TASK-026), the docs header with the search slot and the docs menu buttons (TASK-014), `docs.js` (TASK-016) and the search script (TASK-028).
- The content of the home, get-started, trust and Claude Code and Codex pages (TASK-019, 021, 022, 023) and the check that the commands match the README (TASK-020).
- The CI step that runs the browser checks and the repository-wide script and cookie scans (TASK-030, TASK-033); this task only adds the npm script `test:controls`.
- The `vercel.json` headers and the local server parity (TASK-027).

## Constraints

- Expected test exception: the three SVG icon files are drawings with no test-first RED. What is tested instead: the files exist, use `currentColor`, the control sizes in a real browser (AC-6) and the contrast figures stated in `DESIGN.md` "Colour roles and contrast".
- `DESIGN.md` "Header controls (rules)": the GitHub link is an icon, the language is a link, not a button; icons are SVG files kept under `src/assets/icons/`; the controls script is synchronous in the head, at most 2048 bytes, with no inline body.
- ADR 0006 amendment: the script reads and writes only the local storage key `theme`, sets `data-theme`, keeps the button name current and runs the copy button; it reads no cookie and makes no request.
- ADR 0009: browser checks use the Playwright library under `node:test`; `tests/controls.mjs` follows the pattern of `tests/axe.mjs` (served from `dist/` by `scripts/serve-dist.mjs`, not discovered by plain `node --test`).
- ADR 0001: no UI-framework island and no dependency added.

## Risks

- The sample was drawn as one flat file with its own CSS; copying its markup instead of rebuilding it from the design document would carry its differences (the sample menu lacks Home and Docs).
- The pin-dependent LICENSE link (Context) can stay on the `main` address if TASK-007 is not merged before the launch; AC-8 is the check.
- The browser tests need Chromium; CI installs it in the `install` step, local runs need `npx playwright install chromium`.
- Menu entries appear only as their pages arrive, so a page task that forgets to register its page leaves the menu short; TASK-029 asserts the full menu.

## Pre-existing defects

none

## Suggested class

COMPLEX - several layers (layout, components, client script, assets, tests) and a privacy-relevant browser script; CRITICAL not placed (no secret, no `vercel.json` change)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:controls`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-005 -->
- run: TASK-005
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-23T06:25:16Z
- runtime: claude
- session: 8303465e-75e9-456e-b28c-83159dca7957
- estimate: size L
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-005 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-005 -->
# Completion Report: TASK-005

<!-- proofline:summary:begin -->
Changed: every marketing page now has the header (brand, menu, GitHub, language, theme), the one-line footer and a copyable command block, driven by one 1630-byte same-origin controls script; a refused clipboard copy now shows its message visibly.
Verify: `npm test`
<!-- proofline:summary:end -->

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-005 — Site header, footer and controls script; class COMPLEX; tier full; branch `proofline/TASK-005-site-header-footer-and-controls-script`
- Changed: `src/lib/nav.ts` (AC-1, AC-2, AC-8), `src/components/marketing/Header.astro` (AC-1 to AC-6), `src/components/marketing/Footer.astro` (AC-8), `src/components/marketing/CommandBlock.astro` (AC-14, AC-15), `src/assets/icons/github.svg`, `sun.svg`, `moon.svg` (AC-3, AC-5, AC-7), `public/assets/controls.js` (AC-9 to AC-14), `src/styles/components.css` (AC-5, AC-6, AC-12 to AC-14), `src/layouts/Base.astro` (AC-1, AC-8, AC-9, AC-13), `src/pages/index.astro` and `src/pages/tr/index.astro` (AC-14, AC-15), `tests/header-footer.test.mjs` (AC-1 to AC-5, AC-7 to AC-10, AC-15, AC-16), `tests/controls.mjs` (AC-6, AC-11 to AC-14, AC-16), `tests/site.test.mjs` and `tests/design.test.mjs` (AC-9), `package.json` (script `test:controls`)
- Reopened by the user once after the first pass to make the clipboard-refused message of AC-14 visible to sighted visitors as well as announced (QA finding J-2); that change is inside the plan scope (`public/assets/controls.js`, `src/styles/components.css`, `tests/controls.mjs`).

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| src/lib/nav.ts, the three components, Base.astro, both home pages, components.css, controls.js, the four test files | `npm test` fails: built pages hold no header, footer, command block or controls script, and the new assertions on header order, menu, footer text, script count and allow-list fail | `npm test` passes | implementer |
| src/styles/components.css, tests/controls.mjs (touch targets) | `npm run test:controls` fails: the English menu link Home measures 41.97 by 44 at 390 px and the footer links 40.9 high | `npm run test:controls` passes | implementer |
| public/assets/controls.js, src/styles/components.css, tests/controls.mjs (visible refused message) | `npm run test:controls` fails: the refused-state message has a 1 by 1 box | `npm run test:controls` passes | implementer |
| tests/controls.mjs (alpha-aware contrast, split tests, original title) | `npm run test:controls` fails with the `.msg` colour mutant applied | `npm run test:controls` passes | implementer |
| tests/header-footer.test.mjs (pinnedCommit rules) | `npm test` fails with the two surviving `pinnedCommit` mutants applied | `npm test` passes | implementer |
| src/assets/icons/github.svg, sun.svg, moon.svg | tdd_exemption: icon drawings with no test-first RED; AC-7 reads the files | not applicable | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm test`, `npm run build`, `npm run test:controls`, `npm run test:axe`

## Assumptions

- AS-1 (low): The Turkish sample file agrees with the Turkish labels in TASK.md — unverified
- AS-2 (low): npm run build works offline from the sync cache in the worktree — unverified (the build record shows exit 0, the register row was not updated)
- AS-3 (low): The 404 page gets header and footer but no controls script, so AC-9 is read for the home pages — unverified

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 2 | none |
| REVIEW_PLAN | pass | high | 2 | REVIEW_PLAN-1, REVIEW_PLAN-2 |
| REVIEW_RULES | pass (unsupported: performance) | high | 2 | REVIEW_RULES-1, REVIEW_RULES-2, REVIEW_RULES-3 |
| REVIEW_TESTS | pass | medium | 2 | none |
| SECURITY | pass | high | 2 | none |
| QA | pass | high | 2 | QA-1 |
| VERIFY | pass | high | 2 | none |

Fix rounds used: 2 of 2 (the numbers of the Facts block).

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- SECURITY:dependencies: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)
- QA:visual: not reproduced (NOT_RERUN)
- REVIEW_PLAN: REVIEW_PLAN-1 info the knowledge file docs/design/DESIGN.md is the only changed path outside the plan scope (documentation of the built components)
- REVIEW_PLAN: REVIEW_PLAN-2 info the live-region class switch between `sr` and `msg` is not listed in the plan's internal DOM contract
- REVIEW_RULES: REVIEW_RULES-1 info docs/design/DESIGN.md changed outside the plan scope, documentation only
- REVIEW_RULES: REVIEW_RULES-2 info the language link keeps the fixed AC-4 name and ignores the translated flag of the switcher target; no pair other than home exists yet
- REVIEW_RULES: REVIEW_RULES-3 info the visible refused message shares the 1800 ms reset timer, so it shows for under two seconds; no written rule sets a minimum
- QA: QA-1 info two of eight full runs of the controls tests hit a 404 at the first page load while another process rebuilt `dist/`; six later runs passed and no code defect was found

## QA Result

QA: PASS (high); scenarios 29/29.

## Unsupported Checks

- REVIEW_RULES:performance: the project defines no benchmark command (no bench, benchmark or perf script, no CI benchmark step; ci.yml says the Lighthouse budgets arrive with the performance task) and the base has no controls.js to time against; not proven: the blocking time of the synchronous head script (only its 1630-byte size, head placement and the absence of async or defer were observed)

## Reopen History

- 2026-11-23 08:28 UTC, reopened with `amend` (022-REOPEN) so the plan reviewer could regenerate its findings file without quoted Turkish text; authorized_by: the user chose reopening in the session. No product change was possible for that reason alone, so the user then approved a bounded usability change inside the plan scope (the visible clipboard-refused message, AC-14), implemented in a fix round, after which every gate ran again.

## Execution

Generated from the decision records by `agent.sh report-execution TASK-005` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| architect | - | claude | opus | high | none | agent path |
| designer | - | claude | sonnet | medium | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| security_reviewer | - | claude | opus | xhigh | large_diff | escalated (ESCALATED_EFFORT); agent path |
| qa | - | claude | opus | medium | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | performance | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | dependencies | claude | opus | high | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | performance | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| qa | visual | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| qa | visual | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| verifier | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| verifier | - | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | performance | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| security_reviewer | dependencies | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | performance | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| security_reviewer | - | claude | opus | high | large_diff,fix_round_2 | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| verifier | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| reviewer | performance | claude | sonnet | high | large_diff,fix_round_2 | agent path |

## Known Limitations / Follow-up

- Three design rationales were approved by the user for this run: mono-labels, hairline-newspaper and numbered-steps.
- A page with no Turkish version keeps the fixed language-link name of AC-4; no committed Turkish wording exists for the "no translation" case.
- The visible refused message disappears with the 1800 ms reset timer; a longer display time would need a decision.
- Parallel gate roles rebuild `dist/` at the same time and can make each other's local-server test fail once with a 404; a re-run passes.
- Proofline problems worked around and recorded as friction notes: a failed write-window close that needed a tree approval, stale request files that made the approval hook demand a run name its phrase check refused, and the language check flagging quotes of TASK.md inside JSON strings.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 40)
- Gate REVIEW_PLAN: ran on an EARLIER tree (gate REVIEW_PLAN, record 25; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_RULES: ran on an EARLIER tree (gate REVIEW_RULES, record 27; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Check REVIEW_RULES:performance: unsupported: it could not run here (focus REVIEW_RULES:performance, record 41); nothing is claimed
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 45)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 42)
- Check SECURITY:dependencies: ran on an EARLIER tree (focus SECURITY:dependencies, record 32; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate QA: ran on the final tree: pass (gate QA, record 44)
- Visual/browser check: ran on an EARLIER tree (visual/browser check, gate QA:visual, record 37; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 43)

Final message line (paste it unchanged): Verification claims (from the ledger): 5 of 7 gates hold a record for the final tree; not on the final tree: REVIEW_PLAN (earlier tree), REVIEW_RULES (earlier tree), SECURITY:dependencies (earlier tree), QA:visual (earlier tree); visual/browser check: ran on an EARLIER tree (gate QA:visual, record 37; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree.
Claims-hash: 6779a84037010708350b096e6616b6b5aabced8e7708977d428c67f2f08dfae2
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-005` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1 REVIEW_PLAN-2
- Gate REVIEW_RULES: pass (unsupported: performance); findings: REVIEW_RULES-1 REVIEW_RULES-2 REVIEW_RULES-3
  - Focus REVIEW_RULES:performance: unsupported; findings: none
- Gate REVIEW_TESTS: pass; findings: none
- Gate SECURITY: pass; findings: none
  - Focus SECURITY:dependencies: pass; findings: none
- Gate QA: pass; findings: QA-1
  - Focus QA:visual: pass; findings: none
- Gate VERIFY: pass; findings: none
- Friction notes recorded (A200): proofline_bug 3, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 2 of 2
- Refreezes: 0
- Files changed (task-owned paths): 17
- Worker-evidence run records: total 14, ended pass 7, ended fail 7 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-005 -->
