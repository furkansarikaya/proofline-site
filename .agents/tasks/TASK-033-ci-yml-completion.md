# Task: TASK-033 - ci.yml completion

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-002
  - TASK-006
  - TASK-028
  - TASK-029
  - TASK-030
  - TASK-031
prd: site

---

## Goal

The required check `ci / verify` runs every check the launch needs (both indexing variants, an indexable build compared twice, the content, privacy, CSP and search checks, the workflow rules) with a timeout set from measured runs, and the workflow checker enforces the permission and secret rules of the PRD on every workflow, also on the ones added later.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: NFR-8, and the criteria AC-45, AC-46, AC-47.

- ADRs: `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` points 1, 3 and 4 (workflows, `verify` steps, the checker), `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` point 6 (the fail-closed indexing switch), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 3 (determinism), `/docs/adr/0009-browser-checks-with-the-playwright-library-under-node-test.md`.
- Today: `.github/workflows/ci.yml` (name `ci`, job `verify`, top-level `permissions: contents: read`) has the steps `checkout`, `setup node`, `install`, `node --test`, `build`, `determinism compare`, `link check`, `axe`, `performance slot`; after TASK-002 its actions are pinned by commit and `verify` has a measured `timeout-minutes`. `tests/site.test.mjs` asserts the exact list of those nine step names and that the gating steps call their npm scripts. `scripts/check-workflows.mjs` checks only that each workflow has a top-level `permissions` block that is not `write-all`, and that zero workflow files is a failure. `scripts/check-dist.mjs determinism` builds twice with `npm run build` and compares the two trees with `compareTrees`. `package.json` has the scripts `check:determinism`, `check:links`, `test:axe`, `check:workflows`.
- Scripts this task wires, created by other tasks: `check:content` (TASK-029), `check:privacy` and `test:csp` (TASK-030), `test:search` (TASK-028), `test:axe` (TASK-031 widens it). TASK-028 is in this task's `depends_on` because the search step needs its script.
- The performance slot stays a skipped step until TASK-032 (post-launch); this task keeps it.
- Contract kept: the step names and their order of TASK-001 AC-10 (`install`, `node --test`, `build`, `determinism compare`, `link check`, `axe`, `performance slot`) stay in this relative order; new steps are inserted between them.
- Expected scope: `.github/workflows/ci.yml`, `scripts/check-workflows.mjs`, `scripts/check-dist.mjs`, `package.json`, `tests/site.test.mjs`, `tests/check-workflows.test.mjs` (new), `tests/fixtures/workflows/` (new). 7 paths.
- The verification-tag build (AC-26 of the PRD) stays covered by the tests of TASK-006 under `npm test`; no separate CI step is added for it (assumption).

## Acceptance criteria

- AC-1: `ci.yml` is read -> `verify` has these steps in this order, each running one npm script and none with `continue-on-error` or `if`: `checkout`, `setup node`, `install`, `node --test` (`npm test`), `build` (`npm run build`), `indexing variants` (`npm run check:indexing`), `determinism compare` (`npm run check:determinism`), `content check` (`npm run check:content`), `privacy check` (`npm run check:privacy`), `link check` (`npm run check:links`), `axe` (`npm run test:axe`), `csp check` (`npm run test:csp`), `search check` (`npm run test:search`), `workflow check` (`npm run check:workflows`), `performance slot`.
- AC-2: `npm run check:indexing` builds the site without `VERCEL_ENV=production` and without `SITE_INDEXABLE=1` -> it exits 0 only when every page holds `<meta name="robots" content="noindex, nofollow">`, `robots.txt` is `Disallow: /`, no `sitemap.xml` exists and the build log holds a line starting `indexing: blocked`.
  PRD ids: AC-46.
- AC-3: `npm run check:indexing` builds the site with `SITE_INDEXABLE=1` -> it exits 0 only when no page holds the `noindex` meta tag, `robots.txt` holds `Allow` and the `Sitemap:` line, `sitemap.xml` exists and the build log holds a line starting `indexing: allowed`; a fixture tree that breaks any of the 8 conditions of AC-2 and AC-3 exits 1 and names the condition.
  PRD ids: AC-46.
