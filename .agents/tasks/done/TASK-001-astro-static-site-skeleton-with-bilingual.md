# Task: TASK-001 - Astro static site skeleton with bilingual placeholders and ci / verify

**Status:** done

---
type: feature
size: L
---

## Goal

An empty but working Astro project that builds to static output, with placeholder pages for the two language roots (`/` and `/tr/`) and a 404 page, one shared base layout, a test setup, and a CI workflow whose single job `verify` (shown as `ci / verify`) builds, tests, link-checks, compares two builds by hash, and runs accessibility checks, with a labelled place for performance checks.

## Context

Request (user's words):

> İskelet task'ı: ARCHITECTURE.md ve ADR'lere (özellikle 0001, 0002 ve
> 0008) göre boş ama çalışan Astro projesi: statik çıktı, iki dilli adres
> yapısı (/ ve /tr/) için boş sayfa iskeletleri, ortak taban yerleşim, test
> altyapısı ve CI (ci / verify işi: build, test, bağlantı kontrolü, iki
> build'in hash karşılaştırması; erişilebilirlik ve performans kontrolleri
> için yer).

- The repository holds only `.agents/`, `.claude/`, `.codex/`, `docs/`, `AGENTS.md`, `CLAUDE.md`, `.gitignore` (ADR 0001); this is the first product code.
- `docs/design/ARCHITECTURE.md` lists "Scaffold and toolchain closure" (1) and "`ci.yml` and checks" (5) as separate task proposals; this task takes the skeleton of both.
- Decisions from the intent interview (`.agents/local/intent-grill/iskelet-task-architecture-md-ve/INTENT.md`): pages are `/`, `/tr/` and the bilingual 404 only; Playwright with axe runs for real, Lighthouse is a documented slot only; closed indexing mode only; a broken link or a hash difference fails `verify`; the workflow-permissions check is included.
- Assumption: the 404 page follows ADR 0002 (one page, an `lang="en"` block and an `lang="tr"` block, links to `/` and `/tr/`); the `/docs/` links of that ADR are left out because those pages do not exist yet.
- Assumption: the closed-mode `robots.txt` text is `Disallow: /` for all agents, taken from the AC-46 wording in `docs/design/ARCHITECTURE.md`.

## Acceptance criteria

- AC-1: `npm ci` then `npm run build` exit 0 and `dist/` holds exactly three HTML pages: `index.html`, `tr/index.html` and `404.html`.
- AC-2: `dist/index.html` has `<html lang="en">` and `dist/tr/index.html` has `<html lang="tr">`; each links to the other language root, and `dist/404.html` holds an `lang="en"` block and an `lang="tr"` block with links to `/` and `/tr/`.
- AC-3: Each page shows a heading and one short placeholder sentence, and `dist/` holds 0 script elements; the three pages share the same head structure (charset, viewport, non-empty title element, lang attribute on the html element).
- AC-4: The link check passes on the built `dist/` (reporting at least 1 link checked) and exits non-zero on a fixture whose page links to a missing internal address.
- AC-5: Two clean builds of the same tree give the same sha256 over the sorted `dist/` paths and contents; the compare exits non-zero when a file in one of the two outputs differs.
- AC-6: Every built HTML page carries `<meta name="robots" content="noindex, nofollow">`, `dist/robots.txt` contains `Disallow: /`, and `dist/sitemap.xml` does not exist.
- AC-7: Playwright with axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) reports 0 violations on `/` and `/tr/` served from `dist/`, and fails on a fixture page with a known violation; `verify` installs Chromium itself.
- AC-8: `verify` shows a step for performance checks that is skipped and prints a line saying that the Lighthouse budgets arrive with the performance task; no Lighthouse dependency is installed.
- AC-9: The workflow-permissions check passes for `.github/workflows/ci.yml` (top-level `permissions: contents: read`) and exits non-zero on a workflow fixture without a top-level `permissions` block or with `write-all`; it runs as part of `node --test`.
- AC-10: `.github/workflows/ci.yml` is named `ci`, runs on `pull_request` and on `push` to `main`, and has one job `verify`; a pull request run shows a check named `ci / verify` whose steps run in this order: install, `node --test`, build, determinism compare, link check, axe, performance slot.
- AC-11: Failing any of link check, determinism compare, `node --test` or axe makes the `verify` job fail.
- AC-12: `.node-version` holds Node 24.x, `package.json` has `engines.node` `24.x`, Astro is pinned to exactly 7.4.13, every dependency in `package.json` is an exact version (no `^` or `~`), `package-lock.json` is committed, and the Astro config sets static output, `build.format` `directory`, `trailingSlash` `always`, and i18n with locales `en` and `tr`, default `en`, no prefix for the default locale and no fallback.
- AC-13: The completion report states that enabling `ci / verify` as the required check on `main` is the owner's step and was not done by this task, and it names the check exactly as GitHub shows it after the first run.
- AC-14: Failure criterion (anti-goal): the task is not done if `/` and `/tr/` have a wrong `lang` or no link to each other, if the hash compare passes on differing outputs or compares nothing, or if the Node 24.x, exact-version or `ci / verify` name pins are broken, even when the build is green.

