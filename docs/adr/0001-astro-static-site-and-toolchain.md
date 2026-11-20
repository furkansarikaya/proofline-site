# 0001. Build the site with Astro 7 as a static site, npm and Node 24.x

Status: accepted
Date: 2026-11-19

## Context

The site is static, needs no server and runs on free hosting (NFR-2). The four site-written pages load JavaScript only when a feature needs it (NFR-5), so the framework must be able to ship pages with zero script of its own (the four site pages then carry one small controls script, ADR 0006 amendment). Synced Markdown must be rendered with raw HTML made inert (NFR-7), independent of how the framework processes Markdown. Two languages with different slugs (FR-17) and generated index pages (FR-9) are needed. The user asked for Astro if suitable ("önceki site Astro'ydu; uygunsa Astro"). The repository is greenfield: `git ls-files` lists only `.agents/`, `.claude/`, `.codex/`, `docs/`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`.

## Decision

The site is an Astro 7 project pinned exactly to 7.4.13 with `output: 'static'`, TypeScript for site code under `src/`, plain `.mjs` for build scripts under `scripts/`, no UI-framework integration (no React/Vue/Svelte island), npm with a committed `package-lock.json` installed by `npm ci`, and Node 24.x fixed in three places that must agree: `.node-version` (local and CI via `actions/setup-node` `node-version-file`), `package.json` `engines.node: "24.x"` (Vercel) and the Vercel project setting. Tests: `node --test` for scripts and units, Playwright for browser checks (ADR 0008). Synced Markdown is not rendered by Astro's Markdown processor; the sync transform (ADR 0003) produces sanitized HTML that Astro pages insert.

## Alternatives considered

- Starlight (Astro docs theme): ships its own theme, components and client script (search UI, theme toggle), which fights a custom design system and the zero-script budget of the four site pages (NFR-5); its i18n model assumes one slug tree per locale, while the Turkish site pages have their own slugs. Lost on NFR-5 and FR-17.
- Next.js static export: every page carries the React runtime for hydration, so the four site pages would load JavaScript without a feature that needs it (NFR-5). Lost on NFR-5.
- Eleventy: lighter and script-free by default, a real contender; weaker typed content collections and no first-party i18n helpers, and the previous site and the user's preference are Astro. Lost on fit with the user's request and on types for the translation index.
- VitePress: Vue-based, client-side router and hydration on every page (NFR-5), docs-theme oriented like Starlight. Lost on NFR-5.

## Consequences

- Easier: zero-JS pages by default; `404.astro` builds to `404.html`; `build.format: 'directory'` and `trailingSlash` match the address table of ADR 0002; the old site's knowledge (Astro) carries over.
- Harder: Astro 7's default Markdown processor (Sätteri) has no stated raw-HTML behavior, so the design does not use it for synced content; the transform carries its own unified/remark pipeline and fixture tests (ADR 0003).
- Follow-up: the scaffold task pins exact versions of every dependency in `package.json` (no ranges) and records the ones not verified here (remark-gfm, remark-rehype, rehype-stringify).
- Node: Astro 7.4.13 needs Node >=22.23.4 and @lhci/cli needs >=22.19.0, both met by 24.x; the local machine has v24.14.1.

## Evidence

- verified (A1): Astro latest 7.4.13, `engines.node >=22.23.4`; Sätteri is the default Markdown processor since v7; raw-HTML handling not stated.
- verified (A2): `output`, `build.format`, `trailingSlash`, `404.astro` -> `404.html`, `glob()` loader with `base`.
- verified (A4, A6): @lhci/cli 0.16.1 needs Node >=22.19.0; local Node v24.14.1, npm 11.11.0.
- verified (V10): Vercel offers Node 26.x, 24.x, 22.x; `engines.node` overrides the dashboard.
- verified (survey): the old site served assets under `/_astro/` (`.agents/local/scratch/home.html`), consistent with the user's statement that it was Astro.
- inferred: Starlight and VitePress ship client script on every page (general knowledge of the products, not read in this session).
- unverified: Vercel reads `.node-version` (not stated; `engines.node` is the setting Vercel honours, V10).
