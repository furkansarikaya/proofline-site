# Task: TASK-040 - Launch documents: checklist, recorded-settings table, old address list

---
origin: prd:site
type: docs
size: M
depends_on:
  - TASK-001
prd: site
---

## Goal

The product owner has three launch documents under `ops/`: the launch checklist in the order the PRD fixes, an empty table in which every owner step records its setting with a date, and the list of the 94 old site addresses that the launch checks must find answering not found.

## Context

- PRD requirements: FR-32 (the checklist and its order), FR-19 (old addresses answer not found), FR-22 (the repository link search is a checklist step), AC-27 to AC-31 (verification timing, old addresses, redirects, rehearsal, promote step and retention). The launch scope decision of the PRD (section "Launch scope decision (2026-11-20)", L-1, L-2, L-3) changes the checklist; the product owner's words:

> 035 ve 036 (otomatik sync PR'ı), 037, 038 ve 039 (trafik anlık görüntüsü) ve 032 (Lighthouse bütçesi) yayından sonraya ertelensin: task olarak yazılsın ama "post-launch" etiketiyle ve lansman task'larının (047 ve sonrası) bağımlılıklarından çıkarılsın. Yayından önce proofline sürümü elle güncellenir.

- Sources: `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` (decision points 2 to 7: way back, rehearsal, retention, switch, closed outside production, other items), `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` (point 7: launch-only checks), `/docs/design/ARCHITECTURE.md` (component C11 "Operations records", task proposal 8 with item (g): `ops/old-sitemap.txt` holds the 94 old addresses), `/docs/product/site/RESEARCH.md` (claim C-31 and the section "Old site address inventory").
- The old address list is reproducible from the repository. The RESEARCH inventory names 8 pages (`/`, `/faq/`, `/skills/`, `/agents/`, `/how-it-works/`, `/legal/privacy/`, `/legal/cookies/`, `/legal/terms/`), 28 skill slugs and 11 agent slugs; each exists in English and under `/tr/`, which gives (8 + 28 + 11) x 2 = 94. The old sitemap saved on 2026-11-19 (`.agents/local/scratch/sitemap.txt`, git-ignored, so it may be absent) holds the same 94 address entries in the http form; it is a cross-check only, not a source the task needs. The owner is not asked.
- The list holds the https form on the apex host (AC-28 requests that form; http and www reach it by the redirects of AC-29). It contains the two home addresses that the new site also defines; the check script (TASK-041) skips addresses the new sitemap contains.
- Later owner steps fill these documents: TASK-031 (keyboard pass), TASK-034 (ruleset), TASK-046 (DNS and consoles), TASK-047 (Vercel settings and the switch), TASK-048 (rehearsal record), TASK-049 (launch-day record).
- Expected scope: `ops/LAUNCH.md`, `ops/SETTINGS.md`, `ops/old-sitemap.txt` (3 paths).

## Acceptance criteria

- AC-1: `ops/LAUNCH.md` is read -> it holds a section "Launch steps" with exactly 12 headings `### Step 1: ...` to `### Step 12: ...`, in this order: README heading change and single Version line upstream; manual pin update when needed; PB-3; first-screen check; repository link search; DNS record and ownership check in both consoles; the switch; rehearsal of the way back; ownership check in both consoles when the meta-tag fallback is used; check that the old sitemap addresses answer not found; submission of the sitemap in both consoles; listing of the skills catalogue in a skills directory and in awesome-claude-code.
  PRD ids: AC-27, AC-28, AC-29, AC-30, AC-31
  Covers: FR-32
- AC-2: Each of the 12 steps is read -> it holds a line starting `Task:` that names the task that performs it (TASK-043, TASK-044, TASK-045, TASK-041, TASK-046, TASK-047, TASK-048, TASK-049 as the steps need), a line starting `Record:` that names the file and row or section where the result is written, and a line starting `Done when:` that states one observable condition.
  Covers: FR-32
- AC-3: The launch steps are searched for the words "Lighthouse", "sync workflow" and "sync pull request" -> the search returns 0 hits inside the section "Launch steps", so the sync workflow observation and the Lighthouse budget are not launch steps.
  PRD ids: L-2, L-3
  Covers: FR-32
- AC-4: Step 2 (manual pin update) is read -> it names `sync/pin.json` and `sync/lock.json`, says the owner runs the lock command of `scripts/sync.mjs` (TASK-007) and merges the change in a normal pull request that `ci / verify` checks, says the launch pin is the tag v0.0.173 (commit b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd) and that no update is needed when the owner keeps it, and says a pin change after step 5 repeats step 5.
  PRD ids: L-1, L-3
  Covers: FR-32
- AC-5: Step 5 (repository link search) is read -> it names `npm run check:launch` (TASK-041), says a hit is corrected in the proofline repository and the search is repeated until it finds 0 hits other than the domain root.
  PRD ids: AC-38
  Covers: FR-22
- AC-6: Step 6 and step 9 are read -> step 6 states that ownership is verified by the DNS TXT record before the switch and the status is checked by hand in both consoles; step 9 states that, when the meta-tag fallback was used, the status is checked in both consoles right after the switch; both name the row of `ops/SETTINGS.md` that stores the status.
  PRD ids: AC-27
  Covers: FR-32
- AC-7: Step 7 (the switch) is read -> it lists, in order, connecting the existing Vercel project to the repository with production branch `main`, setting Deployment Protection (Standard or stronger), setting production deployment retention of at least 7 days, setting the permanent www to apex redirect, recording each setting with its date in `ops/SETTINGS.md`, and running `npm run check:launch` right after the first production deployment (robots.txt, the redirects of AC-29, the response headers, the not-found status).
  PRD ids: AC-29
  Covers: FR-32
- AC-8: Step 8 and the section "Rehearsal record" are read -> step 8 lists: create the second production deployment (a redeploy of `main` when nothing changed), roll back with Instant Rollback to the previous production deployment of the new site, confirm it is served at https://proofline.technology, promote the newer deployment, confirm a later push to `main` goes live; the section holds empty fields `steps:`, `time:` and `result:`.
  PRD ids: AC-30
  Covers: FR-32
- AC-9: Step 8 is read -> it contains the sentence that after a rollback new pushes to `main` do not go live until the owner promotes a deployment, a line "Promote step:" that tells where to promote in the hosting dashboard, and the retention value of at least 7 days to be read from the retention row of `ops/SETTINGS.md`.
  PRD ids: AC-31
  Covers: FR-32
- AC-10: Step 10 is read -> it names `npm run check:launch` and `ops/old-sitemap.txt`, says each old address is requested in its https form on the apex host and must answer status 404 with the one bilingual not-found page, and says no old address is redirected.
  PRD ids: AC-28
  Covers: FR-19
- AC-11: The sections after the steps are read -> section "After the launch (post-launch)" lists TASK-032 (Lighthouse CI budget), TASK-035 (sync workflow), TASK-036 (sync pull request observation), each with one line saying what it does and that it is not a launch step; a separate line names TASK-050 as the evaluation that starts eight weeks after the launch-day steps; a section "Launch record" holds the empty field `launch-day steps completed (UTC date):`.
  Covers: FR-32
- AC-12: `ops/SETTINGS.md` is read -> it holds one table with the header `Setting | Value | Date (UTC) | Recorded by | Evidence` and these 15 rows, each with the Value, Date, Recorded by and Evidence cells empty: keyboard pass on the four site pages in both languages (TASK-031); ruleset on `main` with required check `ci / verify` (TASK-034); DNS provider and TXT record (TASK-046); Search Console Domain property status (TASK-046); Bing Webmaster Tools method and status (TASK-046); verification variables set in the Vercel project when DNS is not possible, names only (TASK-046); launch pin at the switch (TASK-047); Vercel project connected with production branch `main` (TASK-047); Deployment Protection level (TASK-047); production deployment retention (TASK-047); www to apex redirect (TASK-047); Vercel plan (TASK-047); preview deployment closed to visitors without a login (TASK-047); "Allow GitHub Actions to create and approve pull requests" (TASK-036, post-launch); repository public (TASK-036, post-launch).
- AC-13: `ops/old-sitemap.txt` is read -> it holds exactly 94 lines, one address per line, LF line endings, no blank line and no comment; every line starts with `https://proofline.technology/` and ends with `/`; `sort -u` leaves 94 lines.
  PRD ids: AC-28
  Covers: FR-19
- AC-14: `ops/old-sitemap.txt` is compared with the RESEARCH inventory -> it holds the 8 page addresses of the inventory (`/`, `/faq/`, `/skills/`, `/agents/`, `/how-it-works/`, `/legal/privacy/`, `/legal/cookies/`, `/legal/terms/`), the 28 skill addresses under `/skills/` and the 11 agent addresses under `/agents/`, each followed or accompanied by its `/tr/` twin (47 English and 47 Turkish addresses), and no address that the inventory does not name.
  PRD ids: AC-28
  Covers: FR-19
- AC-15: Failure criterion (anti-goal): the task is not done if any file under `ops/` already holds a recorded result (a date, a setting value, a rehearsal time or result, a console status, a verification token, a secret), if the checklist names the sync workflow or the Lighthouse budget as a launch step, or if `ops/old-sitemap.txt` holds an http address, a www address or an address with a query string, even when every other file is well formed.

## Out of scope

- Performing any step, and writing any recorded value, date or result: the owner steps TASK-031, 034, 044 to 049 do that.
- The script that reads `ops/old-sitemap.txt` (`scripts/check-launch.mjs`, TASK-041) and the sitemap of the new site.
- `ops/FIRST-SCREEN-CHECK.md` and `ops/EVALUATION.md`; each is created by the task that fills it.
- Editing the PRD, the ADRs or `docs/product/site/PROBES.md`.
- Redirects for old addresses (FR-19 forbids them).

## Constraints

- Expected test exception: documents only (task type `docs`); a test-first RED does not exist for them. Tested instead by the criteria read as commands in "Verification commands" (line count, uniqueness, prefix, step headings) and by a reading of the checklist against FR-32.
- All text in the three files is English; addresses and commands are ASCII.
- The PRD's FR-32 order is kept for the items it lists; the manual pin update step is the only addition and sits before the link search (decision L-3).
- ADR 0005 point 5: the switch is the first production deployment of `main`; there is no way back to the old site (owner decision), so the checklist never names the old site as a rollback target.

## Risks

- The 94-address count depends on the RESEARCH inventory; if the old site had an address that its sitemap did not list, the launch check cannot see it. It changes only the completeness of AC-28, not the site.
- A checklist that disagrees with the later owner tasks (step numbers, row names) makes the owner record a setting in the wrong place; the row names of `ops/SETTINGS.md` are fixed here for that reason.
- The two home addresses in the old list are also addresses of the new site; a reader who requests them expects 404. The check script skips them (TASK-041).

## Pre-existing defects

none

## Suggested class

STANDARD - new operations documents confined to `ops/`, no executable code, no integration (hosting steps are written down, not performed)

## Verification commands

- `npm ci`
- `npm test`
- `wc -l < ops/old-sitemap.txt`
- `sort -u ops/old-sitemap.txt | wc -l`
- `grep -c '^https://proofline.technology/.*/$' ops/old-sitemap.txt`
- `grep -c '^### Step ' ops/LAUNCH.md`
