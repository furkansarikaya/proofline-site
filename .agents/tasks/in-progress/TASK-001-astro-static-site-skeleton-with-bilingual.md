# Task: TASK-001 - Astro static site skeleton with bilingual placeholders and ci / verify

**Status:** in-progress

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
- updated: 2026-11-19T21:01:52Z
- runtime: claude
- session: 255c1b95-906f-4b40-ba0d-6a5f3d745bbe
- estimate: size L
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-001 -->
