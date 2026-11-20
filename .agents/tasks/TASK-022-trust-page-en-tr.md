# Task: TASK-022 - Trust page in English and Turkish

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-005
  - TASK-010
  - TASK-011
prd: site

---

## Goal

A team lead who wonders "why can I trust it" opens `/trust/` or `/tr/guven/`, one click from the home page, sees a case of a script blocking a claim with no proof taken from the proof page before the word "evidence" is used, reads the pinned version and the date of the figures generated from that page, and finds the limits stated in one sentence with the links to the proof and limits pages.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-7, US-3 (AC-6, AC-7, AC-8), AC-12 (trust page), N-1 and N-2 (notes of the promotional design step).

- Design: `/docs/design/DESIGN-marketing.md` sections "Visitor mode" (the trust page is persuade, kept calm, no showpiece), "Limits and trust statement (R-6)", "Real output as the visual material" (rule R-5: quoted English text carries `lang="en"`), "Copy rules" and "Gaps" (the trust page is not drawn here: it follows these rules and is specified by its task); `/docs/design/DESIGN.md` sections "Typography" and "Spacing". Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html` (the limits paragraph and the quoted-text treatment); the menu words "Trust" and "Güven" are in it. A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (addresses `/trust/` and `/tr/guven/`; `/docs/proof/` and `/docs/limits/` are English-only pages; titles), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (pin facts; a missing sentence, figure or heading fails the build naming page and pattern), `/docs/adr/0006-privacy-headers-csp-and-referrer.md`.
- Today: TASK-011 publishes `docs/proof.md` at `/docs/proof/` and `docs/limits.md` at `/docs/limits/`; TASK-010 produces the pin facts `version`, `figures_date`, `does_not_prove_id` (the id of the "does not prove" heading, "What this does not prove" at the candidate pin) and `not_proven_sentence`; TASK-005 gives the header whose menu holds "Trust" ("Güven").
- Proof page at the candidate pin (`.agents/local/scratch/pl-tree/docs/proof.md`, proofline 0.0.171): it holds records of hooks and scripts that block a change, for example the record of A293 ("review and security roles never push", a tripwire in the runtime hook and the pre-push hook) and the pull request row of #302 (a deny is blocked with or without `.agents/config.yaml`). The case to quote is chosen by the plan from the proof page at the real pin (v0.0.173), where the text may differ.
- Assumption: the case is a sentence quoted unedited from the synced proof page with a link to that page, read by a pattern at build time; the build fails naming `/trust/` and the pattern when the sentence is not found. The case itself contains no "evidence"; the word, if used, comes after the case.
- Assumption: the R-6 sentence replaces the stand-alone README sentence "not yet proven on real projects" on the page (PRD note N-1 forbids showing that sentence alone); the build still reads the README sentence from the pin facts and fails when it is missing, so the limit stays tied to the pin.
- Assumption: the R-6 limits block is one shared component `src/components/marketing/Limits.astro`; the first of TASK-019 and TASK-022 to be done creates it and the other reuses it.
- Assumption: the version and date are shown in one sentence whose wording the plan chooses (for example "Figures from proofline 0.0.171, taken on 2026-11-19", the values of the candidate pin); only the values are fixed.
- Expected scope: `src/content/` trust files in both languages (location set by TASK-004), `src/pages/trust/index.astro`, `src/pages/tr/guven/index.astro`, `src/components/marketing/Limits.astro`, `src/components/marketing/EnforcedCase.astro`, `src/lib/trust-facts.mjs` (reads the case and the facts), `src/styles/trust.css`, `tests/trust.test.mjs`, `tests/fixtures/trust/`. 9 paths.

## Acceptance criteria

- AC-1: `/trust/` and `/tr/guven/` are built -> the html element carries `lang="en"` and `lang="tr"`, each has one H1 ("Trust", "Güven"), the title is the page title plus the suffix of ADR 0002 point 5, and the title, `og:title` and every heading hold neither "evidence" nor "kanıt" (case-insensitive, also as part of a word).
  PRD ids: AC-10, AC-12
  Covers: FR-16
- AC-2: The header menu of the built home page `/` and of `/tr/` is followed once -> it leads to `/trust/` and `/tr/guven/` in 1 click, and `npm run check:links` reports 0 broken internal links on the trust pages.
  PRD ids: AC-6
  Covers: FR-7
- AC-3: Each trust page is read -> it links to `/docs/proof/` and `/docs/limits/` (also from the Turkish page, whose link texts say the pages are in English) and both targets exist in the build output.
  PRD ids: AC-6
  Covers: FR-7
- AC-4: Each trust page is read in document order -> a quoted case from the proof page (an element with `lang="en"`, the sentence unedited, a link to the proof page, and on the Turkish page a Turkish line saying it is quoted from the English source) comes before the first match of `/evidence/i` (English) or of `kan[ıi]t` after Turkish lower-casing (Turkish), or the word does not occur at all.
  PRD ids: AC-7
  Covers: FR-7
- AC-5: The fixture archive's proof page is changed so that the sentence of the case is gone -> `npm run build` exits non-zero and the message names `/trust/` and the pattern; with a changed sentence the page shows the changed text.
  Covers: FR-7, NFR-4
- AC-6: Each trust page is read -> it shows the pinned `version` and `figures_date` of the pin facts in one sentence (a fixture with another version and date shows the other values), and the content files hold neither the version nor the date as text.
  PRD ids: AC-8
  Covers: FR-7
- AC-7: Each trust page is read -> it shows a link to `/docs/proof/#` followed by the `does_not_prove_id` of the pin facts, and that fragment exists as an id in the built proof page.
  PRD ids: AC-8
  Covers: FR-7