## Out of scope

- Visual design: pages are plain placeholders; the design comes in the next step.
- Document sync, the pin and lock files, hosting (Vercel, `vercel.json`, headers) and content (the user excluded all three).
- hreflang, the sitemap, the translation index and the switch that opens indexing (only closed mode exists).
- Real Lighthouse budgets and any other pages of the ADR 0002 address table (`/get-started/`, `/docs/` and the rest).
- Search (Pagefind), `sync.yml`, `snapshot.yml` and the rest of `check-dist` (title rules, CSP checks, llms.txt).
- Setting the `main` ruleset or the required check: the user does that.

## Constraints

- The user said to follow `ARCHITECTURE.md` and the ADRs, especially 0001, 0002 and 0008.
- ADR 0001: Astro 7 static, TypeScript under `src/`, plain `.mjs` build scripts under `scripts/`, no UI-framework integration, npm with `npm ci`, Node 24.x fixed in `.node-version`, `package.json` and (later) Vercel.
- ADR 0001: tests are `node --test` for scripts and units and Playwright for browser checks.
- ADR 0008: `ci.yml` has a least-privilege top-level `permissions:` block and one job `verify`; axe uses `@axe-core/playwright` 4.14.0; Playwright is 1.65.1.
- The first run of project code (npm install, build) happens under the sandbox warning of the lead.

## Risks

