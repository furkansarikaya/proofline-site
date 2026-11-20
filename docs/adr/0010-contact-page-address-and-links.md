# 0010. Add the contact page at /contact/ and /tr/iletisim/, a last "Contact" menu entry, and plain links with a mailto address

Status: accepted
Date: 2026-11-20

## Context

The product owner decided on 2026-11-20, in the task split step, that the site gets a contact page (PRD N-6). ADR 0002 point 2 says its address table is complete and anything else is 404, and point 8 fixes the header menu. ADR 0006 point 3 covers only links to the proofline repository, and its amendment allows the controls script on the four site pages. Neither says anything about a contact page, other external links or a mailto link. This ADR extends both by addition.

## Decision

1. Address table. Rows added to the address table of ADR 0002 point 2:

| Page | English | Turkish |
|---|---|---|
| contact | `/contact/` | `/tr/iletisim/` |

   The Turkish slug `iletisim` is ASCII, as ADR 0002 point 2 requires. ADR 0002 stays unchanged and keeps its status `accepted`; its table and this row are read together.
2. Translation index and titles. The pair `/contact/` and `/tr/iletisim/` is registered in the translation index of ADR 0002 point 3, so the hreflang tags, the sitemap alternates and the language switcher follow from it. As a site-written page it is a content file with a `translatedFrom` stamp (ADR 0002 point 4). Titles follow ADR 0002 point 5 with the page titles "Contact" and "İletişim".
3. Navigation. The header menu of ADR 0002 point 8 becomes Home, Get started, Docs, Trust, Claude Code + Codex, Contact. "Contact" ("İletişim") is the last menu entry, after "Claude Code and Codex". The GitHub icon, the language switch and the theme button are controls, not menu entries, and stay after it; the tab order is brand, menu links, GitHub, language, theme (DESIGN.md header controls rule 5), and on docs pages the search button stays between the menu links and the GitHub icon. The GitHub icon of the header still goes to `https://github.com/furkansarikaya/proofline` (PRD N-4).
4. Content. The page shows four links, in this order: GitHub `https://github.com/furkansarikaya`, LinkedIn `https://www.linkedin.com/in/furkansarikaya`, Medium `https://furkansarikaya.medium.com/`, and the e-mail as the link `mailto:furkannsarikaya@gmail.com`. The page has no form. Both languages show the same four links.
5. Privacy and scripts (ADR 0006 read with this ADR, its text unchanged). The four links are plain links: no tracking parameter, and no embedded profile, widget, pixel, image or script from GitHub, LinkedIn or Medium. ADR 0006 point 1 (no reference to a third-party host) is read as no resource loaded from such a host; a link the visitor follows is not a load, as the existing links to github.com show. The referrer follows the site-wide `Referrer-Policy` of ADR 0006 point 2; point 3 binds only links to the proofline repository. The mailto link is a navigation, not a form submission, so `form-action 'none'` stays as it is. The contact page is a fifth site-written page: it loads the same controls script `/assets/controls.js` as the four site pages of the ADR 0006 amendment, because the header is shared, and no other script. ADR 0006 is read this way without a text change.

## Alternatives considered

- A contact form: rejected by the product owner ("form yok"). It would also need a form endpoint or a third-party service, which `form-action 'none'` and ADR 0006 point 1 do not allow. Rejected.

## Consequences

- Contract: the public address table grows by two addresses, `/contact/` and `/tr/iletisim/`; a later change to them needs redirects that the PRD does not plan (FR-19), as ADR 0002 states for the table.
- TASK-026 builds the page, the menu entry and the translation index pair; the CI script check of ADR 0008 then covers the contact page as a site page.
- The overview `docs/design/ARCHITECTURE.md` (ADR list, address table) is updated by the knowledge step.
- A contact e-mail address in a public repository and page can attract spam; the owner chose it (PRD N-6).

## Evidence

- verified (PRD N-4, N-5): the header GitHub icon goes to the proofline repository; the controls script is one same-origin file of at most 2048 bytes.
- verified (ADR 0002 points 2, 3, 4, 5, 8): table format, ASCII slugs, translation index, title rule, header menu.
- verified (ADR 0006 points 1 to 3 and the amendment): no third-party load, `form-action 'none'`, referrer rule only for repository links, controls script on the four site pages.
- verified (TASK-025): the owner's words and the four values of the task split step, 2026-11-20.
