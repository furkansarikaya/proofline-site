# Task: TASK-034 - GitHub ruleset and required check (owner step)

---
origin: prd:site
type: chore
size: S
depends_on:
  - TASK-033
prd: site

---

## Goal

The `main` branch of the site repository can change only through a pull request whose `ci / verify` check has passed, and the product owner has recorded the setting, its date and the evidence in the repository.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-13, and the criterion AC-16 (a pull request cannot be merged while the build check fails).

- ADRs: `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` Consequences (the ruleset: required status check `ci / verify`, require a pull request, no required approvals because a solo maintainer cannot approve his own pull request, block force pushes; the stored context string is whatever GitHub shows for `ci / verify` after the first run), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 8 ("The branch ruleset requires the check of ADR 0008").
- Today: the repository `furkansarikaya/proofline-site` is public; `.github/workflows/ci.yml` names the workflow `ci` and the job `verify`; `ops/SETTINGS.md` is created by TASK-040 (an empty table of recorded settings). If this step is done before TASK-040, the owner creates the file with the same table.
- Expected scope: `ops/SETTINGS.md`. 1 path. The setting itself is made in the GitHub settings, outside the code.
- This task is the owner's step; it changes no code.

## Acceptance criteria

- AC-1: User step: the product owner creates a repository ruleset on the branch `main` (Settings > Rules > Rulesets) with the rules "Require a pull request before merging" with 0 required approvals, "Require status checks to pass" with the check that GitHub lists for `ci / verify` (picked from the list GitHub offers after a first run), and "Block force pushes"; the owner records in `ops/SETTINGS.md` a row with the setting name, the value, the date and the exact check string GitHub shows.
  Covers: FR-13
- AC-2: User step: the owner runs `gh api repos/furkansarikaya/proofline-site/rulesets` and `gh api repos/furkansarikaya/proofline-site/rulesets/{id}` for the new ruleset -> the output holds a rule of type `pull_request` with `required_approving_review_count` 0, a rule of type `required_status_checks` whose context equals the string recorded in AC-1, a rule of type `non_fast_forward`, and the ruleset `enforcement` is `active`; the owner pastes those four values into `ops/SETTINGS.md` next to the row of AC-1.
  Covers: FR-13
- AC-3: User step: the owner opens a throwaway pull request that makes `ci / verify` fail (a deliberately failing test) -> the pull request shows the merge blocked while the check is red; the owner records the pull request number and the blocking text GitHub shows in `ops/SETTINGS.md`, then closes the pull request without merging and deletes its branch.
  PRD ids: AC-16.
  Covers: FR-13
- AC-4: User step: the owner opens a throwaway pull request whose changes make `ci / verify` pass -> the pull request shows the merge allowed without any approval; the owner records the pull request number and the result in `ops/SETTINGS.md`, then closes it without merging.
  PRD ids: AC-16.
- AC-5: Failure criterion (anti-goal): the task is not done if the recorded check string differs from the string GitHub shows on the pull request, if the number of required approvals is greater than 0, if the ruleset is in `evaluate` or `disabled` mode, or if a screenshot or output is recorded without its date, even when a pull request merged once without trouble.

## Out of scope

- The first sync pull request, the setting "Allow GitHub Actions to create and approve pull requests" and the approval-required run (TASK-036).
- Deployment Protection, retention and the www redirect (TASK-047).
- Any rule for tags.
- Changing `ci.yml` or its check name.

## Constraints

- Expected test exception: owner step; no automated test can set or read the repository ruleset of a repository the code does not control. The evidence is the recorded setting, the `gh api` output and the two pull request numbers.
- The values (check `ci / verify`, 0 approvals, force pushes blocked) are the product owner's decision recorded in ADR 0008 Consequences.
- No token or secret value is recorded; `gh api` output holds none.

## Risks

- The check appears in the ruleset's list only after it has run once on the repository; the owner creates the ruleset after the first green `ci` run.
- With 0 required approvals a single maintainer can merge his own pull request, which is the intent; the check is the only gate.
- A ruleset with a wrong context string blocks every merge or none; AC-3 and AC-4 test both sides.

## Pre-existing defects

none

## Suggested class

STANDARD - one record file; the repository setting is made by the owner outside the code (CRITICAL considered: it sets the required check, but no code, secret or deploy changes)

## Verification commands

- `gh api repos/furkansarikaya/proofline-site/rulesets`
- `npm test`
