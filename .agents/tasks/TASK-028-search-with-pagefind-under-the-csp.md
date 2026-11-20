# Task: TASK-028 - Search with Pagefind under the CSP

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-011
  - TASK-014
  - TASK-016
  - TASK-027
prd: site

---

## Goal

A reader of the documents can search them on every docs page with the Pagefind Component UI, in English and in Turkish, and the search works under the strict Content-Security-Policy of `vercel.json` without a single violation, without a request to another host and without a layout shift.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-9 (the page-source map: the search covers the synced pages and the generated indexes), NFR-1, NFR-5 (layout shift).

- ADRs: `/docs/adr/0004-static-search-with-pagefind.md` (whole decision and its follow-up: prove the UI under the real CSP, measure the layout shift), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (Consequences: `'wasm-unsafe-eval'` is removed if Pagefind runs without it; `style-src` may be relaxed for `/docs/*` and `/tr/docs/*` only), `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 2 (build order: sync -> `astro build` -> `pagefind --site dist`), `/docs/adr/0009-browser-checks-with-the-playwright-library-under-node-test.md` (browser checks are `node:test` files with the `playwright` library, run by their own npm script), `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (addresses).
- Design: surface docs. `/docs/design/DESIGN-docs.md` section "Search (ADR 0004)" and "Copy" (search no result), `/docs/design/DESIGN.md` (header rule 5 for the search button), samples `/docs/design/references/docs-surface/en-concept-workflow.html`, `/docs/design/references/docs-surface/tr-guide-gunluk-kullanim.html`, and the stand-in `/docs/design/references/docs-surface/search-mock.js` (look only, not code to copy). Where the sample and the design document differ, the design document wins.
- Today: `package.json` has `build` = `astro build`; `scripts/check-dist.mjs links` treats every `href` and `src` under `dist/` as an internal reference; `vercel.json` (TASK-027) holds the CSP with `'wasm-unsafe-eval'`. The docs layout and the search slot in its header come from TASK-014, `docs.js` (which opens the panel with `/` and Control or Command with K) from TASK-016, the synced pages from TASK-011. The index pages `/docs/` and `/tr/docs/` come from TASK-017 and use the same docs layout, so they get the search from the layout; this task does not depend on them.
- New dependency: `pagefind` as an exact version (no `^`, no `~`), the newest release that is at least 14 days old when the task is run; the exact version is chosen and recorded by the plan (ADR 0004 names 1.6.0 as verified).
- Expected scope: `package.json`, `package-lock.json`, `src/layouts/` (the docs layout and the base layout marker), `src/components/` (the search component), `src/styles/` (reserved space for the widget), `vercel.json` (only if AC-8 or AC-9 requires it), `docs/adr/0006-privacy-headers-csp-and-referrer.md` (an amendment section, only if the CSP changes), `tests/search.test.mjs` (new, config and markup units), `tests/search.mjs` (new, the browser check), `tests/fixtures/search/` (new). 10 paths.
- Assumption: of "the four site content pages" in ADR 0004, all four site pages (home, get-started, trust, Claude Code and Codex, in both languages) mark their main content region, not their header, footer or menu.
- Not placed here: the links "to `/docs/#search`" that ADR 0004 gives the four site pages belong to the page tasks (TASK-019, 021, 022, 023); reported to the lead.

## Acceptance criteria

- AC-1: `package.json` is read -> `pagefind` is declared with an exact version (no range prefix), the `build` script runs `pagefind --site dist` after `astro build` and before any check of `dist/`, and a failing Pagefind run makes `npm run build` exit non-zero.
  Covers: FR-9
- AC-2: The site is built -> `dist/pagefind/` exists and holds `pagefind.js` and an index for the language `en` and one for the language `tr`.
  Covers: FR-9
- AC-3: Every synced page and every page of the four site pages that is present in `dist/` is read -> it holds exactly 1 element with `data-pagefind-body`, which does not contain the header, the footer, the docs tree or the page outline; `/docs/`, `/tr/docs/` and `404.html` hold 0.
  Covers: FR-9
- AC-4: The docs page `/docs/guides/daily-use/` is opened in Chromium through `scripts/serve-dist.mjs` and the key `/` is pressed outside a field -> the search panel opens with the focus in its field, and typing a word of that page's title returns at least 1 result whose address starts with `/docs/`.
  Covers: FR-9
