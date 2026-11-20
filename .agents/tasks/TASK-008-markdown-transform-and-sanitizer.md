# Task: TASK-008 - Markdown transform and sanitizer

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-001
prd: site
---

## Goal

A deterministic transform turns a synced Markdown document into inert HTML: raw HTML in the source is shown as visible text, comments are dropped, links with an unsafe scheme are not links, and headings, tables and the `translated-from` header line are read without editing the text, so the automatic sync can never add a script, an element or an event attribute to a page.

## Context

Request (user's words, from the technical design step, quoted in `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md`):

> sabitlenmiş commit'in belgelerini build sırasında alan bir script; bağlantıları site adreslerine çeviren, eşitleme kümesi dışındakileri GitHub adresine döndüren, Türkçe kılavuzları da alan, deterministik

- Source requirements in `/docs/product/site/PRD.md`: NFR-7 (raw HTML made inert, comments dropped, links with a scheme other than http, https or mailto not rendered as links), FR-14 (headings render without hand edits; `translated-from` header lines are read and not shown), and the user story AC-44.
- ADR `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 5 (mdast based, independent of Astro's processor; frontmatter split with `yaml`; remark-parse and remark-gfm; every `html` node becomes a `text` node with the same literal value except comments; remark-rehype without `allowDangerousHtml` and rehype-stringify; no syntax highlighting; heading ids with github-slugger) and `/docs/adr/0001-astro-static-site-and-toolchain.md` (Astro's Markdown processor is not used for synced content). Architecture component C16 in `/docs/design/ARCHITECTURE.md`.
- Existing: `package.json` has `astro`, `yaml`, `cheerio`, `playwright` and `@axe-core/playwright`; `unified` and `github-slugger` are installed only as dependencies of Astro, and `remark-parse`, `remark-gfm`, `remark-rehype` and `rehype-stringify` are not installed. There is no `scripts/lib/`.
- Expected scope (5 paths): `scripts/lib/transform.mjs`, `tests/transform.test.mjs`, `tests/fixtures/transform/` (Markdown fixtures), `package.json`, `package-lock.json`.
- Expected interface (the plan may name it differently): a function that takes a repository path and the source text and returns the frontmatter object, the HTML string, the list of headings (depth, text, id), the `translated-from` data, and the list of links and images with their source line; it accepts an optional function that rewrites a link target (TASK-009 supplies it) and leaves targets unchanged without it.
- The `translated-from` header at the candidate pin looks like this, in `docs/guides/tr/gunluk-kullanim.md`: `<!-- translated-from: docs/guides/daily-use.md; blob: 63606a83788971a1ada89515bb008c32cc701e2b -->`.
- New dependencies (approved by the product owner, exact versions, no `^` or `~`): `remark-gfm`, `remark-rehype` and `rehype-stringify`; the exact versions are the newest releases that are at least 14 days old on the day the task is run, chosen and recorded by the plan.
- Assumption: ADR 0003 point 5 also names `remark-parse`, `unified` and `github-slugger`; they are not in the owner's list of three but are required by the same point, so they are added as direct dependencies with exact versions chosen by the same rule (`unified` and `github-slugger` already exist in `package-lock.json` through Astro and are declared directly so the build does not depend on Astro's tree).
- Assumption: a link with an unsafe scheme keeps its label as plain text and has no `a` element; the target text is not shown.
- Assumption: an image becomes a link with the image's alternative text to the same target and no `img` element is produced (ADR 0003 point 4: never an image from another host); TASK-009 rewrites the target.

## Acceptance criteria

- AC-1: A fixture document with YAML frontmatter (`name`, `description`) is transformed -> the result holds the frontmatter values as an object and the HTML holds none of the frontmatter text.
  Covers: FR-14
- AC-2: A fixture with the headings "What this does not prove" and a second heading of the same text is transformed -> the headings keep their depth and their text unedited, their ids are `what-this-does-not-prove` and `what-this-does-not-prove-1`, and the result lists them in order.
  Covers: FR-14
- AC-3: A fixture with a GFM table and a fenced code block is transformed -> the table renders as `table` with a header row and body rows, and the code block renders as `pre` and `code` with its `<`, `>` and `&` characters escaped, with 0 `style` attributes and 0 highlighting `span` elements.
  Covers: NFR-7
- AC-4: A fixture holds the `translated-from` comment shown in the Context -> the result reports the source path `docs/guides/daily-use.md` and the blob id `63606a83788971a1ada89515bb008c32cc701e2b`, and the HTML and its visible text hold neither "translated-from" nor the blob id.
  Covers: FR-14
- AC-5: A fixture holds the `translated-from` comment and the comment `<!-- proofline:shared-rules:begin v1 -->` -> the HTML holds 0 `<!--` sequences and neither comment text appears anywhere in the output.
  Covers: NFR-7
- AC-6: A fixture holds a script element containing `alert(1)` (the first string of PRD AC-44) -> the HTML holds 0 `script`, `iframe`, `object`, `embed` and `style` elements, and the visible text of the output shows the source markup of the element including `alert(1)`.
  Satisfies: AC-44.
  Covers: NFR-7
- AC-7: A fixture holds `<img src=x onerror=alert(1)>` -> the HTML holds 0 `img` elements and 0 attributes whose name starts with `on`, and the visible text shows `<img src=x onerror=alert(1)>` as written.
  Satisfies: AC-44.
  Covers: NFR-7
- AC-8: A fixture holds `[x](javascript:alert(1))` -> the HTML holds 0 `a` elements for it, 0 occurrences of `javascript:` in any attribute, and the visible text "x".
  Satisfies: AC-44.
  Covers: NFR-7
- AC-9: A fixture holds `[x](JaVaScRiPt:alert(1))`, `[x](java&#x73;cript:alert(1))`, `[x](data:text/html,x)` and `[x](ftp://example.com/a)` -> none of the four renders as a link; `[x](https://example.com/)`, `[x](http://example.com/)`, `[x](mailto:a@example.com)`, `[x](../other.md)` and `[x](#heading)` each render as a link with the target unchanged.
  Covers: NFR-7
- AC-10: A fixture paragraph holds a placeholder written as a word in angle brackets (the `slug` placeholder of PRD AC-44) and an inline `kbd` element written in the source around the letter x -> the visible text of the output holds the same characters as the source for both, and the HTML holds 0 `kbd` elements.
  Satisfies: AC-44.
  Covers: NFR-7
- AC-11: A fixture holds a block of raw HTML with a `div` and a `details` element -> the HTML holds 0 `div` and 0 `details` elements from it and the source text is visible, so no element of the source reaches the output as an element, only the elements the Markdown syntax itself makes.
  Covers: NFR-7
- AC-12: A fixture holds `![alt text](https://example.com/a.png)` -> the HTML holds 0 `img` elements and one link whose text is "alt text" and whose target is `https://example.com/a.png`.
  Covers: NFR-7
- AC-13: The same fixture is transformed twice in one process and in two processes -> the HTML strings are identical byte for byte and hold no date, time or random value.
  Covers: NFR-7
- AC-14: `package.json` is read -> `remark-gfm`, `remark-rehype` and `rehype-stringify` are listed with exact versions (no `^` or `~`), the direct dependencies of the Assumption are listed with exact versions, `package-lock.json` holds them, and `npm ci` exits 0.
  Covers: NFR-7
- AC-15: Failure criterion (anti-goal): the task is not done if a dangerous string is made harmless by deleting it (its text must stay visible), if the safe result depends on a pattern search over the output instead of on the transform, or if any HTML element of the source reaches the output as an element, even when the three strings of PRD AC-44 pass.

## Out of scope

- The link map: relative links inside the synced set, links outside it and missing targets (TASK-009); the transform here leaves targets unchanged unless a rewrite function is given.
- Page routes, layouts and titles (TASK-011), the Markdown copies (TASK-012) and the scan of the built `dist/` for active HTML (TASK-029 and TASK-030).
- Syntax highlighting, footnotes, math and any Markdown extension other than GFM tables, strikethrough and task lists.
- Content Security Policy headers (TASK-027).

## Constraints

- ADR 0003 point 5: independent of Astro's Markdown processor; remark-parse plus remark-gfm; `html` nodes become text nodes except comments; no `allowDangerousHtml`; no syntax highlighting (inline `style=` would break the CSP of ADR 0006).
- ADR 0001: plain `.mjs` under `scripts/`, tests under `node --test`; every dependency is an exact version.
- The three new dependencies are the owner-approved list; the exact versions are chosen at run time (newest release at least 14 days old) and recorded by the plan.

## Risks

- This is the cross-site-scripting boundary of the site (NFR-7): a parser change or an option that passes raw HTML through would reach every synced page; the hostile fixtures of AC-6 to AC-12 are the guard.
- remark-gfm turns bare addresses into links (autolink literals); those links use http or https and are allowed, but a bare `javascript:` text is not turned into a link by the parser, which AC-9 does not cover beyond the listed forms.
- Heading ids must match GitHub's, or the anchors of the upstream documents break; AC-2 covers the duplicate-id rule only.
- The dependencies in the Assumption are not in the owner's list of three; the plan records the choice and the report names it.

## Pre-existing defects

none

## Suggested class

CRITICAL - security boundary: untrusted synced Markdown must render without active HTML (COMPLEX also applies: three new dependencies and a public rendering contract)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
