# Architecture: proofline site

Mode: task (greenfield, standalone `design system`) | Levels: context, container, component (component level only for the build pipeline)

Revision 2 (2026-11-19): the product owner simplified the way back and answered the confirmations; see "Owner decisions" below and `PRD-CHANGES.md`.

Sources: `docs/product/site/PRD.md`, `DECISION.md`, `REVIEW.md` (round 3); the proofline repository at candidate pin `457729b31481a8a1915c06ec3bddd57b549f0194` (evidence tree `.agents/local/scratch/pl-tree/`, read-only); the lead's verified facts V1-V10, G1-G7, A1-A6 (accessed 2026-11-19). ADRs are in `adr/` next to this file; nothing is published to `docs/` before the owner approves.

## Context

| Actor or system | Talks to the site through | Direction | Contract |
|---|---|---|---|
| Visitor, crawler, AI agent | `https://proofline.technology` | both | HTML pages of the address table (ADR 0002), `sitemap.xml`, `robots.txt`, `/llms.txt`, `<page>.md` |
| proofline repository (`furkansarikaya/proofline`, public) | codeload archive `https://codeload.github.com/furkansarikaya/proofline/tar.gz/<commit>`; REST `tags`, `compare/{pin}...{tag}` (sync); REST traffic views, referrers, repository (snapshot) | proofline -> site (read only) | archive contents verified against `sync/lock.json`; API JSON |
| Vercel (Hobby, existing project of proofline.technology) | Git integration on this repository; `vercel.json`; dashboard Deployment Protection, retention, Domains redirect | both | `npm run build` -> `dist/`; response headers; production branch `main`; Instant Rollback as the way back |
| GitHub Actions | `.github/workflows/{ci,sync,snapshot}.yml` | both | required check `verify`; sync PR on `sync/proofline`; pushes to `traffic-data` |
| `traffic-data` branch (orphan, this repository) | snapshot job writes, builds read | both | `snapshots/<UTC timestamp>.json`, `merged.json` (ADR 0007) |
| Google Search Console, Bing Webmaster Tools | DNS TXT (Domain property); sitemap submission by hand | site -> consoles | FR-21, FR-23 |
| DNS provider (owner) | apex and www records, TXT records | owner | not changed when the same Vercel project is reused |

## Containers and components

| Id | Name | Level | Path | Change | Responsibility |
|---|---|---|---|---|---|
| C1 | proofline site repository (the system) | context | `.` | modify | Owns site, build, checks, workflows; reads proofline at a pin, never writes to it |
| C2 | Static site application | container | `src` | new | Pages from content files and transformed HTML; sitemap, robots, llms endpoints; no fetch, no clock |
| C3 | Astro configuration | container | `astro.config.mjs` | new | static output, i18n en/tr without fallback, directory format, trailing slash, no inline stylesheets |
| C4 | Static public assets | container | `public` | new | `og-default.png`, self-hosted fonts, favicon |
| C5 | Package manifest and lock | container | `package.json` | new | exact pins, `engines.node` 24.x, scripts build/test/translation:stamp/check:launch |
| C6 | Node version pin | container | `.node-version` | new | Node 24.x for local and CI |
| C7 | Sync pin and lock | container | `sync` | new | `pin.json`, `lock.json`; the only files a sync PR changes |
| C8 | Build and check scripts | container | `scripts` | new | `.mjs` scripts; none publishes or deploys |
| C9 | Hosting configuration | container | `vercel.json` | new | build command, output, trailing slash, headers, `git.deploymentEnabled` |
| C10 | GitHub workflows | container | `.github` | new | ci (required `verify`), sync, snapshot; least privilege |
| C11 | Operations records | container | `ops` | new | `TOKENS.md`, `LAUNCH.md`, `old-sitemap.txt`, `SETTINGS.md` |
| C12 | Tests and fixtures | container | `tests` | new | node tests, sanitizer fixtures, mini archive, two snapshots, Playwright specs, LHCI config |
| C13 | Git ignore rules | container | `.gitignore` | modify | add `node_modules/`, `dist/`, `.cache/` |
| C14 | Product documents (inputs) | container | `docs/product/site` | unchanged | PRD/DECISION/REVIEW; wording changes proposed to the owner, not edited |
| C15 | Sync fetch and verify (`scripts/sync.mjs`) | component | `scripts` | new | archive download, per-file verification, cache `.cache/sync/<commit>/` |
| C16 | Transform, sanitize, link map (`scripts/lib/transform.mjs`) | component | `scripts` | new | frontmatter, remark-parse + remark-gfm, HTML as text, comments dropped, links mapped, HTML + `.md` + manifest |
| C17 | Pin facts extractor (`scripts/lib/pin-facts.mjs`) | component | `scripts` | new | proof.md figures and anchor; README Status sentences and Install-range commands; fails when missing |
| C18 | Translation index (`src/lib/translations`) | component | `src` | new | pairs, hreflang, sitemap alternates, switcher, staleness |
| C19 | Pages, layouts, endpoints | component | `src` | new | address table, titles, footer, indexing switch; zero script on four site pages |
| C20 | Search index step | component | `package.json` | new | `pagefind --site dist` |
| C21 | Dist checker (`scripts/check-dist.mjs`) | component | `scripts` | new | static checks over `dist/` |
| C22 | Local static server (`scripts/serve-dist.mjs`) | component | `scripts` | new | vercel.json semantics for browser checks |
| C23 | Workflow checker (`scripts/check-workflows.mjs`) | component | `scripts` | new | NFR-8, AC-20 |
| C24 | Traffic merge and status | component | `scripts` | new | merge by UTC day; stale/unknown warning, exit 0 |
| C25 | Launch checks (`scripts/check-launch.mjs`) | component | `scripts` | new | owner-run live checks |
| C26 | Translation stamp (`scripts/translation-stamp.mjs`) | component | `scripts` | new | writes `translatedFrom.hash` after human confirmation |

