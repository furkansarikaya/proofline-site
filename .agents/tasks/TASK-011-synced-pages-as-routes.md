# Task: TASK-011 - Synced pages as routes

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-004
  - TASK-007
  - TASK-008
  - TASK-009
  - TASK-010
prd: site
---

## Goal

Every English document of the synced set becomes a page at its address of the address table (guides, concepts, proof, limits and one page for each skill), with a title built from its own H1, a description, rewritten links, and a line that says which proofline version or commit the text was taken from, and the number of pages follows the lock, never a typed number.

## Context

- Source requirements in `/docs/product/site/PRD.md`: FR-9 (the page-source map; this task covers the synced half), FR-10 (one skill page for each `skills/*/SKILL.md` and one concept page for each `docs/concepts/*.md`), FR-12 (every synced page shows the commit or tag it was taken from), and the user stories AC-17, AC-41 (counts read from the lock) and AC-10 (the title of a synced page is its full H1 followed by the name and the phrase).
- ADR `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` point 2 (address table: guide `/docs/guides/{name}/`, concept `/docs/concepts/{name}/`, `/docs/proof/`, `/docs/limits/`, skill `/docs/skills/{skill}/`; no `/docs/guides/` or `/docs/concepts/` index page) and point 5 (synced titles and descriptions); `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` points 4 to 7. Architecture components C16 and C19 and the page manifest row (C16 to C19) in `/docs/design/ARCHITECTURE.md`.
- Design: this task uses the shared `src/layouts/Base.astro` only; the docs layout is TASK-014. The provenance sentence is specified in `/docs/design/DESIGN-docs.md` section "Provenance (every page)" ("Taken from proofline v0.0.173" under the H1). Approved docs-surface samples, for the later styling: `/docs/design/references/docs-surface/en-concept-workflow.html` and `en-skill-tdd-proof.html`; where a sample and the design document differ, the design document wins.
- Inputs from earlier tasks: the pin and lock and the cache (TASK-007), the transform (TASK-008), the link map (TASK-009), the title and description builders (TASK-004). The synced English set at the candidate pin is 5 guides, 13 concepts, `docs/proof.md`, `docs/limits.md` and 28 skills; the build reads these counts from the lock.
- Existing: `src/pages/` holds only the two home placeholders and the 404 page; `src/layouts/Base.astro` takes the language, title and description.
- Expected scope (6 paths): `src/lib/synced.ts` (page manifest, routes and skills index data), `src/pages/docs/[...path].astro`, `src/components/SyncedPage.astro`, `tests/synced-routes.test.mjs`, `tests/fixtures/synced/`, `src/layouts/Base.astro` (only if a slot for the provenance line is needed).
- Assumption: the provenance sentence is "Taken from proofline {tag}" when the pin has a tag (for example "Taken from proofline v0.0.173") and "Taken from proofline {short commit}" with the first 8 characters of the commit when the tag is null.
- Assumption: the skills index data is a list of `{name, description, address}` sorted by name, which the skill catalogue page (TASK-017) reads; the catalogue page itself is not built here.
- Assumption: the page manifest lists every synced document, the two Turkish guides included (TASK-012 and TASK-013 read them from it), while the HTML routes of this task are the English ones; the Turkish guides (`docs/guides/tr/*.md`) are routed by TASK-013.

## Acceptance criteria

- AC-1: The route list is asked for a fixture lock with 2 guides, 1 Turkish guide, 2 concepts, `docs/proof.md`, `docs/limits.md`, 3 skills and files outside the set -> it returns exactly `/docs/guides/{name}/` for the 2 guides, `/docs/concepts/{name}/` for the 2 concepts, `/docs/proof/`, `/docs/limits/` and `/docs/skills/{skill}/` for the 3 skills, and no route for the Turkish guide or any other file.
  Covers: FR-9
- AC-2: The site is built from the committed lock -> the number of pages under `dist/docs/skills/` equals the number of `skills/*/SKILL.md` entries of `sync/lock.json`, the number under `dist/docs/concepts/` equals the number of `docs/concepts/*.md` entries, the number under `dist/docs/guides/` equals the number of `docs/guides/*.md` entries, and `dist/docs/proof/index.html` and `dist/docs/limits/index.html` exist.
  Satisfies: AC-41.
  Covers: FR-10
- AC-3: The route list is asked for a second fixture lock with 4 concepts and 1 skill -> it returns 4 concept routes and 1 skill route, and no source file of the task holds the numbers 28, 13 or 5 as page counts.
  Satisfies: AC-41.
  Covers: FR-10
