# Task: TASK-047 - Vercel connection and cutover (owner step)

---
origin: prd:site
type: chore
size: M
depends_on:
  - TASK-024
  - TASK-026
  - TASK-028
  - TASK-034
  - TASK-041
  - TASK-042
  - TASK-043
  - TASK-044
  - TASK-045
  - TASK-046
prd: site
---

## Goal

The product owner connects the existing Vercel project of proofline.technology to this repository with production branch `main`, sets and records the protection, retention and redirect settings, and the first production deployment replaces the old site on the same domain, with the launch checks passing right after it.

## Context

- PRD requirements: FR-20 (the cutover on the same domain and hosting, the existing Vercel project connected to the repository with production branch `main`), FR-19 (the old site is not preserved and no old address is redirected), NFR-2 (static site, free hosting, no paid tool), and the criteria AC-28 and AC-29 (old addresses answer not found; http and www redirect permanently to the https apex). FR-32 puts the switch after PB-3, the first-screen check, the link search and the DNS record, and before the rehearsal.
- Launch scope: the product owner's decision of 2026-11-20, quoted here because it sets what this task does not wait for:

> 035 ve 036 (otomatik sync PR'ı), 037, 038 ve 039 (trafik anlık görüntüsü) ve 032 (Lighthouse bütçesi) yayından sonraya ertelensin: task olarak yazılsın ama "post-launch" etiketiyle ve lansman task'larının (047 ve sonrası) bağımlılıklarından çıkarılsın. Yayından önce proofline sürümü elle güncellenir.

  So the dependencies above leave out TASK-032, TASK-035 and TASK-036. The proofline version is the pin of TASK-043 (tag v0.0.173); the owner updates it by hand before the switch when needed (step 2 of `ops/LAUNCH.md`).
- Sources: `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` (decision points 1, 4, 5, 6, 7: the hosting, retention of at least 7 days, the switch as the first production deployment of `main`, the three layers that keep non-production builds out of search, the www redirect and the plan), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (the header set the checks read), `/docs/design/ARCHITECTURE.md` (section "Migration", steps 3 and 4; task proposal 8). The plan is Hobby for a personal, non-commercial open-source project (owner's answer of 2026-11-19, recorded in ADR 0005).
- There is no way back to the old site (owner decision): a problem found after the first production deployment is repaired by a new deployment, and the rehearsal of the way back to the previous deployment of the new site is TASK-048.
- The documents it fills: `ops/SETTINGS.md` (rows of TASK-040) and step 7 of `ops/LAUNCH.md` (TASK-040). The script `npm run check:launch` is TASK-041.
- Expected scope: `ops/SETTINGS.md`, `ops/LAUNCH.md` (2 paths).

## Acceptance criteria

- AC-1: Before connecting, `main` is read -> its newest commit has a green `ci / verify` run, `vercel.json` exists in the repository, `sync/pin.json` holds the tag v0.0.173 or the tag the owner updated it to, and the row "launch pin at the switch" of `ops/SETTINGS.md` records that pin and the date; the cutover does not start while any of these is false.
  Covers: FR-20
- AC-2: User step: the owner connects the existing Vercel project of proofline.technology to the repository `furkansarikaya/proofline-site` with production branch `main` -> the row "Vercel project connected with production branch main" of `ops/SETTINGS.md` records the project name as the dashboard shows it, the branch `main`, the date (UTC) and the time of the first production deployment, which is the cutover.
  PRD ids: AC-29
  Covers: FR-20
- AC-3: User step: the owner sets Deployment Protection of the project to Standard or stronger -> the row "Deployment Protection level" holds the level as the dashboard shows it and the date; a pull request preview URL opened without a Vercel login asks for authentication (an HTTP 401 answer or a login redirect), and the row "preview deployment closed to visitors without a login" records that observation.
  Covers: FR-20
- AC-4: User step: the owner sets the retention of production deployments to at least 7 days -> the row "production deployment retention" holds the value in days as the dashboard shows it (7 or more) and the date.
  PRD ids: AC-31
  Covers: FR-20
- AC-5: User step: the owner sets the redirect of www.proofline.technology to proofline.technology as permanent under Domains -> the row "www to apex redirect" holds the status code the dashboard shows (308 or 301) and the date.
  PRD ids: AC-29
  Covers: FR-20
- AC-6: User step: the owner records the plan -> the row "Vercel plan" holds `Hobby`, the words "personal, non-commercial open source", and the date; no paid plan and no paid add-on is enabled for the project.
  Covers: NFR-2
- AC-7: Right after the first production deployment, `npm run check:launch` is run -> the section of step 7 in `ops/LAUNCH.md` records the date, the number of passed and failed checks, and the exit code; the cutover row is marked complete only when the exit code is 0, and a failed check is listed there with its line.
  PRD ids: AC-28, AC-29
  Covers: FR-19, FR-20
- AC-8: The owner requests `https://proofline.technology/`, `https://proofline.technology/tr/` and `https://proofline.technology/sitemap.xml` after the cutover -> the home pages respond 200 with the title element of the new home page in English and in Turkish (the product name followed by the descriptive phrase, per ADR 0002 point 5), `sitemap.xml` responds 200 with https addresses only, and these observations are recorded in step 7.
  PRD ids: AC-29
  Covers: FR-20
- AC-9: An address of `ops/old-sitemap.txt` that the new site does not define (for example `https://proofline.technology/faq/`) is requested -> it answers 404 with the bilingual not-found page and no redirect, and this is recorded in step 7.
  PRD ids: AC-28
  Covers: FR-19
- AC-10: Failure criterion (anti-goal): the task is not done if a setting row holds a value the dashboard did not show (a guess, a planned value, an agent-written value), if the cutover is recorded as complete while `npm run check:launch` exits other than 0, if any old address is redirected to make a check pass, or if a rollback to the old site is used, even when the home page loads.

## Out of scope

- The rehearsal of the way back (TASK-048), the sitemap submission, the old-address 404 check on launch day and the directory listings (TASK-049).
- The ruleset on `main` (TASK-034), DNS and consoles (TASK-046), PB-3 (TASK-044) and the first-screen check (TASK-045); they are finished before this task starts.
- Any post-launch task: Lighthouse budget (TASK-032), sync workflow and its observation (TASK-035, TASK-036).
- Any traffic snapshot: there is none (PRD L-4); traffic is read by hand.
- Changing `vercel.json`, code or the site content; a problem found here is repaired by a pull request of its own.
- Billing, Pro features and any change to the DNS zone beyond what TASK-046 recorded.

## Constraints

- Expected test exception: an owner step in the Vercel dashboard on the real project; a test-first RED does not exist. Tested instead by the rows recorded in `ops/SETTINGS.md`, by the observations in step 7 and by `npm run check:launch`.
- ADR 0005: the first production deployment of `main` is the cutover; Deployment Protection Standard or stronger; retention of production deployments of at least 7 days; the permanent www redirect is set explicitly under Domains.
- Code tasks never wait on this decision: the code was merged earlier; this task only connects and records.
- No secret, token or environment variable value is written to a repository file or a log.

## Risks

- This is the production cutover of the domain: a problem found after the first deployment cannot be undone by returning to the old site (owner decision); it is repaired forward, and the one-step return to the previous deployment of the new site exists only after a second deployment (TASK-048).
- Between the cutover and the second production deployment there is no rollback target; the owner creates the second deployment at the start of TASK-048.
- Hosting behaviours marked unverified in ADR 0005 and ADR 0006 (status of the 404 page, HSTS, the `.md` content type) are first seen here; the check script reports them.
- If the owner updates the pin by hand at the last minute, the link search (step 5) and the README check were made at the earlier pin and are repeated (step 2 of `ops/LAUNCH.md`).
- CRITICAL indicator: high-impact deploy of the production domain; the task changes no code, workflow or secret.

## Pre-existing defects

none

## Suggested class

CRITICAL - high-impact infrastructure and deploy: production cutover of the domain and the hosting settings (no code, workflow or secret changes; the lead classifies)

## Verification commands

- `npm run check:launch`
- `grep -c 'Vercel project connected' ops/SETTINGS.md`
- `npm run build`