- AC-8: The pin facts of a fixture archive lack the `does_not_prove_id`, the version, the figures date or the README not-yet-proven sentence in turn -> `npm run build` exits non-zero each time and names the trust page and the missing pattern.
  PRD ids: AC-8
  Covers: NFR-4
- AC-9: The limits statement of each trust page is read -> it is the sentence of rule R-6 in the page's language exactly as written in `/docs/design/DESIGN-marketing.md` ("site repository" linked to `https://github.com/furkansarikaya/proofline-site`, "README, Status" linked to the README at the pinned commit), and the phrase "not yet proven on real projects" does not stand alone on the page.
  PRD ids: N-1
  Covers: FR-7
- AC-10: The built trust pages are searched for numbers -> they hold no count of tasks, pull requests or CI runs (no numeral next to the words task, pull request or run in either language) and no hand-written figure that the proof page owns.
  PRD ids: N-2
- AC-11: `/tr/guven/` is read -> it shows Turkish prose and interface text only, and the only elements with `lang="en"` are the quoted case, product names and the links to English-only pages.
  PRD ids: AC-12, AC-13
  Covers: FR-17
- AC-12: The two trust pages are read -> they list each other as `hreflang` alternates with `x-default` to `/trust/`, the language link of the header leads from one to the other, and the Turkish content file records the hash of the English one.
  Covers: FR-17
- AC-13: Failure criterion (anti-goal): the task is not done if the version, the date or the case is typed in a content file, if "evidence" or "kanıt" comes before the case, if the README half of rule R-6 is shown alone, or if the build passes with a proof page that lacks the case, even when the page looks complete.

## Out of scope

- The synced proof and limits pages themselves (TASK-011) and their docs layout (TASK-014).
- The pin facts extraction and its failure messages (TASK-010); this task uses them and adds the case pattern.
- The home page, its limits section and the first-screen check (TASK-019, TASK-045).
- The check that every page title obeys the title rules across the site (TASK-029).
- A count of tasks, pull requests or CI runs read from the site repository (PRD N-2 allows it only with a read date; the first version states none).
- Judging whether the quoted case is the best case; the plan chooses it and the reviewer reads it.

## Constraints

- Expected test exception: none; text, order, links and build failures have a RED. Whether a reader finds the page convincing is not tested here (it belongs to TASK-045 and the evaluation of TASK-050).
- All pin-derived text comes from the pin facts or from the synced proof page, never typed (PRD FR-7, NFR-4, N-2).
- The R-6 sentence is used word for word in both languages (`/docs/design/DESIGN-marketing.md`, "Limits and trust statement (R-6)").
- Turkish prose follows "Copy rules"; the quoted case stays English with `lang="en"`.
- No new dependency; no inline style or script (ADR 0006).

## Risks

- The proof page is rewritten at every upstream version; the pattern of the case can stop matching and keep the build red until the plan's pattern or the quoted case is changed.
- The quoted case is English on a Turkish page (AC-12 exempts quotes from a synced page, so this is allowed), which a Turkish reader may find less convincing.
- A team lead who reads only the first screen of this page sees the case, not the limits; the order (case, figures, limits) follows the PRD.
- TASK-019 and TASK-022 share the limits component; a clash is resolved by whichever runs second.

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (two pages, shared limits component, pin facts reader, synced proof page) and a design choice about reading a quoted case from synced text

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
