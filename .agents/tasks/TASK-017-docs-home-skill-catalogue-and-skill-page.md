# Task: TASK-017 - Docs home, skill catalogue and skill page

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-011
  - TASK-014
  - TASK-015
prd: site

---

## Goal

A reader finds every documentation page from `/docs/` (English) or `/tr/docs/` (Turkish) without a script, scans the skills in a catalogue of one row per skill, and reads one skill on a page that opens with its description, its one rule, its role and its version.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-9 (page-source map and the query-to-page map), FR-10 (one page per skill, one per concept), FR-17 (English-only pages seen from Turkish), AC-11 (docs part), US-5.

- Design: `/docs/design/DESIGN-docs.md` sections "Layout rules" (bullets "Skill page" and "Catalogue"), "Typography use" (rows "Skill description", "Skill names"), "Provenance (every page)", "Copy" (rows "Shared rules", "Role, Version"), "States" (rows "Page without script", "English-only page seen from Turkish") and "Gaps" (the docs home is not drawn: its rules are written there). Approved samples: `/docs/design/references/docs-surface/en-skills.html` (catalogue), `/docs/design/references/docs-surface/en-skill-tdd-proof.html` (skill page with the folded "Shared rules") and `/docs/design/references/docs-surface/tr-guide-gunluk-kullanim.html` (Turkish tree with `EN` tags); `/docs/design/DESIGN.md` section "Typography". A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (address table; points 5 and 8: titles of site-written pages, the docs index lists every page grouped and works without script, the Turkish index lists the two Turkish guides and then a labelled list of English pages, each link text saying the page is in English), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (counts come from the lock; `/llms.txt`).
- Today: TASK-011 builds the 28 skill pages, the concept pages, the guides, proof and limits as routes and holds the skills index data; TASK-014 gives them the docs layout; TASK-015 gives the content components. This task builds the two index pages, the catalogue page and the skill page head and folded block on top of them.
- Skill source facts at the pin (`b6d7f0ff`, v0.0.173): each `skills/*/SKILL.md` has front matter `description` and `metadata.version`; the body starts with a heading, then usually a paragraph `One rule: **...**` (`skills/test-trust/SKILL.md` has none), usually a line `Role: ...` (for example `Role: Implementer. Output: ...`), and ends with the section `## Shared rules (proofline)`.
- Assumption: "the first sentence" of a description is the text up to and including its first full stop followed by a space or the end.
- Assumption: "the first words of the `Role:` line" are the text after `Role:` up to the first full stop, opening bracket, comma or semicolon, trimmed (`Implementer`, `Data Architect`, `Security Reviewer`).
- Assumption: the "Shared rules" block is the section from the heading `## Shared rules (proofline)` to the end of the document or the next heading of level 2.
- Assumption: the one sentence of the docs home that says what the documents are is written by the plan in both languages from the README sentence "A deterministic engineering team for coding agents" and the page types (guides, concepts, proof, limits, skills); the design gives no wording.
- Assumption: a skill whose `description` is missing fails the build naming the skill (the design lists a description in every row; ADR 0003 fails the build on missing source data).
- Expected scope: `src/pages/docs/index.astro`, `src/pages/tr/docs/index.astro`, `src/pages/docs/skills/index.astro`, `src/pages/docs/skills/` (the skill page route of TASK-011, edited), `src/components/docs/SkillCatalogue.astro`, `src/components/docs/SkillHead.astro`, `src/components/docs/SharedRules.astro`, `src/lib/skill-meta.mjs` (description sentence, rule line, role words, version), `src/styles/docs.css`, `tests/skill-meta.test.mjs`, `tests/docs-pages.test.mjs`, `tests/browser/docs-pages.mjs`, `tests/fixtures/docs/`. 13 paths.

## Acceptance criteria

- AC-1: `/docs/` is built -> its title is "Documentation | proofline: a deterministic engineering team for Claude Code and Codex" (the page title is 13 characters), its text column holds one sentence about what the documents are, a link to `/llms.txt`, and then four groups with the ids `guides`, `concepts`, `reference` (proof and limits) and `skills`, each a plain list of links.
  PRD ids: AC-10
  Covers: FR-9
- AC-2: `/docs/` is built from a fixture lock with 2 guides, 3 concepts and 4 skills -> the lists hold 2, 3 and 4 links plus the proof and limits links, every link leads to a built page, and the same build from the real fixture archive holds the counts of that archive (the numbers are not typed anywhere in the source).
  PRD ids: AC-41
  Covers: FR-10
- AC-3: `/docs/` is opened with scripts disabled -> every list is visible and every link works, and no search button is shown.
- AC-4: `/tr/docs/` is built -> its title is "Belgeler | proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi", it lists first the two Turkish guides with links to `/tr/docs/guides/gunluk-kullanim/` and `/tr/docs/guides/prompt-katalogu/`, and then a list under a heading that contains the word "İngilizce", holding every English-only page as a link to its English page followed by the tag `EN` (`lang="en"`) and an item text that contains "İngilizce".
  PRD ids: AC-13, AC-12
  Covers: FR-17