Paths deeper than the top level (`scripts/lib/...`, `src/lib/...`, `.github/workflows/...`) are planned file names inside new top-level paths; the validator checks the top-level path.

Build pipeline (`npm run build`): C15 -> C16 and C17 -> `astro build` (C18, C19) -> C20 -> C21 (+ C24 status warning, which never writes to `dist/`).

## Boundaries

| From | To | Contract | Direction |
|---|---|---|---|
| C15 | C7 | `sync/pin.json` `{commit: 40-hex, tag: null\|string}`; `sync/lock.json` `{commit, files: [{path, role: page\|input, blob, sha256}], tree_sha256}` | C7 -> C15 |
| C15 | proofline (external) | HTTPS GET codeload archive of `<commit>`, no credential; contents verified per file | C15 -> external |
| C15 | C16 | `.cache/sync/<commit>/` tree + listing `(path, type, blob)` | C15 -> C16 |
| C16 | C19 | page manifest `[{source, address, lang, title, description, html, md_path, translated_from?, headings[]}]` | C16 -> C19 |
| C17 | C19 | pin facts `{version, figures_date, does_not_prove_id, not_proven_sentence, codex_sentence, readme_commands[], readme_inline_spans[], commit, tag}` | C17 -> C19 |
| C18 | C19 | `alternates(page)`, `switcherTarget(page)`, `isStale(page)` | C18 -> C19 |
| C19 | C20 | `dist/` HTML with `<html lang>` and `data-pagefind-body` | C19 -> C20 |
| C20 | C21 | `dist/` incl. `dist/pagefind/` | C20 -> C21 |
| C21 | C7 | lock counts vs built pages (AC-41) | C7 -> C21 |
| C22 | C9 | vercel.json headers and trailingSlash applied locally | C9 -> C22 |
| C9 | C5 | Vercel runs `npm run build`, Node from `engines.node`, serves `dist` | C9 -> C5 |
| C10 | C5 | `ci.yml` job `verify` | C10 -> C5 |
| C10 | C7 | `sync.yml` force-pushes `sync/proofline` (pin + lock), one PR via GITHUB_TOKEN | C10 -> C7 |
| C10 | C24 | `snapshot.yml` pushes `snapshots/<UTC timestamp>.json` + `merged.json` to `traffic-data` | C10 -> C24 |
| C24 | C11 | `ops/TOKENS.md` expiry line; issue at <= 21 days | C11 -> C24 |
| C23 | C10 | `.github/workflows/*.yml` parsed with `yaml` | C10 -> C23 |
| C25 | C11 | `ops/old-sitemap.txt` | C11 -> C25 |
| C26 | C2 | frontmatter `translatedFrom {page, hash}` | C26 -> C2 |
| C3 | C2 | i18n, build, trailingSlash | C3 -> C2 |

Public contracts (`contract_change` none today, all new): the address table (search engines), the `/llms.txt` and `.md` surface (agents), `sync/pin.json` and `sync/lock.json` (sync PR), `merged.json` on `traffic-data`. A later change to the address table needs redirects that FR-19 does not plan.

