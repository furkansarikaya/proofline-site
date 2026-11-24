# Task: TASK-026 - Contact page in English and Turkish

**Status:** done

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-004
  - TASK-005
  - TASK-025
prd: site

---

## Goal

A visitor who wants to reach the site's owner opens `/contact/` or `/tr/iletisim/`, finds the owner's GitHub, LinkedIn and Medium profiles and an e-mail link, with no form, and finds the entry "Contact" ("İletişim") as the last item of the header menu on every page.

## Context

Source: the product owner's decisions of 2026-11-20, recorded by TASK-025 as the PRD note N-6, the ADR `/docs/adr/0010-contact-page-address-and-links.md` and the section "Contact page" of `/docs/design/DESIGN-marketing.md`. The owner's words:

> İletişim sayfası: GitHub github.com/furkansarikaya, LinkedIn [linkedin adresin], Medium [medium adresin], e-posta [e-postan]; mailto bağlantısı, form yok; iki dilde. Üst menüdeki GitHub ikonu proofline repository'sine gider.

> /contact/ ve /tr/iletisim/ adres tablosuna eklensin; header menüsünün sonuna "İletişim" bağlantısı, kabul.

The values of the bracketed fields, as given for the task split: GitHub `https://github.com/furkansarikaya`, LinkedIn `https://www.linkedin.com/in/furkansarikaya`, Medium `https://furkansarikaya.medium.com/`, e-mail `furkannsarikaya@gmail.com`.

PRD ids: FR-16, FR-17, AC-10, AC-12 (the requirements that every page also meets: name and phrase in titles, English and Turkish pages, `lang`); the page itself is outside the PRD requirements (N-6).

- Design: `/docs/design/DESIGN-marketing.md` section "Contact page" (written by TASK-025) and the sections "Layout rules" and "Copy rules"; `/docs/design/DESIGN.md` sections "Typography", "Spacing" and "Header controls (rules)" (rule 5: 44 by 44 px targets, focus ring; rule 1: the GitHub icon goes to the proofline repository and has no `rel="noreferrer"`). Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html` (header, plain links, lower reading column). A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0010-contact-page-address-and-links.md` (addresses, menu entry, mailto, no form), `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (point 3 translation index, point 4 content files and the stamp, point 5 titles), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (no tracking, no third-party resource, one controls script).
- Today: TASK-005 builds the header whose menu is Home, Get started, Docs, Trust, Claude Code and Codex, and the footer of PRD note N-3; TASK-004 builds the translation index, the title builders and the stamp.
- Assumption: link texts are "GitHub", "LinkedIn", "Medium" and "E-mail" on the English page and "GitHub", "LinkedIn", "Medium" and "E-posta" on the Turkish page, in this order; the e-mail link shows the address as its visible text.
- Assumption: the H1 equals the page title ("Contact", "İletişim"); the page has no other prose (the copy is not designed; the owner named only the links).
- Expected scope: `src/content/` contact files in both languages (location set by TASK-004), `src/pages/contact/index.astro`, `src/pages/tr/iletisim/index.astro`, `src/components/marketing/Header.astro` (the menu entry), `src/lib/translations` (the pair; the module of TASK-004), `src/styles/contact.css`, `tests/contact.test.mjs`, `tests/fixtures/contact/`. 8 paths.

## Acceptance criteria

- AC-1: `/contact/` and `/tr/iletisim/` are built -> the html element carries `lang="en"` and `lang="tr"`, each page has one H1 ("Contact", "İletişim"), and the title is the page title plus the suffix of ADR 0002 point 5 (`Contact | proofline: a deterministic engineering team for Claude Code and Codex`, `İletişim | proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi`), with `og:title` equal to it and no "evidence" or "kanıt".
  PRD ids: AC-10
  Covers: FR-16
- AC-2: Each page is read -> it holds exactly four links to the owner, in this order: `https://github.com/furkansarikaya`, `https://www.linkedin.com/in/furkansarikaya`, `https://furkansarikaya.medium.com/` and `mailto:furkannsarikaya@gmail.com`, with the link texts of the Context, and the e-mail link shows the address.
- AC-3: Each page is read -> it holds 0 `form`, `input`, `textarea` and `button` elements, no `ping` attribute, no query string on the four links, no script element other than `controls.js`, and no resource from another host.
- AC-4: The four links of each page are measured -> each is at least 44 px high and at least 44 px wide, and each shows a 2 px `--accent` focus ring with a 3 px offset when reached with the keyboard.
- AC-5: The header of every built page (the four site pages in both languages, the not-found page and a docs page) is read -> the last item of the menu is "Contact" (`/contact/`) on English pages and "İletişim" (`/tr/iletisim/`) on Turkish pages, after "Claude Code and Codex" ("Claude Code ve Codex"), and the existing menu items keep their order.
- AC-6: The header GitHub icon is read on both contact pages and the home page -> it still shows a link to `https://github.com/furkansarikaya/proofline` with the accessible name "proofline on GitHub" ("GitHub'da proofline") and no `rel="noreferrer"`, and the contact page's GitHub link is not that address.
- AC-7: The two contact pages are read -> they list each other as `hreflang` alternates with `x-default` to `/contact/` from the translation index, the language link of the header leads from one to the other (not to a home page), and the index function that returns alternates for `/contact/` returns `/tr/iletisim/`.
  Covers: FR-17
