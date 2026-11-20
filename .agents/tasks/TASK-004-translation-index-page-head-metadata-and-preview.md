# Task: TASK-004 - Translation index, page head metadata and preview image

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-003
prd: site
---

## Goal

Every page head is built from one place: titles and descriptions follow the name-plus-phrase rules, `hreflang` alternates and the language-switcher target come from one translation index and appear only on pages that have a translation, a staleness check compares Turkish pages with their English source, and one preview image with a localized alternative text is attached to every page.

## Context

- Source requirements in `/docs/product/site/PRD.md`: FR-16 (name always with the descriptive phrase), FR-17 (no `/tr/` address without a translation, `hreflang` only on translated pages), FR-18 (staleness of Turkish pages), and the user stories AC-10, AC-13 and AC-14.
- ADR `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` points 3 to 7: the translation index module (point 3), `translatedFrom` frontmatter and `npm run translation:stamp` (point 4), the title and description builders and the 40-character cap (point 5), the title-rule match semantics (point 6, checked later by TASK-029), the preview image (point 7). Architecture components C18 and C26 in `/docs/design/ARCHITECTURE.md` ("Containers and components").
- Existing: `src/layouts/Base.astro` takes `lang` and `title` and prints a fixed `noindex` robots meta (the indexing switch is TASK-006); `src/pages/index.astro`, `src/pages/tr/index.astro` and `src/pages/404.astro` are placeholders; `tests/site.test.mjs` asserts "0 script elements" on the built pages.
- Expected scope (13 paths): `src/lib/translations.ts`, `src/lib/meta.ts`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/pages/tr/index.astro`, `src/pages/404.astro`, `scripts/translation-stamp.mjs`, `package.json`, `public/og-default.png`, `tests/translations.test.mjs`, `tests/meta.test.mjs`, `tests/fixtures/translations/`, `tests/site.test.mjs`.
- Facts used by the builders: the English phrase is "a deterministic engineering team for Claude Code and Codex"; the Turkish phrase is "Claude Code ve Codex için deterministik bir mühendislik ekibi". The title suffix is 72 characters in English and 75 in Turkish; the description suffix is 71 and 74.
- Assumption: the `og:image:alt` text is the name and phrase of the page language ("proofline: a deterministic engineering team for Claude Code and Codex" and "proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi"); the image is text-free, so the alternative text states what the site is, and no design document gives other wording.
- Assumption: `og:image` is the absolute address `https://proofline.technology/og-default.png`.
- Assumption: the two home pages are the first pair registered in the index; every later page task registers its own pair in the same index (one entry per pair).
- Assumption: the notice that a Turkish page written for the site is stale has no designed wording yet, so this task builds the staleness data and the warning only; the notice of Turkish guides is TASK-013.

## Acceptance criteria

- AC-1: The title builder gets the page title "Get started" for an English site-written page -> it returns "Get started | proofline: a deterministic engineering team for Claude Code and Codex"; for the Turkish page title "Başlarken" it returns "Başlarken | proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi".
  Satisfies: AC-10.
  Covers: FR-16
- AC-2: The builder gets a site-written page title of 41 characters -> the build fails and the message names the page; a title of exactly 40 characters passes.
  Satisfies: AC-10.
  Covers: FR-16
- AC-3: The builder gets the home page of each language -> it returns the name and phrase only: "proofline: a deterministic engineering team for Claude Code and Codex" and "proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi", and no title it returns ends with the name alone.
  Satisfies: AC-10.
  Covers: FR-16
- AC-4: The builder gets the H1 of a synced page, 48 characters long -> the title holds all 48 characters followed by " | proofline: " and the phrase of the page language; a title above 120 characters prints a warning naming the page and the build exits 0; a title of exactly 120 characters prints no warning.
  Satisfies: AC-10.
  Covers: FR-16
- AC-5: The description builder gets a lead text of 20, 120 and 400 characters in each language -> the description it returns is a lead cut at a word boundary with "…" only when needed, followed by " proofline: " and the phrase and ".", and its total length is between 70 and 160 characters in all six cases.
  Satisfies: AC-10.
  Covers: FR-16
- AC-6: Every page is built -> its head holds a meta description, `og:title` equal to the title element, `og:description` equal to the description, `og:image` equal to `https://proofline.technology/og-default.png` and a non-empty `og:image:alt` in the page language that carries the name and the phrase of that language.
  Satisfies: AC-10.
  Covers: FR-16