- AC-4: A synced page is built from a pin with the tag `v0.0.173`, and again from a pin whose tag is null and whose commit starts with `b6d7f0ff` -> the first shows "Taken from proofline v0.0.173" under the H1 and the second "Taken from proofline b6d7f0ff", and no page shows a blob id.
  Satisfies: AC-17.
  Covers: FR-12
- AC-5: Every synced page is built -> it holds exactly one `h1` whose text equals the H1 of its source document, and its title element equals that H1 followed by " | proofline: a deterministic engineering team for Claude Code and Codex"; the page of a skill whose H1 is `tdd-proof` has the title "tdd-proof | proofline: a deterministic engineering team for Claude Code and Codex".
  Satisfies: AC-10.
  Covers: FR-9
- AC-6: Every synced page is built -> its meta description is 70 to 160 characters long and ends with " proofline: a deterministic engineering team for Claude Code and Codex.", its lead is the skill's frontmatter `description` for a skill page and the first paragraph as plain text for any other page, and its `og:title` equals the title element.
  Satisfies: AC-10.
  Covers: FR-9
- AC-7: Every synced page is built -> its `html` element has `lang="en"`, it holds 0 `hreflang` tags, and it uses the shared Base layout (the same head structure as the home page).
  Covers: FR-9
- AC-8: The built synced pages are scanned -> they hold 0 `script`, `iframe`, `object`, `embed` or `style` elements that come from a source document, 0 attributes whose name starts with `on`, and 0 `javascript:` addresses, and every source document that holds a placeholder written as a word in angle brackets shows those characters as visible text on its page.
  Satisfies: AC-44.
  Covers: FR-9
- AC-9: `npm run check:links` runs on the built site -> it exits 0 with 0 broken internal links on the synced pages, and the relative links of the source documents appear on the pages as the addresses the link map of TASK-009 returns.
  Covers: FR-9
- AC-10: The skills index data is asked for the fixture lock with 3 skills and, at delivery, for the committed lock -> it returns one entry for each skill, sorted by name, each with the skill's frontmatter `description` and its address `/docs/skills/{skill}/`, and its length equals the lock's skill count.
  Satisfies: AC-41.
  Covers: FR-10
- AC-11: The built `dist/` is listed -> it holds no page for `docs/decisions.md`, `docs/adr/`, `docs/skills/*-decisions.md` or a `references/` or `assets/` folder of a skill, no `dist/docs/guides/tr/` and no `dist/tr/docs/` page from this task.
  Covers: FR-9
- AC-12: `npm run check:determinism` runs with the pages added -> it exits 0, so two clean builds from the same pin and lock give the same output hash.
  Satisfies: AC-47.
- AC-13: Failure criterion (anti-goal): the task is not done if a page count, a page name or a version is typed in the site code instead of read from the lock and the pin, if a title is cut below the full H1, or if a synced page can be built without the line that names its tag or commit, even when the build is green.

## Out of scope

- The Turkish guides and the stale notice (TASK-013), the Markdown copies and `/llms.txt` (TASK-012), the docs home, the skills index page and the skill page layout (TASK-017).
- The docs layout, tree, outline and code-block components (TASK-014, TASK-015, TASK-016) and search (TASK-028).
- The dist-wide checks of titles, the query-to-page map and counts (TASK-029) and of scripts and privacy (TASK-030).
- Pages written for the site and the header menu entries other than those that already exist.

## Constraints

- ADR 0002: the address table is public and complete; anything else is 404; no `/docs/guides/` or `/docs/concepts/` index page exists (breadcrumbs link to `/docs/#guides` and `/docs/#concepts`, which TASK-017 builds).
- ADR 0003: the site code does not fetch and has no clock; pages come from the transform and link map output of the cached, verified files.
- ADR 0001: plain TypeScript under `src/`; no dependency is added.
- Expected test exception: none for this task; the delivery build uses the real pin and needs the network or a primed cache.

## Risks

- This task joins five earlier modules; a fault in an earlier one shows here as a failed build (a missing link target, a missing pinned sentence).
- Skill pages carry YAML frontmatter and long shared-rules comments; the transform must drop both from the page, or the page text would show them.
- Until TASK-017 the breadcrumbs and the docs menu entry point at `/docs/`, which does not exist; the menu rule of TASK-005 hides the entry, and the breadcrumbs are not part of this task.

## Pre-existing defects

none

## Suggested class

COMPLEX - joins several modules (sync core, transform, link map, pin facts, translation metadata) into new public routes; address contract of ADR 0002

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