- AC-8: The Turkish content file is stamped with `npm run translation:stamp` -> `translatedFrom` records the hash of the English content file and no stale notice shows; after the English file is edited the notice shows.
  PRD ids: AC-14
  Covers: FR-17
- AC-9: `/tr/iletisim/` is read -> all prose and interface text is Turkish with its letters intact (`İletişim`, `E-posta`), the only elements with another `lang` are product names, and `/contact/` holds no Turkish prose.
  PRD ids: AC-12
  Covers: FR-17
- AC-10: The footer of both contact pages is read -> its text equals the footer line of PRD note N-3 in the page's language, as on every other page.
- AC-11: Failure criterion (anti-goal): the task is not done if a form, tracking or a third-party widget is on the page, if the menu entry is not the last item, if the header GitHub icon was changed to the owner's profile, if one of the four addresses differs by one character, or if the Turkish page is the English text with Turkish headings, even when the build is green.

## Out of scope

- The decision records (TASK-025) and the sitemap (TASK-006, which lists the pair because it is in the translation index).
- Any contact form, mail sending, captcha, chat or social-media embed (the owner said "form yok").
- Reading the e-mail address from an environment variable or obfuscating it.
- Changes to the footer line, the header icons or the language link (TASK-005).
- The check that the old address list contains no contact addresses and the dist-wide checks (TASK-029, TASK-030, TASK-041).

## Constraints

