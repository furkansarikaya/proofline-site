# 0009. Run browser checks with the Playwright library under node:test

Status: accepted
Date: 2026-11-20

## Context

ADR 0001 fixes "`node --test` for scripts and units, Playwright for browser checks"; ADR 0008 names Playwright
1.65.1 and `@axe-core/playwright` 4.14.0 and runs axe against `scripts/serve-dist.mjs`, but neither decides
which Playwright harness runs the browser checks. TASK-001 AC-7 needs axe on `/` and `/tr/` plus a failing
fixture, AC-10 runs `node --test` before `build` and axe as a later, separate step, and the COMPLEX scope bound
is 15 paths (`.agents/config.yaml` `pipelines.COMPLEX.max_scope_paths`). Later browser checks (CSP-violation
listening, the Markdown 200 requests of ADR 0008) will follow whatever harness the skeleton sets up.

## Decision

Browser checks are `node:test` files that drive Chromium through the `playwright` library (`import { chromium }
from 'playwright'`) and `AxeBuilder` from `@axe-core/playwright`, against `scripts/serve-dist.mjs`. They live in
`tests/` under names that the default `node --test` discovery does not match (`tests/axe.mjs`) and run only
through their own npm script (`npm run test:axe` = `node --test tests/axe.mjs`). No `@playwright/test`
dependency and no `playwright.config.*` file.

## Alternatives considered

- Playwright Test runner (`@playwright/test` 1.65.1, `playwright.config.mjs`, `npx playwright test`): reporters,
  retries, traces and parallel workers; but one more dependency and one more config file, a second test
  runner beside `node:test`, and its default `testMatch` (`*.test.*`, `*.spec.*`) also matches the
  `node --test` files, so the config must exclude them. Rejected for the skeleton: two pages and one fixture
  need none of its features.
- Browser checks inside the default `node --test` run: one command, but AC-10 runs `node --test` before
  `build` and axe after the link check, and the run would need `dist/` and Chromium before the build step.
  Rejected (AC-10).

## Consequences

- Easier: one test runner and one assertion library for every test; one file per browser check; no runner
  config to keep in sync with `node --test` discovery.
- Harder: no Playwright trace viewer, HTML report or built-in retries; a browser check prints its own
  diagnostics (axe rule ids and targets). If later browser checks need traces or parallel workers, a new ADR
  supersedes this one and adds `@playwright/test` with a `testMatch` that excludes the `node --test` files.
- Follow-up: the CI task adds CSP-violation listening and the Markdown requests as further `node:test` browser
  files with the same server and launch pattern.

## Evidence

- verified (2026-11-20, `npm view`): `playwright@1.65.1` exports `.` (library) and `./test`; depends on
  `playwright-core` 1.65.1; `@axe-core/playwright@4.14.0` peer `playwright-core >= 1.0.0`, ESM export
  `./dist/index.mjs`.
- verified (2026-11-20, Node v24.14.1): default `node --test` discovery runs `tests/site.test.mjs` and does not
  run `tests/axe.mjs` or `scripts/*.mjs`; `node --test tests/axe.mjs` runs the named file.
- verified (2026-11-20, TASK-001): `AxeBuilder` accepts a `Page` from the `playwright` library; `npm run test:axe` finds 0 violations on `/` and `/tr/` and rejects a fixture page with `image-alt`.
