# Task: TASK-031 - Accessibility gate widened

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-019
  - TASK-021
  - TASK-022
  - TASK-023
prd: site

---

## Goal

The axe run gates the four site pages in both languages against WCAG 2.2 level AA, reports (without failing) on the docs pages whose content is outside the site's control, and the product owner records one manual keyboard pass over the same four pages.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD id: NFR-6.

- ADRs: `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 5 (tags, gate pages, report-only pages, the written keyboard pass), `/docs/adr/0009-browser-checks-with-the-playwright-library-under-node-test.md`, `/docs/adr/0004-static-search-with-pagefind.md` (Accessibility: the widget is covered by the report-only run on `/docs/`).
- Design: `/docs/design/DESIGN.md` (tokens and "Header controls (rules)": 44 by 44 targets, focus ring) as the standard the pages are built to; no new UI is built in this task.
- Today: `tests/axe.mjs` (TASK-001) runs `@axe-core/playwright` 4.14.0 on `/` and `/tr/` and a failing fixture page (`image-alt`) through `scripts/serve-dist.mjs`; the command is `npm run test:axe` (`node --test tests/axe.mjs`). The pages of the other three site pages come from TASK-021, 022, 023, the home page from TASK-019.
- Gate pages (8): `/`, `/tr/`, `/get-started/`, `/tr/baslarken/`, `/trust/`, `/tr/guven/`, `/claude-code-and-codex/`, `/tr/claude-code-ve-codex/`. Report-only pages (4): one synced guide `/docs/guides/daily-use/`, `/docs/`, `/tr/docs/`, one Turkish guide `/tr/docs/guides/gunluk-kullanim/`.
- Expected scope: `tests/axe.mjs`, `tests/fixtures/axe/` (new, fixture pages), `ops/SETTINGS.md` (the keyboard-pass record; TASK-040 creates the file, and if this step comes first the owner adds only a section "Keyboard pass"). 3 paths.
- Mixed task: AC-1 to AC-7 are code and are verified without the owner; AC-8 is the owner's step and is last.

## Acceptance criteria

- AC-1: `npm run test:axe` scans each of the 8 gate pages with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` -> it fails when any page has a violation and prints the page address, the rule id, the impact and the element targets of each violation.
  Covers: NFR-6
- AC-2: A fixture page whose only fault is a button of 10 by 10 pixels (rule `target-size`, tag `wcag22aa`) is scanned -> the run reports that violation, which proves the `wcag22aa` tag is in force; the fixture page with a missing image alternative still reports `image-alt`.
  Covers: NFR-6
- AC-3: A gate page answers a status other than 200 -> the test fails naming the address; a run that scanned fewer than 8 gate pages fails.
  Covers: NFR-6
- AC-4: `npm run test:axe` scans the 4 report-only pages with the same tags -> each page prints one line `report-only {address}: N violations` followed by one line per violation (rule id, impact, targets), and the test passes even when N is greater than 0.
  Covers: NFR-6
- AC-5: A report-only page answers a status other than 200 -> the test fails naming the address (a missing page is not a pass).
  Covers: NFR-6
- AC-6: The run ends -> it prints a summary with the number of gate pages scanned, the number of gate violations, the number of report-only pages scanned and the number of report-only violations.
- AC-7: Failure criterion (anti-goal): the task is not done if a report-only violation makes the run fail, if a gate violation makes it pass, if the tag list lacks `wcag22aa`, or if the run passes while scanning 0 pages, even when `ci / verify` is green.
- AC-8: User step: the product owner walks the 8 gate pages with the keyboard only (Tab, Shift+Tab, Enter, Space, Escape), and writes into `ops/SETTINGS.md` under a section "Keyboard pass" the date, the browser and its version, and for each of the 8 pages one line with "pass" or the control that could not be reached or operated; a line with a problem is also filed as a follow-up task by the owner.
  Covers: NFR-6

## Out of scope

- Fixing violations on pages: a violation found on a gate page is fixed in the task of that page; this task only makes the run catch it.
- Filing the findings of the report-only pages in the proofline repository (done by the owner by hand, NFR-6).
- The search widget's own keyboard pass; `/docs/` stays report-only (ADR 0004).
- Lighthouse accessibility scores (TASK-032) and any change to `.github/workflows/ci.yml` (the step `axe` already runs `npm run test:axe`).

## Constraints

- ADR 0008 point 5: the tag list and the split between gate and report-only pages are fixed; `@axe-core/playwright` stays at 4.14.0 and `playwright` at 1.65.1 (exact versions, ADR 0001).
- ADR 0009: no `@playwright/test`; the file stays `tests/axe.mjs` and the command `npm run test:axe`.
- Expected test exception: the keyboard pass (AC-8) is a human step and has no automated test; the evidence is the record in `ops/SETTINGS.md`.
- The PRD wording is kept: an automated checker finds part of the issues (ADR 0008 point 5).

## Risks

- axe finds only part of the WCAG issues (ADR 0008: about 57%), so a green run is not proof of conformance; the keyboard pass is the second check.
- Report-only findings can pile up unseen; the summary line of AC-6 keeps the count visible in the CI log.
- The owner's step can be left undone; the launch checklist (TASK-040) lists it.

## Pre-existing defects

none

## Suggested class

STANDARD - bounded change to one browser test file plus one owner record, no new integration

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run test:axe`
