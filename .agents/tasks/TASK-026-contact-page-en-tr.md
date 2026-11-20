# Task: TASK-026 - Contact page in English and Turkish

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
