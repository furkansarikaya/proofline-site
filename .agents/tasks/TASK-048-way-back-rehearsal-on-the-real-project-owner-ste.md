# Task: TASK-048 - Way-back rehearsal on the real project (owner step)

---
origin: prd:site
type: chore
size: S
depends_on:
  - TASK-047
prd: site
---

## Goal

Right after the switch the product owner returns once to the previous production deployment of the new site with Vercel Instant Rollback, promotes the newer deployment again, and writes the steps, the time and the result in the launch checklist, so the way back is proven before anyone needs it.

## Context

- PRD requirements: FR-20 (the way back is the one-step return to the previous production deployment of the new site, rehearsed once right after the switch as soon as two production deployments exist), and the criteria AC-30 (the return, the serving, the promotion, recorded with steps, time and result) and AC-31 (after a return a later push to the production branch does not go live until a deployment is promoted; the retention keeps production deployments for at least 7 days).
- Sources: `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` (decision points 2 and 3: "previous publication" is the production deployment of the new site that was live before the current one; the old site is never a target; after a rollback Vercel turns off automatic assignment of production domains; the rehearsal on the real project with two deployments of the new site, the owner may create the second with a redeploy of `main`; evidence marked inferred: promoting after a rollback restores automatic assignment, checked in the rehearsal), `/docs/design/ARCHITECTURE.md` (section "Migration", step 4).
- Starting state: TASK-047 is done, so one production deployment of the new site exists (the cutover). Step 8 and the section "Rehearsal record" of `ops/LAUNCH.md` (TASK-040) hold the steps and the empty fields `steps:`, `time:` and `result:`; the retention value is in the retention row of `ops/SETTINGS.md` (TASK-047).
- A push to `main` needs a pull request (ruleset of TASK-034); the pull requests of this rehearsal change only `ops/LAUNCH.md`.
- Expected scope: `ops/LAUNCH.md` (1 path).

## Acceptance criteria

- AC-1: Before the rollback, two production deployments of the new site exist -> the section "Rehearsal record" of `ops/LAUNCH.md` names both (the deployment URLs or ids as the dashboard shows them, and the commit of this repository each was built from), and states that the second was created by a redeploy of `main` when nothing had changed.
  PRD ids: AC-30
  Covers: FR-20
- AC-2: User step: the owner rolls back with Instant Rollback to the older of the two deployments -> the dashboard marks that deployment as the production deployment, a request to `https://proofline.technology/` responds 200, and the record in `ops/LAUNCH.md` holds the start time, the time the older deployment was served, and the duration in seconds.
  PRD ids: AC-30
  Covers: FR-20
- AC-3: After the rollback, a pull request that changes only `ops/LAUNCH.md` is merged into `main` -> a production deployment is created for it, `https://proofline.technology/` is still served by the rolled-back deployment (the new deployment is not live), and the record states this observation.
  PRD ids: AC-31
  Covers: FR-20
- AC-4: User step: the owner promotes the newest production deployment (the one created by the merge of AC-3, which is newer than the rolled-back one) -> the dashboard marks it as the production deployment, a request to `https://proofline.technology/` responds 200, and the record holds the promote step as the owner took it (the menu path in the dashboard), the time and the duration in seconds.
  PRD ids: AC-30, AC-31
  Covers: FR-20
- AC-5: After the promotion, a second pull request that changes only `ops/LAUNCH.md` is merged into `main` -> its production deployment goes live without a further step; when it does not, the owner re-enables automatic assignment of production domains in the project settings and the record says which of the two happened.
  PRD ids: AC-31
  Covers: FR-20
- AC-6: The record is read -> the field `result:` holds `pass` when AC-2 to AC-5 were observed as written and `fail` with the failing step otherwise, the retention value of the retention row of `ops/SETTINGS.md` (at least 7 days) is repeated in the record, and the field `steps:` lists the steps in the order they were taken.
  PRD ids: AC-30, AC-31
  Covers: FR-20
- AC-7: Failure criterion (anti-goal): the task is not done if the rollback target was a deployment of the old site or a deployment that was never a production deployment of the new site, if the `result:` line says `pass` without the times of AC-2 and AC-4, or if the production domain is left on the rolled-back deployment, even when the dashboard shows no error.

## Out of scope

- Changing `vercel.json`, the build or any page; the pull requests of the rehearsal change only `ops/LAUNCH.md`.
- A way back to the old site (the owner decided against it).
- Rolling back further than the previous deployment, and rehearsing on a preview deployment or a throwaway project.
- The sitemap submission, the old-address check and the directory listings (TASK-049).

## Constraints

- Expected test exception: an owner step on the real Vercel project; a test-first RED does not exist. Tested instead by the observations and times recorded in `ops/LAUNCH.md` and by the retention row of `ops/SETTINGS.md`.
- Vercel Hobby allows one-step rollback to the immediately previous production deployment only (ADR 0005, verified V1 and V2).
- Code tasks never wait on this decision.

## Risks

- During the rehearsal the production domain serves the older deployment for a short time; both are the new site, so a visitor sees the same site, possibly one commit behind.
- If the promote step does not restore automatic assignment, later merges do not go live until the owner acts; AC-5 makes that visible before the launch continues.
- A rollback to a deployment older than the retention is impossible; AC-6 repeats the retention value for that reason.
- Classing: CRITICAL considered (a rollback on the production domain) and taken.

## Pre-existing defects

none

## Suggested class

CRITICAL - high-impact deploy operation on the production domain (rollback and promote); no code, workflow or secret changes

## Verification commands

- `grep -n 'result:' ops/LAUNCH.md`
- `grep -n 'retention' ops/SETTINGS.md`
- `npm run check:launch`
