# Task: TASK-023 - Claude Code and Codex page in English and Turkish

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-005
  - TASK-010
  - TASK-021
prd: site

---

## Goal

A developer who uses both Claude Code and Codex opens one page, `/claude-code-and-codex/` or `/tr/claude-code-ve-codex/`, sees how proofline works with each agent and with both together, finds the link to the get-started page, and reads the README's own limit for Codex, taken from the pinned commit.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-8, US-4 (AC-9), AC-12 (this page).

- Design: `/docs/design/DESIGN-marketing.md` sections "Typography use", "Layout rules", "Copy rules" (Turkish pages keep technical terms and proofline's own names in English) and "Gaps" (this page is not drawn: it follows these rules and is specified by its task); `/docs/design/DESIGN.md` sections "Typography" and "Spacing". Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html` (the menu words "Claude Code and Codex" and "Claude Code ve Codex", the command block). A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (addresses, point 4 content files and the stamp, point 5 titles: the page title is "Claude Code and Codex" and "Claude Code ve Codex", 21 and 20 characters), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (the Codex limit sentence is extracted from the README at the pin and guarded: the build fails when it is missing), `/docs/design/ARCHITECTURE.md` section "Trade-offs" (row "EN renders the README sentences; TR hand translation under the same guard").
- Today: TASK-010 produces the pin facts, among them `codex_sentence` (the README Status sentence about Codex), `readme_commands[]` and `readme_inline_spans[]`; TASK-021 writes the get-started page that this page links to.
- README at the candidate pin (`.agents/local/scratch/pl-tree/README.md`): the Codex install lines `git clone https://github.com/furkansarikaya/proofline` and `node proofline/adapters/codex/install.mjs`; the Claude Code plugin lines; the sentence "Run a role on another runtime with `proofline init --role implementer=codex`" in the Quick start; and the Status limit for Codex (as the PRD quotes it: Codex as implementer is supported and the other Codex roles are not yet verified in real use). The text of the real pin is what the build reads.
- Assumption: the page shows, for each agent, its install lines (Claude Code: the plugin lines; Codex: the clone and install lines) and one command that uses both (`proofline init --role implementer=codex`); every command shown is a line of `readme_commands[]` or a member of `readme_inline_spans[]`.
- Assumption: the Turkish limit sentence is "Codex, implementer olarak desteklenir; diğer Codex rolleri gerçek kullanımda henüz doğrulanmadı." (a hand translation of the English README sentence; technical terms stay English); the plan checks its meaning against the real sentence at the pin.
- Assumption: the page title is also the H1.
- Expected scope: `src/content/` page files in both languages (location set by TASK-004), `src/pages/claude-code-and-codex/index.astro`, `src/pages/tr/claude-code-ve-codex/index.astro`, `src/styles/agents.css`, `tests/agents-page.test.mjs`, `tests/fixtures/agents-page/`. 6 paths.

## Acceptance criteria

- AC-1: `/claude-code-and-codex/` and `/tr/claude-code-ve-codex/` are built -> the html element carries `lang="en"` and `lang="tr"`, each page has one H1 equal to its title part ("Claude Code and Codex", "Claude Code ve Codex"), and the title is that text plus the suffix of ADR 0002 point 5 with no "evidence" or "kanıt".
  PRD ids: AC-10
  Covers: FR-8
- AC-2: Each page is read -> it has a part for Claude Code with the two plugin lines, a part for Codex with the clone and install lines, and a part for using both with the command `proofline init --role implementer=codex`; each command is in a block with `lang="en"` and `translate="no"`.
  Covers: FR-8
- AC-3: Every command line shown on the built pages is trimmed and stripped of a trailing comment starting with " #" -> it equals a line of `readme_commands[]`, and an inline command span equals a member of `readme_inline_spans[]` of the pin facts.
  Covers: FR-8
- AC-4: Each page is read -> it shows a link to `/get-started/` (`/tr/baslarken/` on the Turkish page) whose target exists in the build output.
  PRD ids: AC-9
  Covers: FR-8
- AC-5: The English page is read -> it shows the `codex_sentence` of the pin facts word for word, a fixture archive with another sentence shows the other sentence, and the content files hold no typed copy of it.
  PRD ids: AC-9
  Covers: FR-8, NFR-4
- AC-6: The `codex_sentence` is missing from the README of a fixture archive -> `npm run build` exits non-zero and the message names `/claude-code-and-codex/` and the pattern.
  PRD ids: AC-9
  Covers: FR-8, NFR-4
- AC-7: The Turkish page is read -> it shows the Turkish sentence of the Context, which holds the words "Codex", "implementer" and "doğrulanmadı", and the English sentence appears on it only inside an element with `lang="en"`.
  PRD ids: AC-9, AC-12
  Covers: FR-8, FR-17
- AC-8: The Turkish page is read -> all prose and interface text is Turkish, the only elements with `lang="en"` are command blocks, the quoted English sentence and proofline's own names, and the language link of the header leads from one page to the other.
  PRD ids: AC-12
  Covers: FR-17
- AC-9: The two pages are read -> they list each other as `hreflang` alternates with `x-default` to `/claude-code-and-codex/` from the translation index, the Turkish content file records the hash of the English one so no stale notice shows, and the AC-4 time pattern of the PRD finds 0 matches in both.
  PRD ids: AC-4
  Covers: FR-17
- AC-10: Failure criterion (anti-goal): the task is not done if the Codex limit is typed in a content file instead of read from the pin, if the page claims that Codex is verified for roles other than the implementer, if a command appears that the README does not hold, or if the build stays green when the README sentence is gone, even when both pages look right.

## Out of scope

- Install and first-task steps in full (TASK-021); this page links to them.
- A comparison of Claude Code and Codex or a versus table (PRD US-4 asks for none).
- Extracting the Codex sentence from the README (TASK-010).
- Hooks approval steps for Codex (`/hooks`) and role configuration beyond the one command above.
- The home, trust and not-found pages.

## Constraints

- Expected test exception: none; text, order, links, pin-derived content and build failures have a RED.
- PRD FR-8: the page states the README limit for Codex; NFR-4: the build fails naming page and pattern when the sentence is missing.
- ADR 0002 point 4: the site-written Turkish page is a content file with `translatedFrom` written by `npm run translation:stamp`.
- Turkish prose follows `/docs/design/DESIGN-marketing.md` "Copy rules".
- No new dependency; no inline style or script (ADR 0006).

## Risks

- The Turkish limit sentence is a hand translation of a sentence that upstream can reword; the build detects only a missing English sentence, so a changed meaning is caught only when the stale notice or a review reads it.
- The command `proofline init --role implementer=codex` rests on one README sentence; a README change makes the build fail until the page is edited.
- A reader may take the page as proof that Codex works everywhere; the limit sentence sits next to the Codex part to prevent that.

## Pre-existing defects

none

## Suggested class

STANDARD - two content pages on the existing layout that read the pin facts; no new integration (COMPLEX considered: the build guard reads upstream text)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
