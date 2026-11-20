# Design: docs surface (read)

Surface `docs` of `design_docs.design` (the documentation section: the docs home, concepts, guides, the skill catalogue, skill pages, proof and limits; English and Turkish). Base: [DESIGN.md](DESIGN.md); everything there applies here unless this document narrows it. Written as the direction contract of the approved sample; to be updated after the build.

Approved sample: [references/docs-surface/](references/docs-surface/README.md) (four pages, English and Turkish, light and dark, desktop and mobile, with screenshots). A look reference, not code to copy one to one; where it and this document differ, this document wins. It was approved by the product owner in the `design ui` step (2026-11-20): one direction, chosen as the only one drawn.

## Visitor mode
`read`, for every page of the surface (docs home, concept, guide, catalogue, skill, proof, limits). The visitor is a developer who lets Claude Code or Codex change real code and has come for one answer: what a command does, what a skill's rule is, where a limit lies. Most arrive from the search box onto one page, read it for minutes, copy a command and go back to a terminal. So the surface is measured in precision and restraint: a text column, a tree, a page outline, no showpiece. The pipeline drawing and every other mark of the promotional surface stay off these pages. One visitor mode, so there is no two-surface question.

## Topic inventory
Things that belong to this product's documents and not to a generic docs site (all found in the pinned repository at `b6d7f0ff`):
1. 28 skills, each opening with one rule ("One rule: a test that never failed for the right reason proves nothing").
2. 13 concept pages (workflow, gates, evidence, failover, night mode, roles ...).
3. Commands the reader types: `proofline init`, `/proofline run <TASK>`.
4. Classes and gate names written in capitals (`TRIVIAL` ... `CRITICAL`, `SECRETS`, `REVIEW_SMALL`).
5. GFM tables of 57 rows and more (limits, classes) that are wider than any column.
6. Turkish and English guide pairs joined by a `translated-from` line; the translation can fall behind.
7. The same "Shared rules" block at the end of every `SKILL.md`.
8. The pinned version and commit every page is taken from.
9. A Markdown address for every page and `/llms.txt` for agents.
10. "Real output": the lead's final message of a real run, as a code block.
These decide the layout: code and tables are common (copy buttons, sideways scroll), headings are long English names, and the tree must say which pages exist only in English.

## Idea
Not a persuade surface, so no rival test is required. The one idea is restraint with a reason: the page is the text, and the chrome is a tree, an outline and a footer that tell the reader where the text came from (version, source, Markdown). The marks of provenance sit on every page in the same place.

## Page structure
```
>= 1180px   header | tree (256) | text column | outline (216)
820-1179    header | tree (240) | text column; "On this page" opens as a panel above the text (button row)
< 820       header | button row: [Docs +] [On this page +] ... [search] | text; tree and outline are open/close menus
```
- Grid: the base's 20px gutters, max 1400px, column gap 48px (36px between 820 and 1179). The tree is `position: sticky; top: 0` with its own scroll; so is the outline. A 1px `--rule` line closes the tree on the right (above 819px).
- **Text column: `33em`** (about 560px at 17px). Measured on the sample at 1440px: the longest line of running text is 74 characters (workflow), 75 (Turkish guide), 69 (skill), 63 (catalogue). `75ch` is not used: `ch` is the width of a zero and gave lines of about 94 characters. Tables, code blocks and the catalogue may use the whole column between the tree and the outline (about 790px at 1440px).
- Order in the text column: stale notice (Turkish guides only), H1, "Taken from proofline v0.0.173", [skill pages: description, the rule, a Role and Version row], body, page foot (edit link, Markdown link), previous and next.
- No script: the tree and the outline show in order (tree, outline, text) as plain lists; the menu buttons, copy buttons, search button and the saved theme need `docs.js`.

## Typography use
Faces and weights from DESIGN.md. Reading comes first.

| Element | Face | Size (mobile / desktop) | Line height | Notes |
|---|---|---|---|---|
| Body | Stack Sans Text 400 | 17 / 17 | 1.65 | column `33em` |
| H1 (page title) | Stack Sans Headline 400 | 30 to 44 (`5.4vw`) / 44 | 1.12 | at most two lines; long names wrap (`overflow-wrap: anywhere`) |
| H2 | Stack Sans Headline 400 | 26 / 32 | 1.2 | a 1px `--rule` above, 2.1em above that |
| H3 | Stack Sans Text 500 | 20 / 20 | 1.35 | |
| H4 | Stack Sans Text 500 | 17 / 17 | 1.4 | |
| Skill description | Stack Sans Text 400 | 19 | 1.5 | first sentence of the front matter |
| Tree and outline | Stack Sans Text 400, 500 for the current page | 15 | 1.4 | group titles 13 `--muted` |
| Table | Stack Sans Text 400 | 15 | 1.5 | header cells 500 on `--surface` |
| Code, commands | JetBrains Mono 400 | 13 to 13.5 / 13.5 | 1.7 | inline code 0.88em |
| Skill names (tree, catalogue) | JetBrains Mono 400 or 500 | 13.5 to 14.5 | | they are what the reader types or searches |
Ratio of H1 to body is 2.6 (at least 2 for `read`). Sentence case everywhere; headings are the source headings, unedited. No letter-spacing change except H1 at -0.005em. Browser edges from tokens: selection (`--accent` ground, `--bg` text), caret (`--accent`), scrollbar (`--rule`), focus ring, link underline 1px with 3px offset (underline colour `--rule`, `currentColor` on hover), `tabular-nums` is not needed (no numeric columns of figures).

