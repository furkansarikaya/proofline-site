# Task: TASK-036 - Real sync PR observation (owner step)

---
origin: prd:site
type: chore
size: S
depends_on:
  - TASK-034
  - TASK-035
prd: site

---

## Goal

The product owner has seen one real sync pull request from the sync workflow, with its approval-required check run and its merge blocked until the check passes, and has recorded what GitHub showed, so that the inferred behaviour of ADR 0003 is replaced by an observation.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-11, FR-13, and the criterion AC-16.

Launch scope decision, in the product owner's words:

> 035 ve 036 (otomatik sync PR'ı), 037, 038 ve 039 (trafik anlık görüntüsü) ve 032 (Lighthouse bütçesi) yayından sonraya ertelensin: task olarak yazılsın ama "post-launch" etiketiyle ve lansman task'larının (047 ve sonrası) bağımlılıklarından çıkarılsın. Yayından önce proofline sürümü elle güncellenir.

This task is no dependency of any launch task.

- ADRs: `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 8 and Consequences ("confidence medium on point 8: the approval-required state of a `GITHUB_TOKEN` pull request must be seen once on a real sync pull request"; the meaning of each compare status is unverified and is proved with the real API), `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` Evidence (G1, G2: approval-required runs; dispatched checks do not satisfy a required check), `/docs/design/ARCHITECTURE.md` task proposal 6 (acceptance: the setting is on and recorded, the repository is public, one real sync pull request shows the approval-required run).
- Today: the sync workflow exists after TASK-035; the ruleset after TASK-034; `ops/SETTINGS.md` is created by TASK-040 and extended by TASK-034.
- Expected scope: `ops/SETTINGS.md`. 1 path. The settings and the observation are made on GitHub, outside the code.
- Label: `post-launch`.

## Acceptance criteria

- AC-1: User step: the product owner turns on the repository setting "Allow GitHub Actions to create and approve pull requests" (Settings > Actions > General > Workflow permissions) and confirms that the repository `furkansarikaya/proofline-site` is public; the owner records both settings with the date in `ops/SETTINGS.md`.
  Covers: FR-11
- AC-2: User step: the owner runs `gh api repos/furkansarikaya/proofline/compare/b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd...main` (the pinned launch commit against the current `main` of the proofline repository) and records the `status` value in `ops/SETTINGS.md` with the date; when the proofline repository has a tag newer than `v0.0.173`, the owner records the `status` for that tag too.
  Covers: FR-11
- AC-3: User step: the owner starts the workflow `sync` by hand with a commit id of the proofline repository that differs from the pin -> a pull request from the branch `sync/proofline` opens by itself; the owner records the workflow run address, the pull request number and the list of added, removed and changed documents from the pull request body in `ops/SETTINGS.md`.
  Covers: FR-11
- AC-4: User step: the owner opens the pull request before doing anything else -> the Checks tab shows the run of `ci / verify` in the state GitHub names for a workflow waiting for approval ("Approve workflows to run" or the text GitHub shows), and the merge is blocked; the owner records the exact text shown and a screenshot file name or the output of `gh pr checks` for that pull request.
  PRD ids: AC-16.
  Covers: FR-13
- AC-5: User step: the owner clicks "Approve workflows to run" -> `ci / verify` runs on the pull request; while it runs or fails the merge stays blocked, and when it passes the merge is allowed; the owner records the three states with times in `ops/SETTINGS.md`, then closes the pull request without merging unless the owner wants the new pin.
  PRD ids: AC-16.
  Covers: FR-13
- AC-6: User step: the owner compares the observation with ADR 0003 point 8 (an approval-required run exists; the check blocks the merge until it passes) and writes one line "matches ADR 0003" or a description of the difference in `ops/SETTINGS.md`; a difference is also filed as a follow-up task by the owner and no ADR is edited in this task.
  Covers: FR-11
- AC-7: Failure criterion (anti-goal): the task is not done if the pull request was created by a person's token instead of the workflow, if the merge was allowed before `ci / verify` passed, or if an observation is recorded without its date and the pull request number, even when the workflow run is green.

## Out of scope

- Changing the workflow (a difference found here becomes a follow-up task) and editing ADR 0003.
- The ruleset (TASK-034).
- Merging the sync pull request into `main` as a launch step; the launch pin is set by hand (TASK-043).
- Observing a scheduled tag-follow run; only the manual start is observed.

## Constraints

- Expected test exception: owner step; the behaviour of real GitHub cannot be reproduced by a test. The evidence is the dated record and the pull request number.
- The setting is the owner's decision recorded in ADR 0003 point 8; the repository is public (owner statement, ADR 0007 Evidence).
- No token value is recorded.

## Risks

- If GitHub starts the check without the approval click, or never shows a pending state, ADR 0003's review point does not exist; AC-6 records it and a follow-up task decides.
- The owner's manual start with a real commit runs a full build on GitHub; a red build leaves a draft pull request, which is also a valid observation of TASK-035.
- The proofline repository has one tag only (`v0.0.173`), so a tag-follow target may not exist to observe.

## Pre-existing defects

none

## Suggested class

STANDARD - one record file; the observation is made by the owner on GitHub outside the code (CRITICAL considered: the setting lets Actions create pull requests, but no code, secret or deploy changes)

## Verification commands

- `gh pr checks`
- `npm test`

## Labels

post-launch
