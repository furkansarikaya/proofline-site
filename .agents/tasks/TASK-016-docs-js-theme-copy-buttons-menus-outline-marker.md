# Task: TASK-016 - docs.js: theme, copy buttons, menus, outline marker and shortcuts

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-014
prd: site

---

## Goal

Every docs page loads one small same-origin script, `public/assets/docs.js` of at most 4096 bytes, that remembers the theme, runs the copy buttons, opens and closes the menu panels, marks the current heading in the outline and answers the search shortcuts, and the page reads fully without it.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: NFR-5 (script budget: pages load JavaScript only when a feature needs it), NFR-6 (keyboard and announcements), NFR-1 (no cookie, no counting script).

- Design: `/docs/design/DESIGN-docs.md` sections "Scripts (CI, ADR 0008)" (what the script does and its size limit), "States" (rows "Copied", "Menu open / closed", "Page without script", "Reduced motion"), "Search (ADR 0004)" (the `/` and Control or Command with K keys) and "Accessibility"; `/docs/design/DESIGN.md` section "Header controls (rules)", rules 2, 6 and 9 (theme behaviour, one script, scripts on docs pages). Approved sample: `/docs/design/references/docs-surface/docs.js` (2806 bytes) and `docs.css`, with `/docs/design/references/direction-c/controls.js` (1462 bytes) as the theme behaviour reference. A look and behaviour reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (point 2 and the amendment of 2026-11-20: same-origin file, synchronous in the head, no inline script body, reads no cookie, makes no request), `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` (point 4: script rules checked in `check-dist`; the final gate is TASK-030), `/docs/adr/0009-browser-checks-with-the-playwright-library-under-node-test.md`, `/docs/adr/0004-static-search-with-pagefind.md` (the search script is added by TASK-028; this script only answers the shortcut by pressing the search button when there is one).
- Today: the docs layout (TASK-014) renders the header with the theme button of TASK-005, the menu button row, the outline and the copy buttons of TASK-015, all hidden until the script adds the class `js` to the root element. This task writes the script and adds its `script` element to the docs layout head. The hooks (ids, data attributes, class names) are the ones TASK-005, TASK-014 and TASK-015 already render; this task does not rename them.
- Expected scope: `public/assets/docs.js`, `src/layouts/docs/DocsLayout.astro` (the script element in the head), `tests/docs-js.test.mjs`, `tests/browser/docs-js.mjs`, `tests/fixtures/docs/`. 5 paths.
- Browser checks follow ADR 0009 (`tests/browser/` and `npm run test:browser`, see TASK-014). Waits are events of the page (`waitForFunction`) and Playwright's fake clock for the 1.8 second return of the copy button; no real sleep is foreseen.

## Acceptance criteria

- AC-1: `public/assets/docs.js` is measured -> the file size it reports is at most 4096 bytes uncompressed.
  Covers: NFR-5
- AC-2: A built docs page (the English workflow page and the Turkish guide) is read -> its head holds exactly one `script` element, with `src="/assets/docs.js"`, no `async`, no `defer`, no inline body, and the body holds no script element; the page holds no `controls.js` reference.
  Covers: NFR-5, NFR-1
- AC-3: The script is read as text -> it holds 0 uses of `document.cookie`, `fetch`, `XMLHttpRequest`, `sendBeacon` and `eval`, and it calls `localStorage` only with the key `theme`.
  Covers: NFR-1
- AC-4: A docs page is opened with `localStorage.theme` set to `dark` while the system asks for light -> the root element carries `data-theme="dark"` when `DOMContentLoaded` fires, before any later script; with nothing saved the root element has no `data-theme` and the system setting decides by CSS.
- AC-5: The theme button is pressed on a page showing the light theme -> the root element carries `data-theme="dark"`, `localStorage.theme` equals `dark`, and the button's accessible name reads "Theme: dark. Switch to light" ("Tema: koyu. Açık temaya geç"); with nothing saved and the system setting changed, the name follows the new setting.
  Covers: NFR-6