## Layout rules
- Hairlines only as separators of sections and rows (above each H2, between catalogue rows, around the Role/Version row, above the page foot). Boxes only where they hold something that scrolls or is pressed: code block, table, buttons, the stale notice, previous and next. Square corners, no shadow, no gradient, no cards.
- The current page in the tree has a 2px `--accent` bar on its left, weight 500 and a `--surface` ground: the state does not rest on colour alone. The same marks the current heading in the outline (`aria-current="true"`, set while scrolling).
- Pages that exist only in English are marked in the Turkish tree with a small mono tag `EN` (`lang="en"`); they are not links to a `/tr/` address (FR-17).
- **Skill page.** H1 is the skill name. Under it: the first sentence of `description` (19px), the rule line ("One rule: ...", `--muted`, the rule itself 500), then a Role and Version row (two label-over-value pairs between hairlines; Role is the first words of the `Role:` line, left out when a skill has none, Version from the front matter `metadata.version`). The `Role:` sentence is not repeated in the body. The "Shared rules" section, which every skill repeats, is a `<details>` folded by default: summary "Shared rules" (Turkish "Ortak kurallar") and the note "The same in every skill" ("Her skill'de aynı"); it keeps an id and a link in the outline.
- **Catalogue.** A definition list, one row per skill: name (mono, a link) on the left (150 to 200px), the first sentence of its description on the right; hairlines between rows; one column on a phone. No grouping (the role lines in the sources are not uniform). No cards, no icons.
- **Code block.** Full column width, `--install-bg` ground, 1px `--rule` border, horizontal scroll inside (`tabindex="0"` so it is keyboard scrollable), the copy button at the top right corner (44 by 44, `--rule` border on its left and bottom); the block's right padding keeps the first line clear of the button. Lines never wrap on desktop; below 720px they may wrap only where the source is a command (the base rule); long output scrolls.
- **Table.** In a `div` with `role="region"`, `tabindex="0"` and a label ("Table, scrolls sideways" / "Tablo, yana kaydırılır"); 1px border; header row on `--surface`; cells `min-width` 9 to 14ch; the table is as wide as it needs, never wider than the page.
- **Page foot.** One row of two text links ("Edit source", "Markdown version"; 44px high), then previous and next as two bordered links (small label "Previous" / "Next" over the page title; no arrows).
- **Heading anchors.** A `#` link after each heading, visible on hover and on keyboard focus, named "Link to this section".
- No hover-only information, no arrows on links, no icons beyond the base's header icons and the search icon, no emoji.

## Provenance (every page)
- "Taken from proofline v0.0.173" under the H1 (Turkish "proofline v0.0.173 sürümünden alındı"): the version from `docs/proof.md` or the pin's tag as ADR 0003 decides; the commit id is not shown here (FR-12 asks for the commit or tag; the tag is shown when the pin has one, otherwise the short commit, and the visitor never sees a blob id).
- "Edit source" / "Kaynakta düzenle": `https://github.com/furkansarikaya/proofline/edit/main/<repository path of the file>`. It opens the current file on `main`, which can be newer than the pinned text; that is intended (an edit is made against the source).
- "Markdown version" / "Markdown sürümü": the page address with `.md` (ADR 0003, point 6), `/docs/guides/daily-use.md`; the docs home links `/llms.txt`.
- Turkish guides: when the `translated-from` blob differs from the English file's blob at the pin (FR-18), a note above the H1: a `--surface` ground, a 2px `--muted` bar on its left (no colour alert: it is a note, `role="note"`), 15px. Text: "Bu çeviriden sonra İngilizce sayfa değişti, bu yüzden bu sayfa güncel olmayabilir. İngilizce metin esastır: Daily use." The English page's title is a link with `lang="en"`. No commit or blob id, no red, no icon, no dismiss button, the build is not failed.