- AC-5: The Turkish guide `/tr/docs/guides/gunluk-kullanim/` is opened and the panel is used -> the panel shows the line "Türkçe belgelerde aramak için yaz." with a link to the English search (`lang="en"`, address `/docs/#search`), and every result address for a query starts with `/tr/`.
  Covers: FR-9
- AC-6: The docs pages of AC-4 and AC-5 are opened, searched and closed with the real headers of `vercel.json` served by `scripts/serve-dist.mjs` -> the browser reports 0 `securitypolicyviolation` events and 0 requests to a host other than the local server.
  Covers: NFR-1
- AC-7: The browser check of AC-6 is run once more with `'wasm-unsafe-eval'` removed from `script-src` -> `vercel.json` after this task holds `'wasm-unsafe-eval'` if and only if that run reports a failure of the search; the completion report states which of the two holds.
  Covers: NFR-1
- AC-8: The browser check reports a `style-src` violation from the Component UI -> `vercel.json` relaxes `style-src` in a header rule for `/docs/(.*)` and `/tr/docs/(.*)` only, the CSP value for every other path stays the string of ADR 0006 (less the AC-7 result), and `docs/adr/0006-privacy-headers-csp-and-referrer.md` gains a dated amendment section naming the rule; when no `style-src` violation is reported, `vercel.json` holds no such rule.
  Covers: NFR-1
- AC-9: The home, get-started, trust and Claude Code and Codex pages and `404.html` are read -> they hold 0 reference to `/pagefind/` and the docs layout pages hold exactly the scripts `docs.js` and the Pagefind component script.
  Covers: NFR-1
- AC-10: A docs page is loaded with the search button initialised, the layout-shift entries that no input caused are summed -> the sum is 0.1 or less on `/docs/guides/daily-use/` and on `/tr/docs/guides/gunluk-kullanim/`.
  Covers: NFR-5
- AC-11: `dist/pagefind/` is removed and `pagefind --site dist` is run twice on the same `dist/` -> the sha256 over the sorted paths and contents of `dist/pagefind/` is the same both times.
- AC-12: `npm run check:links` runs on a `dist/` that holds `dist/pagefind/` -> it exits 0 and its `checked` count equals the count of the same build without the Pagefind files, because the files of `/pagefind/` are not read as pages.
- AC-13: Failure criterion (anti-goal): the task is not done if the search is proved only with the CSP header removed or only on a page where the panel is hidden, if a query returns results from the other language, if any Pagefind file is loaded from another host, or if a page of the four site pages ships the Pagefind script, even when the unit tests are green.

## Out of scope

- The docs layout, the search button in the header and `docs.js` (TASK-014, TASK-016); the index pages `/docs/` and `/tr/docs/` (TASK-017).
- The links from the four site pages to `/docs/#search` (the page tasks).
- Wiring `npm run test:search` into `.github/workflows/ci.yml` (TASK-033).
- Excluding `/pagefind/` from the sitemap (TASK-029 checks it) and the accessibility run of the widget (TASK-031, report-only).
- Search of the site-written pages' navigation, a ranking or synonym tuning, a search without script.

## Constraints

- Expected test exception: the widget under the real CSP is provable only in a real Chromium, so the browser check is `tests/search.mjs` (Playwright library under `node:test`, run by `npm run test:search`, ADR 0009); unit tests cover the build script, the markers and the script list.
- ADR 0004 and ADR 0006 are accepted decisions: Component UI (not the legacy UI), docs pages only, same-origin files only, `data-pagefind-body` on content only.
- ADR 0001: exact versions for every dependency.
- `npm run test:search` is `node --test tests/search.mjs` (the name keeps it out of default `node --test` discovery, like `tests/axe.mjs`).

## Risks

- ADR 0004 and ADR 0006 mark three points unverified: the inline-style behaviour of the Component UI, the need for `'wasm-unsafe-eval'` and byte-identical Pagefind output. AC-7, AC-8 and AC-11 settle them; if the output of AC-11 cannot be made identical, the plan returns BLOCKED naming the differing files (the lead decides whether the compare of TASK-033 excludes `pagefind`).
- A second language index depends on the `lang` attribute of the `html` element of every page; a page with a wrong `lang` lands in the wrong index (AC-5 catches it only for the sampled Turkish page).
- The home page's main region is marked as content (assumption above); the owner may want the home page left out of the index.
- Pagefind adds a build step and a package to the Vercel build.

## Pre-existing defects

none

## Suggested class

COMPLEX - new dependency and a build step, a possible change to the CSP, three modules (layouts, build script, hosting configuration)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:search`
