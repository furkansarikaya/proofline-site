# Task: TASK-019 - Home page in English and Turkish

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-004
  - TASK-005
  - TASK-010
  - TASK-018
prd: site

---

## Goal

A first-time visitor who opens `/` or `/tr/` sees within the first screen what makes proofline different (a script blocks a claim with no proof), can copy the install command, sees the pipeline drawing, reads the three steps from install to a finished run with a real output excerpt, and reads the limits statement, in English and in Turkish.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-1, FR-2, FR-16, FR-17; US-1 (AC-1, AC-2), AC-10, AC-12 (home page), N-1 and N-2 (notes of the promotional design step).

- Design: `/docs/design/DESIGN-marketing.md` sections "Idea and argument", "Typography use" (the headline), "Layout rules" (first screen order and columns, rule R-4, the lower reading column), "Real output as the visual material" (rule R-5), "Limits and trust statement (R-6)", "Copy rules" and "States of the first screen"; `/docs/design/DESIGN.md` sections "Typography" (type scale), "Spacing" and "Header controls (rules)". Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html`, which hold the texts used below. A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (address table; point 4 content files; point 5 titles: the home title is the name and phrase only; JSON-LD `WebSite` on the home pages), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (pin facts and the 'Real output' excerpt), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (one controls script, the JSON-LD data block is the only other script element).
- Today: `src/pages/index.astro` and `src/pages/tr/index.astro` are placeholders of TASK-001. TASK-004 gives the title and description builders, the translation index and the `og-default.png`; TASK-005 gives the header, footer, `controls.js` and the copyable command component; TASK-010 gives the pin facts (`real_output`, `readme_commands`, `commit`, `tag`); TASK-018 gives the pipeline diagram with its frame, key line and legend.
- Texts (from the sample, not edited): English headline "A script blocks / a claim with no proof."; Turkish "Dayanaksız iddiayı / bir script engeller."; English lead "proofline is a deterministic engineering team for Claude Code and Codex, for developers who let an agent change real code."; Turkish lead "proofline, Claude Code ve Codex için deterministik bir mühendislik ekibi; bir ajanın gerçek kodu değiştirmesine izin veren geliştiriciler için."; section headline "From install to a finished run." ("Bitmiş bir run’a kurulumdan."); step lines "First, install it." / "Then ask for a task, and run it." / "Last, read how it ended." ("Önce kurun." / "Sonra bir görev isteyin ve çalıştırın." / "En sonda nasıl bittiğini okuyun."); the install command `/plugin marketplace add furkansarikaya/proofline` and `/plugin install proofline@proofline`; the task commands `/proofline task --grill Add rate limiting to the login endpoint` and `/proofline run TASK-001`; the note link "Codex and terminal: Get started" ("Codex ve terminal: Başlarken").
- The limits sentence R-6 and its links are in `/docs/design/DESIGN-marketing.md` section "Limits and trust statement (R-6)" and in the PRD note N-1; the links are the site repository `https://github.com/furkansarikaya/proofline-site` and the README at the pinned commit.
- Assumption: JSON-LD is written here (TASK-004 builds titles, descriptions and tags); if TASK-004 already emits it, this task verifies it instead.
- Assumption: the Turkish home page links to the skills catalogue and the concepts section at their English addresses, with a link text that says the page is in English (they have no Turkish version, FR-17).
- Assumption: the install command and the two task commands are compared with the README commands of the pin facts by this task's own test (the get-started guard of TASK-020 covers the get-started page only).
- Expected scope: `src/pages/index.astro`, `src/pages/tr/index.astro`, the content files of the home page in both languages (location set by TASK-004), `src/components/marketing/Hero.astro`, `src/components/marketing/Steps.astro`, `src/components/marketing/RealOutput.astro`, `src/components/marketing/Limits.astro`, `src/styles/home.css`, `tests/home.test.mjs`, `tests/browser/home.mjs`, `tests/fixtures/home/`. 12 paths.

## Acceptance criteria

- AC-1: `/` and `/tr/` are built -> the `lang` attribute of the html element is `en` and `tr`, the page holds exactly one H1 whose text is "A script blocks a claim with no proof." and "Dayanaksız iddiayı bir script engeller.", the H1 breaks after "blocks" and after "iddiayı" at 1440 px (two lines), the first part computes the `--muted` colour and the second part the `--ink` colour.
  Covers: FR-2
- AC-2: The text of each built page is read in document order -> the headline sentence comes before the first match of `/evidence/i` (English) or of `kan[ıi]t` after Turkish lower-casing (Turkish), or the word does not occur at all.
  PRD ids: AC-2
  Covers: FR-2
- AC-3: The first screen is read at 1440 px and at 390 px -> the document order shows headline, description, install command, diagram frame (with the key line and the legend inside it); at 1440 px the headline sits on the left (7 of 12 columns) and the description with the command on the right (5 columns), at 390 px they stack in that order.
  Covers: FR-1
- AC-4: The built home pages are searched for lists -> the only list elements are the five-item gate legend of the diagram (and none lists roles or skills), the page holds the names of none of the roles and none of the 28 skills, and it links to the skills catalogue (`/docs/skills/`) and to the concepts section (`/docs/#concepts`).
  PRD ids: AC-1
  Covers: FR-1
- AC-5: The three steps are read -> they are in the order install, ask for a task and run it, read how it ended; the install and task commands are in code blocks marked `lang="en"` and `translate="no"`, each command line trimmed and without a trailing comment equals a line of `readme_commands` of the pin facts, and the page carries the English or Turkish step sentences of the Context.
  PRD ids: AC-1
  Covers: FR-1