## Search (ADR 0004)
- A button in the header after the menu links: icon, the word "Search" ("Ara") and the key `/`; accessible name "Search the docs. Shortcut: slash, or Control K" (Turkish "Belgelerde ara. Kısayol: eğik çizgi veya Control K"), `aria-keyshortcuts="/ Control+K Meta+K"`. Below 820px the button moves to the end of the "Docs / On this page" row as an icon only (DESIGN.md, header rule 8).
- `/` (not while typing in a field) and Control or Command with K open it on every docs page. `Esc` closes it and returns focus to the button.
- The panel is the Pagefind Component UI in a modal: a field with the placeholder "Search the docs", a close button, a one-line note, results with a small group name (Guides, Concepts, Skills) over the page title. The Turkish panel says in one line "Türkçe belgelerde aramak için yaz." and links to the English search (ADR 0004). The sample's panel is a stand-in; the real component's behaviour under the CSP is the search task's to prove (ADR 0004 follow-up).
- Without a script the docs home lists every page (ADR 0002) and the tree is the way in; the search button is not shown.

## Copy
| Place | English | Turkish |
|---|---|---|
| Tree title (name) | Documentation | Belgeler |
| Tree groups | Docs home, Skill catalogue, Guides, Concepts, Skills (28), Reference | Belgeler ana sayfası, Skill kataloğu, Kılavuzlar, Kavramlar, Skill'ler (28), Başvuru |
| Outline | On this page | Bu sayfada |
| Menu buttons | Docs, On this page | Belgeler, Bu sayfada |
| Skip link | Skip to the text | Metne geç |
| Copy button | Copy / Copied | Kopyala / Kopyalandı |
| Copy button name | Copy this code | Bu kodu kopyala |
| Copy refused (announced) | Could not copy; the code is selected, copy it by hand | Kopyalanamadı; kod seçildi, elle kopyala |
| Page foot | Edit source, Markdown version, Previous, Next | Kaynakta düzenle, Markdown sürümü, Önceki, Sonraki |
| Shared rules | Shared rules, "The same in every skill" | Ortak kurallar, "Her skill'de aynı" |
| Role, Version | Role, Version | Rol, Sürüm |
| Search no result | No page matches. | Eşleşen sayfa yok. |
Turkish pages follow DESIGN-marketing.md "Copy rules": Turkish sentences, technical terms and proofline's own names (skill, run, task, commit, pull request, CI ...) in English. Synced text is shown as the repository wrote it; this design translates nothing of it. A Turkish page lists English-only pages with the tag `EN` and no Turkish address (FR-17). Turkish letters (`ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü`) were checked in screenshots in both languages (the Turkish guide in light and dark, desktop and mobile, and the Turkish search panel).

## Responsive
| Width | Behaviour |
|---|---|
| >= 1180px | Tree, text, outline in three columns; outline highlights the heading in view. |
| 820 to 1179px | Tree and text; the outline is a panel opened by the "On this page" button (two columns of links), above the text; the "Docs" button is hidden (the tree is open). Search stays in the header. |
| < 820px | One column. Buttons "Docs" and "On this page" open and close the tree (max 70vh, scrolls) and the outline; search is an icon at the right end of that row. The header keeps brand and the GitHub, language, theme controls on its first row, menu links wrap on the second. Code and tables scroll sideways inside their boxes; the page itself never scrolls sideways (checked at 390px on all four sample pages: none). |
All targets are at least 44 by 44, except the plain text links of the site menu and of the tree and outline (their rows are 32 to 49px high); the base's 44px rule names header controls and the copy button, which meet it.

## States
| State | Behaviour |
|---|---|
| Page without script | Everything reads in order; the language link, tree, outline and menu links work; the system theme applies by CSS; theme, copy, search and menu buttons are hidden. |
| Copied | A polite live region says "Copied" / "Kopyalandı", the button shows a check mark for 1.8 seconds. A refused clipboard selects the code and the region says so (same as `controls.js`). |
| Menu open / closed | `aria-expanded` on the button; the panel keeps its place in the focus order. |
| Search open | Modal; focus in the field; results update as the visitor types; "No page matches." when empty. |
| Stale Turkish guide | The note above the title (see Provenance). |
| English-only page seen from Turkish | Marked `EN` in the tree; the language link on an English-only page goes to the Turkish docs home (DESIGN.md rule 3). |
| Reduced motion | There is no motion on the surface; the only transitions are none. `scroll-behavior` is not smooth when reduced motion is asked. |
| Empty, loading, error | Not applicable: the pages are static; a missing page is the site's not-found page (FR-19). |

