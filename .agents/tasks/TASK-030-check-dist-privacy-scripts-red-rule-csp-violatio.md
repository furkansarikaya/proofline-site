# Task: TASK-030 - check-dist: privacy, scripts, red rule, CSP violations

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-005
  - TASK-016
  - TASK-018
  - TASK-027
prd: site

---

## Goal

Two checks prove the privacy and script rules of the site on the built output: a static check over `dist/` (cookies, hosts, scripts, the red of the blocked slab, secrets) and a browser check against the local server with the real headers (no Content-Security-Policy violation, no cookie, and a page that still works without the controls script).

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: NFR-1, NFR-3, and the criteria AC-42 and N-5 (N-5 is the note of the promotional design step on the controls script).

- ADRs: `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (points 1, 2, 3, 5 and the amendment of 2026-11-20), `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 4 (script rules of `check-dist.mjs`) and its amendment (the blocked-script case), `/docs/adr/0009-browser-checks-with-the-playwright-library-under-node-test.md` (browser checks are `node:test` files run by their own npm script).
- Design: `/docs/design/DESIGN-marketing.md` rule R-1 ("The red is only the blocked slab": the values `#c4152b` light and `#e0354a` dark appear only in the diagram rule), `/docs/design/DESIGN.md` section "Header controls (rules)" (the script-only buttons stay hidden without script) and `/docs/design/DESIGN-docs.md` section "Scripts (CI, ADR 0008)" (docs pages carry `docs.js` and the search script only, `docs.js` at most 4096 bytes).
- Today: `scripts/check-dist.mjs` has `links`, `compare`, `determinism`; `tests/axe.mjs` shows the Playwright pattern (server start, `chromium.launch`); `scripts/serve-dist.mjs` serves the real headers after TASK-027; the controls script `public/assets/controls.js` comes from TASK-005, `docs.js` from TASK-016, the diagram rule from TASK-018.
- New commands: `node scripts/check-dist.mjs privacy dist` with the npm script `check:privacy`, and `node --test tests/csp.mjs` with the npm script `test:csp`; TASK-033 puts both into `ci.yml`.
- The four site pages are `/`, `/get-started/`, `/trust/`, `/claude-code-and-codex/` and their Turkish pairs `/tr/`, `/tr/baslarken/`, `/tr/guven/`, `/tr/claude-code-ve-codex/` (ADR 0002 address table). Docs pages are every page under `/docs/` and `/tr/docs/`.
- Expected scope: `scripts/check-dist.mjs`, `scripts/lib/dist-privacy.mjs` (new), `tests/privacy.test.mjs` (new), `tests/fixtures/privacy/` (new), `tests/csp.mjs` (new, browser), `package.json`. 6 paths.
- Assumption: the red rule of R-1 is read as follows: an occurrence of `#c4152b` or `#e0354a` in built CSS is allowed as the declaration of the custom property `--block` and inside a rule whose selector belongs to the diagram component; `var(--block)` is allowed only in that same diagram rule. TASK-018 names the diagram class; the check holds it as one constant.
- Assumption: the pages that have a copyable install command are found by the marker that TASK-005 gives the copyable command component.

## Acceptance criteria

- AC-1: A file of `dist/` holds `document.cookie` -> `privacy` exits 1 and names the file; a `dist/` with 0 uses exits 0.
  PRD ids: NFR-1, AC-42.
  Covers: NFR-1
- AC-2: A page of `dist/` has a `script src`, `link href` (stylesheet, icon, preload), `img src`, `srcset` or a CSS `url()` or `@import` that names a host other than `proofline.technology`, or a built `.js` file holds such an address in a `fetch` or `import` -> `privacy` exits 1 and names file and address; a plain link `<a href="https://github.com/furkansarikaya/proofline">` passes.
  PRD ids: NFR-1, AC-42.
  Covers: NFR-1
- AC-3: Each of the 8 pages of the four site pages is read -> it holds exactly 1 `script` element that executes, `src="/assets/controls.js"`, inside `head`, with no `async` and no `defer` attribute and an empty body, and `dist/assets/controls.js` is 2048 bytes or less; the `application/ld+json` block of the two home pages is not counted.
  PRD ids: N-5.
  Covers: NFR-1
