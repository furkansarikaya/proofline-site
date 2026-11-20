# Task: TASK-043 - Launch pin check: the pin is the tag v0.0.173 and its README has no install-time suffix

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
