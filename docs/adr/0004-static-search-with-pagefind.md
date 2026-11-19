# 0004. Search the documents with Pagefind's Component UI on docs pages only

Status: accepted
Date: 2026-11-19

## Context

The user asked for static, serverless document search ("doküman araması (statik, sunucusuz)"). REVIEW (Never mentioned) asks how a reader finds one of 28 skills, 13 concepts and 7 guides. NFR-1 forbids third-party scripts and anything that counts visitors; NFR-5 allows JavaScript on site-written pages only when a feature needs it; NFR-6 asks for WCAG 2.2 AA on the four site pages.

## Decision

Pagefind 1.6.0 runs as a post-build step `pagefind --site dist` (output `/pagefind/`). Only elements marked `data-pagefind-body` are indexed: the content of synced pages and of the four site content pages (both languages); home navigation, indexes, 404 and chrome are not. Pagefind splits the index by `<html lang>`. The Component UI (not the legacy Default UI) is placed on `/docs/`, `/tr/docs/` and the docs layout; the home, get-started, trust and Claude Code and Codex pages ship no script and link to `/docs/#search`. Without JavaScript `/docs/` lists every page (ADR 0002). The Turkish search says in one line that only Turkish pages are searched and links to the English search. `/pagefind/` is excluded from the sitemap and is not treated as pages by the link check. The UI's space is reserved in CSS (no layout shift).

## Alternatives considered

- Own index with MiniSearch, Fuse.js or lunr: the whole index downloads on first use, and tokenizing Turkish and English, chunking and the UI are code the site would own. Rejected on size and maintenance (A-13: one maintainer).
- Algolia DocSearch: a third-party service; queries leave the site and its script loads from another host (NFR-1, the strict CSP of ADR 0006), and it needs an application. Rejected.
- Starlight's built-in search: it is Pagefind inside a theme that is rejected in ADR 0001. Rejected.
- No search, indexes only: smallest, but the user asked for search. Rejected.

## Consequences

- Easier: no server, no third party, payload loaded on input focus; multilingual index by `lang` without configuration.
- Harder: the Component UI's behavior under the CSP of ADR 0006 is unknown: it may inject inline styles, and Pagefind's search runs WebAssembly, which needs `'wasm-unsafe-eval'` in `script-src` (included in ADR 0006). Fallback if inline styles are injected: a `style-src` relaxation on `/docs/*` and `/tr/docs/*` only, recorded in ADR 0006's follow-up. Determinism of the Pagefind output is unproven: if two builds differ only under `/pagefind/`, the determinism check names the files and the search task decides.
- Accessibility: the widget is covered by the axe run and the keyboard pass on `/docs/` (report-only, ADR 0008); it is not on the four gated pages.
- Follow-up (search task): prove the UI under the real CSP with the `securitypolicyviolation` listener; measure CLS on `/docs/`.

## Evidence

- verified (A3): Pagefind 1.6.0 on npm; post-build, no server; multilingual per `<html lang>`; `data-pagefind-body` restricts indexing; `--site`, `--output-subdir`; Component UI replaces the legacy Default UI, claims WAI-ARIA patterns, loads on input focus; about 100 kB total for most sites; no WCAG audit stated.
- inferred: Pagefind's search runtime uses WebAssembly (known design of the project; not read this session), so strict CSP needs `'wasm-unsafe-eval'`.
- unverified: inline style injection by the Component UI; byte-identical Pagefind output across two builds.
