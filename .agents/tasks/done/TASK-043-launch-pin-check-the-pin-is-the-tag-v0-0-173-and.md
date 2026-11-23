# Task: TASK-043 - Launch pin check: the pin is the tag v0.0.173 and its README has no install-time suffix

**Status:** done

---
origin: prd:site
type: chore
size: S
depends_on:
  - TASK-007
  - TASK-010
prd: site
---

## Goal

The site's pin is the proofline tag v0.0.173 (commit b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd), its lock matches that commit, and a test shows offline that the README at that pin has no "(5 minutes)" suffix on its start heading and one Version line in each place that states it.

## Context

- Request (the product owner's words, from the task split):

> 043 sadece pin'i v0.0.173 etiketine bağlamaya indirgensin

- PRD requirements: FR-31 (the README start heading loses "(5 minutes)" before PB-3 and the pin is a commit made after that change) and AC-37. The upstream README fix was made by the owner in proofline 0.0.173, so this task no longer waits on the owner: the code side is the pin, the lock and one test. The launch pin decision is L-1 of the PRD section "Launch scope decision (2026-11-20)". The live check of the README at the pin is in `scripts/check-launch.mjs` (TASK-041) and is run by the owner; it is not repeated here.
- Sources: `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (point 1: `sync/pin.json` = `{"commit": ..., "tag": null or "vX.Y.Z"}`; point 2: the lock lists `README.md` with path, git blob id and sha256), `/docs/design/ARCHITECTURE.md` (section "Migration", item on the real pin; the waiting condition of the launch).
- Facts read from the proofline repository on 2026-11-20 (tag v0.0.173, commit b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd): the README has the headings `## Status`, `## Install`, `## Quick start`, `## What it supports`; line 31 is `Version 0.0.173 is an early release.`; line 119 starts `Version **0.0.173**:`; no other line starts with `Version` followed by a digit or by `**`. Its git blob id is 5352cae2d2458df885eb87f49d11beef13ca667e and its sha256 is 8f3e3011d3c75a112288e31c9698e11289d640610229798a86c60c4d91d5c9ce. The Status section holds the sentences "It is not yet proven on real projects." and "Codex as implementer is supported (real use, 2026-10-23 to 25); other Codex roles are not yet verified in real use."
- TASK-007 sets the pin and generates the lock; if it already holds this pin, this task adds the test and the fixture and regenerates nothing that differs. If it holds another commit, this task changes it.
- Expected scope: `sync/pin.json`, `sync/lock.json`, `tests/launch-pin.test.mjs`, `tests/fixtures/launch/README.pin.md` (4 paths).

## Acceptance criteria

- AC-1: `sync/pin.json` is read -> `commit` is `b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd` and `tag` is `v0.0.173`; a test fails when either differs, when `tag` is null, or when the commit is a short id.
  Covers: FR-31
- AC-2: The lock command of TASK-007 is run for the pin of AC-1 -> `sync/lock.json` records that commit, lists `README.md` with git blob id `5352cae2d2458df885eb87f49d11beef13ca667e` and sha256 `8f3e3011d3c75a112288e31c9698e11289d640610229798a86c60c4d91d5c9ce`, and a test compares the committed lock with these values.
  Covers: FR-31
- AC-3: The fixture `tests/fixtures/launch/README.pin.md` is hashed -> its git blob id and its sha256 equal the values of AC-2 (it is a byte-for-byte copy of the README at the pin); a test fails when they differ.
- AC-4: The headings of the fixture README are read -> a heading line `## Quick start` exists, and no heading line contains "(5 minutes)" (case-insensitive, any spaces inside the parentheses); a test fails on a fixture that carries the suffix.
  PRD ids: AC-37
  Covers: FR-31
- AC-5: The lines of the fixture README are counted -> exactly 1 line starts with `Version ` followed by a digit and exactly 1 line starts with `Version **` followed by a digit; a test fails on 0 or 2 of either kind.
  PRD ids: AC-37
  Covers: FR-31
- AC-6: The pin-facts module of TASK-010 is run over the fixture README -> it finds the README sentence "It is not yet proven on real projects.", the Codex sentence and a non-empty list of install commands between `## Install` and `## What it supports`, and does not fail.
- AC-7: Failure criterion (anti-goal): the task is not done if `sync/pin.json` still names the earlier candidate commit 457729b31481a8a1915c06ec3bddd57b549f0194 or no tag, if the lock describes another commit than the pin, or if the fixture was edited by hand (a changed fixture must fail AC-3), even when `npm run build` is green.

## Out of scope

- Any step the owner performs: this task is not a user step and waits for no decision.
- The live check of the README at the pin and the search for old links (TASK-041, run by the owner at the launch).
- Sync pull requests and the sync workflow (TASK-035, post-launch); later pin changes are made by hand with the lock command in a normal pull request.
- Changes to the proofline repository.
- The lock script and the fetch itself (TASK-007) and the pin facts module (TASK-010); this task only runs them.

## Constraints

- ADR 0003: the commit is the truth and the tag is a label; the build verifies the downloaded files against the lock and fails on any difference, with no network in tests.
- ADR 0001: plain `.mjs` test with `node --test`; no dependency is added.
- The lock is produced by the lock script, never edited by hand.

## Risks

- The pin and lock are the integrity base of every synced page; a wrong commit changes all of them. AC-1 and AC-2 pin the exact values.
- If the lock command needs the network, the lock is generated once by the implementer; the tests only read it.
- The count rule of AC-5 (one `Version ` line and one `Version **` line) is this task's reading of "a single Version line"; if the owner meant one line in total, the README at the pin (two lines, in two different sections) would not satisfy it, and the criterion would be reopened with the owner.

## Pre-existing defects

none

## Suggested class

STANDARD - change to the integrity data of the sync (`sync/pin.json`, `sync/lock.json`) plus one test, confined to the sync component (COMPLEX considered: no new code path, the lock is produced by the existing lock command)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-043 -->
- run: TASK-043
- type: chore
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-23T01:18:30Z
- runtime: claude
- session: 539cc842-8fd6-4aa6-9892-b38539b7c09f
- estimate: size S
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-043 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-043 -->
# Completion Report: TASK-043

<!-- proofline:summary:begin -->
Changed: a new test file and a fixture prove that the site's pin is the tag v0.0.173 (commit b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd), that the lock matches it, and that the pinned README has no install-time suffix and the two expected Version lines.
Verify: `npm test`
<!-- proofline:summary:end -->

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-043 — Launch pin check: the pin is the tag v0.0.173 and its README has no install-time suffix; class STANDARD; tier full; branch `proofline/TASK-043-launch-pin-check-the-pin-is-the-tag-v0-0-173-and`
- Changed: tests/launch-pin.test.mjs (AC-1 to AC-7) and tests/fixtures/launch/README.pin.md (AC-3 to AC-6; a byte-for-byte copy of the README at the pin, taken from the cache of the pinned archive).
- Not changed: sync/pin.json and sync/lock.json already held the launch values (commit, tag, README blob id and sha256), so the lock command was not run and neither file was edited, as the task allows.
- Knowledge step: batch default, no page written.

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| tests/launch-pin.test.mjs | the tests fail on assertions against a three-line stub fixture and on mutated copies of the pin, the lock and the fixture (a null tag, a short or other commit, one changed byte, the suffix heading, zero or two Version lines, the earlier candidate commit) | `npm test` passes | implementer |
| tests/fixtures/launch/README.pin.md | exempt (byte copy of the pinned README, asserted against the lock by the test) | `npm test` passes | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm ci`, `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links`

## Assumptions

none

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 0 | none |
| REVIEW_PLAN | pass | high | 0 | REVIEW_PLAN-1 REVIEW_PLAN-2 |
| REVIEW_RULES | pass | high | 0 | none |
| REVIEW_TESTS | pass | high | 0 | none |
| SECURITY | pass | high | 0 | SECURITY-1 |
| QA | pass | high | 0 | QA-1 |
| VERIFY | pass | high | 0 | none |

Fix rounds used: 0 of 2 (the numbers of the Facts block).

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)

Findings by id (all info):

- REVIEW_PLAN: REVIEW_PLAN-1 info the pin and the lock are unchanged and the plan scope names two paths where the task text expected four. REVIEW_PLAN-2 info the task file move is a control-plane change, not task output.
- SECURITY: SECURITY-1 info the test joins the pin commit into its temp cache path without a hex check; the value comes from the committed pin file, which the first test checks exactly, so it is not exploitable.
- QA: QA-1 info a lock README entry with a wrong role is not caught by the new test, but tests/sync.test.mjs fails on it, so the whole suite refuses it.

## QA Result

QA: PASS (high); scenarios 26/26.

## Waivers

None.

## Execution

Generated from the decision records by `agent.sh report-execution TASK-043` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| reviewer | plan | claude | sonnet | high | none | agent path |
| reviewer | rules | claude | sonnet | high | none | agent path |
| reviewer | tests | claude | sonnet | high | none | agent path |
| security_reviewer | - | claude | opus | high | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| verifier | - | claude | sonnet | medium | none | agent path |

## Known Limitations / Follow-up

- The criterion AC-5 reads "a single Version line" as one line starting with Version and a digit plus one starting with Version, two stars and a digit, as the task states; the pinned README has one of each (two lines in total). If the owner meant one line in total, the criterion needs to be reopened with the owner (task risk).
- A later change of the pin by hand needs this test and its fixture updated in the same pull request.
- A probe of the security review left a harmless folder named escape with three fixture copies in the system temporary directory; the run hook refuses deletions outside the project, so remove it by hand.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 1)
- Gate REVIEW_PLAN: ran on the final tree: pass (gate REVIEW_PLAN, record 2)
- Gate REVIEW_RULES: ran on the final tree: pass (gate REVIEW_RULES, record 3)
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 6)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 4)
- Gate QA: ran on the final tree: pass (gate QA, record 5)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 7)
- Visual/browser check: not part of this run (no QA:visual gate); no visual, browser or screenshot check is claimed

Final message line (paste it unchanged): Verification claims (from the ledger): 7 of 7 gates hold a record for the final tree; visual/browser check: not part of this run (no QA:visual gate); no visual, browser or screenshot check is claimed.
Claims-hash: ee08446358b7fb1dd1007ee6bd6f22b38e4f8a0d5f45edaacc02b0d0a7367672
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-043` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: STANDARD
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1 REVIEW_PLAN-2
- Gate REVIEW_RULES: pass; findings: none
- Gate REVIEW_TESTS: pass; findings: none
- Gate SECURITY: pass; findings: SECURITY-1
- Gate QA: pass; findings: QA-1
- Gate VERIFY: pass; findings: none
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: not_applicable; not_applicable reason: batch default (A291): no knowledge page was written, the suggestion to the user is in the report
- Suggestion to the user (knowledge): TASK-043: no knowledge note was written and nothing was changed under docs/, in skills or in rules; the acceptance criteria mention 'command' (user-visible behaviour); if you want it kept, write a wiki page or a design-document change yourself, or ask for a documentation task
- Fix rounds: 0 of 2
- Refreezes: 0
- Files changed (task-owned paths): 2
- Worker-evidence run records: total 5, ended pass 3, ended fail 2 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-043 -->
