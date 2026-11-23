# Task: TASK-023 - Claude Code and Codex page in English and Turkish

**Status:** done

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-005
  - TASK-010
  - TASK-021
prd: site

---

## Goal

A developer who uses both Claude Code and Codex opens one page, `/claude-code-and-codex/` or `/tr/claude-code-ve-codex/`, sees how proofline works with each agent and with both together, finds the link to the get-started page, and reads the README's own limit for Codex, taken from the pinned commit.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-8, US-4 (AC-9), AC-12 (this page).

- Design: `/docs/design/DESIGN-marketing.md` sections "Typography use", "Layout rules", "Copy rules" (Turkish pages keep technical terms and proofline's own names in English) and "Gaps" (this page is not drawn: it follows these rules and is specified by its task); `/docs/design/DESIGN.md` sections "Typography" and "Spacing". Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html` (the menu words "Claude Code and Codex" and "Claude Code ve Codex", the command block). A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (addresses, point 4 content files and the stamp, point 5 titles: the page title is "Claude Code and Codex" and "Claude Code ve Codex", 21 and 20 characters), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (the Codex limit sentence is extracted from the README at the pin and guarded: the build fails when it is missing), `/docs/design/ARCHITECTURE.md` section "Trade-offs" (row "EN renders the README sentences; TR hand translation under the same guard").
- Today: TASK-010 produces the pin facts, among them `codex_sentence` (the README Status sentence about Codex), `readme_commands[]` and `readme_inline_spans[]`; TASK-021 writes the get-started page that this page links to.
- README at the candidate pin (`.agents/local/scratch/pl-tree/README.md`): the Codex install lines `git clone https://github.com/furkansarikaya/proofline` and `node proofline/adapters/codex/install.mjs`; the Claude Code plugin lines; the sentence "Run a role on another runtime with `proofline init --role implementer=codex`" in the Quick start; and the Status limit for Codex (as the PRD quotes it: Codex as implementer is supported and the other Codex roles are not yet verified in real use). The text of the real pin is what the build reads.
- Assumption: the page shows, for each agent, its install lines (Claude Code: the plugin lines; Codex: the clone and install lines) and one command that uses both (`proofline init --role implementer=codex`); every command shown is a line of `readme_commands[]` or a member of `readme_inline_spans[]`.
- Assumption: the Turkish limit sentence is "Codex, implementer olarak desteklenir; diğer Codex rolleri gerçek kullanımda henüz doğrulanmadı." (a hand translation of the English README sentence; technical terms stay English); the plan checks its meaning against the real sentence at the pin.
- Assumption: the page title is also the H1.
- Expected scope: `src/content/` page files in both languages (location set by TASK-004), `src/pages/claude-code-and-codex/index.astro`, `src/pages/tr/claude-code-ve-codex/index.astro`, `src/styles/agents.css`, `tests/agents-page.test.mjs`, `tests/fixtures/agents-page/`. 6 paths.

## Acceptance criteria

- AC-1: `/claude-code-and-codex/` and `/tr/claude-code-ve-codex/` are built -> the html element carries `lang="en"` and `lang="tr"`, each page has one H1 equal to its title part ("Claude Code and Codex", "Claude Code ve Codex"), and the title is that text plus the suffix of ADR 0002 point 5 with no "evidence" or "kanıt".
  PRD ids: AC-10
  Covers: FR-8
- AC-2: Each page is read -> it has a part for Claude Code with the two plugin lines, a part for Codex with the clone and install lines, and a part for using both with the command `proofline init --role implementer=codex`; each command is in a block with `lang="en"` and `translate="no"`.
  Covers: FR-8
- AC-3: Every command line shown on the built pages is trimmed and stripped of a trailing comment starting with " #" -> it equals a line of `readme_commands[]`, and an inline command span equals a member of `readme_inline_spans[]` of the pin facts.
  Covers: FR-8
- AC-4: Each page is read -> it shows a link to `/get-started/` (`/tr/baslarken/` on the Turkish page) whose target exists in the build output.
  PRD ids: AC-9
  Covers: FR-8
- AC-5: The English page is read -> it shows the `codex_sentence` of the pin facts word for word, a fixture archive with another sentence shows the other sentence, and the content files hold no typed copy of it.
  PRD ids: AC-9
  Covers: FR-8, NFR-4
- AC-6: The `codex_sentence` is missing from the README of a fixture archive -> `npm run build` exits non-zero and the message names `/claude-code-and-codex/` and the pattern.
  PRD ids: AC-9
  Covers: FR-8, NFR-4
- AC-7: The Turkish page is read -> it shows the Turkish sentence of the Context, which holds the words "Codex", "implementer" and "doğrulanmadı", and the English sentence appears on it only inside an element with `lang="en"`.
  PRD ids: AC-9, AC-12
  Covers: FR-8, FR-17
- AC-8: The Turkish page is read -> all prose and interface text is Turkish, the only elements with `lang="en"` are command blocks, the quoted English sentence and proofline's own names, and the language link of the header leads from one page to the other.
  PRD ids: AC-12
  Covers: FR-17
- AC-9: The two pages are read -> they list each other as `hreflang` alternates with `x-default` to `/claude-code-and-codex/` from the translation index, the Turkish content file records the hash of the English one so no stale notice shows, and the AC-4 time pattern of the PRD finds 0 matches in both.
  PRD ids: AC-4
  Covers: FR-17
- AC-10: Failure criterion (anti-goal): the task is not done if the Codex limit is typed in a content file instead of read from the pin, if the page claims that Codex is verified for roles other than the implementer, if a command appears that the README does not hold, or if the build stays green when the README sentence is gone, even when both pages look right.

## Out of scope

- Install and first-task steps in full (TASK-021); this page links to them.
- A comparison of Claude Code and Codex or a versus table (PRD US-4 asks for none).
- Extracting the Codex sentence from the README (TASK-010).
- Hooks approval steps for Codex (`/hooks`) and role configuration beyond the one command above.
- The home, trust and not-found pages.

## Constraints

- Expected test exception: none; text, order, links, pin-derived content and build failures have a RED.
- PRD FR-8: the page states the README limit for Codex; NFR-4: the build fails naming page and pattern when the sentence is missing.
- ADR 0002 point 4: the site-written Turkish page is a content file with `translatedFrom` written by `npm run translation:stamp`.
- Turkish prose follows `/docs/design/DESIGN-marketing.md` "Copy rules".
- No new dependency; no inline style or script (ADR 0006).

## Risks

- The Turkish limit sentence is a hand translation of a sentence that upstream can reword; the build detects only a missing English sentence, so a changed meaning is caught only when the stale notice or a review reads it.
- The command `proofline init --role implementer=codex` rests on one README sentence; a README change makes the build fail until the page is edited.
- A reader may take the page as proof that Codex works everywhere; the limit sentence sits next to the Codex part to prevent that.

## Pre-existing defects

none

## Suggested class

STANDARD - two content pages on the existing layout that read the pin facts; no new integration (COMPLEX considered: the build guard reads upstream text)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-023 -->
- run: TASK-023
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-23T21:44:04Z
- runtime: claude
- session: 8303465e-75e9-456e-b28c-83159dca7957
- estimate: size M
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-023 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-023 -->
# Completion Report: TASK-023

<!-- proofline:summary:begin -->
Changed: the English and Turkish Claude Code and Codex pages with the README's own Codex limit sentence read from the pinned commit, its content files, helper, component and tests, and the pair registered in the menu, language link and hreflang.
Look at: Read `/tr/claude-code-ve-codex/`: is the Turkish prose natural, with technical terms and proofline names kept in English (AC-8, QA-53)?
Look at: Does the Turkish limit sentence mean the quoted English one (AC-7, AS-1)? It has no counterpart of the English date range in parentheses.
Verify: `npm run build && npm test`
<!-- proofline:summary:end -->

## Implementation Summary

The pages `/claude-code-and-codex/` and `/tr/claude-code-ve-codex/` exist. Two content files hold the text; `src/lib/agents.ts` reads and checks the content, reuses the Claude Code and Codex command lines of the get-started page by import, and holds the both-agents command. `AgentsPage.astro` builds a Claude Code part (the two plugin lines), a Codex part (the clone and installer lines) with the Codex limit directly under it, a part for using both agents with the README inline span `proofline init --role implementer=codex` as a marked inline code element, and a link to the get-started page. The limit sentence is `codex_sentence` of the pin facts, shown word for word in an element with `lang="en"` and never typed in a content file; the Turkish page adds the hand translation first. A source link to the pinned README Status anchor follows the quote (added in a fix round, because the project rule requires every claim to carry its source). A missing sentence fails the page build with the page address and the pattern in the message. The pair is registered, so the menu entry, the language link, the hreflang alternates and the sitemap entries appear; the guard list gained the two addresses. The page adds no stylesheet: it uses the existing `gs-call` and `home-limits` classes.

Existing tests that hard-code the page set, the controls-script rule, the external-host allowance, the menu and the guard address list were in the plan scope from the start (the lesson of the get-started task) and were amended with probe cases.

## TDD Evidence

Worker evidence holds RED then GREEN per scope path with the plan commands. The fix rounds added tests for the source link and its content key, for every prop of both page files, for the boundary lines of a command block against the guard, for claim words in both languages scanned over the whole page body, for copy controls in the main element and for the page address in the wrapper message.

## Verification

All plan commands passed on the final tree in the verifier's own evidence worktree: tests, build with the guards, determinism check, link check and the accessibility check. Every acceptance criterion AC-1 to AC-10 maps to a passing named test. The Turkish prose and the meaning of the Turkish limit sentence against the pinned English sentence are human checks (see the QA report); the Turkish sentence leaves out the date parenthetical of the README sentence.

## Assumptions

- AS-1 (medium): the Turkish limit sentence is the hand translation of the task context and its meaning is checked against the real sentence at the pin by the review — unverified
- AS-2 (medium): the build in the worktree reads the pinned documents from the cache or fetches them; build tests use the fixture cache — unverified

## Review Result

- REVIEW_PLAN: pass; REVIEW_PLAN-1 info (the source link is requested through the project rule that every claim carries its source; the plan should have named it).
- REVIEW_RULES: pass after a fix round; the first run failed on a blocking finding (the Codex limit had no link to its source), closed by the fix; REVIEW_RULES-1 and REVIEW_RULES-2 are info rows (a test hook that fetches the pinned cache like other test files, the menu label wording owned by another file).
- REVIEW_TESTS: pass; the first run was blocked on the mutation budget, which the batch raised, and a later QA gate found hollow tests that the second fix round closed.
- SECURITY: pass, no findings.
- Fix rounds: see the Facts block.

## QA Result

QA gate: waived by the user for the four design rows; all frozen scenarios passed in the last QA run. Findings of QA: QA-1, QA-2, QA-3 and QA-4 blocking and waived (below); QA-5, QA-6 and QA-7 info rows (pre-existing observations, a manual check of the Turkish prose, a route note for one scenario). The design group focus is waived with the same rows.
- VERIFY: pass; VERIFY-1, VERIFY-2 and VERIFY-3 info rows named design-document lines (the component table and the architecture row) that the knowledge step then updated, and a cold-cache first run that passed on repetition.

## Unsupported Checks

none

## Waivers

| Finding | Gate | Reason | Approval |
|---|---|---|---|
| QA-1 | QA | the page is plain text by design, so the first screen holds no drawing; the home page has the pipeline drawing | user, approve qa-1 |
| QA-2 | QA | no animated element by design | user, approve qa-2 |
| QA-3 | QA | headline to body ratio 1.95 at 390 px, same value as the home pages (user option A) | user, approve qa-3 |
| QA-4 | QA | the checker flags the pinned English Codex sentence in its lang=en quote on the Turkish page as untranslated text, but AC-7 requires exactly that quote | user, approve qa-4 |

NOT_RERUN lines:

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)