- Expected test exception: none; content, links, order and head tags have a RED. Visual likeness to the samples is left to review.
- The four addresses are exactly those of the Context (the owner's values) and of PRD note N-6.
- ADR 0002 point 4: the Turkish page is a content file with `translatedFrom` written by the stamp command; ADR 0002 point 3: the pair is registered in the translation index, the only source of hreflang, sitemap entries and the language switcher.
- ADR 0006: external links carry no tracking; links to hosts other than the proofline repository do not need `rel="noreferrer"` and none is required here; no inline style or script.
- No new dependency.

## Risks

- The header is on every page; adding a sixth menu item can wrap the menu on a narrow phone or at 1000 px, where the base design tightens the menu gap; the header test of TASK-005 and the axe gate must still pass.
- The e-mail address is a public mailto link in the page source; the owner chose it (N-6).
- Three of the four links go to hosts the site does not control; they can change or disappear, and the build checks internal links only.
- The page has almost no prose; the Turkish and English pages are nearly identical in structure, so the translation stamp is the only guard against drift.

## Pre-existing defects

none

## Suggested class

COMPLEX - changes the shared header that every page renders, adds a page pair to the translation index and two public addresses (STANDARD considered for the page alone)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-026 -->
- run: TASK-026
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-24T08:11:12Z
- runtime: claude
- session: 8303465e-75e9-456e-b28c-83159dca7957
- estimate: size M
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-026 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-026 -->
# Completion Report: TASK-026

<!-- proofline:summary:begin -->
Changed: the English and Turkish contact pages with the owner's four links (GitHub, LinkedIn, Medium and e-mail, no form), the Contact entry as the last item of the header menu on every page, and the pair registered in the translation index.
Verify: `npm run build && npm test`
<!-- proofline:summary:end -->

## Implementation Summary

The pages `/contact/` and `/tr/iletisim/` exist. Two content files hold the text (a title, a lead, one short paragraph and the link texts); `src/lib/contact.ts` holds the four owner addresses as exact constants and reads and checks the content; `ContactPage.astro` builds one H1, one short paragraph and the four links in the required order as rows of at least 44 by 44 px, with the e-mail row showing a label word before the mailto link whose text is the address; `src/styles/contact.css` styles them with tokens only and no conditional rule. The paragraph width is set in em so no line exceeds 75 characters, and the e-mail label stays unbreakable and wraps above the address on a narrow phone. The menu entry is appended last in `src/lib/nav.ts` and the pair is registered in `src/lib/translations.ts`, so every page's header ends with Contact, the language link leads between the two contact pages, and the hreflang alternates and the sitemap include the pair. The header GitHub icon is unchanged. The pages hold no form, tracking or script other than the controls script.

Three amendments were applied. Amendment 001 added two existing test files (`tests/agents-page.test.mjs`, `tests/not-found.test.mjs`) whose menu and style-folder expectations assert the old state. Amendment 002 stated the 75-character paragraph rule in the plan and gave a new fix budget (budget approved by the user). Amendment 003 stated that the contact tests pin the exact stylesheet and the exact element tree by explicit tables and gave a further fix budget (approved by the user). The external-host scan of the design test allows exactly the three external owner addresses as link targets on the two contact pages and nothing else.

## TDD Evidence

Worker evidence holds RED then GREEN per scope path with the plan commands. The many fix rounds each closed one class of hollow test found by the mutation reviews: the row wrapping and the label, the paragraph's longest line, the layout box, conditional at-rules, the full stylesheet and markup tables, the validation of the content by the component, and key and constant order. A sweep of single-expression mutants over the component, helper, page files, menu entry, pair and import ended with no survivor that is not equivalent.

## Verification

All plan commands passed on the final tree in the verifier's own evidence worktree: tests, build with the guards, determinism check, link check and the accessibility check. Every acceptance criterion AC-1 to AC-11 maps to a passing named test. AC-5 names a docs page that does not exist yet; it is covered by the shared header rule and the menu tests of every built page (plan assumption AS-2), so it holds for a docs page when it lands. The copy of both languages is a human check recorded in the QA report.

## Assumptions

- AS-1 (low): the page needs one short paragraph because every built page must hold a non-empty paragraph; the copy is chosen by the plan and checked by the review — unverified
- AS-2 (low): AC-5 names a docs page that does not exist yet; the menu check covers the pages that exist and holds for a docs page by the same rule when it lands — unverified

## Review Result

- REVIEW_PLAN: pass.
- REVIEW_RULES: pass after two rounds; the first run failed on the e-mail row breaking mid-word at 320 px on the Turkish page, the second on the paragraph measure above 75 characters per line; both closed; REVIEW_RULES-1 is recorded as the final info row set.
- REVIEW_TESTS: pass after many rounds of hollow-test findings of the same class, all closed by the tables, sweeps and mutants described above; REVIEW_TESTS-1, REVIEW_TESTS-2, REVIEW_TESTS-3, REVIEW_TESTS-4, REVIEW_TESTS-5, REVIEW_TESTS-6 and REVIEW_TESTS-7 are informational rows (decorative probes, brittleness of the exact tables, the Turkish paragraph pinned by measure and heuristics, a clock candidate that is old code).
- SECURITY: pass, no findings.
- Fix rounds: see the Facts block.

## QA Result

QA gate: waived by the user for the four design rows; all frozen scenarios (QA-1 to QA-33 of the QA plan) passed in the last QA run. Findings of QA: QA-1, QA-2, QA-3 and QA-4 blocking and waived (below); QA-5 and QA-6 info rows (the home page rows that are not part of this task, the body measure rule that now passes). The design group focus is waived with the same rows.
- VERIFY: pass; VERIFY-1, VERIFY-2 and VERIFY-3 info rows named design-document lines (the component table, the architecture row and the contact section) that the knowledge step then updated.

## Unsupported Checks

none

## Waivers

| Finding | Gate | Reason | Approval |
|---|---|---|---|
| QA-1 | QA | the page is plain text by design, so the first screen holds no drawing; the same rule fails on the text-only get-started page at the base | user, approve qa-1 |
| QA-2 | QA | no animated element by design; the same rule fails on the get-started page at the base | user, approve qa-2 |
| QA-3 | QA | headline to body ratio 1.95 at 390 px, the same value as the home pages (user option A) | user, approve qa-3 |
| QA-4 | QA | the checker requires an image ledger document that does not exist; the rule fails on every page including the base | user, approve qa-4 |

NOT_RERUN lines:

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)