- AC-4: Every docs page is read -> its executing scripts are exactly `/assets/docs.js` (in `head`, no `async`, no `defer`, no inline body, 4096 bytes or less) and one script whose `src` starts with `/pagefind/`; any other script, or an inline script body, makes `privacy` exit 1 and name the page.
  Covers: NFR-1
- AC-5: Any page outside the two classes of AC-3 and AC-4 (for example `404.html`) holds a script other than `/assets/controls.js` -> `privacy` exits 1 and names the page.
  Covers: NFR-1
- AC-6: A page of `dist/` has a `style=` attribute or an inline `style` element -> `privacy` exits 1 and names the page.
- AC-7: A repository link (`https://github.com/furkansarikaya/proofline`) on a page carries `rel` containing `noreferrer` -> `privacy` exits 1 and names the page and the link.
- AC-8: The built CSS holds `#c4152b` or `#e0354a` (case-insensitive) outside the cases of the assumption above, or `var(--block)` outside the diagram rule -> `privacy` exits 1 and names the file, the selector and the value; a tree where both values appear only as the `--block` declarations and in the diagram rule exits 0.
- AC-9: The build is run with `GITHUB_TOKEN` and `GH_TOKEN` set to the sentinel values `ghp_sentinel0123456789` and `github_pat_sentinel0123456789` -> neither value appears in any file of `dist/` nor in the captured build log; and a file of `dist/` holding a string that starts with `ghp_` or `github_pat_` makes `privacy` exit 1 and name the file.
  PRD ids: NFR-3.
  Covers: NFR-3
- AC-10: `tests/csp.mjs` loads each of the 8 pages of the four site pages, `/docs/`, `/tr/docs/`, one synced guide, one Turkish guide and a path that answers 404, each with `colorScheme` light and dark, through `scripts/serve-dist.mjs` with the headers of `vercel.json` -> it records 0 `securitypolicyviolation` events (the listener is installed before the first navigation), 0 `Set-Cookie` response headers and an empty cookie jar at the end.
  PRD ids: AC-42.
  Covers: NFR-1
- AC-11: `tests/csp.mjs` serves a fixture page with an inline `script` through the same server and headers -> the listener records 1 violation and the test reports it as a failure (the self-test proves the listener can fail).
  PRD ids: AC-42.
- AC-12: `tests/csp.mjs` blocks the request for `/assets/controls.js` and loads each of the 8 pages with `colorScheme` light and with dark -> the page background colour differs between the two schemes and equals the token value of each scheme of `/docs/design/DESIGN.md`, the theme button and the copy button are hidden, and the text of the install command on the pages that have one can be selected by triple click.
  PRD ids: N-5.
  Covers: NFR-1
- AC-13: Failure criterion (anti-goal): the task is not done if a check passes on an empty `dist/` (`privacy` must exit 1 with "privacy: no pages found"), if the violation listener is attached after navigation, if a rule has no failing fixture in `tests/fixtures/privacy/`, or if the browser check runs against a server without the `vercel.json` headers, even when the unit tests are green.

## Out of scope

- The title, query, count, hreflang and sitemap checks (TASK-029) and the axe run (TASK-031).
- The Lighthouse measure of the script count (TASK-032, post-launch); this task checks the exact count statically.
- The Pagefind widget under the CSP (TASK-028 proves it; this task only allows its script on docs pages).
- Putting the commands into `.github/workflows/ci.yml` (TASK-033).
- The verification meta-tag value check (TASK-006).

## Constraints

- ADR 0006 and ADR 0008 are accepted: the script rules, the allowed JSON-LD block and the blocked-script case are as written there.
- ADR 0009: the browser check is a `node:test` file with the `playwright` library; its name keeps it out of default `node --test` discovery; no `@playwright/test`.
- ADR 0001: no new dependency.
- The checks read `dist/` and the served site only; they make no request to a host outside the machine.

## Risks

- The red rule depends on the selector of the diagram component, which TASK-018 owns; a rename there fails AC-8 until the constant follows.
- A strict listener can report a violation caused by a browser extension; the run uses a fresh Chromium without extensions.
- The sentinel build of AC-9 repeats a full build, so the test is long; the plan sets its timeout from a measured run.

## Pre-existing defects

none

## Suggested class

COMPLEX - two new checks that gate privacy and script rules (static and browser), 3 modules; hosting headers are read, not changed (CRITICAL considered: no secret is stored, sentinels only)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:privacy`
- `npm run test:csp`
- `npm run check:links`
- `npm run test:axe`
