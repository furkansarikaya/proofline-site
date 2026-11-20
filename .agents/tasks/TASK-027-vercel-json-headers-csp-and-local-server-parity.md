# Task: TASK-027 - vercel.json headers, CSP and local server parity

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-002
prd: site

---

## Goal

The hosting configuration (`vercel.json`) carries the build command, the trailing-slash rule, the strict header set of ADR 0006, and the local server used by the build checks answers with the same headers and the same routing, so that the Content-Security-Policy a check sees is the one the visitor gets.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-20 (the config part only: the cutover itself is TASK-047), NFR-1, AC-42.

- ADRs: `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` point 1 (`vercel.json` content), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` points 2, 3 and 5 and its amendment of 2026-11-20 (the controls script needs no CSP change), `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 4 (the checker reads the headers), `/docs/adr/0001-astro-static-site-and-toolchain.md` (exact versions, Node 24.x).
- Today: there is no `vercel.json`. `scripts/serve-dist.mjs` serves `dist/` with 308 for a directory without slash and a 404 response with the body of `404.html`; its header comment says "Vercel header rules are out of scope" (`scripts/serve-dist.mjs:5`), so no response carries a header other than `Content-Type` and `Content-Length`, and `.md` files get `application/octet-stream` (no entry in `TYPES`). `package.json` has `engines.node` `24.x`.
- The `'wasm-unsafe-eval'` source in `script-src` is taken from ADR 0006 as written; TASK-028 proves whether Pagefind needs it and removes it if not.
- Expected scope: `vercel.json`, `scripts/serve-dist.mjs`, `tests/vercel.test.mjs` (new), `tests/fixtures/vercel/` (new, fixture configs). 4 paths.
- TASK-002 is a dependency because it pins the workflow file this task's tests run next to; this task does not edit `ci.yml`.

## Acceptance criteria

- AC-1: `vercel.json` is parsed -> it is valid JSON holding `buildCommand` `npm run build`, `outputDirectory` `dist` and `trailingSlash` `true`.
  Covers: FR-20
- AC-2: `vercel.json` is parsed -> its top-level keys are exactly `buildCommand`, `outputDirectory`, `trailingSlash` and `headers` (no `git`, `redirects` or `rewrites` key, so no old address is redirected).
  Covers: FR-20
- AC-3: `vercel.json` is parsed -> its header rule for source `/(.*)` holds the four headers `Content-Security-Policy` with the exact value `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, `X-Content-Type-Options` `nosniff`, `Referrer-Policy` `strict-origin-when-cross-origin` and `Permissions-Policy` `camera=(), microphone=(), geolocation=()`.
  PRD ids: AC-42.
  Covers: NFR-1
- AC-4: `vercel.json` is parsed -> a header rule for source `/(.*)\.md` sets `Content-Type` to `text/markdown; charset=utf-8` and a header rule for source `/llms.txt` sets `Content-Type` to `text/plain; charset=utf-8`.
  Covers: FR-20
- AC-5: `vercel.json` is parsed -> it holds 0 header named `Set-Cookie` (case-insensitive) and no `Referrer-Policy` value `no-referrer`.
  PRD ids: AC-42.
  Covers: NFR-1
- AC-6: The local server starts on a built tree and a fixture `vercel.json` whose `X-Test-Header` value is changed between two runs -> the response header value changes with the file and no header value is found in `scripts/serve-dist.mjs` itself.
- AC-7: The local server receives a request for an existing page, an existing `.md` file, `/llms.txt`, a directory path without the trailing slash (308) and an unknown path (404) -> each response returns the four headers of AC-3 with the values read from `vercel.json`.
  PRD ids: AC-42.
- AC-8: The local server receives a request for a file ending in `.md` and for `/llms.txt` -> it returns `Content-Type` `text/markdown; charset=utf-8` and `text/plain; charset=utf-8`.
- AC-9: The local server receives a request list that holds a page, an asset, a `.md` file, a 308, a 404 and a method other than GET or HEAD (405) -> 0 responses hold a `Set-Cookie` header.
  PRD ids: AC-42.
  Covers: NFR-1
- AC-10: The local server answers `/docs` for a built `docs/` directory -> status 308 with `Location: /docs/`, and answers an unknown path -> status 404 with the body of `404.html`; both behaviours of TASK-001 stay.
- AC-11: Failure criterion (anti-goal): the task is not done if the CSP value differs by one character from AC-3, if the server keeps its own copy of the header values instead of reading `vercel.json`, if the tests read only a fixture and never the real `vercel.json`, or if `npm run test:axe` fails with the headers served, even when the new tests are green.

## Out of scope

- Proving Pagefind under the CSP, and removing `'wasm-unsafe-eval'` or relaxing `style-src` for `/docs/*`: TASK-028.
- The `securitypolicyviolation` listener and the dist privacy checks: TASK-030.
- Branch-specific deployment settings and redirects of old addresses (FR-19: none).
- HSTS (ADR 0006: added only if the live check after the switch shows Vercel does not send it), the www redirect, Deployment Protection and retention: TASK-047.
- Any change to `.github/workflows/ci.yml`.

## Constraints

- Expected test exception: Vercel's own handling (the `Content-Type` override for `.md`, the 404 status of `404.html`, HSTS) cannot be run locally. Tested instead: the content of `vercel.json` and the local server's behaviour; the live checks are TASK-041 and TASK-047 (ADR 0005 and ADR 0006 mark these as unverified).
- The header values are those of ADR 0006 point 2 (accepted ADR).
- ADR 0001: plain `.mjs`, `node --test`, no new dependency.
- `vercel.json` is a hosting and header configuration: CRITICAL is considered (see Suggested class).

## Risks

- A strict `style-src 'self'` and `script-src 'self'` can stop a page of TASK-001 that has an inline style or script from rendering; the violation listener only arrives with TASK-030, so such a page can stay unseen until then (AC-11 keeps `npm run test:axe` green meanwhile).
- The match of the `source` patterns `/(.*)\.md` and `/llms.txt` on Vercel is unverified (ADR 0006 Evidence); the local server follows the file, so a mismatch shows only live.
- A header rule listed twice for the same path is merged by Vercel in a way not read in this session; the file keeps one rule per source.

## Pre-existing defects

none

## Suggested class

COMPLEX - hosting configuration and security headers plus a server change, tests in 2 modules (CRITICAL considered: headers and deploy configuration, no secret and no destructive change)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
