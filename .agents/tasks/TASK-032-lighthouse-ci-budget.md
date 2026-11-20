# Task: TASK-032 - Lighthouse CI budget

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-011
  - TASK-019
  - TASK-021
  - TASK-022
  - TASK-023
  - TASK-027
prd: site

---

## Goal

The required check `ci / verify` runs Lighthouse CI with its default mobile profile and fails when Largest Contentful Paint exceeds 2500 ms or Cumulative Layout Shift exceeds 0.1 on the four site pages in both languages and on one synced guide, or when a site page loads more than one script.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: NFR-5 (the lab part), and the criterion AC-43.

Launch scope decision, in the product owner's words:

> 035 ve 036 (otomatik sync PR'ı), 037, 038 ve 039 (trafik anlık görüntüsü) ve 032 (Lighthouse bütçesi) yayından sonraya ertelensin: task olarak yazılsın ama "post-launch" etiketiyle ve lansman task'larının (047 ve sonrası) bağımlılıklarından çıkarılsın. Yayından önce proofline sürümü elle güncellenir.

PRD section "Launch scope decision (2026-11-20)", L-1 and L-2 (b): the lab check is not run before the launch; AC-43 is checked when this task is done. This task is no dependency of any launch task.

- ADRs: `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 6 (tool `@lhci/cli` 0.16.1, default mobile profile unmodified, `numberOfRuns: 5`, `aggregationMethod: median`, error assertions, the proxy `total-blocking-time` at warn level) and point 3 (one Chromium for axe and Lighthouse), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` point 5 (Lighthouse sees the real CSP through `scripts/serve-dist.mjs`), `/docs/adr/0009-browser-checks-with-the-playwright-library-under-node-test.md` (the check is a `node:test` file run by its own npm script).
- Today: `.github/workflows/ci.yml` step `performance slot` prints the line "performance checks skipped: the Lighthouse budgets arrive with the performance task" and is the last step (TASK-001 AC-8, AC-10); `tests/site.test.mjs` has the test "performance slot prints the skip line and no Lighthouse package exists" that asserts no `lighthouse` or `@lhci` package in `package.json` and `package-lock.json`; `.gitignore` has no `.lighthouseci/`.
- New dependency: `@lhci/cli` 0.16.1, exact (ADR 0008; it needs Node 22.19.0 or newer, Node 24.x is used).
- The pages (9 addresses, 5 runs each): `/`, `/tr/`, `/get-started/`, `/tr/baslarken/`, `/trust/`, `/tr/guven/`, `/claude-code-and-codex/`, `/tr/claude-code-ve-codex/` and one synced guide `/docs/guides/daily-use/`.
- Expected scope: `package.json`, `package-lock.json`, `lighthouserc.json` (new), `tests/lighthouse.mjs` (new, runs the real measurement), `tests/lighthouse-config.test.mjs` (new, parses the config), `tests/site.test.mjs` (the performance-slot test is rewritten), `.github/workflows/ci.yml`, `.gitignore`. 8 paths.
- The docs-page script budget of ADR 0008 point 6 ("set from the first measurement in the performance task") is only measured and printed here; no assertion is set for it (listed under Out of scope).
- Label: `post-launch`.

## Acceptance criteria

- AC-1: `package.json` and `package-lock.json` are read -> `@lhci/cli` is declared as a dev dependency with the exact version `0.16.1` and the lock resolves it to `0.16.1`.
  Covers: NFR-5
- AC-2: `lighthouserc.json` is parsed -> it lists the 9 addresses above, sets `numberOfRuns` to 5 and `aggregationMethod` to `median`, and holds none of the keys `preset`, `formFactor`, `screenEmulation`, `throttling`, `throttlingMethod`, `emulatedUserAgent` (the default mobile profile stays unmodified).
  PRD ids: AC-43.
  Covers: NFR-5
- AC-3: `lighthouserc.json` is parsed -> for the 9 addresses it sets the assertion `largest-contentful-paint` with `maxNumericValue` 2500 and the assertion `cumulative-layout-shift` with `maxNumericValue` 0.1, both at level `error`.
  PRD ids: AC-43.
  Covers: NFR-5
- AC-4: `lighthouserc.json` is parsed -> for the 8 site-page addresses it sets the assertion `resource-summary:script:count` with `maxNumericValue` 1 and `resource-summary:script:size` with `maxNumericValue` 2048, both at level `error`, and `total-blocking-time` at level `warn`.
  PRD ids: AC-43.
  Covers: NFR-5
- AC-5: `npm run test:lighthouse` is run on a built `dist/` served by `scripts/serve-dist.mjs` with the headers of `vercel.json`, with the Chromium of Playwright -> it measures every address 5 times, compares the median with the assertions and exits 0 when all pass.
  PRD ids: AC-43.
  Covers: NFR-5
- AC-6: The same command is run with a copy of the config whose LCP limit for `/` is 1 ms -> it exits non-zero and prints the address, the audit name, the limit and the median value.
  Covers: NFR-5
- AC-7: `.github/workflows/ci.yml` is read -> the step named `performance slot` is still the last step of `verify`, runs `npm run test:lighthouse`, prints no skip line, and has neither `continue-on-error` nor `if`; the other step names and their order are unchanged.
  PRD ids: AC-43.
- AC-8: `.github/workflows/ci.yml` is read -> `timeout-minutes` of `verify` is greater than the longest of at least two measured durations of the full workflow, and a comment next to it names those runs by id and their durations.
- AC-9: `tests/site.test.mjs` is run -> the performance-slot test no longer asserts that Lighthouse is absent, asserts the skip line is gone and asserts `@lhci/cli` is present, and the full test run passes.
- AC-10: Failure criterion (anti-goal): the task is not done if the config overrides the default mobile profile, if an assertion is `warn` where AC-3 says `error`, if the median is replaced by the mean or a single run, if Lighthouse is run against a server without the `vercel.json` headers, or if `ci / verify` goes green while a budget is exceeded.

## Out of scope

- INP: it has no lab value and is read from Search Console at the evaluation (TASK-050).
- A budget or an assertion for docs pages (script count and size of `docs.js` and the search script); the first measurement of `/docs/guides/daily-use/` is printed in the log only.
- Axe and the CSP checks (TASK-030, TASK-031); the "exactly 1 script" and the 2048-byte size are asserted exactly by TASK-030, Lighthouse measures transfer size.
- Any change to the page design to meet a budget (a failing budget is reported to the page task).
- Hosted measurement (PageSpeed Insights, Vercel integrations), rejected in ADR 0008.

## Constraints

- Expected test exception: the real measurement cannot be replaced by a fake; five Lighthouse passes per address run only in CI and on a developer machine with Chromium. Tested instead: the config file (AC-1 to AC-4, AC-7, AC-8) and the exit behaviour (AC-6).
- ADR 0008 point 6 names the tool, the version, the profile, the run count and the aggregation; the user did not change them.
- ADR 0001: exact version; plain `.mjs`.
- `ci.yml` is the required check; CRITICAL is considered (see Suggested class).

## Risks

- ADR 0008 marks it inferred that Lighthouse can drive the Playwright Chromium through `CHROME_PATH`; if it cannot, the plan returns BLOCKED naming the error.
- Five runs on 9 addresses make `verify` longer; AC-8 sets the timeout from measured runs, and the 5-minute value of TASK-002 will probably not hold.
- Lab values vary between runner machines; the median of 5 reduces but does not remove this, and a borderline page can turn the required check red without a code change.
- Because the task is post-launch, the site goes live without the lab check (PRD L-2 b).

## Pre-existing defects

none

## Test exceptions

- measure: `tests/lighthouse.mjs` -- runs five real Lighthouse passes per address against the served build and compares the median; no clock or fake can stand in for the measurement itself

## Suggested class

COMPLEX - new dependency and a change to the required-check workflow `ci.yml` (CRITICAL considered: read-only permissions, no secret, no deploy)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:lighthouse`

## Labels

post-launch
