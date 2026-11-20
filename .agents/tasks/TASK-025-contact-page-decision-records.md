# Task: TASK-025 - Contact page decision records

---
origin: prd:site
type: docs
size: S
depends_on:
  - TASK-001
prd: site

---

## Goal

The owner's decision to add a contact page is recorded in the three places the later tasks read: a note N-6 in the PRD, an ADR that adds the two addresses and the menu entry to the address table, and a "Contact page" section in the marketing design document, with the ADR listed in the ADR index.

## Context

Source: the product owner's decisions of 2026-11-20 in the task split step. This task records a new decision that is outside the PRD requirements (no FR, NFR or AC of the PRD is satisfied by it), so its criteria carry no `Covers:` line; the later task TASK-026 builds the page.

The product owner's words:

> İletişim sayfası: GitHub github.com/furkansarikaya, LinkedIn [linkedin adresin], Medium [medium adresin], e-posta [e-postan]; mailto bağlantısı, form yok; iki dilde. Üst menüdeki GitHub ikonu proofline repository'sine gider.

> /contact/ ve /tr/iletisim/ adres tablosuna eklensin; header menüsünün sonuna "İletişim" bağlantısı, kabul.

The bracketed fields of the first message were filled with these values for the task split: GitHub `https://github.com/furkansarikaya`, LinkedIn `https://www.linkedin.com/in/furkansarikaya`, Medium `https://furkansarikaya.medium.com/`, e-mail `furkannsarikaya@gmail.com`.

- Documents to write: the PRD note in `/docs/product/site/PRD.md`, section "Notes from the promotional design step" (the notes N-1 to N-5 stand there; N-4 says the header GitHub icon links to the proofline repository); a new ADR `/docs/adr/0010-contact-page-address-and-links.md` in the format of the existing ADRs (title line `# 0010. ...`, then `Status:`, `Date:`, and the sections Context, Decision, Alternatives considered, Consequences, Evidence); a new section "Contact page" in `/docs/design/DESIGN-marketing.md`; the ADR index `/docs/adr/README.md`.
- ADRs this one extends: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (point 2 address table, point 3 translation index, point 5 titles, point 8 navigation) and `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (no tracking, one controls script, point 3 on links). It contradicts neither, so ADR 0002 keeps its status `accepted` and its text unchanged; ADR 0010 adds rows.
- Design sources: `/docs/design/DESIGN-marketing.md` (surface list, "Layout rules", "Copy rules", "Gaps": pages other than the first screen are specified by their tasks) and `/docs/design/DESIGN.md` ("Header controls (rules)", rule 5: 44 by 44 px targets).
- Today: `/docs/adr/README.md` holds two sentences and no list of ADRs; the PRD working tree has uncommitted additions of the owner (git status shows the file modified), which this task leaves as they are.
- Assumption: because the index lists no ADR today, the index gets a list of ADRs 0001 to 0010 (title from each file's first line, status in brackets), so that ADR 0010 is listed in a complete index.
- Assumption: the "Contact page" section states the owner's decisions and points to the existing rules for the look (type scale, hairlines, 44 px targets, no new token); the page is not drawn, and the section says so.
- Assumption: the page titles follow ADR 0002 point 5 with the page titles "Contact" and "İletişim".
- Expected scope: `docs/product/site/PRD.md`, `docs/adr/0010-contact-page-address-and-links.md`, `docs/adr/README.md`, `docs/design/DESIGN-marketing.md`. 4 paths.

## Acceptance criteria

- AC-1: The PRD section "Notes from the promotional design step" is read -> it holds a line starting `- N-6:` after the line of N-5, which states the pages `/contact/` and `/tr/iletisim/`, the four links with the values of the Context, the e-mail as a `mailto:` link, no form, two languages, the menu entry "Contact" ("İletişim") as the last menu entry, that the header GitHub icon still goes to the proofline repository (N-4), a reference to ADR 0010, and ends with a tag `[decision: by product owner because ...]` with a reason.
- AC-2: The PRD file is compared with its state before the task -> the comparison shows only the added N-6 line (and its blank line); the other notes, requirements and the owner's uncommitted additions are unchanged.
- AC-3: `docs/adr/0010-contact-page-address-and-links.md` is read -> its first line is `# 0010. ` followed by a title, it holds `Status: accepted` and `Date: 2026-11-20`, and the sections Context, Decision, Alternatives considered, Consequences and Evidence, in this order.
- AC-4: The Decision section of ADR 0010 is read -> it adds the row `contact` with the English address `/contact/` and the Turkish address `/tr/iletisim/` to the address table of ADR 0002 in the same table format, says the Turkish slug is ASCII as ADR 0002 point 2 requires, and says ADR 0002 itself stays unchanged.
- AC-5: The Decision section is read -> it shows the menu entry "Contact" ("İletişim") as the last entry of the header menu, after "Claude Code and Codex", and that the GitHub icon of the header still goes to `https://github.com/furkansarikaya/proofline`.
- AC-6: The Decision section is read -> it shows the four links with the exact values of the Context, the e-mail as a `mailto:` link, that the page has no form, that the pair is registered in the translation index of ADR 0002 point 3 (so hreflang, sitemap and language switcher follow), that the titles follow ADR 0002 point 5, and that external links follow ADR 0006 (no tracking, no script beyond the controls script).
- AC-7: The sections Alternatives considered and Consequences are read -> the first holds the contact form as an alternative rejected by the owner with the quoted words "form yok" and no alternative the owner did not name, and the second says the public address table grows by two addresses and that a later change to them needs redirects the PRD does not plan (as ADR 0002 states for the table).
- AC-8: `/docs/adr/README.md` is read -> it lists ADRs 0001 to 0010 once each, with a link to the file and its title, and ADR 0010 is among them; every link target exists in `docs/adr/`.
- AC-9: `/docs/design/DESIGN-marketing.md` is read -> it holds a section `## Contact page` that states the surface (marketing), the four links with the exact values, the `mailto:` link and no form, the two languages with the titles "Contact" and "İletişim", the menu entry as the last item, 44 by 44 px targets for the links, that no new token is added, and that the page is not drawn and follows the rules above it; the surface list in the first paragraph of the file names the contact page.
- AC-10: The four values are searched in the three changed documents -> each of the four values occurs identically (same characters) in N-6, in ADR 0010 and in the "Contact page" section, and the e-mail is spelled `furkannsarikaya@gmail.com` in all three.
- AC-11: The relative links in the added text of the four files are followed -> the check shows every target as an existing file of the repository.
- AC-12: Failure criterion (anti-goal): the task is not done if any other text of the PRD, ADR 0002, ADR 0006 or `ARCHITECTURE.md` changes, if a form, a tracking pixel or a third-party widget appears in any of the three decisions, if a value differs from the Context by one character, or if ADR 0010 is missing from the index, even when the documents read well.

