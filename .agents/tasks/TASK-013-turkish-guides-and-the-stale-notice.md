# Task: TASK-013 - Turkish guides and the stale notice

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-011
prd: site
---

## Goal

The two Turkish guides of the proofline repository are published at their Turkish addresses, paired with their English guides for the language link and `hreflang`, and each shows a calm notice above its title when the English guide has changed since the translation, without ever failing the build or showing a commit or blob id.

## Context

- Source requirements in `/docs/product/site/PRD.md`: FR-18 (every Turkish guide reads its `translated-from` header; when the blob id differs from the git blob id of its English source at the pinned commit the page shows a notice that the English page has changed, with a link to it, without failing the build and without showing a commit or blob id), FR-17 (no `/tr/` address for a page without a translation; `hreflang` only on pages that have one), and the user stories AC-13 and AC-14 (the guide half; site-written Turkish pages are TASK-004's staleness data).
- Sources: `docs/guides/tr/gunluk-kullanim.md` and `docs/guides/tr/prompt-katalogu.md` of the pinned commit. At the candidate pin each starts with its H1 and the line `<!-- translated-from: docs/guides/daily-use.md; blob: 63606a83788971a1ada89515bb008c32cc701e2b -->` (for the second guide `docs/guides/prompt-catalogue.md` and its own blob id).
- Design: surface document `/docs/design/DESIGN-docs.md` section "Provenance (every page)" (the provenance sentence and the note for a stale Turkish guide: a `--surface` ground, a 2px `--muted` bar on its left, `role="note"`, 15px, no colour alert, no icon, no dismiss button), shared base `/docs/design/DESIGN.md`; approved docs-surface sample `/docs/design/references/docs-surface/tr-guide-gunluk-kullanim.html` (the sample shows the note and the provenance sentence). Where the sample and the design document differ, the design document wins. The full docs layout is TASK-014; this task builds the pages on the shared Base layout and styles only the note.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` point 2 (addresses `/tr/docs/guides/gunluk-kullanim/` and `/tr/docs/guides/prompt-katalogu/`, no other Turkish docs address for synced content), point 3 (the translation index is built from the Turkish guides' `translated-from` header) and point 4 (Turkish guides compare the header blob with the git blob id of the English source at the pin); `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md`.
- Inputs: the manifest and routes of TASK-011, the transform's `translated-from` result (TASK-008), the lock blob ids (TASK-007), the translation index (TASK-004) and the link map (TASK-009).
- Expected scope (6 paths): `src/pages/tr/docs/guides/[slug].astro`, `src/lib/synced.ts`, `src/lib/translations.ts` (pairs read from the headers), `src/components/StaleNotice.astro`, `tests/turkish-guides.test.mjs`, `tests/fixtures/synced/` (Turkish guide fixtures).
- Assumption: the note reads "Bu çeviriden sonra İngilizce sayfa değişti, bu yüzden bu sayfa güncel olmayabilir. İngilizce metin esastır: " followed by the title of the English page as a link with `lang="en"` and a full stop, as the design document gives it with the English title "Daily use".
- Assumption: the provenance sentence of a Turkish guide is "proofline v0.0.173 sürümünden alındı" when the pin has a tag (the exact Turkish text of the design document), and when the tag is null the tag is replaced by the first 8 characters of the commit in the same sentence.
- Assumption: a Turkish guide without a `translated-from` header, or whose header names a path that is not an English guide of the lock, stops the build and names the page; the PRD says every Turkish guide reads its header, and a silent default would hide a broken pair.

## Acceptance criteria

- AC-1: The site is built from the committed lock -> `dist/tr/docs/guides/gunluk-kullanim/index.html` and `dist/tr/docs/guides/prompt-katalogu/index.html` exist, each with `lang="tr"`, and each source's `translated-from` line appears nowhere in the page text or markup.
  Satisfies: AC-13.
  Covers: FR-17
- AC-2: The Turkish guide pages are built -> the title element of the first reads "Günlük kullanım | proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi" (its H1 followed by the Turkish name and phrase), and each page shows "proofline v0.0.173 sürümünden alındı" under its H1 while the pin tag is `v0.0.173`.
  Satisfies: AC-10.
  Covers: FR-17
- AC-3: A fixture Turkish guide records the blob id of its English guide as it is in the lock -> the page holds 0 notices, and the build prints no warning for it.
  Satisfies: AC-14.
  Covers: FR-18
- AC-4: A fixture Turkish guide records a blob id that differs from the lock's blob id of its English guide -> the page holds one element with `role="note"` above the H1 whose text is "Bu çeviriden sonra İngilizce sayfa değişti, bu yüzden bu sayfa güncel olmayabilir. İngilizce metin esastır: " followed by the English page's H1 as a link with `lang="en"` to the English guide's address, the build prints a warning naming the page, and the build exits 0.
  Satisfies: AC-14.
  Covers: FR-18
- AC-5: The stale page is built -> the page holds neither the blob id of the header nor the blob id of the English file, the note holds no icon, no button and no other element than text and the one link, and the page is not marked as an error in any way (no `aria-live`, no `role="alert"`).
  Satisfies: AC-14.
  Covers: FR-18
- AC-6: The style of the note is read -> its ground is `--surface`, it has a 2px left bar in `--muted`, its font size is 15px, and it uses neither `--block` nor `--accent`.
  Covers: FR-18
- AC-7: A fixture Turkish guide has no `translated-from` header, and another names a path that is not an English guide in the lock -> each build exits non-zero and the message names the Turkish page and the problem.
  Covers: FR-18
- AC-8: The built pages `/docs/guides/daily-use/` and `/tr/docs/guides/gunluk-kullanim/` are read -> each holds `link rel="alternate"` tags for `en`, `tr` and `x-default` equal to the pair `/docs/guides/daily-use/` and `/tr/docs/guides/gunluk-kullanim/`, and the same holds for the second pair; the pairs come from the headers, so no pair is typed in the code.
  Satisfies: AC-13.
  Covers: FR-17
- AC-9: `dist/` is listed -> `dist/tr/docs/guides/` holds exactly the two guide directories, there is no Turkish address for any concept, skill, proof or limits page, and the pages that carry `hreflang` among the synced pages are exactly the four guide pages.
  Satisfies: AC-13.
  Covers: FR-17
- AC-10: The language link of an English synced page that has no pair is asked for its target -> it returns `/tr/docs/` and flags the page as having no Turkish version (the behaviour of TASK-004, shown on a synced page).
  Satisfies: AC-13.
  Covers: FR-17
- AC-11: `npm run check:links` and `npm run check:determinism` run on the built site -> both exit 0.
  Satisfies: AC-47.
- AC-12: Failure criterion (anti-goal): the task is not done if a stale guide fails the build, if the page shows a commit or blob id in its notice, if a Turkish address exists for an English-only page, or if a page without a translation carries `hreflang`, even when the pages look right in the browser.

## Out of scope

- The Turkish docs home `/tr/docs/` with its list of Turkish guides and English-only pages (TASK-017) and the `EN` tag in the Turkish tree (TASK-014).
- The full docs layout, tree and outline (TASK-014, TASK-015), the Markdown copies of the Turkish guides (TASK-012) and search (TASK-028).
- Staleness notices for Turkish pages written for the site (their wording is not designed yet; the staleness data is TASK-004's).
- Translating or editing the guides; the pages show the upstream Turkish text as it is.

## Constraints

- PRD FR-18: the staleness check never fails the build and never shows a commit or blob id.
- ADR 0002 point 2: the only Turkish synced addresses are the two guides; point 4: the comparison uses the git blob id of the English source at the pin.
- Expected test exception: none; the stale and equal cases are tested on fixtures, and the delivery report states which of the two real guides is stale at the launch pin (a comparison of the committed lock's blob ids).
- ADR 0001: no dependency is added.

## Risks

- At the candidate pin both headers equal their English blobs; at the launch pin one may be stale, so the real build can print a warning on day one. The warning is by design and the delivery report names it.
- The Turkish text of the note and of the provenance sentence comes from the design document; the English page title inside the note must be the H1 of the English guide as it is, not a typed string.
- The pairs are read from upstream headers; an upstream rename of an English guide fails the build (AC-7), which is the intended signal.

## Pre-existing defects

none

## Suggested class

STANDARD - bounded change: two routes, one component and the registration of two pairs on top of an existing manifest and index

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