## Execution

Generated from the decision records by `agent.sh report-execution TASK-026` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| implementer | - | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | plan | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | plan | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | rules | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff,fix_round_2 | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| qa | visual | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| qa | visual | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| verifier | - | claude | sonnet | medium | large_diff | agent path |

## Amendments

- 001-menu-and-style-tests: scope paths `tests/agents-page.test.mjs` and `tests/not-found.test.mjs` added (scope approved by the user).
- 002-measure-and-layout-test: the paragraph width rule and the longest-line assertion stated in the plan (budget approved by the user).
- 003-pin-stylesheet-and-markup: the stylesheet and the markup tree pinned by explicit tables (budget approved by the user).

## Reopen History

none

## Known Limitations / Follow-up

- The docs links of the header and the AC-5 docs page check apply once the docs pages exist.
- `tests/axe.mjs` scans only the two home pages; the gates scanned the contact pages separately.
- The exact tables of the contact tests make every future contact style change touch the test (hollow-proof but brittle); a design pass on the contact page may follow, as the design document says.
- The same 75-character width rule written in `ch` is still on the get-started paragraphs (not part of this task).

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 42)
- Gate REVIEW_PLAN: ran on an EARLIER tree (gate REVIEW_PLAN, record 37; fix rounds used in the run: 1, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_RULES: ran on an EARLIER tree (gate REVIEW_RULES, record 39; fix rounds used in the run: 1, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 46)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 43)
- Gate QA: ran on the final tree: pass (gate QA, record 44)
- Visual/browser check: failed on the final tree and was waived by the user (visual/browser check, gate QA:visual, record 45)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 47)

Final message line (paste it unchanged): Verification claims (from the ledger): 5 of 7 gates hold a record for the final tree; not on the final tree: REVIEW_PLAN (earlier tree), REVIEW_RULES (earlier tree); visual/browser check: failed on the final tree and was waived by the user (gate QA:visual, record 45).
Claims-hash: 0104168ce7d857d28b8c6206a034217b6fc0e4df9fe08cb2a7c47e9fc27f419d
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-026` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: none
- Gate REVIEW_RULES: pass; findings: REVIEW_RULES-1
- Gate REVIEW_TESTS: pass; findings: REVIEW_TESTS-1 REVIEW_TESTS-2 REVIEW_TESTS-3 REVIEW_TESTS-4 REVIEW_TESTS-5 REVIEW_TESTS-6 REVIEW_TESTS-7
- Gate SECURITY: pass; findings: none
- Gate QA: waived; findings: none
  - Focus QA:visual: waived; findings: QA-1 QA-2 QA-3 QA-4 QA-5 QA-6
- Gate VERIFY: pass; findings: VERIFY-1 VERIFY-2 VERIFY-3
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 1 of 2
- Refreezes: 3
- Files changed (task-owned paths): 17
- Worker-evidence run records: total 65, ended pass 54, ended fail 11 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-026 -->
