# Task: TASK-020 - Install-time and README command guards

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-010
prd: site

---

## Goal

The build fails, naming the page and the line, when a command on the get-started page does not appear in the README of the pinned commit, and when a page written for the site states an install time while the first-time installation probe PB-3 has no `confirmed` result.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-4, FR-5, FR-6 (the guard part), NFR-4, AC-3, AC-4, AC-36.

- PRD: FR-4 (command lines compared after trimming white space and removing a trailing comment that starts with " #" on both sides; the lines come from the fenced blocks between the heading "Install" and the heading "What it supports" of the README at the pin; an inline code span that starts with a command is compared with the inline spans of the same range; the blocks of `docs/guides/existing-project.md` are not compared), FR-5, FR-6, AC-3, AC-4 (the two patterns, copied below) and NFR-4 (naming the page and the pattern).
- ADRs: `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 4 (the guards of AC-3 and AC-4 live in the dist checker `scripts/check-dist.mjs`), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (pin facts, the README range), `/docs/design/ARCHITECTURE.md` section "Trade-offs" (rows "Get-started command spans compared only when marked" and "AC-4 pattern as written (no word boundary)"). Design documents: none, this task has no user interface.
- Patterns of AC-4, case-insensitive, applied to the text of a page written for the site: `(?<![\w-])(five|5)[ -]?(minutes?|mins?)` and `(?<![\w-])(beş|5)[ -]?(dakika|dk)`. The look-behind keeps "15 minutes" and "twenty-five minutes" from matching.
- PB-3 lives in `docs/product/site/PROBES.md` as the list item `- PB-3 ...` followed by indented lines `success:`, `failure:`, `locked:` and, once run, `result:` with the value `confirmed`, `failed` or `inconclusive`. Today the PB-3 item has no `result:` line, while the PB-1 and PB-2 items have `result: confirmed`.
- Today: `scripts/check-dist.mjs` exists with the modes `determinism` and `links` (`package.json`); TASK-010 produces the pin facts `readme_commands[]` and `readme_inline_spans[]` (ARCHITECTURE boundary C17 to C19). The get-started page does not exist yet (TASK-021 writes it), so the guard must pass when no such page exists and must work on fixtures.
- Assumption: the guard reads the built HTML of `dist/` (ADR 0008 point 4); which pages are site-written and which are synced is decided by the plan (for example by a marker written by the page route), and the tests prove both classes.
- Assumption: an inline code span of the get-started page is compared only when it carries the attribute `data-command` (ARCHITECTURE: "compared only when marked"); an unmarked span is prose and is not compared.
- Assumption: the guard runs in `npm run build` after the Astro build step and is also callable as `node scripts/check-dist.mjs guards` followed by the path of a dist folder with options for fixture facts and a fixture PROBES file; an npm script `check:guards` is added.
- Expected scope: `scripts/lib/guards.mjs`, `scripts/check-dist.mjs` (the `guards` mode), `package.json` (scripts `build` and `check:guards`), `tests/guards.test.mjs`, `tests/fixtures/guards/` (small dist trees, facts and PROBES files). 5 paths.

## Acceptance criteria

- AC-1: A fixture get-started page holds a command line in a fenced block that is not among `readme_commands` -> the guard exits with a non-zero code and the message names the page address and the line text.
  PRD ids: AC-3
  Covers: FR-4, NFR-4
- AC-2: The same fixture page holds lines that differ from `readme_commands` only by leading or trailing white space or by a trailing comment starting with " #" (on either side) -> the guard exits 0.
  PRD ids: AC-3
  Covers: FR-4
- AC-3: A fixture command line appears in the README outside the range between "Install" and "What it supports" (for example in the "Commands" section) but not in `readme_commands` -> the guard fails on it, naming the page and the line.
  Covers: FR-4
- AC-4: A fixture get-started page holds an inline code span with `data-command` that starts with a command and is not in `readme_inline_spans` -> the guard fails naming the span; the same span without `data-command`, and a span that is in `readme_inline_spans`, pass.
  Covers: FR-4
- AC-5: A synced fixture page (a guide) holds a command line that is not in the README and the text "five minutes" -> the guard exits 0 for both (the guards read site-written pages only).
  Covers: FR-4
- AC-6: PROBES.md has no `result:` line in its PB-3 item, and a site-written fixture page holds each of "5 minutes", "five-minute", "5 mins", "beş dakika" and "5 dk" in turn -> the guard exits non-zero for each and names the page and the pattern; the texts "15 minutes", "twenty-five minutes" and "a few seconds" pass.
  PRD ids: AC-4
  Covers: FR-5, NFR-4
- AC-7: PROBES.md has the PB-3 item with `result: failed`, and then with `result: inconclusive`, and a site-written page holds "5 minutes" -> the guard fails each time; with `result: confirmed` in the PB-3 item the same page passes.
  PRD ids: AC-36
  Covers: FR-6
- AC-8: PROBES.md has `result: confirmed` in the PB-1 and PB-2 items only, and a site-written page holds "5 minutes" -> the guard fails (only the PB-3 item counts), and a PB-3 `result:` value spelled `Confirmed` or `confirmed?` does not count as `confirmed`.
  PRD ids: AC-36
  Covers: FR-6
- AC-9: The guard runs on the real `docs/product/site/PROBES.md` and on a built site that holds no install-time text and no get-started page -> it exits 0 and prints the PB-3 state (`PB-3: no result`) without failing.
  Covers: NFR-4
- AC-10: `npm run build` runs on a fixture site that holds a failing page -> it exits with a non-zero code after the Astro build step and the output names the page and the line or pattern.
  Covers: NFR-4
- AC-11: Failure criterion (anti-goal): the task is not done if the guard passes a command line that is absent from the README range because it is present in some other README section, if a synced page makes it fail, if `confirmed` in the PB-1 or PB-2 item lets an install time pass, or if it fails without naming the page, even when the fixtures for the passing cases are green.

## Out of scope

- The get-started page itself and its hand-written blocks (TASK-021), and the pin facts extraction (TASK-010).
- Running PB-3 and writing its result line (TASK-044, an owner step).
- The title rules, hreflang, sitemap and the other `check-dist` checks (TASK-029, TASK-030).
- The stale-Turkish-page warning and the sentence checks of the trust and Claude Code and Codex pages (NFR-4 parts handled by their own tasks).
- A proof that the sentences are true; the AC-4 pattern is a guard, not a proof (PRD AC-4).

## Constraints

- Expected test exception: none; guards over fixture trees have a RED.
- The two patterns of AC-4 are used exactly as the PRD writes them, including the look-behind; no word boundary is added (`/docs/design/ARCHITECTURE.md`, "Trade-offs").
- Plain `.mjs` and `node --test`, Node 24.x (ADR 0001); no new dependency (`cheerio` is already a development dependency of `package.json`).
- Tests use fixtures only; no network.

## Risks

- The pattern has false positives by design (PRD: it is a guard); a legitimate sentence such as "5 minutes of reading" on a site page blocks the build until reworded.
- "Site-written page" must be told from "synced page" in `dist/`; a wrong class either misses a claim or blocks a synced document that says "5 minutes".
- TASK-010 decides what the README range holds; an upstream change to the heading names makes the pin facts fail first (by design).
- `package.json` is edited by many tasks; a merge conflict on the `build` script is likely if tasks run in parallel.

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (guard library, dist checker, build script, tests) and a change to the build pipeline that decides whether a deployment can happen

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run check:guards`
- `npm run test:axe`