## Execution

Generated from the decision records by `agent.sh report-execution TASK-023` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| security_reviewer | - | claude | opus | xhigh | large_diff | escalated (ESCALATED_EFFORT); agent path |
| qa | - | claude | opus | medium | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| security_reviewer | - | claude | opus | high | large_diff,fix_round_2 | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| qa | visual | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| verifier | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |

## Amendments

none

## Reopen History

none

## Known Limitations / Follow-up

- The English menu label comes from `src/lib/nav.ts` (outside this task) and reads differently from the approved sample.
- `tests/axe.mjs` scans only the two home pages; the gates scanned the new pages separately.
- The Turkish limit sentence omits the date parenthetical of the README sentence by design of AC-7.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 12)
- Gate REVIEW_PLAN: ran on an EARLIER tree (gate REVIEW_PLAN, record 6; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_RULES: ran on an EARLIER tree (gate REVIEW_RULES, record 8; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 17)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 14)
- Gate QA: ran on the final tree: pass (gate QA, record 16)
- Visual/browser check: failed on the final tree and was waived by the user (visual/browser check, gate QA:visual, record 15)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 18)

Final message line (paste it unchanged): Verification claims (from the ledger): 5 of 7 gates hold a record for the final tree; not on the final tree: REVIEW_PLAN (earlier tree), REVIEW_RULES (earlier tree); visual/browser check: failed on the final tree and was waived by the user (gate QA:visual, record 15).
Claims-hash: 645cd13316868b9c3293f7024ad8985fa07005c66aedbe89c02b74f97d398ac6
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-023` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: STANDARD
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1
- Gate REVIEW_RULES: pass; findings: REVIEW_RULES-1 REVIEW_RULES-2
- Gate REVIEW_TESTS: pass; findings: none
- Gate SECURITY: pass; findings: none
- Gate QA: waived; findings: QA-1 QA-2 QA-3 QA-4
  - Focus QA:visual: waived; findings: QA-1 QA-2 QA-3 QA-4 QA-5 QA-6 QA-7
- Gate VERIFY: pass; findings: VERIFY-1 VERIFY-2 VERIFY-3
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 2 of 2
- Refreezes: 0
- Files changed (task-owned paths): 14
- Worker-evidence run records: total 21, ended pass 18, ended fail 3 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-023 -->
