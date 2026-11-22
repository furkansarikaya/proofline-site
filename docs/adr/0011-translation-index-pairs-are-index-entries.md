# 0011. Register each site-written page pair as one entry of the translation index

Status: accepted
Date: 2026-11-23

## Context

ADR 0002 point 3 builds the translation index from the `translated-from` header of the Turkish guides and the `translationOf` frontmatter of site-written Turkish pages. TASK-004 registers the home pair, whose pages are `.astro` files without frontmatter, and its criterion AC-12 requires that a new pair is one index entry with no other file changed. `node --test` loads the index without Vite, so a glob over content files is not available there. The product owner accepted this narrowing on 2026-11-23, in the batch run of TASK-004.

## Decision

1. Site-written pairs (home, get started, trust, Claude Code and Codex, docs index, contact) are entries `{ en, tr }` of `PAIRS` in `src/lib/translations.ts`. Turkish guide pairs keep coming from their `translated-from` headers (TASK-013). `translationOf` frontmatter is not used.
2. The index stays the only source of the `hreflang` tags, the sitemap alternates and the language switcher target. ADR 0002 point 3 is narrowed by this ADR for site-written pages and is otherwise unchanged; ADR 0002 keeps its status `accepted`, as ADR 0010 did for point 2.
3. Staleness of a site-written page keeps `translatedFrom { page, hash }` (ADR 0002 point 4).
4. The switcher target of a page without a pair is `/tr/docs/` for a docs page and `/tr/` for any other page, and it says that the page has no Turkish version (ADR 0002 point 3; AC-11 of TASK-004). The sentence in `docs/design/DESIGN.md` (header controls rule 3) is brought into line with it.

## Alternatives considered

- `translationOf` frontmatter read at build time: two places per pair, fails AC-12, and unavailable to `node --test` without a second file reader. Rejected.
- Pairs derived from the Astro i18n routes: Turkish slugs differ from the English ones, which is why ADR 0002 rejected path-based pairing for the sitemap. Rejected.

## Consequences

- A page task adds one line to `PAIRS`. A forgotten entry shows as a missing alternate, which the reciprocity check of TASK-029 reports.
- The C18 row of `docs/design/ARCHITECTURE.md` needs no change; its boundary row now lists `isStale(source, options)` and `checkStale(page, source, options)`, because a guide (blob ids) and a site page (frontmatter hash) need different inputs.

## Evidence

- verified (TASK-004 criteria AC-9, AC-11, AC-12, AC-13, AC-14): one index feeds the head tags and the switcher target; stale checks cover both kinds.
- verified (ADR 0002 points 3 and 4, ADR 0010 point 2): the index stays the single source and the pair rule is unchanged.