## Compatibility

- Old site (deployed by the same Vercel project from another source): not preserved and never a way back (owner decision); its last production deployment stays in the project as it is and is only the previous deployment at the first push; its 94 sitemap addresses (http) get no redirects (FR-19); 92 answer 404 with the bilingual page, `/` and `/tr/` are reused.
- Search engines: old URLs drop out; new sitemap https only; Search Console Domain property is new, M-4 baseline none, M-5 baseline old site.
- Vercel project: the existing project is connected to this repository (production branch `main`) by the hosting task; the way back is Instant Rollback to the new site's previous production deployment.
- proofline repository: read only at a pin; the site depends on README Status sentences, the Install..What it supports range and the proof.md figures sentence; an upstream rewording fails the site build by design.
- Upstream defects worked around: two Version lines in README Status (lines 31-32) and in Versioning and license (120-121), so the version comes from `docs/proof.md`; heading `## Quick start (5 minutes)` (line 58) must lose its suffix before the real pin (FR-31; AC-37 is a waiting condition of the launch, done by the owner upstream).
- Branch ruleset on `main`: new, set by the CI task; every PR, including the sync PR, needs `ci / verify`.

## Migration

1. Build on branches; CI only; the Vercel project is not yet connected to this repository, so nothing reaches production. Rollback: delete branches.
2. Launch checklist items before the switch in FR-32 order (README fix upstream as a waiting condition, PB-3, first-screen check, link search, DNS TXT and console checks). Rollback: remove the TXT record.
3. Switch: the hosting task connects the existing project to this repository with `main` launch-ready, then sets and records Deployment Protection, retention >= 7 days and the www -> apex redirect; the first production deployment of `main` is the cutover; curl checks of robots.txt, redirects, headers, `.md` content type and 404. Rollback: none to the old site (owner decision); a defect before the second deployment is fixed forward.
4. Right after the switch: create the second production deployment of the new site (a redeploy of `main` if nothing changed), then rehearse: roll back to the first, confirm it is served, promote the second, confirm that a later push goes live; write the steps in the launch checklist (AC-30). Rollback of the rehearsal: the promote step.
5. Launch day: first snapshot to `traffic-data` (no deployment), sitemap submission, old-address 404 check.
6. Afterwards: every production deployment keeps a one-step way back to the deployment before it (Instant Rollback, Hobby).

## Trade-offs

| Choice | Alternatives rejected | Evidence |
|---|---|---|
| Synced titles keep the full H1; 40-char cap for site-written titles; warn above 120 | cut every H1 at 40 (brief) | AC-10 "its own H1"; H1s of 48/44/41 chars; longest title 120 |
| Lock hashes extracted contents | hash of the tar.gz | archive compression not promised stable (inferred) |
| No syntax highlighting in v1 | Shiki with inline styles; class-based highlighting | CSP `style-src 'self'` |
| ASCII Turkish slugs | percent-encoded Unicode slugs | upstream ASCII file names `gunluk-kullanim.md`, `prompt-katalogu.md` |
| No `/docs/guides/` or `/docs/concepts/` pages | one index per section | smallest address table |
| hreflang sets include `x-default` | en and tr only | old sitemap used it; reciprocity unaffected |
| JSON-LD on the two home pages only | none; every page | AC-10 mentions structured data |
| Get-started command spans compared only when marked | heuristic detection | REVIEW two-engineer test (FR-4, AC-3) |
| AC-4 pattern as written (no word boundary) | add `\b` | PRD is the contract; REVIEW R3-10 false positive |
| EN renders the README sentences; TR hand translation under the same guard | quote English on TR pages; no guard | AC-12 exempts only synced-page quotes; README is not synced |
| One required check `verify` | one check per concern | one approval click per sync PR (G1) |
| Sync API calls with GITHUB_TOKEN | anonymous 60/h | G6; shared runner IPs (inferred) |

## ADRs