- AC-4: `npm run check:determinism` builds twice from clean with `SITE_INDEXABLE=1` -> it compares the two trees including `dist/pagefind/`, prints the sha256 over the sorted paths and contents of each, exits 0 when they are equal, and exits 1 and names every differing path when they differ.
  PRD ids: AC-47.
- AC-5: `scripts/check-workflows.mjs` reads a workflow whose text uses a secret other than `GITHUB_TOKEN` (`secrets.OTHER`, `secrets.TRAFFIC_TOKEN`) -> it exits 1 and names the file and the secret; `secrets.GITHUB_TOKEN` passes in any workflow.
  PRD ids: AC-45.
  Covers: NFR-8
- AC-6: `scripts/check-workflows.mjs` reads a workflow with no top-level `permissions` block, with `permissions: write-all`, or with a `permissions` block that exists only inside a job -> it exits 1 and names the file; the rule is applied to every `*.yml` and `*.yaml` file of the directory, so a workflow added later is checked without a change to the script.
  PRD ids: AC-45.
  Covers: NFR-8
- AC-7: `scripts/check-workflows.mjs` reads a directory that holds only `ci.yml` -> it exits 0 (the rules about workflows that are added later do not fail while the files do not exist), and a directory with no workflow file still exits 1.
  PRD ids: AC-45.
- AC-8: `scripts/check-workflows.mjs` reads the real `.github/workflows/` -> it exits 0 and `ci.yml` still has the name `ci`, the top-level `permissions: contents: read` and the triggers `pull_request` and `push` to `main`.
  PRD ids: AC-45.
- AC-9: `ci.yml` is read -> `timeout-minutes` of `verify` is greater than the longest of at least two measured durations of the full workflow of this task, and a comment next to it names those runs by id and duration.
- AC-10: `tests/site.test.mjs` is run -> it asserts the step list of AC-1, the gating rule (no `continue-on-error`, no `if`) for every step, and the exact npm script bodies of the gating steps; `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links` and `npm run test:axe` exit 0.
- AC-11: Failure criterion (anti-goal): the task is not done if a check step can be bypassed (`continue-on-error`, `if`, `|| true`), if the determinism compare skips `dist/pagefind/`, if the workflow checker passes on a fixture that breaks one of its rules, or if the checker fails because `sync.yml` does not exist yet, even when `ci / verify` is green.

## Out of scope

- The check scripts themselves: `check:content` (TASK-029), `check:privacy` and `test:csp` (TASK-030), `test:search` (TASK-028), the widened axe run (TASK-031), the Lighthouse step (TASK-032, post-launch).
- Creating `sync.yml` (TASK-035); the checker rules are written to hold when it is added.
- The GitHub ruleset and the required-check setting (TASK-034, owner step).
- The verification-tag build as a CI step; moving or renaming `verify`; changing the pinned actions of TASK-002.

## Constraints

- Expected test exception: the measured durations of AC-9 exist only after real runs on GitHub; tested instead: the key, its comment format and the relation to the recorded durations.
- ADR 0008 point 1: one job `verify`, the only required check; each workflow keeps a least-privilege top-level `permissions` block; `ci.yml` keeps `contents: read`.
- ADR 0008 point 3: one Chromium installation serves axe, the CSP check and the search check.
- ADR 0001: no new dependency; the checker keeps using `yaml`.
- `ci.yml` is the workflow of the required check: CRITICAL is considered (see Suggested class).

## Risks

- Every new step lengthens `verify`; three full builds and four browser runs may exceed the 5 minutes that TASK-002 set, which is why AC-9 re-measures.
- The checker looks for secrets by reading workflow text; an indirect use (a secret passed through `env` of another file) is not seen.
- `ci.yml` is edited by TASK-032 later; its test must be updated there, not worked around.
- A missing `test:search` script (if TASK-028 is not done first) fails AC-1 at the `search check` step.

## Pre-existing defects

none

## Suggested class

COMPLEX - change to the required-check workflow plus the workflow checker and a determinism rule, 4 modules (CRITICAL considered: `ci.yml` has read-only permissions, no secret and no deploy)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:indexing`
- `npm run check:determinism`
- `npm run check:content`
- `npm run check:privacy`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:csp`
- `npm run test:search`
- `npm run check:workflows`
