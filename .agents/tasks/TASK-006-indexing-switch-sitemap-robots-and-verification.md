# Task: TASK-006 - Indexing switch, sitemap, robots and verification tags

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-004
prd: site
---

## Goal

The build opens the site to search engines only when it is a production build or is explicitly told so, and then publishes an https sitemap with reciprocal `hreflang` entries, a `robots.txt` that allows all, canonical addresses and the optional ownership verification tags; in every other build the whole site stays closed, and each build says in its log which mode it chose.

## Context

- Source requirements in `/docs/product/site/PRD.md`: FR-21 (sitemap, robots, canonical https addresses, reciprocal hreflang only for translated pages), FR-23 and FR-24 (verification tags from the environment, log lines without values), NFR-3 (no secret or verification value in a log line), and the user stories AC-26, AC-32, AC-33, AC-46.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` point 3 (own sitemap endpoint reading the translation index, not `@astrojs/sitemap`), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 3 (sitemap without `lastmod`), `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` (closed previews), `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 3 (both indexing variants asserted in CI, TASK-033).
- Existing (TASK-001 closed mode): `src/layouts/Base.astro` prints `<meta name="robots" content="noindex, nofollow">` on every page; `public/robots.txt` holds `User-agent: *` and `Disallow: /`; no sitemap exists; `tests/site.test.mjs` asserts these.
- Expected scope (8 paths): `src/lib/indexing.ts`, `src/layouts/Base.astro`, `src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts`, `public/robots.txt` (removed, replaced by the endpoint), `astro.config.mjs` (the build-log lines), `tests/indexing.test.mjs`, `tests/site.test.mjs` (only if an assertion needs the new log lines).
- Facts: the production origin is `https://proofline.technology`; the Bing verification meta tag is named `msvalidate.01` and the Google one `google-site-verification` (the names the two consoles define).
- Assumption: the verification tags are printed in the head of every HTML page (the layout is shared), and independently of the indexing mode.
- Assumption: the log lines are `indexing: blocked (` + a reason + `)` and `indexing: allowed`, and one line per console `verification tag: present (google)`, `verification tag: absent (google)`, `verification tag: present (bing)`, `verification tag: absent (bing)`; the PRD sets the text "verification tag: present|absent" and the service name in parentheses is added to tell the two apart.
- Assumption: only the value `1` of `SITE_INDEXABLE` opens the site; any other value (empty, `0`, `true`) leaves it closed.
- Assumption: the canonical link is printed only in an indexable build, on every page except the not-found page.

## Acceptance criteria

- AC-1: The site is built without `VERCEL_ENV=production` and without `SITE_INDEXABLE=1` -> every built page holds `<meta name="robots" content="noindex, nofollow">`, `dist/robots.txt` holds `User-agent: *` and `Disallow: /`, `dist/sitemap.xml` does not exist, and the build log holds one line `indexing: blocked (` followed by a reason that names `VERCEL_ENV` and `SITE_INDEXABLE` and `)`.
  Satisfies: AC-46.
  Covers: FR-21
- AC-2: The site is built with `VERCEL_ENV=production` -> 0 built pages hold a `robots` meta tag, `dist/robots.txt` allows all agents and points to `https://proofline.technology/sitemap.xml`, `dist/sitemap.xml` exists, and the log holds the line `indexing: allowed`.
  Satisfies: AC-46, AC-32.
  Covers: FR-21
- AC-3: The site is built with `SITE_INDEXABLE=1` and `VERCEL_ENV` unset, and again with `VERCEL_ENV=preview` and `SITE_INDEXABLE=1` -> both builds produce the same indexable output as AC-2; with `VERCEL_ENV=preview` alone, or `SITE_INDEXABLE` set to `0`, `true` or empty, the output is the closed output of AC-1.
  Satisfies: AC-46.
  Covers: FR-21
- AC-4: An indexable build is read -> `sitemap.xml` lists exactly the built HTML pages except `404.html`, the `pagefind` files and the Markdown copies, every address starts with `https://proofline.technology/` and ends with a slash, the file holds 0 `http://` addresses, and no entry has a `lastmod` element.
  Satisfies: AC-32.
  Covers: FR-21
- AC-5: An indexable build with the pair `/` and `/tr/` is read -> the sitemap entry of `/` lists `xhtml:link` alternates for `en`, `tr` and `x-default` and the entry of `/tr/` lists the same three, the alternates equal the `link rel="alternate"` tags of the same page, and a page with no pair has 0 alternates in the sitemap and 0 in its head.
  Satisfies: AC-33.
  Covers: FR-21
- AC-6: An indexable build is read -> every page except `404.html` holds exactly one `link rel="canonical"` whose address is the page's own `https://proofline.technology/` address, and a closed build holds 0 canonical links.
  Covers: FR-21
- AC-7: The site is built with `GOOGLE_SITE_VERIFICATION` set to a test value and with it empty -> the first build puts `meta name="google-site-verification"` with that value in the head of every HTML page and logs `verification tag: present (google)`; the second prints no such tag and logs `verification tag: absent (google)`; the same pair of results holds for `BING_SITE_VERIFICATION` with the tag `msvalidate.01` and the lines `(bing)`.
  Satisfies: AC-26.
  Covers: FR-23, FR-24
- AC-8: A build runs with both variables set to distinct test values -> no line of the build's standard output or error output holds either value, and in `dist/` each value appears only inside its own verification meta tag (0 matches in `sitemap.xml`, `robots.txt`, scripts and styles).
  Satisfies: AC-26.
  Covers: NFR-3, FR-24
- AC-9: A closed build and an indexable build both run with `GOOGLE_SITE_VERIFICATION` set -> both builds print the google verification tag in the head of every page, so the tags depend on the two variables only and not on the indexing mode.
  Covers: FR-23
- AC-10: Failure criterion (anti-goal): the task is not done if a closed build writes a sitemap or leaves any page without the `noindex` tag, if an indexable build leaves `noindex` on any page, if a log line holds a verification value, or if the sitemap alternates and the page tags disagree, even when every test of TASK-001 is green.

## Out of scope

- The check of the sitemap against all pages written later (TASK-029) and the CI assertion of both variants (TASK-033).
- The DNS record and the console verification (TASK-046), the launch-day sitemap submission (TASK-049).
- `vercel.json` and the Markdown content type (TASK-027); the search index files under `/pagefind/` (TASK-028).
- The translation index and the `hreflang` tags in the head, which TASK-004 provides; this task reuses them.

## Constraints

- ADR 0002 point 3: the sitemap is an own Astro endpoint that reads the translation index, so the sitemap and the page tags cannot drift.
- ADR 0003 point 3: the sitemap has no `lastmod` (build determinism, AC-47 of the PRD).
- ADR 0001: no dependency is added; the sitemap is not produced by `@astrojs/sitemap`.
- The closed mode of TASK-001 stays the default when no variable is set (a preview build must never be indexable).

## Risks

- `VERCEL_ENV` is set by the hosting only on its own builds; a local production-like check needs `SITE_INDEXABLE=1`.
- The sitemap lists the pages that exist when it is built, so pages added by later tasks appear without a change here; TASK-029 compares it with the full page set.
- Removing `public/robots.txt` for an endpoint changes where the file comes from; AC-1 and AC-2 assert the built file in both modes.

## Pre-existing defects

none

## Suggested class

COMPLEX - public contract (sitemap, robots, hreflang and canonical addresses that search engines read) across the layout, two endpoints and the build configuration

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
