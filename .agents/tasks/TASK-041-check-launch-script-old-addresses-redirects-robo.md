# Task: TASK-041 - check:launch script: old addresses, redirects, robots, headers, README at the pin, repository link search

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-027
  - TASK-040
prd: site
---

## Goal

The product owner runs one command, `npm run check:launch`, right after the switch and before the launch checklist closes, and it reports for every launch-only check whether the live site and the pinned proofline repository pass, so no old address, redirect, header, README heading or old-site link is checked by hand.

## Context

- PRD requirements: FR-19 (old addresses are not redirected and answer not found), FR-22 (search of the proofline repository for links to an old site address), and the criteria AC-28, AC-29, AC-37, AC-38 (US-10, US-11, US-13). The launch checks are not part of the build (ADR 0008 point 7).
- Sources: `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` (point 7: launch-only checks in `npm run check:launch`, "never part of the build"), `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` (point 5: what is checked with curl right after the switch: `robots.txt`, the http and www redirects, the headers, the `Content-Type` of a `.md` file, a 308 to the slash form, an unknown path answering 404 with the bilingual page), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (point 2: the header set), `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (point 2: the address table, `/404.html`), `/docs/design/ARCHITECTURE.md` (component C25 and its edge from `ops/old-sitemap.txt`).
- Inputs that exist before this task: `ops/old-sitemap.txt` (TASK-040: 94 https addresses on the apex host) and `vercel.json` with the header set (TASK-027). `sync/pin.json` (`commit` and `tag`) is created by TASK-007, which is not a declared dependency of this task: the tests use a pin file of their own, and a live run needs the real file, which exists by the time TASK-047 runs the script (after TASK-043).
- README at the pin: the owner changed the upstream README in proofline 0.0.173. At the pinned commit (b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd) the start heading is `## Quick start` (the earlier `## Quick start (5 minutes)` is gone), the Status section holds one line `Version 0.0.173 is an early release.` and the section "Versioning and license" holds one line starting `Version **0.0.173**:`. The earlier README held two lines of each kind (lines 31-32 and 120-121 at commit 457729b).
- AC-38 hit rule (assumption): an old site address is every address of `ops/old-sitemap.txt` except `https://proofline.technology/` (the domain root, as the PRD says); `https://proofline.technology/tr/` is therefore a hit. The match ignores the scheme (http or https), an optional `www.` and a missing trailing slash.
- Expected scope: `scripts/check-launch.mjs`, `package.json` (script `check:launch`), `tests/check-launch.test.mjs`, `tests/fixtures/launch/` (4 paths).

## Acceptance criteria

- AC-1: `npm run check:launch` is started with the default base `https://proofline.technology` -> it prints one line per check starting `PASS` or `FAIL` and the check name, then a last line with the number of passed and failed checks, and exits 0 only when every check passed and 1 otherwise; `--help` prints usage and exits 0, and an unknown option prints usage and exits 2.
- AC-2: The live `https://proofline.technology/sitemap.xml` lists some addresses of `ops/old-sitemap.txt` and not the others -> only the addresses missing from that sitemap are checked as old addresses; a sitemap that cannot be fetched or parsed makes the check `FAIL` and names the cause.
  PRD ids: AC-28
  Covers: FR-19
- AC-3: An old address, requested in its https form on the apex host, answers status 404 and a body with an element with `lang="en"` and an element with `lang="tr"` and links to `/`, `/tr/`, `/docs/` and `/tr/docs/` -> its check is `PASS`.
  PRD ids: AC-28
  Covers: FR-19
- AC-4: An old address answers status 200 (also with the not-found page as body), 301, 302, 307 or 308, or 404 with a body that lacks the `lang="tr"` element or one of the four links -> its check is `FAIL`, the line names the address and the status found, and the exit code is 1.
  PRD ids: AC-28
  Covers: FR-19
- AC-5: `http://proofline.technology/`, `http://www.proofline.technology/` and `https://www.proofline.technology/` are requested without following redirects automatically -> each reaches `https://proofline.technology/` within at most 2 redirects and every hop answers 301 or 308 for the check to `PASS`; any hop with another status, a loop, or an end address other than `https://proofline.technology/` is a `FAIL` naming the URL and the hop.
  PRD ids: AC-29
  Covers: FR-20
- AC-6: `https://proofline.technology/robots.txt` is requested -> the check `PASS`es when the status is 200, there is no line `Disallow: /` (the whole site), and a line `Sitemap: https://proofline.technology/sitemap.xml` exists; it is a `FAIL` otherwise. The home page `/` carrying `noindex` in a robots meta tag or in an `X-Robots-Tag` header is a `FAIL` of the same check.
  PRD ids: AC-46
