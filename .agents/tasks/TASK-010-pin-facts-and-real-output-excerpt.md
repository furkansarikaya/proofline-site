# Task: TASK-010 - Pin facts and real-output excerpt

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-007
prd: site
---

## Goal

One module reads the facts the site pages state about proofline from the pinned documents (the version and the date of the figures, the "does not prove" anchor, the README Status sentences, the README install commands, and the "Real output" excerpt) and fails the build, naming the page and the pattern, when a sentence, a figure or a heading is missing, so no page ever carries a hand-typed copy of them.

## Context

- Source requirements in `/docs/product/site/PRD.md`: NFR-4 (the build fails on a sentence, a figure or a heading that the trust page or the Claude Code and Codex page reads from the pinned commit and does not find, naming the page and the pattern), FR-7 and FR-8 (the data part only: the pinned version, the figures date, the link target of "does not prove", the not-yet-proven sentence and the Codex limit sentence; the pages that show them are TASK-022 and TASK-023), and the user story AC-8 (version and figures date generated from the synced proof page at the pinned commit).
- ADR `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 7 (the patterns, the Status sentences, the Install range, the Codex sentence, the version never read from the README because it states two) and `/docs/design/DESIGN-marketing.md` section "Real output as the visual material". Architecture component C17 and the boundary row C17-C19 in `/docs/design/ARCHITECTURE.md`.
- Inputs: the cache `.cache/sync/{commit}/` of TASK-007 (the synced files and `README.md`, which the lock lists as a read-only input) and `sync/pin.json`.
- Output contract (architecture boundary C17-C19): `{version, figures_date, does_not_prove_id, not_proven_sentence, codex_sentence, readme_commands[], readme_inline_spans[], commit, tag, real_output}`.
- Patterns (ADR 0003 point 7): in the whitespace-collapsed first paragraph of `docs/proof.md`, `Figures\s+were\s+taken\s+on\s+(\d{4}-\d{2}-\d{2})\s+at\s+proofline\s+(\d+\.\d+\.\d+)`; the H2 `What this does not prove` with its github-slugger id; in `README.md` section `## Status`, the sentence `It is not yet proven on real projects.` and the pattern `Codex as implementer is supported \([^)]*\); other Codex roles are not yet verified in real use\.`; the README range from the heading `## Install` to the heading `## What it supports`.
- The real-output source (`docs/concepts/workflow.md`, heading `## Real output`, anchor `real-output`) is one fenced `text` block holding the lead's final message. The approved sample shows the opening paragraph, the paragraphs that start `**Cause:**`, `**Tests:**` and `**Review:**`, and the list item that starts `**Commit:**`; the other parts are left out and the caption says so.
- Expected scope (3 paths): `scripts/lib/pin-facts.mjs`, `tests/pin-facts.test.mjs`, `tests/fixtures/pin-facts/` (fixture `README.md`, `docs/proof.md` and `docs/concepts/workflow.md`).
- Assumption: in the README range a line that starts with `#` after trimming is a shell comment and is not a command; every other non-empty line of every fenced block is a command line. After trimming white space and removing a trailing comment that starts with " #", the line is added to `readme_commands` in document order (the rule of FR-4, applied here to the README side only).
- Assumption: `readme_inline_spans` holds the text of every inline code span of the prose in the same range, without the backticks, in document order (FR-4 compares the get-started page's marked command spans with it).
- Assumption: `real_output` holds the five selected items as unedited Markdown text, in source order, with a label for each (`opening`, `cause`, `tests`, `review`, `commit`), plus the anchor `real-output`; the caption and the link are TASK-019's.

## Acceptance criteria

- AC-1: A fixture `docs/proof.md` whose first paragraph reads "Figures were taken on 2026-11-19 at proofline 0.0.171 (`main` at 9790c3ed)" across two lines is read, together with a fixture README that states two different Version lines -> `figures_date` equals `2026-11-19` and `version` equals `0.0.171`, and neither value comes from the README.
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-2: The fixture `docs/proof.md` loses the sentence, or states the date in another form -> the module throws, the build exits non-zero, and the message holds the page `docs/proof.md` and the pattern text.
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-3: A fixture `docs/proof.md` holds the heading `## What this does not prove` -> `does_not_prove_id` equals `what-this-does-not-prove`; with the heading missing or reworded the build exits non-zero naming `docs/proof.md` and the heading text.
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-4: A fixture README `## Status` section holds the sentence "It is not yet proven on real projects." -> `not_proven_sentence` equals that sentence; with the sentence reworded ("It is not proven yet on real projects.") the build exits non-zero naming `README.md` and the pattern.
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-5: A fixture README `## Status` section holds "Codex as implementer is supported (real use, 2026-10-23 to 25); other Codex roles are not yet verified in real use." -> `codex_sentence` equals that whole sentence; with the sentence missing or its second half reworded the build exits non-zero naming `README.md` and the pattern.
  Covers: NFR-4, FR-8
- AC-6: A fixture README holds a fenced block between `## Install` and `## What it supports` with the lines `/plugin marketplace add furkansarikaya/proofline # add the marketplace`, an empty line and `# a comment line`, and a second fenced block in the section `## Quick start` -> `readme_commands` holds `/plugin marketplace add furkansarikaya/proofline` and no line from the second block, the empty line or the comment line.
  Covers: NFR-4
- AC-7: The same README holds the inline code span `npx skills add furkansarikaya/proofline` in the prose between the two headings and another span outside them -> `readme_inline_spans` holds the first span's text without backticks and not the second.
  Covers: NFR-4
- AC-8: A fixture README lacks the heading `## Install`, and another lacks `## What it supports` -> each build exits non-zero naming `README.md` and the missing heading.
  Covers: NFR-4
- AC-9: A fixture `docs/concepts/workflow.md` holds `## Real output` with a `text` block that has the opening paragraph, the `**Cause:**` paragraph, one more labelled paragraph, the `**Tests:**` and `**Review:**` paragraphs, and a `**Not done:**` list with a `**Commit:**` item -> `real_output` holds exactly the five selected items in source order, each equal to its source text byte for byte, and holds neither the extra labelled paragraph nor the other list items.
  Covers: NFR-4
- AC-10: The fixture lacks the `## Real output` heading, or lacks one of the five items -> the build exits non-zero naming `docs/concepts/workflow.md` and the missing item or heading.
  Covers: NFR-4
- AC-11: The module is called with a pin file and the cache -> the output holds `commit` and `tag` equal to the values of `sync/pin.json`, and two calls on the same cache return values that are equal key for key.
  Covers: FR-7
- AC-12: At delivery, with network access and the cache of the launch pin, the module runs on the real pinned files -> it returns the facts without an error, and its `version` and `figures_date` equal what the pinned `docs/proof.md` states (the delivery report quotes both).
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-13: Failure criterion (anti-goal): the task is not done if any fact is read from the README's Version lines, if a missing sentence, figure or heading is replaced by a default value or only warns, or if the module returns a sentence written in the module's own source instead of the pinned text, even when the fixtures pass.

## Out of scope

- The trust page, the Claude Code and Codex page and the home page that show these facts (TASK-022, TASK-023, TASK-019); the Turkish translations of the two sentences.
- Comparing the get-started page's commands with `readme_commands` and the install-time guard (TASK-020).
- Fetching and verifying the archive (TASK-007) and rendering Markdown (TASK-008).
- The README change that removes "(5 minutes)" and the second Version line (upstream, TASK-043).

## Constraints

- ADR 0003 point 7: the version is read from `docs/proof.md` only; the sentences are matched on whitespace-collapsed plain text; a missing item fails the build and names the page and the pattern.
- ADR 0001: plain `.mjs`; Markdown is read with the pipeline of TASK-008 or plain text matching, and no dependency is added.
- Expected test exception: none; the live run of AC-12 is a delivery check, the unit tests use fixtures and make no network request.

## Risks

- An upstream rewording of a guarded sentence keeps every later sync red; this is intended (NFR-4, ADR 0003 consequences) and the message must be precise enough to file upstream.
- The candidate pin's README has two Version lines in Status and in Versioning and license; the module must not read either.
- The excerpt rule (five items by their bold labels) rests on the layout of one upstream section; a layout change upstream fails the build rather than changing the excerpt.

## Pre-existing defects

none

## Suggested class

COMPLEX - a data contract between the sync core and several pages (C17 to C19) with build-failing guards over external text

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
