# Task: TASK-044 - PB-3 probe: first-time installation in a clean user account (owner step)

---
origin: prd:site
type: chore
size: S
depends_on:
  - TASK-043
  - TASK-021
prd: site
---

## Goal

The product owner runs the locked probe PB-3 once, in a clean user account, and its result line (`confirmed`, `failed` or `inconclusive`) is recorded in `docs/product/site/PROBES.md`, so the launch rests on a measured first-time installation or on no install-time claim at all.

## Context

- PRD requirements: FR-6 (PB-3 is run before the launch and its result is written to PROBES.md; on a failed or inconclusive result no page written for the site states an install time), FR-5 (only `confirmed` allows the site to state the time, and then only the time of that run), AC-36, DEC-2 (`/docs/product/site/DECISION.md`) and the metric M-6 (time of the first-time installation; its baseline is the PB-3 stopwatch result).
- The probe text and its thresholds are locked in `/docs/product/site/PROBES.md` (PB-3 locked 2026-11-19T18:09:33.732Z, sha256 5f8b35fb02aa3eeaac31eafc7b471bd69ff614b3f15420f78aeaf4a8ee7c2ba3): the owner installs the proofline plugin and the command line tool for the first time, by the README steps, in a clean user account where neither is installed, up to a `proofline doctor` run, and times it with a stopwatch. Success: the steps finish in 5 minutes or less and no step outside the README is needed. Failure: more than 10 minutes, or a step outside the README is needed. In between: inconclusive. A locked threshold is never edited.
- The README is the one at the launch pin, the tag v0.0.173 (TASK-043). PB-1 (init and doctor only, 5 seconds, plugin and tool already installed) and PB-2 are recorded in the same file as the format example: a `result:` line followed by an `evidence:` line.
- The get-started page (TASK-021) and the guard that fails the build on an install-time claim (TASK-020) already exist; this task does not change a page.
- Expected scope: `docs/product/site/PROBES.md` (1 path).

## Acceptance criteria

- AC-1: User step: the owner follows the README steps of the pinned commit in a clean user account on which neither the proofline plugin nor the command line tool is installed, up to a finished `proofline doctor` run, and times it with a stopwatch -> a line `  result: confirmed`, `  result: failed` or `  result: inconclusive` is recorded in `docs/product/site/PROBES.md` directly under the PB-3 entry, using the thresholds of the locked text (at most 5 minutes and no outside step is `confirmed`; more than 10 minutes or an outside step is `failed`; anything else is `inconclusive`).
  Covers: FR-6
- AC-2: The result line of AC-1 exists -> the line after it starts `  evidence:` and holds the stopwatch time in minutes and seconds, the date of the run (UTC), the operating system of the account, the list of steps taken outside the README (or the word "none") and the statement that the run was made by the owner; this time is the baseline of M-6.
  PRD ids: M-6
  Covers: FR-6
- AC-3: The diff of `docs/product/site/PROBES.md` is read -> it adds only the `result:` line and the `evidence:` line under PB-3; the lines `success:`, `failure:` and `locked:` of PB-3 and every line of PB-1 and PB-2 are unchanged.
- AC-4: The result is `failed` or `inconclusive` -> `npm run build` still exits 0 on the current pages (no page written for the site states an install time) and the guard of TASK-020 keeps failing a page that matches the install-time pattern; no page is edited by this task.
  PRD ids: AC-36
  Covers: FR-5
- AC-5: The result is `confirmed` -> the evidence line states that the time of that run is the only time a page may state later, and no page is edited by this task.
  PRD ids: AC-36
  Covers: FR-5
- AC-6: Failure criterion (anti-goal): the task is not done if the result line was written without a real run by the owner (no stopwatch time, no date, or an agent-written time), if a threshold of the locked text is edited, or if a page of the site is changed to state an install time, even when `npm run build` is green.

## Out of scope

- Running the probe again or replacing it with a new probe; a wrong probe is replaced by a new one in a later task.
- Writing the install time on any page (FR-5 allows it only after `confirmed`, and a page change is a separate content decision).
- The README text, the plugin and the command line tool (proofline repository).
- Opening a new content task for a `failed` or `inconclusive` result; the lead reads the result and decides.

## Constraints

- Expected test exception: an owner step on the owner's own machine with a stopwatch; a test-first RED does not exist. Tested instead by the recorded line in `docs/product/site/PROBES.md` and by `npm run build` staying green with the guard of TASK-020 in place.
- The probe is run before the launch (DEC-2); the task is done when the line exists, whatever the result.
- Code tasks never wait on this decision: no code task depends on it except the cutover, TASK-047.

## Risks

- A `failed` or `inconclusive` result leaves the site without an install time; the launch is not blocked by it, because FR-31 already removed the claim, but the owner may choose to change the README upstream.
- A clean user account differs from a clean machine (shared caches, Node already present); the evidence line records what was present.
- The README steps may differ from the get-started page; the probe measures the README, as PB-3 states.

## Pre-existing defects

none

## Suggested class

TRIVIAL - one recorded result line in one document, no executable code, no integration

## Verification commands

- `npm run build`
- `grep -n 'result:' docs/product/site/PROBES.md`
- `git diff --stat docs/product/site/PROBES.md`