- Astro 7.4.13 and the exact pins are verified only by ADR 0001; the versions not listed there (Playwright's Chromium, any link-check library) are unproven until the first install.
- Two Astro builds might differ in file content or order, which would make the determinism check red from the start; the check must name the differing files.
- The required-check name can only be picked after the first run of `ci / verify` on GitHub; until the user enables it, nothing blocks a merge.
- CI duration is unmeasured; timeouts are set from the first measured run.
- CI/infrastructure indicator: `ci.yml` is a new workflow, but it has `contents: read`, no secrets and no deploy, so it is classed below CRITICAL.

## Pre-existing defects

none

## Suggested class

COMPLEX - new dependencies and a new integration across site code, tests and CI (CI workflow considered, no secrets or deploy)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-001 -->
- run: TASK-001
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-20T06:39:20Z
- runtime: claude
- session: 255c1b95-906f-4b40-ba0d-6a5f3d745bbe
- estimate: size L
- duration: 0 min
- tokens: 416030
<!-- PROOFLINE-STATUS:END:TASK-001 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-001 -->
# Completion Report: TASK-001

<!-- proofline:summary:begin -->
Changed: Astro 7.4.13 static site skeleton with `/`, `/tr/` and 404 placeholders, closed-mode robots, link check, determinism compare, axe check and the `ci` workflow with job `verify`.
Look at: QA-18: the PR Checks tab shows a check named exactly `ci / verify` with the AC-10 step order.
Look at: QA-22: `COMPLETION_REPORT.md` states that making `ci / verify` the required check on `main` is the owner's step and was not done.
Verify: `npm ci && npm test`
<!-- proofline:summary:end -->

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-001 — Astro static site skeleton with bilingual placeholders and ci / verify; class COMPLEX; tier full; branch `proofline/TASK-001-astro-static-site-skeleton-with-bilingual`
- Changed: `.gitignore` (AC-1), `.node-version` (AC-12), `package.json` (AC-1, AC-8, AC-12), `package-lock.json` (AC-8, AC-12), `astro.config.mjs` (AC-1, AC-12), `src/layouts/Base.astro` (AC-3, AC-6), `src/pages/index.astro`, `src/pages/tr/index.astro`, `src/pages/404.astro` (AC-1, AC-2, AC-3), `public/robots.txt` (AC-6), `scripts/check-dist.mjs` (AC-4, AC-5, AC-11, AC-14), `scripts/serve-dist.mjs` (AC-7), `scripts/check-workflows.mjs` (AC-9), `.github/workflows/ci.yml` (AC-8, AC-9, AC-10, AC-11, AC-13), `tests/site.test.mjs` (AC-1 to AC-14), `tests/axe.mjs` (AC-7, AC-11)
- Outside the plan scope: `.agents/config.yaml` (`commands.build` and `commands.test`, set by the user's approval of doctor; control plane, not product code)
- Knowledge: ADR 0009 published to `docs/adr/` and listed in `docs/design/ARCHITECTURE.md`
- Required check (AC-13): making `ci / verify` the required check on `main` is the owner's step and was not done by this task. After the first pull request run GitHub shows the check as exactly `ci / verify` (workflow `ci`, job `verify`, no job name); this is not confirmed until that run.

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| `astro.config.mjs`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/pages/tr/index.astro`, `src/pages/404.astro`, `public/robots.txt`, `package.json`, `.node-version` | `npm test` and `npm run test:axe` fail on assertions against stubs | `npm test` passes; `npm run test:axe` passes | implementer |
| `scripts/check-dist.mjs`, `scripts/serve-dist.mjs`, `scripts/check-workflows.mjs`, `.github/workflows/ci.yml` | `npm test` fails on assertions against stubs | `npm test` passes | implementer |
| `tests/site.test.mjs` (AC-11 test, changed in each fix round) | `npm test` with a bypass in a gating script fails on the assertion | `npm test` passes on the restored tree | implementer |
| `.gitignore`, `package-lock.json` | tdd_exemption (ignore rules and a generated lock) | `npm ci` and the toolchain test | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm ci`, `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links`, `npm run test:axe`

## Assumptions

- AS-1 (medium): Two Astro 7.4.13 builds of the same tree are byte-identical — unverified in the plan register; observed: `npm run check:determinism` gave the same digest over 4 files on two clean builds
- AS-2 (medium): The pinned axe test tooling installs and runs in the sandbox and on the CI runner — unverified; observed locally (the axe step passes), not yet on the CI runner
- AS-3 (low): Astro peer `@astrojs/markdown-remark` can stay transitive — unverified; `npm ci` succeeded with it transitive
- AS-4 (low): no `site` option, canonical link, inline-stylesheet setting or indexing log line — unverified, a design decision against ADR 0005 that the owner may revisit
- AS-5 (low): `.mjs` fixture strings do not match `risk.ui_path` — unverified; an extra QA focus ran because the `.astro` page paths match it
- AS-6 (low): Astro builds without `tsconfig.json` — unverified; the build passed without one
- AS-7 (low): `AxeBuilder` accepts a page object from the pinned test library — unverified in the register; `npm run test:axe` passes
- AS-8 (low): Astro emits no `script`, no extra HTML file and no generator tag — unverified in the register; the page tests assert it
- AS-9 (low): `actions/checkout@v7` and `actions/setup-node@v7` run on `ubuntu-24.04` — unverified; not run on GitHub yet
- AS-10 (low): 16 scope paths exceed the COMPLEX limit of 15 and run unsplit — unverified in the register; the run froze unsplit on the user's own answer `proceed without splitting`, `questions/001.answer.md`

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 2 | none |
| REVIEW_PLAN | pass | high | 0 | REVIEW_PLAN-1 REVIEW_PLAN-2 |
| REVIEW_RULES | pass | high | 0 | REVIEW_RULES-1 REVIEW_RULES-2 |
| REVIEW_TESTS | pass | high | 2 | none |
| SECURITY | pass | high | 0 | none |
| SECURITY:dependencies | pass | high | 0 | SECURITY-1 SECURITY-2 SECURITY-3 |
| QA | pass | high | 2 | QA-1 QA-2 |
| VERIFY | pass | high | 2 | none |

Fix rounds used: 2 of 2. REVIEW_TESTS failed twice on the AC-11 test (a gating npm script could be bypassed without a failing test); both findings were fixed in `tests/site.test.mjs` and the gate then passed.

- REVIEW_PLAN: REVIEW_PLAN-1 info `.agents/config.yaml` changed outside the plan scope (control plane); REVIEW_PLAN-2 info AC-13 is a report statement
- REVIEW_RULES: REVIEW_RULES-1 info `check-workflows.mjs` checks only the top-level `permissions` block (ADR 0008 also lists secret and `snapshot.yml` rules for later workflows); REVIEW_RULES-2 info placeholder page titles do not follow the ADR 0002 title format (title rules are out of scope)
- SECURITY: SECURITY-1 info no license policy configured; SECURITY-2 info `fsevents` (optional, macOS only, no install hook); SECURITY-3 info `astro` is the only production dependency
- QA: QA-1 info a bypass appended to the `test` script is reported by the AC-11 test but `npm test` itself still exits 0 (a test cannot gate its own script); QA-2 info the `git ls-files package-lock.json` check cannot succeed before the delivery commit

For each gate that re-ran nothing:

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- SECURITY:dependencies: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)
- QA:visual: not reproduced (NOT_RERUN)

## QA Result

QA: PASS (high); scenarios 34 automatic scenarios passed, 2 manual (QA-18, QA-22) left as human checks.

## Execution

Generated from the decision records by `agent.sh report-execution TASK-001` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| architect | - | claude | opus | high | none | agent path |
| implementer | - | codex | gpt-6-sol | high | none | - |
| implementer | - | claude | sonnet | high | none | runtime set by the operator; agent path |
| security_reviewer | - | claude | opus | xhigh | large_diff | escalated (ESCALATED_EFFORT); agent path |
| qa | - | claude | opus | medium | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | dependencies | claude | opus | high | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | runtime set by the operator; agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | runtime set by the operator; agent path |
| reviewer | tests | claude | sonnet | high | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| qa | visual | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| security_reviewer | dependencies | claude | opus | high | large_diff,fix_round_2 | agent path |
| verifier | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |

## Amendments

none

## Known Limitations / Follow-up

- Mutation budget: the REVIEW_TESTS reviewer ran 27 extra mutants in the last round beyond the configured budget of 20; disclosed in its report and `evidence/round3-wiring-mutants.txt`.
- The implementer's hollow checks in each fix round mutated `package.json` in place in the project tree (the hook blocked a worktree write) and restored it byte-identical; recorded as a proofline friction note.
- The first implementer dispatch on Codex was BLOCKED (its sandbox had no DNS for the npm registry); the implementer was re-decided to Claude by the user's instruction.
- Observation: `.github/workflows/ci.yml` uses major tags `@v7` for both actions and sets no `timeout-minutes`; SHA pins and a measured timeout belong to the CI task.
- Observation: the `determinism` command deletes `node_modules/.astro` and `.astro`; if Astro's `cacheDir` moves, the clean list must change.
- Observation: `tests/site.test.mjs` temp fixtures use `os.tmpdir()` and are removed in an `after` hook; an interrupted run can leave `proofline-site-*` directories there.
- Task file: the run's task file sits uncommitted in `.agents/tasks/in-progress/` (the original path shows as deleted); it is not part of the delivery.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 12)
- Gate REVIEW_PLAN: ran on an EARLIER tree (gate REVIEW_PLAN, record 3; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_RULES: ran on an EARLIER tree (gate REVIEW_RULES, record 2; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 14)
- Gate SECURITY: ran on an EARLIER tree (gate SECURITY, record 4; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Check SECURITY:dependencies: ran on an EARLIER tree (focus SECURITY:dependencies, record 10; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate QA: ran on the final tree: pass (gate QA, record 15)
- Visual/browser check: ran on an EARLIER tree (visual/browser check, gate QA:visual, record 8; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 13)

Final message line (paste it unchanged): Verification claims (from the ledger): 4 of 7 gates hold a record for the final tree; not on the final tree: REVIEW_PLAN (earlier tree), REVIEW_RULES (earlier tree), SECURITY (earlier tree), SECURITY:dependencies (earlier tree), QA:visual (earlier tree); visual/browser check: ran on an EARLIER tree (gate QA:visual, record 8; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree.
Claims-hash: 349f8b9943d4b52a14836e9d2a4a5154003f30a66af3d587041901e16a226a13
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-001` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1 REVIEW_PLAN-2
- Gate REVIEW_RULES: pass; findings: REVIEW_RULES-1 REVIEW_RULES-2
- Gate REVIEW_TESTS: pass; findings: none
- Gate SECURITY: pass; findings: none
  - Focus SECURITY:dependencies: pass; findings: SECURITY-1 SECURITY-2 SECURITY-3
- Gate QA: pass; findings: QA-1 QA-2
  - Focus QA:visual: pass; findings: none
- Gate VERIFY: pass; findings: none
- Friction notes recorded (A200): proofline_bug 1, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 2 of 2
- Refreezes: 0
- Files changed (task-owned paths): 16
- Worker-evidence run records: total 18, ended pass 13, ended fail 5 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-001 -->
