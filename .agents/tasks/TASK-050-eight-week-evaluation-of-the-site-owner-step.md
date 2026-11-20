# Task: TASK-050 - Eight-week evaluation of the site (owner step)

---
origin: prd:site
type: chore
size: S
depends_on:
  - TASK-049
prd: site
---

## Goal

Eight weeks after the launch the product owner reads Search Console for the seven descriptive queries, sets a target for each success metric from its baseline, and records for each metric the decision it informs, so the site's content is kept, changed or no longer measured on evidence and not on a guess.

## Context

- Start condition (not a front matter key): this task does not start before eight weeks, 56 days, after TASK-049 is done. The date is the value of the field `launch-day steps completed (UTC date):` in `ops/LAUNCH.md` (TASK-049). The task is queued behind TASK-049 and the owner starts it on or after that date plus 56 days.
- PRD requirements: FR-30 (no target before the evaluation; the evaluation reads the Search Console impressions for the descriptive queries, lists the content changes for each query that has none, sets a target for each metric from its baseline and records for each metric the decision it informs: keep the content, change the content, or stop reading the metric), FR-25 (what counts as success, read once at this evaluation: the GitHub star count, the documentation page visits and the Search Console impressions; clone counts, the bare brand query and "install command copied" are not measures), NFR-5 (INP is read from the field data of the Search Console Core Web Vitals report at this evaluation, and recorded as not available when there is none), and the criteria AC-40, DEC-4 (`/docs/product/site/DECISION.md`) and the metrics M-1, M-4 and M-5 (M-2 and M-3 were removed, PRD L-4).
- The 7 queries and the page that answers each (PRD FR-9): "Claude Code workflow" (`/docs/guides/daily-use/` with `/docs/concepts/workflow/`); "Claude Code and Codex" (`/claude-code-and-codex/`); "multi-agent coding workflow" (`/docs/concepts/roles/` and `/docs/concepts/gates/`); "AI code review with evidence" (`/trust/` and `/docs/concepts/evidence/`); "TDD with AI agents" (`/docs/concepts/testing/`); "Claude Code skills" (`/docs/skills/`); "yapay zeka ajan iş akışı" (`/tr/docs/guides/gunluk-kullanim/`).
- Baselines are the fixed values of the PRD (L-4), not readings: M-1 is 1 star on 2026-11-20, M-4 is 0 and M-5 is 0. The evaluation is one look: the owner reads the star count and Search Console once, and reads nothing from GitHub Insights. M-6 (the PB-3 install time, TASK-044) is not part of this evaluation.
- Assumption: the target of each metric is set in this task from its fixed baseline and the one reading made here, and the record says so; AC-40 asks for "a target for each of M-1, M-4 and M-5 set from its baseline".
- The record file `ops/EVALUATION.md` is created by this task. The content-change tasks it names are written afterwards through the task author as follow-ups; this task lists their ids.
- Expected scope: `ops/EVALUATION.md` (1 path).

## Acceptance criteria

- AC-1: The record is written -> `ops/EVALUATION.md` shows the launch-day date read from `ops/LAUNCH.md`, the date of the evaluation, and the number of days between them, which is 56 or more.
  PRD ids: AC-40
  Covers: FR-30
- AC-2: User step: the owner reads the Search Console performance report for the period from the launch-day date to the evaluation date -> `ops/EVALUATION.md` holds a table of the 7 queries with, for each, the impressions in that period and the page that answers it (as listed in Context); a query that the report does not show is recorded as 0.
  PRD ids: AC-40, M-5
  Covers: FR-30, FR-25
- AC-3: A query has 0 impressions -> the record has a line for it naming a content-change task by id (a file that exists under `.agents/tasks/`) with a one-line scope; when no query has 0 impressions the record says "none: every query has impressions".
  PRD ids: AC-40, DEC-4
  Covers: FR-30
- AC-4: User step: the owner records the metrics M-1, M-4 and M-5 -> `ops/EVALUATION.md` holds one row per metric with the baseline (value, date, source), the target set from it, the date of the reading the target rests on, and the decision the metric informs, which is exactly one of "keep the content", "change the content" or "stop reading the metric".
  PRD ids: AC-40, M-1, M-4, M-5
  Covers: FR-30
- AC-5: User step: the owner reads the star count on the repository page at the evaluation -> `ops/EVALUATION.md` holds the star count (M-1) with the reading date (UTC), the baseline "1 star on 2026-11-20" copied from the PRD, and a target set from them; the record states that nothing was read from GitHub Insights.
  PRD ids: M-1, L-4
  Covers: FR-30, FR-25
- AC-6: M-4 is recorded -> its value is the Search Console clicks in the period on pages under `/docs/` and `/tr/docs/` (the documentation page visits of FR-25), and its baseline cell holds "0" as the PRD fixes it; the M-5 baseline cell holds "0".
  PRD ids: M-4, M-5
  Covers: FR-25
- AC-7: The Core Web Vitals report of Search Console is read -> `ops/EVALUATION.md` records the INP value in milliseconds for the site, or the words "not available" when the report has no field data; "not available" is not recorded as a pass.
  Covers: NFR-5
- AC-8: Failure criterion (anti-goal): the task is not done if the record is made before 56 days have passed, if a target is written without a baseline or a first reading, if clone counts, the bare brand query or "install command copied" appear as a measure, if "no data" is read as a pass, or if any value is estimated instead of read, even when every table cell is filled.

## Out of scope

- Writing the content-change tasks themselves, and the content changes (follow-up tasks).
- Any automatic traffic record (removed, PRD L-4) and any dashboard.
- M-6, the PB-3 install time (TASK-044) and A-1 / A-8, which no metric measures (Q-2).
- Changing the PRD, DECISION.md or the site; the evaluation only records.
- Metric targets before this evaluation (FR-30).

## Constraints

- Expected test exception: an owner step that reads Search Console after eight weeks; a test-first RED does not exist and the date cannot be tested earlier. Tested instead by the recorded table and by the date check of AC-1.
- The Search Console reading is the owner's; an agent never writes a number it did not read.
- All text is English; the Turkish query is quoted as the PRD writes it.

## Risks

- Eight weeks is a long wait: the launch-day date must be recorded in `ops/LAUNCH.md` by TASK-049, or the date check of AC-1 has no base.
- Search Console shows only queries with impressions, so a missing query reads as 0 in this record; a query may also appear under a different wording and be missed.
- One reading is a thin basis: a star count and Search Console after eight weeks show a direction, not a trend; the record says so.
- A new site may have no INP field data at eight weeks; the record then says "not available".

## Pre-existing defects

none

## Suggested class

TRIVIAL - one new record document filled by the owner, no executable code, no integration

## Verification commands

- `grep -n 'days' ops/EVALUATION.md`
- `grep -c '^| M-' ops/EVALUATION.md`
- `npm run build`