- AC-5: `/tr/docs/` is crawled -> it holds 0 links to a `/tr/` address other than `/tr/`, `/tr/docs/` and the two Turkish guides, and the page carries `lang="tr"` while each English link text sits in an element with `lang="en"`.
  PRD ids: AC-13
  Covers: FR-17
- AC-6: The built site is compared with the query-to-page map -> the pages `/docs/guides/daily-use/`, `/docs/concepts/workflow/`, `/docs/concepts/roles/`, `/docs/concepts/gates/`, `/docs/concepts/evidence/`, `/docs/concepts/testing/`, `/docs/skills/` and `/tr/docs/guides/gunluk-kullanim/` each exist in the build output, and `/docs/` shows a link to each of them (`/tr/docs/` shows the link to the Turkish guide).
  PRD ids: AC-11, US-5
  Covers: FR-9
- AC-7: `/docs/skills/` is built -> its title is "Skill catalogue | proofline: a deterministic engineering team for Claude Code and Codex", the page holds one definition list with one row per skill of the lock (28 at the pin), each row has the skill name in the monospace face as a link to its page and the first sentence of its description, and the page has no group headings, no card and no icon.
  Covers: FR-10
- AC-8: The catalogue is measured at 1440 px and at 390 px -> at 1440 px the name column shows a width between 150 and 200 px with a hairline between rows, and at 390 px each row is one column (name over sentence).
- AC-9: The skill page of `tdd-proof` is built -> its H1 is `tdd-proof` and the page holds exactly one H1 (the heading at the start of the source is that H1, not a second one), then the first sentence of the description at 19 px, then the line "One rule: a test that never failed for the right reason proves nothing." in `--muted` with the rule itself in weight 500, then a row of two label-over-value pairs "Role" "Implementer" and "Version" "0.0.173", between hairlines.
- AC-10: The skill page of `test-trust` (no rule line) and a fixture skill with no `Role:` line are built -> the first shows no rule line and the second shows the Role and Version row with the Version only; the `Role:` sentence of any skill is not repeated in the body, and the body text after it is unchanged.
- AC-11: A skill page is built -> the section from `## Shared rules (proofline)` is a native `details` element closed by default, its summary reads "Shared rules" with the note "The same in every skill", the section keeps its id, and the outline holds a link to that id.
- AC-12: The `details` of a skill page is opened with the keyboard (Enter on the summary) with scripts disabled -> it opens and shows the rules, and the summary shows the 2 px `--accent` focus ring with a 3 px offset.
  Covers: NFR-6
- AC-13: A skill fixture without `description` is synced -> `npm run build` exits with a non-zero code and the message names the skill.
- AC-14: Failure criterion (anti-goal): the task is not done if a number of pages (guides, concepts, skills) is written by hand anywhere in the source, if the Turkish docs page shows an English-only page under a `/tr/` address, if the catalogue is grouped, or if a skill page shows the `Role:` sentence twice, even when the page counts match for the fixture archive.

## Out of scope

- The docs layout, tree, outline and page foot (TASK-014); code blocks, tables and anchors (TASK-015); `docs.js` (TASK-016); the search panel (TASK-028).
- Page routes, titles of synced pages and the sync (TASK-011); the transform and its safety rules (TASK-008).
- The pages of the queries "Claude Code and Codex" and "AI code review with evidence" that are site pages (TASK-022, TASK-023, the later title and query check of TASK-029).
- Turkish skill pages (none exist: FR-17) and grouping the catalogue by role (the sources' role lines are not uniform).
- `/docs/guides/` and `/docs/concepts/` index pages (ADR 0002: none exist).

## Constraints

- Expected test exception: none for markup and text. The measured sizes (19 px, 150 to 200 px name column) are asserted in Chromium. Visual likeness to the samples is left to review.
- ADR 0002 point 5: titles of site-written pages are the page title (at most 40 characters) plus ` | proofline: ` and the phrase; "Documentation" and "Skill catalogue" contain neither "evidence" nor "kanıt".
- The pages work without a script; no inline script, no inline style (ADR 0006).
- Counts are read from the lock (ADR 0003), never typed.
- The skill page head is built from front matter and the source body; no source text is edited or translated (`/docs/design/DESIGN-docs.md`, "Copy").
- No new dependency.

## Risks

- The sentence and role rules are text heuristics over 28 sources; a skill whose description starts with an abbreviation ends its first sentence early. The test runs over the real 28 skills of the fixture archive and prints each cut sentence so a reviewer can read them.
- The "Shared rules" block is detected by heading text; an upstream rename of the heading puts the block back in the open body and leaves the skill page long but correct.
- TASK-011 already owns the skill routes; editing the route file here can conflict with it if both are open at once (the dependency order prevents it).
- The wording of the docs home sentence is not designed; a reviewer must read it in both languages.

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (index pages, catalogue, skill page, metadata extraction, styles) and a design choice about extracting sentences from source text

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:browser`
