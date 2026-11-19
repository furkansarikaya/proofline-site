# 0008. Gate every change with one required CI check that builds twice, checks dist/, runs axe and Lighthouse, and verifies workflow permissions

Status: accepted
Date: 2026-11-19

## Context

The user asked for CI with build, tests, link check, accessibility and a performance budget ("CI (build, test, bağlantı kontrolü, erişilebilirlik, performans bütçesi)"). FR-13 and AC-16 need a check that blocks the sync PR; NFR-5 needs a named lab tool and profile; NFR-6 a named accessibility checker; NFR-8 least-privilege permissions; Q-5 (e) and (q) ask for the tools and for acceptance criteria of FR-10, NFR-1, NFR-5, NFR-7 and NFR-8.

## Decision

1. Workflows: `ci.yml` (`pull_request` and `push` to `main`; one job `verify`, shown as `ci / verify`, the only required check of the `main` ruleset), `sync.yml` (ADR 0003), `snapshot.yml` (ADR 0007). Each has a top-level least-privilege `permissions:` block; `ci.yml` has `contents: read`. `scripts/check-workflows.mjs` (yaml) fails on a missing or `write-all` block, on a secret other than `TRAFFIC_TOKEN` (snapshot only) and `GITHUB_TOKEN`, and on any trigger of `snapshot.yml` other than `schedule` and `workflow_dispatch`.
2. `npm run build` order: sync (fetch, verify, transform) -> `astro build` -> `pagefind --site dist` -> dist checks that need no browser. A failure at any stage fails the Vercel deployment too.
3. `verify` steps: `npm ci`; `node --test` (scripts, units, fixtures, `check-workflows`); build with `SITE_INDEXABLE=1` and build in closed mode, assert both indexing variants (ADR 0005); a second indexable build and a compare of the `dist/` hash (determinism); build with fake `GOOGLE_SITE_VERIFICATION`/`BING_SITE_VERIFICATION` values and assert AC-26 and that the value appears only inside its meta tag; `scripts/check-dist.mjs` (cheerio); Playwright Chromium (`npx playwright install --with-deps chromium`) against `scripts/serve-dist.mjs` for axe, CSP-violation listening and the Markdown 200 requests; `@lhci/cli` with the same Chromium.
4. `check-dist.mjs`: internal links and fragments resolve with the Vercel semantics (0 broken on site-written pages; fragments into synced pages warn); hreflang reciprocity, only on translated pages, equal to the sitemap entries; sitemap https only, lists every indexable page and no `/404.html` or `/pagefind/`; robots.txt per mode; title, description and og rules of ADR 0002; `llms.txt` lists every synced page and every listed `.md` exists; no `<script>` except Pagefind's on docs pages and the JSON-LD block on the home pages; no third-party host in `src`, `href` of resources or CSS; no `noreferrer` on repository links; no `style=`; no active HTML in synced content (ADR 0003); the 404 page has an `lang="en"` and a `lang="tr"` block with links to `/`, `/tr/`, `/docs/`, `/tr/docs/`; page counts equal the lock counts; AC-3 and AC-4 guards.
5. Accessibility (Q-5 e): Playwright + @axe-core/playwright 4.14.0 with `withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])`: gate on the four site pages in both languages; report-only on one synced guide, `/docs/`, `/tr/docs/` and one Turkish guide (NFR-6; findings filed to the proofline repository by hand). A written keyboard pass in the launch checklist. The PRD keeps its honest wording: an automated checker finds part of the issues.
6. Performance (Q-5 e): @lhci/cli 0.16.1, Lighthouse default mobile profile left unmodified (simulated Slow 4G, 4x CPU), `numberOfRuns: 5`, `aggregationMethod: median`; error assertions `largest-contentful-paint` <= 2500 and `cumulative-layout-shift` <= 0.1 on the four site pages (both languages) and one synced guide; `resource-summary:script:size` and `resource-summary:script:count` = 0 on the four site pages; `total-blocking-time` as a warn-level proxy; INP read from Search Console at the FR-30 evaluation. Script budgets for docs pages are set from the first measurement in the performance task, not invented now.
7. Launch-only checks in `npm run check:launch` (AC-28 over the committed old address list `ops/old-sitemap.txt`, AC-29 redirects, AC-36, AC-37, AC-38 as far as a script can see them, live robots.txt and headers); run by the owner at the checklist, never part of the build.

## Alternatives considered

- Build-only CI with checks run by hand: nothing would block a red sync PR (FR-13) or a CSP regression. Rejected.
- Hosted measurement (PageSpeed Insights API, Vercel checks integrations): needs a deployed URL and a key or a paid feature, and cannot run on a GitHub-token sync PR before the approval click. Rejected.
- pa11y (HTML_CodeSniffer runner) instead of axe: no WCAG 2.2 tag set named in the evidence; axe has `wcag22aa` and a Playwright binding. Rejected.
- Separate required checks per concern: more names to keep in the ruleset; one job keeps the ruleset and the approval click simple. Rejected; steps stay separately visible in the log.

## Consequences

- One Chromium binary serves axe and Lighthouse; CI time grows with three builds and five Lighthouse runs per URL (about 14 URLs); measured in the CI task, with timeouts from that measurement.
- Lab results are a lab check, not field data; INP stays "not available" until Search Console has data.
- The CI task sets the `main` ruleset (owner decision): required status check `ci / verify`, require a PR, no required approvals (a solo maintainer cannot approve his own PR), block force pushes. The check is picked from the list GitHub offers after the first run, so the stored context string is whatever GitHub shows for `ci / verify`.
- Proposed acceptance criteria for the PRD are listed in ARCHITECTURE.md (AC-41 to AC-47).

## Evidence

- verified (A4): lhci defaults (mobile, Slow 4G 150 ms / 1.6 Mbps, 4x CPU), `maxNumericValue`, `aggregationMethod` median, `numberOfRuns` default 3, `staticDistDir`, audit ids; INP has no lab value, TBT is a proxy.
- verified (A5): axe `wcag22aa` tag; @axe-core/playwright 4.14.0 API; "57% of WCAG issues automatically"; Playwright 1.65.1 and `install --with-deps`.
- verified (G1, G2): approval-required runs for GITHUB_TOKEN PRs; dispatch checks do not satisfy a required check.
- inferred: Lighthouse can drive Playwright's Chromium through `CHROME_PATH`; the required check context is the job name.
- unverified: CI duration (measured in the CI task).
