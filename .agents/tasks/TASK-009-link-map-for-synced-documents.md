# Task: TASK-009 - Link map for synced documents

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-007
  - TASK-008
prd: site
---

## Goal

Every relative link and image in a synced document is rewritten at build time: a target inside the synced set leads to the site page, a target outside it leads to its GitHub address at the pinned commit, and a target that does not exist at the pinned commit stops the build with a message naming the file, the line and the link.

## Context

Request (user's words, from the technical design step, quoted in `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md`):

> sabitlenmiş commit'in belgelerini build sırasında alan bir script; bağlantıları site adreslerine çeviren, eşitleme kümesi dışındakileri GitHub adresine döndüren, Türkçe kılavuzları da alan, deterministik

- Source requirements in `/docs/product/site/PRD.md`: FR-14 (a relative link whose target is in the synced set leads to the site page; one outside it leads to the GitHub address of that file at the pinned commit; the build fails on a target that does not exist at the pinned commit) and the user story AC-18 (0 unresolved links; the build fails only when the target does not exist).
- ADR `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 4 (links mapped by resolved repository path; `.md` dropped; anchors kept; `/tree/` for a directory; absolute URLs untouched; fragments into synced pages checked and only warned; images become a link to the GitHub blob, never an image from another host) and `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` point 2 (the address table). Architecture component C16.
- Inputs from earlier tasks: the lock and the cache listing of the whole archive (TASK-007: `sync/lock.json`, `.cache/sync/{commit}/` and its listing of files and directories); the transform that reports links and images with their line and accepts a rewrite function (TASK-008).
- Address rules (ADR 0002 point 2): guide `docs/guides/{name}.md` to `/docs/guides/{name}/`; Turkish guide `docs/guides/tr/{name}.md` to `/tr/docs/guides/{name}/`; concept `docs/concepts/{name}.md` to `/docs/concepts/{name}/`; `docs/proof.md` to `/docs/proof/`; `docs/limits.md` to `/docs/limits/`; `skills/{skill}/SKILL.md` to `/docs/skills/{skill}/`.
- GitHub address: `https://github.com/furkansarikaya/proofline/blob/{commit}/{path}` for a file and `https://github.com/furkansarikaya/proofline/tree/{commit}/{path}` for a directory.
- Expected scope (5 paths): `scripts/lib/linkmap.mjs`, `scripts/lib/transform.mjs` (use of the rewrite function), `tests/linkmap.test.mjs`, `tests/fixtures/linkmap/`, `package.json` (script `check:synced-links`).
- Assumption: the fragment of a rewritten link is kept as written (`#real-output` stays), and the same rule applies to GitHub addresses.
- Assumption: a link whose resolved path leaves the repository root (too many `..`) is treated as a target that does not exist.

## Acceptance criteria

- AC-1: A document `docs/guides/daily-use.md` links `../concepts/workflow.md` and `../concepts/workflow.md#real-output` and both targets are in the synced set -> the rendered links lead to `/docs/concepts/workflow/` and `/docs/concepts/workflow/#real-output`.
  Satisfies: AC-18.
  Covers: FR-14
- AC-2: Documents link a guide in the same folder, a skill file, `proof.md` and `limits.md` -> the rendered links lead to `/docs/guides/existing-project/`, `/docs/skills/tdd-proof/`, `/docs/proof/` and `/docs/limits/`.
  Satisfies: AC-18.
  Covers: FR-14
- AC-3: A Turkish guide `docs/guides/tr/gunluk-kullanim.md` links `../daily-use.md` and its sibling `prompt-katalogu.md` -> the output renders links that lead to `/docs/guides/daily-use/` and `/tr/docs/guides/prompt-katalogu/`.
  Satisfies: AC-18.
  Covers: FR-14
- AC-4: A document links `../../references/x.md` (a file present in the archive and outside the set), `../decisions.md`, and `../../assets/` (a directory) -> the links lead to the `blob` address, the `blob` address and the `tree` address at the pinned commit, with the commit written in full, and an anchor on the first link is kept.
  Satisfies: AC-18.
  Covers: FR-14
- AC-5: A document links a file that does not exist in the archive at the pinned commit, and a second document links a directory that does not exist -> the check exits non-zero and prints one line for each broken link holding the source file, the line number and the link as written; with three broken links in one run all three lines are printed.
  Satisfies: AC-18.
  Covers: FR-14
- AC-6: A document links `https://example.com/a`, `mailto:a@example.com` and `#heading` -> the output keeps the three targets unchanged and the check does not look them up in the archive.
  Covers: FR-14
- AC-7: A document links a synced page with a fragment that no heading of that page has -> the check prints a warning naming the file, the line and the link and exits 0.
  Satisfies: AC-18.
  Covers: FR-14
- AC-8: A document holds an image `![a](../assets/img.png)` that is present in the archive -> the output holds a link to the `blob` address of that image at the pinned commit and 0 `img` elements; an image path that is absent fails as in AC-5.
  Covers: FR-14
- AC-9: A link is written with more `..` segments than the folder depth allows -> it is reported as a missing target as in AC-5.
  Covers: FR-14
- AC-10: `npm run check:synced-links` runs against the live archive of the launch pin with network access -> it prints the number of links checked (at least 1) and 0 unresolved, and exits 0.
  Satisfies: AC-18.
  Covers: FR-14
- AC-11: Failure criterion (anti-goal): the task is not done if a link is left relative and so points to an address that does not exist on the site, if a missing target only warns, if a link inside the synced set is sent to GitHub, or if the check reads the cache instead of the lock and the archive listing, even when the fixture tests pass.

## Out of scope

- Fetching and verifying the archive (TASK-007) and the Markdown transform itself (TASK-008).
- Rewriting links in the Markdown copies (TASK-012 reuses this map) and link checking of the built HTML (`npm run check:links` and TASK-029).
- Links in the pages written for the site and the `translated-from` staleness (TASK-004, TASK-013).
- Checking external addresses; absolute URLs are left as written.

## Constraints

- Expected test exception: the live-archive run of AC-10 needs the network and does not run under `npm test`; the fixtures of `tests/fixtures/linkmap/` cover every rule offline.
- ADR 0003 point 4: links are mapped by resolved repository path; fragments into synced pages only warn; absolute URLs are untouched.
- ADR 0001: plain `.mjs`; no dependency is added.

## Risks

- One missing target upstream keeps every later sync red (ADR 0003 consequences); that is the intended behaviour of AC-5, and the message must be precise enough to file upstream.
- The Turkish guides link English files by relative path; the rule of AC-3 depends on the address table not changing.
- Heading ids of the target pages come from the transform (TASK-008); a difference from GitHub's slugs would make the fragment warning noisy, not wrong.

## Pre-existing defects

none

## Suggested class

COMPLEX - build-time rewriting of a public address contract over a fetched archive (two modules, the lock and the transform) with a hard failure path

## Verification commands

- `npm ci`
- `npm test`
- `npm run check:synced-links`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
