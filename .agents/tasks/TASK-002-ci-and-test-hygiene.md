# Task: TASK-002 - CI and test hygiene: pinned actions, measured job timeout, no leftover temp directories

---
type: chore
size: S
---

## Goal

The `ci` workflow uses only actions pinned to a commit hash, its `verify` job has a timeout set from measured run durations, and the test suites leave no `proofline-site-*` or `proofline-axe-*` temporary directories behind, also when a run is interrupted.

## Context

Request (user's words):

> 1 ve 3'ü tek bir task olarak yaz: CI ve test hijyeni (action'ları commit
> hash'iyle sabitle, işlere ölçülmüş zaman aşımı ekle, yarım kalan bir
> koşuda proofline-site-* geçici klasörleri kalmasın). 2 raporda kalsın.

- Source: the observations of the TASK-001 completion report (`.agents/tasks/done/TASK-001-astro-static-site-skeleton-with-bilingual.md`): the actions are pinned by major tag `@v7` and the job has no `timeout-minutes` (`.github/workflows/ci.yml:16`, `:18`); the test temporary directories are removed in `after` hooks (`tests/site.test.mjs:21`, `tests/axe.mjs:47`) and can survive an interrupted run.
- Observation 2 of that report (the `determinism` command deletes `node_modules/.astro` and `.astro`; a moved Astro `cacheDir` needs the clean list changed) stays in the report and is not part of this task.
- Measured durations (GitHub runs of the `ci` workflow on 2026-11-20): pull request run 44704593187, job 1 min 6 s (install step 40 s); push run 44704839510, 47 s. Two samples only.
- Decisions from the user's answers: the `verify` job timeout is 5 minutes; interrupted runs are cleaned by signal handling plus a sweep at the start of the next run (directories older than 1 hour); `proofline-axe-*` directories (`tests/axe.mjs:40`) are included with `proofline-site-*` (`tests/site.test.mjs:60`).
- Assumption: "the commit hash" of an action is the full 40-character commit SHA of the release tag of the version now in use, written with the tag in a comment on the same line.
- Assumption: both pinned actions keep the major version they have now (`@v7`); the pin resolves the newest `v7.x.y` release tag of each.
- Assumption: a process killed with SIGKILL (or a power loss) cannot clean up after itself; its directories are removed by the sweep of the next run.

## Acceptance criteria

- AC-1: Every `uses:` entry in every file under `.github/workflows/` names a 40-character commit SHA after `@`, and the same line ends with a comment holding the version tag (for example `# v7.1.0`); a test fails when any `uses:` entry names a tag, a branch or a short SHA.
- AC-2: For each pinned action, `git ls-remote --tags` on the action's GitHub repository returns the commented tag with the same commit SHA as the pin (checked once at delivery).
- AC-3: Job `verify` in `.github/workflows/ci.yml` has `timeout-minutes: 5`, and a comment next to it names the measured runs (44704593187 with 1 min 6 s and 44704839510 with 47 s); a test fails when the key is missing or not 5.
- AC-4: When `tests/site.test.mjs` is stopped with SIGINT or SIGTERM while its fixture directories exist, no `proofline-site-*` directory created by that run remains in the system temporary directory.
- AC-5: When `tests/axe.mjs` is stopped with SIGINT or SIGTERM while its fixture directory exists, no `proofline-axe-*` directory created by that run remains in the system temporary directory.
- AC-6: When a test in either file fails by an assertion or a thrown error, the directories that run created are removed as well.
- AC-7: At the start of a run of either file, `proofline-site-*` and `proofline-axe-*` directories in the system temporary directory that are older than 1 hour are removed; a directory of those names younger than 1 hour and a directory with any other name are left untouched.
- AC-8: The completion report states that a process killed with SIGKILL leaves its directories until the sweep of the next run (AC-7).
- AC-9: The workflow still has the name `ci`, the single job `verify`, the same step names in the same order, the top-level `permissions: contents: read` and the triggers `pull_request` and `push` to `main`, and `npm ci`, `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links` and `npm run test:axe` exit 0.
- AC-10: Failure criterion (anti-goal): the task is not done if any `uses:` entry is still on a tag, if `timeout-minutes` is missing from `verify`, if an interrupted run leaves a `proofline-site-*` or `proofline-axe-*` directory behind, or if the sweep removes a directory younger than 1 hour or one with another name, even when `ci / verify` is green.

## Out of scope

- Observation 2 of the TASK-001 report (the `determinism` clean list and Astro's `cacheDir`); it stays in the report.
- Automatic updating of pinned actions (Dependabot, Renovate or a script); pins are updated by hand in a later task.
- Moving the actions to a newer major version, changing the runner image, adding caching or step-level timeouts.
- Re-measuring the timeout over more runs; 5 minutes is the user's decision from two samples.
- Making `ci / verify` the required check on `main` (the owner's step) and any change to the check name.
- Fixture directories created by anything other than `tests/site.test.mjs` and `tests/axe.mjs`.

## Constraints

- The user chose a `verify` timeout of 5 minutes (answer of 2026-11-20 to the question on the timeout value).
- ADR 0008: `ci.yml` keeps a least-privilege top-level `permissions:` block (`contents: read`) and one job `verify`; the step names and their order (TASK-001 AC-10) stay.
- ADR 0001: plain `.mjs` scripts and `node --test`; Node 24.x; every dependency in `package.json` stays an exact version, and no dependency is added.
- The workflow check `scripts/check-workflows.mjs` and its tests keep passing.

## Risks

- Only two measured runs: a slow Chromium download could make 5 minutes a false red on the required check.
- A tag can be moved by its publisher; the commit SHA is what the pin is for, and AC-2 is checked once at delivery, not on every run.
- The start-of-run sweep deletes directories in the shared system temporary directory; the 1 hour age and the two name patterns bound what it can touch (AC-7, AC-10).
- SIGKILL and power loss cannot be handled in the process; only the next run's sweep removes those directories (AC-8).
- CI indicator: `ci.yml` is the workflow of the required check, but it has `contents: read`, no secrets and no deploy, so it is classed below CRITICAL; the lead classifies by script.

## Pre-existing defects

none

## Suggested class

COMPLEX - change to the CI workflow `.github/workflows/ci.yml` that carries the required check, plus test code in two files (CRITICAL considered: no secrets, no deploy, read-only permissions)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