- AC-6: The install command on the first screen is read -> it shows the two lines of the Context under the label "Claude Code", the copy button of TASK-005 is attached to it with the accessible name "Copy the install commands" ("Kurulum komutlarını kopyala"), and the note link leads to `/get-started/` (`/tr/baslarken/`) with the text "Codex and terminal: Get started" ("Codex ve terminal: Başlarken").
- AC-7: The real-output excerpt is read -> its text equals `real_output` of the pin facts of the fixture archive character for character (a changed fixture text shows on the page; the source holds no typed copy), it sits in an element with `lang="en"` on both pages, the caption says that the text is unedited, which lines are shown and which are left out and links to `docs/concepts/workflow.md#real-output` at the pinned commit, and the Turkish caption says the excerpt is quoted from the English source.
  Covers: FR-17
- AC-8: The limits section is read in English and in Turkish -> it holds the sentence of rule R-6 in the page's language exactly as written in `/docs/design/DESIGN-marketing.md` (the whole text, "site repository" linked to `https://github.com/furkansarikaya/proofline-site` and "README, Status" linked to the README at the pinned commit), and the phrase "not yet proven on real projects" does not stand alone anywhere on the page.
  PRD ids: N-1
- AC-9: The built home pages are searched for numbers -> they hold no count of tasks, pull requests or CI runs (no numeral next to the words task, pull request or run in either language), and no sentence that states an install time (the AC-4 pattern of the PRD finds 0 matches).
  PRD ids: N-2, AC-4
- AC-10: The title element, `og:title`, meta description, `og:description` and the JSON-LD name of each home page are read -> the title equals "proofline: a deterministic engineering team for Claude Code and Codex" ("proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi"), `og:title` equals it, the description and `og:description` carry the name and the phrase and are 70 to 160 characters long, one `script` element of type `application/ld+json` holds a `WebSite` whose `name` equals the title, and 0 titles, headings or `og:title` values contain "evidence" or "kanıt".
  PRD ids: AC-10
  Covers: FR-16
- AC-11: The two home pages are read -> each has a reciprocal `hreflang` alternate set (`en`, `tr`, `x-default` to `/`) taken from the translation index, the language link of the header leads from `/` to `/tr/` and back, and the other head tags (canonical, `og:image` with its localised alt) come from the builders of TASK-004.
  Covers: FR-17
- AC-12: `/tr/` is read -> all prose and interface text is Turkish, the page carries `lang="tr"`, and the only elements with another `lang` are command blocks, the real-output excerpt, product names and the links to English-only pages, which say in their text that the page is in English.
  PRD ids: AC-12, AC-13
  Covers: FR-17
- AC-13: The lower section is measured at 1440 px -> it is one reading column that starts at column 4 of the 12-column grid and is six columns wide, with a hatched tab of 14 by 92 px beside the section headline, and no other hatched element on the page lies outside the rails of the diagram frame.
- AC-14: The page is opened with `controls.js` blocked -> everything reads, the install command is selectable, the language link navigates, the theme follows the system by CSS, and the theme and copy buttons are not visible.
  Covers: NFR-5
- AC-15: Failure criterion (anti-goal): the task is not done if "evidence" or "kanıt" comes before the headline sentence or appears in a title or heading, if a count, an install time, a list of roles or skills or a typed copy of the real output is on the page, if the Turkish page shows English prose outside the exceptions of AC-12, or if the R-6 sentence is shortened to its README half, even when both pages build.

## Out of scope

- The pipeline drawing itself (TASK-018) and the header, footer and `controls.js` (TASK-005).
- The title and description builders, the translation index and `og-default.png` (TASK-004); the sitemap and indexing switch (TASK-006).
- The first-screen check with three developers (TASK-045, FR-29).
- The get-started, trust and Claude Code and Codex pages and the contact page.
- A claim of install time, statistics, customer logos or third-party logos (`/docs/design/DESIGN-marketing.md`, "Copy rules").
- The full lists of roles, skills and gates (they stay in the documents).

## Constraints

- Expected test exception: the visual likeness of the page to the approved sample (spacing feel, type rhythm, colour) has no RED and is left to review against the sample. Tested instead: text, order, columns at 1440 px and 390 px, computed colours, fonts and sizes, links, head tags and counts.
- All pin-derived text (real output, commit, tag) comes from the pin facts of TASK-010, never typed (NFR-4, N-2).
- ADR 0006: the only script files are `controls.js` and the JSON-LD data block; no inline style and no inline script body.
- Headline in sentence case, two-tone; the words "evidence" and "kanıt" are not used in any title or heading (`/docs/design/DESIGN-marketing.md`, "Typography use").
- Turkish pages follow `/docs/design/DESIGN-marketing.md` "Copy rules": Turkish sentences, technical terms and proofline's own names in English.
- No new dependency.

## Risks

- PRD AC-1 asks for 0 lists of gates while the design shows a legend of the five gates inside the diagram frame; AC-4 reads the legend as part of the drawing's text alternative. The PRD wording should be confirmed by the product owner.
- The first-screen claim is untested with real developers until TASK-045; a no-go reopens this page.
- The real-output excerpt text and caption come from the pinned workflow page; if the pin moves to a version whose excerpt differs in length, the first screen is unchanged but the lower section grows.
- Two scripts (controls and JSON-LD) are on the page; the later script gate (TASK-030) must allow the JSON-LD data block.

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (two pages, four components, content files, pin facts, translation index) and a design choice about composing the first screen

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:browser`