- AC-7: `public/og-default.png` is read -> it holds a PNG of exactly 1200 by 630 pixels, and `dist/og-default.png` exists after the build.
- AC-8: The home pages `/` and `/tr/` are built -> each holds exactly one `application/ld+json` block with a `WebSite` whose `name` equals "proofline: a deterministic engineering team for Claude Code and Codex" (Turkish page: the Turkish phrase form), and every other built page holds 0 such blocks and 0 other script elements.
  Satisfies: AC-10.
  Covers: FR-16
- AC-9: The index holds the pair `/` and `/tr/` and the pages are built -> each of the two pages holds `link rel="alternate"` tags for `en`, `tr` and `x-default` with the absolute addresses `https://proofline.technology/`, `https://proofline.technology/tr/` and `https://proofline.technology/` (the English address), and the set on one page equals the set on the other.
  Satisfies: AC-13.
  Covers: FR-17
- AC-10: A page with no pair in the index is built (the 404 page, and a fixture page) -> it holds 0 `hreflang` tags, and every built page has a `lang` attribute on its `html` element equal to the language of its address.
  Satisfies: AC-13.
  Covers: FR-17
- AC-11: The switcher target is asked for a paired page, a docs page without a pair and any other page without a pair -> it returns the address of the other language for the pair, `/tr/docs/` for the unpaired docs page and `/tr/` for the other, and it flags the unpaired pages as having no Turkish version.
  Satisfies: AC-13.
  Covers: FR-17
- AC-12: A fixture pair is added to the index by one entry -> both pages of the fixture carry the three alternate tags and the switcher target of each page returns the other address, with no other file changed.
  Covers: FR-17
- AC-13: A Turkish guide fixture records a `translated-from` blob id that differs from the blob id of its English file -> `isStale` returns true and the build prints a warning naming the page and exits 0; with equal blob ids `isStale` returns false and no warning is printed.
  Satisfies: AC-14.
  Covers: FR-18
- AC-14: A site-written Turkish page fixture records `translatedFrom: { page, hash }` -> `isStale` returns true after one character of its English content file changes, and false after only the line endings (CRLF against LF) or the leading and trailing white space of that English file change, because the hash is the sha256 of the file with LF line ends and trimmed.
  Satisfies: AC-14.
  Covers: FR-18
- AC-15: `npm run translation:stamp` runs with the path of a Turkish content file -> the file's `translatedFrom.hash` equals the current hash of its English file, every other frontmatter key and the body stay byte for byte as they were, and a second run changes nothing; with a path that is not a Turkish content file the command exits non-zero and names the path.
  Covers: FR-18
- AC-16: A stale fixture page is built -> its HTML holds neither the recorded blob id or hash nor the current one.
  Satisfies: AC-14.
  Covers: FR-18
- AC-17: Failure criterion (anti-goal): the task is not done if any page without a translation carries an `hreflang` tag, if a title carries the name without the phrase of its language, if a site-written title longer than 40 characters passes the build, or if the head tags and the switcher read from different sources, even when the build is green.

## Out of scope

- The indexing switch, the `robots` meta variants, canonical links, the sitemap and the verification tags (TASK-006); the `noindex` meta stays as it is.
- The header, footer and language-switcher markup (TASK-005); this task only provides the target.
- The notice text for stale Turkish pages and the Turkish guide pages (TASK-013); the check of the title rules over the whole `dist/` (TASK-029).
- Registering the pairs of the pages written later; each page task adds its own entry.
- The look of the preview image beyond its size; runtime image generation.

## Constraints

- Expected test exception: `public/og-default.png` is a binary drawing with no test-first RED. What is tested instead: its pixel size (AC-7), that it ships to `dist/`, and that every page points to it with the alternative text of AC-6.
- ADR 0002 point 3: the sitemap and the switcher read the same index (the sitemap itself is TASK-006); point 4: the hash is the sha256 of the English content file with LF line ends, trimmed; point 5: the 40-character cap applies to site-written titles only.
- ADR 0006: the JSON-LD block is the only inline script-type element allowed (`type="application/ld+json"`, not executed).
- ADR 0001: plain `.mjs` scripts and `node --test`; no dependency is added.

## Risks

- `tests/site.test.mjs` asserts "0 script elements" (TASK-001 AC-3); this task changes that assertion to allow the JSON-LD block only, and TASK-005 changes it again for the controls script.
- Site-written Turkish pages need a stamp after every English change; a forgotten stamp shows as a warning, by design (ADR 0002 consequences).
- The `og:image:alt` wording is an assumption (Context); the owner may want other text at the design review.

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (index, builders, layout, stamp script) and a public contract (hreflang tags and head metadata that search engines read)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
