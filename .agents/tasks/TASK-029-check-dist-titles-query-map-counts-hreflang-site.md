# Task: TASK-029 - check-dist: titles, query map, counts, hreflang, sitemap

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-006
  - TASK-011
  - TASK-013
  - TASK-017
  - TASK-019
  - TASK-021
  - TASK-022
  - TASK-023
  - TASK-024
prd: site

---

## Goal

One build check reads the built site and fails, naming page and rule, when a title, a description, the name-and-phrase rule, the query-to-page map, a page count, a hreflang set, the sitemap or the language of a page breaks the rules of the PRD, so that "green but wrong" content cannot reach the launch.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-9, FR-16, and the user-story criteria AC-10, AC-11, AC-12, AC-33, AC-41.

- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` point 3 (translation index, hreflang sets with `x-default`), point 5 (titles and descriptions), point 6 (the check rules); `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 4 (`check-dist.mjs` content); `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 2 (the lock holds the counts).
- Today: `scripts/check-dist.mjs` has the commands `links`, `compare` and `determinism` and exports `listFiles`, `hashTree`, `compareTrees` and `checkLinks`; `cheerio` 1.2.0 and `yaml` 2.9.1 are dev dependencies; `sync/lock.json` comes from TASK-007.
- The check is a new command `node scripts/check-dist.mjs content dist` with the npm script `check:content`; TASK-033 puts it into `ci.yml`. A synced page is a page of the address table that comes from the lock (`/docs/guides/{name}/`, `/tr/docs/guides/{name}/`, `/docs/concepts/{name}/`, `/docs/proof/`, `/docs/limits/`, `/docs/skills/{skill}/`); every other page is site-written, including `/docs/`, `/tr/docs/`, `/docs/skills/` and `404.html`.
- The sitemap exists only in an indexable build (TASK-006): the sitemap rules run on a build made with `SITE_INDEXABLE=1`; on a closed build the command prints "sitemap: skipped (closed build)" and runs the other rules.
- Expected scope: `scripts/check-dist.mjs`, `scripts/lib/dist-content.mjs` (new), `tests/check-content.test.mjs` (new), `tests/fixtures/check-content/` (new, small built trees: a passing one and one failing tree per rule), `package.json`. 5 paths.

## Acceptance criteria

- AC-1: A page's `title` element, `meta name="description"` tag, `og:title`, `og:description` or JSON-LD `name` holds the word proofline (whole word, case-insensitive, not part of an address) but not the phrase of the page's language ("a deterministic engineering team for Claude Code and Codex", Turkish "Claude Code ve Codex için deterministik bir mühendislik ekibi") in the same element -> `content` exits 1 and names the page, the element and the language; a tree where every such element holds the phrase exits 0.
  PRD ids: AC-10.
  Covers: FR-16
- AC-2: A site-written page has `evidence` in its `title` element or `og:title` (case-insensitive, also inside a word) or, after Turkish lower-casing, `kanıt` (also inside a word such as "kanıtlar") -> `content` exits 1 and names the page; the same word in the `title` element of a synced page, and in the description of a site-written page, does not fail.
  PRD ids: AC-10.
  Covers: FR-16
- AC-3: A site-written page title has a page part longer than 40 characters (the part before ` | proofline`) or a total longer than 120 characters -> `content` exits 1 and names the page and the length; a synced page title longer than 120 characters prints a warning and does not change the exit status.
  PRD ids: AC-10.
  Covers: FR-16
- AC-4: A page description is shorter than 70 or longer than 160 characters, or `og:title` or `og:description` differs from the `title` element or the description -> `content` exits 1 and names the page and the value.
  PRD ids: AC-10.
  Covers: FR-16
- AC-5: The query-to-page map of FR-9 is checked against `dist/` -> `content` exits 1 and names the query when its page is missing, and exits 0 when all 7 are present: "Claude Code workflow" has `/docs/guides/daily-use/` and `/docs/concepts/workflow/`; "Claude Code and Codex" has `/claude-code-and-codex/`; "multi-agent coding workflow" has `/docs/concepts/roles/` and `/docs/concepts/gates/`; "AI code review with evidence" has `/trust/` and `/docs/concepts/evidence/`; "TDD with AI agents" has `/docs/concepts/testing/`; "Claude Code skills" has `/docs/skills/`; "yapay zeka ajan iş akışı" has `/tr/docs/guides/gunluk-kullanim/`.
  PRD ids: AC-11.
  Covers: FR-9
- AC-6: The number of built skill pages (`/docs/skills/{skill}/index.html`) differs from the number of `skills/*/SKILL.md` entries of `sync/lock.json`, or the number of built concept pages differs from the number of `docs/concepts/*.md` entries -> `content` exits 1 and prints both numbers; the numbers are read from the lock, so a fixture lock with 3 skills and 2 concepts passes a tree of 3 and 2 and fails a tree of 4 and 2.
  PRD ids: AC-41.
  Covers: FR-9
- AC-7: A built English page of the four site pages has `lang` attribute of the `html` element other than `en`, a Turkish page has `lang` attribute of the `html` element other than `tr`, or a `blockquote`, a `q` or the real-output excerpt on a Turkish page has no `lang` attribute of its own -> `content` exits 1 and names the page and the element.
  PRD ids: AC-12.
  Covers: FR-17
- AC-8: A Turkish page of the four site pages holds in a text block outside `pre`, `code`, `kbd` and any element with a `lang` attribute at least two distinct words of the list `the`, `and`, `with`, `that`, `this`, `are`, `you`, `your` -> `content` exits 1 and names the page and the block; the Turkish sentence "Dayanaksız iddiayı bir script engeller." passes, and the English sentence "The script blocks the claim and you can read it." fails in a `p` and passes in `<p lang="en">`.
  PRD ids: AC-12.
  Covers: FR-17
- AC-9: A page with a Turkish version lists in its head `link rel="alternate" hreflang` tags for `en`, `tr` and `x-default` (the English address), all with `https://proofline.technology` addresses, and the Turkish page lists the same three -> `content` exits 1 and names the page when one entry is missing or not reciprocal; a page without a Turkish version holds 0 `hreflang` links.
  PRD ids: AC-33.
  Covers: FR-17
- AC-10: A page's hreflang entries differ from the `xhtml:link` entries of its `url` element in `dist/sitemap.xml` -> `content` exits 1 and names the page; a tree where page and sitemap list the same set exits 0.
  PRD ids: AC-33.
- AC-11: `dist/sitemap.xml` holds an `http://` address, the address of `404.html`, an address under `/pagefind/`, a `.md` address, or lacks the address of an indexable page of `dist/` -> `content` exits 1 and names the address.
  PRD ids: AC-33.
- AC-12: `content` runs on a directory with no HTML page -> it exits 1 with the line "content: no pages found".
- AC-13: Failure criterion (anti-goal): the task is not done if a rule passes on a fixture that breaks it (every rule above has a failing fixture in `tests/fixtures/check-content/`), if the page lists are typed instead of read from `dist/` and the lock, or if `content` exits 0 on the skipped sitemap rules in an indexable build, even when `npm run build` is green.

## Out of scope

- The privacy, script and CSP checks (TASK-030), the axe run (TASK-031), the guards of AC-3 and AC-4 of the PRD for install commands and install times (TASK-020), the checks of `llms.txt` and the Markdown copies (TASK-012), the not-found page structure (TASK-024).
- Writing or changing any page text, title builder or sitemap generator (TASK-004, TASK-006 and the page tasks); this task only reads their output.
- Putting the command into `.github/workflows/ci.yml` (TASK-033).
- Judging Turkish quality: AC-8 is a guard for obvious English prose, not a proof.

## Constraints

- ADR 0002 point 6 fixes the match rules: the name test is whole word, case-insensitive, not preceded or followed by `[\w./-]`; English `/evidence/i`; Turkish `/kan[ıi]t/` on the text after `toLocaleLowerCase('tr')`.
- ADR 0001: plain `.mjs`, `node --test`, no new dependency (cheerio is present).
- The check reads `dist/` and `sync/lock.json` only; it makes no network call.

## Risks

- The word list of AC-8 can flag a Turkish sentence that quotes English words; such text belongs in an element with its own `lang`.
- A page missing from the build because a page task is not done fails the query map; this is intended, which is why the task depends on the page tasks.
- The synced/site-written split is derived from the address table; a new synced address kind needs a rule here.

## Pre-existing defects

none

## Suggested class

COMPLEX - new check module read by CI, two modules (script and tests) with fixture trees (the check gates the launch content)

## Verification commands

- `npm ci`
- `npm test`
- `SITE_INDEXABLE=1 npm run build`
- `npm run check:content`
- `npm run check:links`