- AC-6: A copy button is pressed with the clipboard permission granted -> the clipboard holds the text of that block's `code` element, a polite live region (`role="status"`) says "Copied" ("Kopyalandı"), the button shows a check mark, and after 1.8 seconds of the fake clock the check mark and the message are gone.
  Covers: NFR-6
- AC-7: A copy button is pressed with the clipboard refused -> the text of the block is selected and the live region says "Could not copy; the code is selected, copy it by hand" ("Kopyalanamadı; kod seçildi, elle kopyala").
  Covers: NFR-6
- AC-8: The "Docs" and "On this page" buttons are pressed at 390 px -> each toggles `aria-expanded` between `false` and `true` and opens or closes its panel (the tree, at most 70vh and scrolling; the outline); the panel stays in the focus order; the button is announced with its state.
  Covers: NFR-6
- AC-9: The page is scrolled so that a different heading of the fixture reaches the top quarter of the window at 1440 px -> the outline link of that heading carries `aria-current="true"`, no other outline link carries it, and when the heading is a third-level one its link is the one marked.
- AC-10: The key `/` is pressed outside a field, and then Control+K, and then Meta+K, on a page whose header holds a search button -> the button is pressed each time; the key `/` typed inside an input or textarea does nothing; on a page with no search button the keys do nothing and the browser default is not prevented.
  Covers: NFR-6
- AC-11: A docs page is opened with `docs.js` blocked -> the tree, outline and text read in order, the menu, copy, theme and search buttons are not visible, the system theme applies by CSS, and the language link and tree links work.
  Covers: NFR-6
- AC-12: Failure criterion (anti-goal): the task is not done if `docs.js` is larger than 4096 bytes, if it is loaded with `async` or `defer` or from another host, if the theme flashes (the page paints before the root element gets the saved `data-theme`), if the copied text includes the button label, or if the script throws on a page that has no outline, no copy button or no search button, even when the page looks right with a mouse.

## Out of scope

- The search button, the Pagefind panel, `Esc` handling inside it and the search script (TASK-028).
- The markup of the copy buttons, tables and tree (TASK-014, TASK-015); the header theme button (TASK-005).
- `controls.js` of the four site pages (TASK-005).
- The CI gate on "docs pages carry `docs.js` and the search script only" and the byte count over the built output (TASK-030); this task tests its own page and file.
- Any analytics, counting or storage other than the theme key.

## Constraints

- Expected test exception: none; each behaviour has a browser RED. The real clipboard of a user's operating system is not exercised: tests grant or deny the permission in Chromium.
- Same origin, in the head, synchronous, no inline script body (ADR 0006 amendment; `/docs/design/DESIGN.md`, header rule 9); size limit 4096 bytes from `/docs/design/DESIGN-docs.md` "Scripts (CI, ADR 0008)".
- The script does what `controls.js` does for the theme, so the theme behaviour of `/docs/design/DESIGN.md` rule 2 is the contract (saved choice wins; with no saved choice the page follows the system, also when it changes).
- Plain browser JavaScript, no dependency, no build step for the file.
- No reduced-motion work is needed: the surface has no motion (`/docs/design/DESIGN-docs.md`, "States").

## Risks

- 4096 bytes leave about 1290 bytes over the sample's 2806; the search wiring of TASK-028 must fit in what remains or use its own script.
- The hooks of three tasks are read here by name; a renamed id in TASK-005 or TASK-015 silently turns a button into a dead button, so the browser test presses the real buttons of the built fixture page.
- `IntersectionObserver` marks the heading by a root margin; very short sections near the page end may never reach the marked band and leave the previous link marked.
- A clipboard permission prompt differs between browsers; only Chromium is tested.

## Pre-existing defects

none

## Suggested class

STANDARD - one new script file and a one-line layout change, confined to the docs surface; no integration, no persistence beyond the theme key (COMPLEX considered: it reads hooks of three tasks)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:browser`