- 0001 Build the site with Astro 7 as a static site, npm and Node 24.x (accepted)
- 0002 Fix the address table, two locales without fallback, one translation index, and the title rules (accepted)
- 0003 Fetch the pinned documents at build time against a lock, transform them deterministically, and move the pin by a GITHUB_TOKEN pull request (accepted)
- 0004 Search the documents with Pagefind's Component UI on docs pages only (accepted)
- 0005 Stay on the existing Vercel project, use Instant Rollback to the new site's previous production deployment as the way back, and keep non-production builds out of search (accepted, revised 2026-11-19 by the owner's decision)
- 0006 Enforce privacy with a strict CSP from vercel.json, keep the origin referrer to the repository, and state privacy and licence in one footer line (accepted)
- 0007 Save weekly traffic snapshots to an orphan traffic-data branch, warn after 10 days, and tell the owner by GitHub issues (accepted)
- 0008 Gate every change with one required CI check that builds twice, checks dist/, runs axe and Lighthouse, and verifies workflow permissions (accepted)
- 0009 Run browser checks with the Playwright library under node:test, not with the Playwright Test runner (accepted)

## Q-5 closure

| Item | Decided by / closes in | Status |
|---|---|---|
| (a) address structure, /docs/ and /tr/docs/ | ADR 0002 | decided |
| (b) agent index name and pattern; Markdown of site pages | ADR 0003 (`/llms.txt`, `<page>.md`; site pages none in v1) | decided |
| (c) hosting named, one-step check, rehearsal place and order, what if none | ADR 0005 (existing Vercel project; Instant Rollback on Hobby; rehearsal on the real project right after the switch; the step exists, so no fallback) | decided; rehearsal result recorded in the hosting/launch task |
| (d) grace value | ADR 0007 (10 days) | decided |
| (e) lab tool, mobile profile, accessibility checker | ADR 0008 (LHCI 0.16.1 default mobile, median of 5; axe `wcag22aa` via Playwright) | decided |
| (f) title and description length | ADR 0002 | decided |
| (g) build check of the title rule | ADR 0002 (rule) + ADR 0008 (`check-dist`) | decided |
| (h) credential for CI on the sync PR; an open PR when a newer one is due | ADR 0003 (GITHUB_TOKEN + approval click; one PR updated in place) | decided; approval-required behavior confirmed in the sync workflow task |
| (i) Q-3 privacy and licence line | ADR 0006 (one footer line, no legal pages) | decided; wording closes in `design ui` |
| (j) decision tags in DECISION.md and source documents | documentation task (no design) | closes in task |
| (k) rehearsal order; meaning of "previous publication" | ADR 0005 (the new site's production deployment before the current one; rehearsal after the switch) | decided |
| (l) Metadata read on the fine-grained token | ADR 0007 (no "mandatory" sentence found; record the form) | closes at token creation (snapshot task) |
| (m) missing proof-page sentence | ADR 0003 (build fails, names page and pattern) | decided; NFR-4 wording change for the owner |
| (n) title match rule, og:title, preview image | ADR 0002 (case-insensitive substring; og:title covered; one static image) | decided |
| (o) comparison base of site-written Turkish pages | ADR 0002 (sha256 of the English content file in this repository) | decided |
| (p) referrer policy | ADR 0006 | decided |
| (p) Search Console property type, zero baselines | ADR 0005 (Domain property; M-4 none, M-5 old site) | decided; baseline dates recorded in the launch checklist |
| (p) DNS and certificate ownership | ADR 0005 (owner holds DNS; Vercel TLS) | decided; DNS provider named in the launch checklist |
| (p) Codex limit text staleness | ADR 0003 (extracted and guarded) | decided |
| (p) Turkish index pages, site navigation | ADR 0002 | decided |
| (p) security headers | ADR 0006 | decided; CSP under Pagefind closes in the search task |
| (p) red sync PR | ADR 0003 (draft + `sync-red` + upstream issue text; site stays on old pin) | decided |
| (p) 404 status on Vercel | ADR 0005 (curl right after the switch) | closes in the hosting task |
| (q) acceptance criteria for FR-10, NFR-1, NFR-5, NFR-7, NFR-8 | proposed AC-41 to AC-47 below | owner adds them to the PRD |

Also answered: Q-1 (ADR 0007: grace 10 days; issues for failure, stale status and token expiry; the owner renews). Not designed: Q-2 (product question, FR-30), Q-4 (scheduled check of the proof page's external CI links; not in v1, owner decides at FR-30).

## Proposed acceptance criteria (for the owner; numbering continues after AC-40)

- AC-41 (FR-10): The site is built -> the number of skill pages equals the number of `skills/*/SKILL.md` entries of `sync/lock.json`, and the number of concept pages the number of `docs/concepts/*.md` entries (28 and 13 at the candidate pin); the counts are read from the lock, not typed.
- AC-42 (NFR-1): The header set of `vercel.json` and every response of the local server hold 0 `Set-Cookie` headers; `dist/` holds 0 uses of `document.cookie` and 0 resource references to a host other than proofline.technology; the browser checks record 0 CSP violations.
- AC-43 (NFR-5): Lighthouse CI with the default mobile profile, median of 5 runs -> LCP <= 2500 ms and CLS <= 0.1 on the home, get-started, trust and Claude Code and Codex pages in both languages and on one synced guide; script resources count 0 and size 0 on those four pages in both languages.
- AC-44 (NFR-7): A synced document holds `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>` and `[x](javascript:alert(1))` -> its built page holds 0 `script`, `iframe`, `object`, `embed` or `style` elements from it, 0 `on*` attributes and 0 `javascript:` URLs, and a placeholder such as `<slug>` in prose shows as visible text.
- AC-45 (NFR-8): `scripts/check-workflows.mjs` passes: every workflow has a top-level `permissions` block that is not `write-all`; no secret other than `TRAFFIC_TOKEN`, and that one only in `snapshot.yml`; `snapshot.yml` has only `schedule` and `workflow_dispatch` triggers.
- AC-46 (indexing): A build without `VERCEL_ENV=production` and without `SITE_INDEXABLE=1` -> every page carries `noindex, nofollow`, `robots.txt` is `Disallow: /`, no `sitemap.xml` exists and the log says `indexing: blocked (<reason>)`; a production build has none of these, has the sitemap, and logs `indexing: allowed`.
- AC-47 (determinism): Two builds from the same pin and lock -> the same sha256 over the sorted `dist/` paths and contents.

## PRD wording changes

The owner accepted all of them and AC-41 to AC-47 (2026-11-19). The exact replacement text is in `PRD-CHANGES.md` next to this file; the PRD itself is not edited here. Changed lines: FR-11, AC-15, FR-14, FR-18, AC-14, FR-20, FR-26, FR-28, AC-39, FR-32, AC-30, AC-31, NFR-4, NFR-7, AC-23, AC-28, AC-32, AC-10, NFR-8, AC-4, AC-34, Q-1, Q-3, Q-5; new AC-41 to AC-47. AC-29 is unchanged.

## Owner decisions (2026-11-19, quoted verbatim)

> Geri dönüşü sadeleştir: eski siteye dönmeyeceğiz (eski site korunmuyor). Geri dönüş, yeni sitenin bir önceki production yayınına Vercel'in normal geri dönüşüyle yapılır. Ayrı prova projesi, 7 günlük bekletme ve Ignored Build Step ile main'i tutma kaldırılsın.

> eski site vercel e bağlıydı ama artık önemi yok bunu bağlarız.

Answers in English: the plan is Hobby (personal, non-commercial open-source project); the existing Vercel project is kept and connected to this repository; the repository is public; the footer wording is decided in `design ui`; the upstream README fixes are the owner's and stay a waiting condition (AC-37).

## Task proposals (titles, with acceptance criteria from the owner's answers)

1. Scaffold and toolchain closure (package.json pins incl. remark-gfm, remark-rehype, rehype-stringify; `.node-version`; astro.config; `.gitignore`).
2. Sync core: pin, lock, fetch, verify, transform, sanitizer fixtures, link map, pin facts, `/llms.txt` and `.md` (AC-41, AC-44, AC-47). The real pin is set only after the upstream README change (AC-37).
3. Site pages (needs `docs/design/DESIGN.md` from `design ui`): four pages x 2 languages, indexes, 404, footer, translation index, stamp. Footer wording comes from `design ui` (Q-3).
4. Search: Pagefind, Component UI under the CSP, CLS.
5. `ci.yml` and checks: check-dist, serve-dist, axe, LHCI, determinism, check-workflows, indexing variants (AC-42, AC-43, AC-45, AC-46, AC-47). Acceptance: the `main` ruleset exists with required status check `ci / verify`, a required PR, no required approvals and blocked force pushes; the setting and its date are recorded in `ops/SETTINGS.md`.
6. `sync.yml`: tag-follow, PR in place, red PR, approval-required observation. Acceptance: the repository setting "Allow GitHub Actions to create and approve pull requests" is on and recorded in `ops/SETTINGS.md`; the repository is public (recorded); one real sync PR shows the approval-required run and the check blocking the merge until it passes.
7. `snapshot.yml` and merge: data branch, issues, token expiry, `ops/TOKENS.md`.
8. Hosting and launch checklist (owner deploys): acceptance: (a) the existing Vercel project of proofline.technology is connected to this repository with production branch `main`; (b) Deployment Protection is Standard or stronger, production deployment retention is at least 7 days, and the Domains redirect www -> apex is permanent, each recorded with its date in `ops/SETTINGS.md`; (c) the plan is recorded as Hobby for a personal, non-commercial open-source project; (d) `ops/LAUNCH.md` holds the FR-32 order with the switch before the rehearsal, the rehearsal steps and result (AC-30) and the promote step after a rollback (AC-31); (e) the curl checks right after the switch pass (robots.txt, AC-29 redirects, headers, `.md` content type, 404 status); (f) a push to `traffic-data` creates no deployment; (g) `ops/old-sitemap.txt` holds the 94 old addresses.
9. Documentation edits: Q-5 (j), applying `PRD-CHANGES.md`, DEC-2 and DEC-3.
10. Launch check script `check:launch`.

Waiting condition of the launch (not a task here): the owner changes the README upstream (no "(5 minutes)" suffix, a single Version line), then the real pin is set (AC-37).

## Open risks

| Risk | Owner action or task |
|---|---|
| The way back covers one step only; a deployment without a site change (for example a stray commit on `main`) moves the target | snapshots stay on `traffic-data` (ADR 0007); owner merges deliberately |
| No new-site rollback target exists between the switch and the second production deployment | hosting task creates the second deployment and rehearses right after the switch |
| After a rollback nothing new goes live until a promote | promote step in `ops/LAUNCH.md` (AC-31) |
| `404.html` might not be served with status 404 | curl right after the switch (task 8) |
| Pagefind Component UI might need inline styles; WebAssembly needs `'wasm-unsafe-eval'` | search task (4) |
| GITHUB_TOKEN sync PR CI might not wait in a visible approval-required state | sync task (6); seen once on a real PR |
| Pagefind or Astro output might differ between two builds | CI task (5); the check names files |
| Scheduled workflows of this public repository can stop silently (60 days, G4) | stale issue from sync.yml; monthly Actions look (task 8) |
| The real pin must follow the README fix; at the candidate pin AC-37 fails | owner upstream (waiting condition), then task 2 sets the pin |
| An upstream rewording of a guarded sentence keeps every sync red | by design; upstream issue text in the red PR |
| `.md` Content-Type override, HSTS default and `git.deploymentEnabled` source branch on Vercel unproven | hosting task (8) |

## Brief items found wrong or contradicted

- Title rule: cutting every H1 at 40 characters contradicts AC-10 ("its own H1") for 3 synced pages at the candidate pin (48, 44, 41 chars); ADR 0002 keeps the full H1 for synced pages.
- Snapshot permissions: `contents: write` alone cannot open the failure, stale and expiry issues (AC-25); `issues: write` added (ADR 0007, and on sync.yml).
- Status file: the brief names `snapshots/latest.json` but lists only `snapshots/<date>.json` and `merged.json`; the status is `merged.json` `last_snapshot`. Same-day manual and scheduled runs collide on a date name, so files use a UTC timestamp.
- Lock scope: the build also needs `README.md` (FR-4, AC-8, AC-9); the lock lists it as a read-only input. The tarball bytes are not hashed, the contents are.
- CSP: without `'wasm-unsafe-eval'` Pagefind's WebAssembly search is expected to fail (inferred); added in ADR 0006.
- Dependencies: the synced set has GFM tables and YAML frontmatter, so remark-gfm (and remark-rehype, rehype-stringify) are needed; their versions are not among the verified pins.
- "No `<script>` on site-written pages" conflicts with JSON-LD and with the Pagefind script on the `/docs/` indexes (site-written per FR-9); the checker exempts those two cases explicitly.
- Codex sentence on Turkish pages: AC-12 exempts only text quoted from a synced page; README is not synced, so the Turkish pages carry a hand translation under the build guard.
- Link counts 289/43/13 are link occurrences; distinct targets per file are 109/40/13.
- README has two Version lines in Status (31-32) as well as in Versioning and license (120-121).
- The anonymous 60/h limit is a problem mainly because hosted runner IPs are shared (inferred), not because the weekly job makes many calls.
- Vercel: a `traffic-data` push makes no deployment only if Vercel reads `git.deploymentEnabled` from `main`'s vercel.json; the orphan branch therefore also carries its own vercel.json and the hosting task checks it with one push.
- Evidence tree note: `docs/decisions.md` is 0 bytes in `.agents/local/scratch/pl-tree/` (the brief does not say whether that is intentional); only its existence matters for link mapping.
