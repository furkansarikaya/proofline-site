# 0002. Fix the address table, two locales without fallback, one translation index, and the title rules

Status: accepted
Date: 2026-11-19

## Context

Q-5 (a), (f), (g), (n), (o) and part of (p) (navigation, Turkish index pages, preview image) are left to this design. FR-17 forbids a /tr/ address for a page without a translation; AC-33 requires reciprocal hreflang in the page and in the sitemap; FR-25 puts the synced pages under /docs/ and /tr/docs/; FR-16 and AC-10 fix the name+phrase rule and the "evidence"/"kanıt" ban on site-written titles; FR-18 and AC-14 require a staleness notice; REVIEW R3-1 says a site-written Turkish page must be compared with the English page of the site repository, R3-7 asks for case and substring rules.

## Decision

1. Locales: Astro `i18n` with `locales: ['en','tr']`, `defaultLocale: 'en'`, `routing.prefixDefaultLocale: false`, and NO `fallback`. `build.format: 'directory'`, `trailingSlash: 'always'`; vercel.json `trailingSlash: true`.
2. Address table (complete; anything else is 404):

| Page | English | Turkish |
|---|---|---|
| home | `/` | `/tr/` |
| get started | `/get-started/` | `/tr/baslarken/` |
| trust | `/trust/` | `/tr/guven/` |
| Claude Code and Codex | `/claude-code-and-codex/` | `/tr/claude-code-ve-codex/` |
| docs index | `/docs/` | `/tr/docs/` |
| guide | `/docs/guides/<name>/` (5) | `/tr/docs/guides/gunluk-kullanim/`, `/tr/docs/guides/prompt-katalogu/` |
| concept | `/docs/concepts/<name>/` (13) | none |
| proof, limits | `/docs/proof/`, `/docs/limits/` | none |
| skills | `/docs/skills/` index, `/docs/skills/<skill>/` (28) | none |
| not found | `/404.html` (one page, an `lang="en"` block and a `lang="tr"` block) | same page |
| machine files | `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `<page>.md` (ADR 0003), `/pagefind/` (ADR 0004) | |

Turkish slugs are ASCII, the convention the upstream repository already uses for its Turkish file names (`gunluk-kullanim.md`, `prompt-katalogu.md`). No `/docs/guides/` or `/docs/concepts/` index page exists; breadcrumbs link to `/docs/#guides` and `/docs/#concepts`. Counts are derived from the lock (ADR 0003), never typed.
3. Translation index: one module (`src/` translation index, built from the Turkish guides' `translated-from` header and the `translationOf` frontmatter of site-written Turkish pages) is the only source for the `<link rel="alternate" hreflang>` tags of a page, the sitemap `xhtml:link` entries and the language switcher. Pairs: the four site pages, `/docs/` with `/tr/docs/`, and the two guide pairs. Each paired page lists `en`, `tr` and `x-default` (the English address). The sitemap is an own Astro endpoint, not @astrojs/sitemap, so AC-33 reciprocity cannot drift between page and sitemap. On a page without a translation the switcher links to `/tr/docs/` (docs pages) or `/tr/` (others) and says that the page has no Turkish version; no hreflang is printed.
4. Site-written pages are content files (Markdown with frontmatter, rendered by Astro layouts) so their content can be hashed. Staleness of a site-written Turkish page (Q-5 o): frontmatter `translatedFrom: { page: <English content file>, hash: <sha256> }`, where the hash is the sha256 of the English content file in the site repository with LF line ends and trimmed; `npm run translation:stamp <page>` writes it after a human confirms the translation. A mismatch prints a build warning and renders the notice (exit 0, NFR-4). Turkish guides compare the header blob with the git blob id of the English source at the pin (computed from the tarball content).
5. Titles and descriptions (Q-5 f): site-written pages: `<title>` = `<page title> | proofline: a deterministic engineering team for Claude Code and Codex` (Turkish: `<page title> | proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi`), the page title at most 40 characters (the build fails above), total at most 120; the home page title is the name and phrase only. Synced pages: `<title>` = the full H1 (never cut, AC-10 "its own H1") + the same suffix; above 120 characters the build warns (longest at the candidate pin: exactly 120). Description: a lead text (site pages: frontmatter; skills: frontmatter `description`; other synced pages: first paragraph as plain text) cut at a word boundary with "…" so that lead + ` proofline: <phrase>.` is 70 to 160 characters (the suffix alone is 71 EN / 74 TR). `og:title` equals `<title>`, `og:description` equals the description; JSON-LD `WebSite` (home pages only) `name` equals `proofline: <phrase>`.
6. Title rule check (Q-5 g, n), in the dist checker on the built HTML: the ban applies to `<title>` and `og:title` of site-written pages (the four pages, both languages, the indexes and 404); English: case-insensitive substring `/evidence/i`; Turkish: `/kan[ıi]t/` on the text after `toLocaleLowerCase('tr')` (substring, so `kanıtı`, `kanıtlar` match). The name test is whole word, case-insensitive `proofline` not preceded or followed by `[\w./-]` (so a repository URL is not "the name"); when it matches, the exact phrase of the page language must appear in the same element.
7. Preview image: one static, text-free `public/og-default.png`, 1200x630, made in the UI design task, with a localised `og:image:alt`; no runtime image generation.
8. Navigation (Q-5 p): header Home, Get started, Docs, Trust, Claude Code + Codex, GitHub (repository link), language switch; footer per ADR 0006. `/docs/` lists every page grouped (guides, concepts, proof and limits, skills) and works without JavaScript; `/tr/docs/` lists the two Turkish guides and then a labelled list of English pages, each link text saying the page is in English (AC-13). The wording of all interface text belongs to the UI design task.

## Alternatives considered

- Astro i18n `fallback`: renders fallback content under a /tr/ address for an untranslated page, which FR-17 forbids. Rejected.
- @astrojs/sitemap with its `i18n` option: it pairs pages by identical path under locale prefixes; the Turkish pages have their own slugs (`/tr/guven/`), and page tags would come from a second source, so AC-33 could drift. Rejected.
- Hand-rolled locale routes with no Astro `i18n` config: possible, but loses `Astro.currentLocale` and the locale helpers for nothing; the translation index is needed in both cases. Rejected as more code.
- Cutting every H1 to 40 characters (the brief's proposal): at the candidate pin three synced H1s are longer (48, 44, 41 characters), so the `<title>` would no longer be "its own H1" (AC-10). Rejected; the 40-character cap is kept for site-written titles only.

## Consequences

- Easier: one source for hreflang, sitemap and switcher; the checker can compare page tags with sitemap entries exactly.
- Harder: every new site-written Turkish page needs `translationOf` and a stamp; a forgotten stamp shows the notice (a warning, by design).
- PRD wording (owner): FR-18 and AC-14 say "the English source of the pinned commit" for site-written pages; this ADR compares with the English content file of the site repository (REVIEW R3-1).
- Contract: the address table is public (search engines, the sitemap); changing it later needs redirects that FR-19 does not plan.

## Evidence

- verified (A2): `prefixDefaultLocale: false` default, `fallback` creates content for untranslated pages, no built-in hreflang emitter, @astrojs/sitemap `i18n`/`filter`/`serialize`, `build.format`, `trailingSlash` handled by the host.
- verified (V7): vercel.json `trailingSlash: true` gives a 308 to the slash form; paths with a file extension do not redirect.
- verified (survey): H1 lengths 48/44/41; suffix lengths 72 (EN) and 75 (TR); longest synced title 120; both Turkish headers' blob ids equal `git hash-object` of the English files; 28 SKILL.md carry a frontmatter `description`.
- verified (survey): the old sitemap used `x-default` alternates (`.agents/local/scratch/sitemap.txt`).
- inferred: search engines accept a reciprocal set that includes `x-default` (common practice; not read this session).