## Out of scope

- The contact page itself, the menu change and the translation index entry (TASK-026).
- Editing ADR 0002, ADR 0006 or `/docs/design/ARCHITECTURE.md` (its ADR list and address table are updated by the knowledge step, not here).
- A visual design of the page, new tokens and screenshots.
- The decision tags of the other source documents (TASK-042) and the launch documents (TASK-040).
- Adding the contact page to the sitemap or to the query-to-page map.

## Constraints

- Expected test exception: documents only (task type `docs`); a test-first RED does not exist for them. Tested instead by the commands under "Verification commands" (counts of lines and values, the index list) and by a reading of the four documents against the criteria.
- All text is English except the owner's quoted words and Turkish product text (menu word "İletişim", address `/tr/iletisim/`), which keep their letters.
- ADR format and numbering follow the existing ADRs (`NNNN` is the highest existing number plus 1; an ADR is never renumbered).
- The PRD note format follows N-1 to N-5, including the closing decision tag.
- Addresses and the e-mail are ASCII and copied exactly from the Context.

## Risks

- `docs/product/site/PRD.md` has uncommitted edits by the owner; an editor that rewrites the whole file would carry them into this task's diff, and AC-2 is the check.
- The ADR index has no list today; a list of ten ADRs is more than the minimum and must match each ADR's real title and status.
- The "Contact page" section is a design record without a drawing; the page may need a design pass later, which the section's last sentence says.
- A contact e-mail address in a public repository can attract spam; the owner chose it (N-6 records his decision).

## Pre-existing defects

none

## Suggested class

COMPLEX - extends a public contract (the address table of ADR 0002) and records a project-level decision, though the change is documents only (STANDARD considered)

## Verification commands

- `grep -c '^- N-6:' docs/product/site/PRD.md`
- `grep -c '^# 0010\. ' docs/adr/0010-contact-page-address-and-links.md`
- `grep -c '0010' docs/adr/README.md`
- `grep -c '^## Contact page' docs/design/DESIGN-marketing.md`
- `grep -c 'furkannsarikaya@gmail.com' docs/product/site/PRD.md docs/adr/0010-contact-page-address-and-links.md docs/design/DESIGN-marketing.md`
- `git diff --stat -- docs/adr/0002-addresses-languages-hreflang-and-titles.md docs/adr/0006-privacy-headers-csp-and-referrer.md docs/design/ARCHITECTURE.md`
- `npm test`