- AC-7: `https://proofline.technology/` is requested -> the check `PASS`es when every header name and value of the rule for source `/(.*)` in `vercel.json` (read from the file, not typed in the script) is present with the same value in the response, and the response holds 0 `Set-Cookie` headers; a missing, different or extra `Set-Cookie` header is a `FAIL` naming the header.
  PRD ids: AC-42
- AC-8: The first Markdown address listed in the live `/llms.txt` is requested -> the check `PASS`es when it answers 200 with `Content-Type: text/markdown; charset=utf-8`; a status other than 200 or another content type is a `FAIL`. `https://proofline.technology/get-started` (no trailing slash) answering 308 with a `Location` that ends in `/get-started/` is a second check with the same rule.
- AC-9: `sync/pin.json` names a commit and the README of that commit is read from the proofline repository -> the check `PASS`es when a heading line starts `## Quick start`, no heading line contains `(5 minutes)` (case-insensitive, any spaces inside the parentheses), exactly 1 line starts with `Version ` followed by a digit, and exactly 1 line starts with `Version **` followed by a digit; otherwise it is a `FAIL` that names the failing rule and the line numbers found.
  PRD ids: AC-37
  Covers: FR-31
- AC-10: The archive of the pinned commit of the proofline repository is read -> the search covers every text file in it (a file with a NUL byte in its first 8000 bytes is skipped) and the check `PASS`es when it finds 0 occurrences of an old site address as defined in Context; each occurrence is a `FAIL` line with `path:line` and the address, and the final line of the check says how many text files were searched.
  PRD ids: AC-38
  Covers: FR-22
- AC-11: A network error, a timeout of 30 seconds, an unreadable file (`ops/old-sitemap.txt`, `vercel.json`, `sync/pin.json`) or an unparsable response -> the affected check is `FAIL` and names the URL or the file; it is never `PASS` and the script does not stop before the other checks have run.
- AC-12: `npm test` is run -> the tests of the script run with 0 network requests (every response and the archive come from fixtures supplied by the test) and `npm run check:launch` is not part of `npm test`, `npm run build` or `ci / verify`.
- AC-13: Failure criterion (anti-goal): the task is not done if a server that answers every old address with status 200 and the not-found page as body, or with a redirect, still makes the script exit 0, if a missing `lang="tr"` block passes, or if the header check passes with a different value than `vercel.json`, even when the tests of the happy paths are green.

## Out of scope

- Changing the site, `vercel.json`, the sitemap or `robots.txt`; the script only reads.
- Running the script against the live site (the owner does that in TASK-047 and TASK-049).
- The proof that the pin is a commit made after the README change beyond the README text itself (TASK-043 holds the offline test over the pinned README).
- The checks of `ci.yml` (TASK-033), the Playwright checks of TASK-030 and the Lighthouse budget (TASK-032).
- Redirects of old addresses (FR-19 forbids them); fragments, hreflang and titles of the live pages.

## Constraints

- ADR 0001: plain `.mjs` script, Node 24.x, `node --test`, every dependency in `package.json` an exact version; no dependency is added by this task.
- ADR 0008 point 7: the checks are launch-only and never part of the build, `npm test` or CI.
- Read-only: the script sends only GET and HEAD requests, writes no file in the repository, and holds no credential.
- Network timeout per request: 30 seconds.
- ADR 0005 point 5 (what is checked with curl) and ADR 0006 point 2 (the header set) are the sources of the checks in AC-5 to AC-8.

## Risks

- The live site and `raw.githubusercontent.com` / `codeload.github.com` can rate-limit or fail; the script then reports `FAIL` for the affected check and the owner repeats the run, which is why a network error is never a pass.
- 94 addresses are requested one after another by the owner at the cutover; a slow host makes the run long but not wrong.
- `https://proofline.technology/tr/` counts as an old-site hit in AC-10 under the PRD's wording ("other than the domain root"); a link to it in the proofline repository would be reported although the new site defines it. The report shows the address, so the owner decides.
- Hosting behaviours listed as unverified in ADR 0005 and ADR 0006 (the status of the 404 page, HSTS, the `.md` content type) are observed here for the first time; a `FAIL` on the real site is information for the hosting task, not a fault of this script.
- Classing: CRITICAL considered (it reads headers of the production site) and not taken: the script is read-only, holds no secret and changes no configuration.

## Pre-existing defects

none

## Suggested class

COMPLEX - new integration: one script reads live hosting responses, `vercel.json`, the sync pin and the pinned proofline archive (CRITICAL considered: read-only requests, no secret, no deploy or workflow configuration changed)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `node scripts/check-launch.mjs --help`