## Accessibility
- WCAG 2.2 AA (NFR-6). Skip link first. Landmarks: header, two named `nav` regions (site, documentation tree, "On this page"), `main`. One H1 per page; headings keep their order (a skipped level in the source is the source's).
- Contrast, measured from the token values (WCAG 2.x, ratio): ink on `--surface` 12.65 light, 13.82 dark; `--muted` on `--surface` 4.51 light, 6.32 dark (the stale notice text is `--ink`, the tree group titles and the outline's third level are `--muted` on `--bg`, 5.07 and 6.93); ink on `--install-bg` 15.75 and 14.36; `--muted` on `--install-bg` 5.62 and 6.56; the 2px accent bar on `--bg` 4.10 and 6.61 (non-text, 3:1 needed). The `--muted` on `--surface` pair in light is the closest to the line: never use a smaller or lighter `--muted` there. Inline code ground (`--code-bg` over `--bg`) is not measured; its text is `--ink`.
- Focus: 2px `--accent` ring with 3px offset on every interactive element, including scroll regions of code and tables and the `summary` of folded sections.
- Names and announcements: the theme and language names as in DESIGN.md; the search button as above; the heading anchor "Link to this section"; copy announcements through the polite region; the folded "Shared rules" is a native `details`.
- Language: page `lang` is `en` or `tr`; an English page title inside a Turkish note, the `EN` tag and the English search link carry `lang="en"`; commands and run output carry their own `lang` when they differ from the page.
- Order of focus in the header: brand, menu links, search, GitHub, language, theme.

## Scripts (CI, ADR 0008)
A docs page loads `docs.js` and the search script and nothing else. `docs.js`: same origin, no inline script, no `async` or `defer`, at most **4096 bytes** uncompressed, in `<head>` so the theme is set before first paint. It does: remember the theme and keep the theme button's name current; copy buttons (class based, one handler for every block); the menu buttons (`aria-expanded`); the outline's current heading (IntersectionObserver); the `/` and Control or Command with K shortcut. The sample's file is 2806 bytes. CI checks the size and that no other script is on a docs page.

## New items (for the knowledge step)
| Item | Value | Reason | Existing item considered |
|---|---|---|---|
| `--install-bg` | `#e8e5df` light, `#121618` dark | ground of code blocks, one step off `--bg` so the block reads as a block without a shadow | `--frame` (`#e6e3dd`, `#111416`) is the diagram frame; its dark value is darker than the dark ground and was designed for the drawing, not for text blocks; same family, different job |
| `--code-bg` | `rgba(10,10,10,.07)` light, `rgba(232,228,220,.09)` dark | ground of inline code | `--surface` is too strong for a word-sized mark |
| `--measure` | `33em` | text column | none (see DESIGN.md step-body) |
| Breakpoint 1180px | | the outline needs a third column | 820 and 1000 leave a text column narrower than 33em at 1000 |
| Components | Docs layout, tree, outline, code block with copy, scroll table, catalogue list, stale notice, page foot, search button | the docs surface | the base's header, controls and icons are reused unchanged |
Planned paths: `src/layouts/docs/`, `src/components/docs/`, `public/assets/docs.js`, tokens in `src/styles/tokens.css`.

## Pattern justifications
- `hairline-newspaper`: the shared base (direction C) draws with 1px hairlines; here they only separate sections and rows (above each H2, between catalogue rows, around the Role and Version row, above the page foot), and boxes are limited to what scrolls or is pressed. No column rules, no boxed card grid.
- `mono-labels`: monospace appears for commands and code, for skill names (the reader types and searches them), for the `EN` tag, which is a language code, and for the key `/`; no other label is monospace.
- `eyebrow-label`: not used; the small group titles of the tree ("Guides", "Concepts") are ordinary sentence case labels that say what lies below.

## Gaps
- Nothing is built; every path above is planned.
- The docs home (`/docs/`, `/tr/docs/`) is not drawn in the sample. It follows these rules: the tree on the left, the text column holds one sentence of what the documents are, the `/llms.txt` link, then every page by group as plain lists (also the no-script way in, ADR 0002); the Turkish page lists the Turkish guides and links the English-only pages marked `EN`.
- The catalogue has no grouping because the sources' `Role:` lines are not uniform (some skills have none).
- The search panel is a stand-in. Pagefind's real component, its shortcut and its behaviour under the CSP of ADR 0006 are unproven (ADR 0004 follow-up).
- Inline code ground contrast is not measured. The `--muted` on `--surface` light pair is 4.51, barely over 4.5.
- The "Edit source" link points at `main`, which can differ from the pinned text.
- The Turkish "English page changed" note is shown in the sample on purpose; at `b6d7f0ff` the two Turkish guides match their English sources.
- The sample's tablet view (1000 wide, outline open) was captured once, before the last width change of the text column; it was not retaken.
