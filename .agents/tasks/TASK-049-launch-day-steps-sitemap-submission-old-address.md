# Task: TASK-049 - Launch-day steps: sitemap submission, old-address check, directory listings (owner step)

---
origin: prd:site
type: chore
size: S
depends_on:
  - TASK-048
prd: site
---

## Goal

On launch day the product owner submits the sitemap in Google Search Console and Bing Webmaster Tools, confirms that the old addresses answer not found, lists the skills catalogue in a skills directory and in awesome-claude-code, and records each step, so the new site is announced to crawlers and to people who look for skills.

## Context

- PRD requirements: FR-21 (the sitemap is submitted in Google Search Console and in Bing Webmaster Tools at the launch), FR-32 (the order of the checklist: ownership check when the fallback was used, old-address check, sitemap submission, listing in a skills directory and in awesome-claude-code), and the criteria AC-27 (verification status checked and recorded), AC-28 (old addresses answer 404 with the bilingual page).
- There is no traffic snapshot step: the snapshot job was removed (PRD L-4); success is judged once, eight weeks later (TASK-050).
- Sources: `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` (point 7 records the baselines of M-4 and M-5 as "none" and "old site"; PRD L-4 later fixed both at 0, and the PRD wins), `/docs/product/site/COMPETITORS.md` (C-81: awesome-claude-code is a place where proofline wants to be listed), `ops/LAUNCH.md` steps 9 to 12 (TASK-040), `ops/SETTINGS.md` (rows of TASK-046).
- Starting state: TASK-048 is done, the site is live and the way back has been rehearsed. `npm run check:launch` exists (TASK-041).
- This task fills steps 9 to 12 and the field `launch-day steps completed (UTC date):` of `ops/LAUNCH.md`; the date written there starts the eight-week count of TASK-050.
- Assumption: the "skills directory" is a directory of agent skills chosen by the owner; the task records which one, the address of the submission and its date. The acceptance of a listing by its maintainers is not required.
- Expected scope: `ops/LAUNCH.md` (1 path).

## Acceptance criteria

- AC-1: User step: the owner submits `https://proofline.technology/sitemap.xml` in the Search Console Domain property -> the console shows the sitemap with status "Success" (or "Couldn't fetch" with the reason), and step 11 of `ops/LAUNCH.md` records the status as the console shows it and the date (UTC).
  PRD ids: AC-32
  Covers: FR-21
- AC-2: User step: the owner submits the same sitemap in Bing Webmaster Tools -> step 11 records the status as the console shows it and the date (UTC).
  Covers: FR-21
- AC-3: `npm run check:launch` is run on launch day -> step 10 of `ops/LAUNCH.md` records the date and the number of old addresses checked, and states that each answered 404 with the bilingual not-found page; any address that did not is listed with the status found, and the step stays open until `npm run check:launch` exits 0 again.
  PRD ids: AC-28
  Covers: FR-19, FR-32
- AC-4: The meta-tag fallback was used (row of TASK-046 says `pending`) -> User step: the owner checks the verification status in both consoles right after the switch and step 9 of `ops/LAUNCH.md` shows `verified` or `not verified` for each console with the date; when DNS verification was used step 9 shows "not applicable: verified by DNS (TASK-046)".
  PRD ids: AC-27
  Covers: FR-32
- AC-5: User step: the owner lists the skills catalogue (`https://proofline.technology/docs/skills/`) in a skills directory and submits it to awesome-claude-code -> step 12 records, for each, the directory or repository name, the address of the submission (listing page, issue or pull request) and the date (UTC); a refused or pending listing is recorded as such and does not keep the step open.
  Covers: FR-32
- AC-6: Step 11 is recorded -> it states the fixed baselines of the PRD (M-1: 1 star on 2026-11-20; M-4: 0; M-5: 0), copied from the PRD (L-4), and no Search Console or GitHub reading is taken on launch day; no target is set from them.
  PRD ids: M-4, M-5
- AC-7: All four steps are done -> the field `launch-day steps completed (UTC date):` of `ops/LAUNCH.md` holds that date; the launch record contains no line about a traffic snapshot (there is none, PRD L-4).
  PRD ids: L-2
  Covers: FR-32
- AC-8: Failure criterion (anti-goal): the task is not done if a status is recorded that the console or the check did not show, if a traffic snapshot step is added to the record, or if the launch-day date is written before all four steps are recorded, even when the sitemap is accepted.

## Out of scope

- Any traffic snapshot or token (removed, PRD L-4); any reading of the metrics (TASK-050 reads them once).
- Changes to the sitemap, robots.txt, pages or code; a problem found here becomes a separate task.
- The rollback rehearsal (TASK-048), the switch (TASK-047) and the eight-week evaluation (TASK-050).
- Announcements, social posts and any channel not named in FR-32.
- Persuading a directory's maintainers; only the submission is required.

## Constraints

- Expected test exception: an owner step in two consoles and two third-party listings; a test-first RED does not exist. Tested instead by the records in `ops/LAUNCH.md` and by `npm run check:launch`.
- Code tasks never wait on this decision.
- Only public information is submitted: the site address, the sitemap address and the catalogue address.

## Risks

- Search Console can show "Couldn't fetch" for a new sitemap for a few hours; the record keeps the status as shown and the owner checks again later without keeping this task open.
- A third-party directory may ask for details beyond the three public addresses; the owner decides what to give and the record names only the submission.
- The baselines are fixed values from the PRD, not readings; they are recorded so the evaluation does not read them as results.

## Pre-existing defects

none

## Suggested class

TRIVIAL - recorded results in one operations document, no executable code, no integration of ours

## Verification commands

- `npm run check:launch`
- `grep -n 'launch-day steps completed' ops/LAUNCH.md`
