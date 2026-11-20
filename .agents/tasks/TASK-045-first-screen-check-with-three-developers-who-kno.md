# Task: TASK-045 - First-screen check with three developers who know GitHub Spec Kit (owner step)

---
origin: prd:site
type: chore
size: S
depends_on:
  - TASK-018
  - TASK-019
prd: site
---

## Goal

Before the launch the product owner shows the first screen of the home page to three developers who know GitHub Spec Kit, records what each says, and the launch has a recorded go or no-go on whether the difference from Spec Kit (proofline enforces its rules with scripts) shows without help.

## Context

- PRD requirements: FR-29 (the check, its 2-of-3 rule, the redo after a no-go), AC-35, DEC-3 (`/docs/product/site/DECISION.md`, already carrying the 2-of-3 rule). The check exists because the whole promotional design rests on one claim: the page shows that a script blocks a claim that has no proof.
- UI surface: marketing. Design documents: `/docs/design/DESIGN-marketing.md` (sections "Idea and argument" and "States of the first screen"; the section "Gaps" says the check has not been run and the design is not yet a go) and `/docs/design/DESIGN.md`. Approved look reference: `/docs/design/references/direction-c/` and its samples `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html`. Where the sample and the design document differ, the design document wins. The check is made on the built home page of the site (TASK-019 with the diagram of TASK-018), not on the sample.
- Rule of FR-29, quoted from the PRD: each developer looks at the first screen for one minute, then says without prompting what differs; a go is at least 2 of the 3 saying in their own words that proofline enforces its rules with scripts; after a no-go the promotional design is redone, the check is repeated with 3 developers, and the launch waits for a go.
- The developers are found and recorded by the product owner. Assumption: because the repository is public, the record holds labels `dev-1` to `dev-3`, never names, e-mail addresses or employers.
- The record file `ops/FIRST-SCREEN-CHECK.md` is created by this task. Step 4 of `ops/LAUNCH.md` (TASK-040) points to it.
- Expected scope: `ops/FIRST-SCREEN-CHECK.md` (1 path).

## Acceptance criteria

- AC-1: User step: the owner shows the first screen of the built home page (English; the first viewport of the page as served from the preview or production build) to 3 developers who each say they know GitHub Spec Kit, each looks at it for one minute, and the owner asks only "what differs?" afterwards -> `ops/FIRST-SCREEN-CHECK.md` holds a section "Round 1" with the date (UTC), the address and the commit of the site repository the screen was built from, the viewport width and the language shown.
  Covers: FR-29
- AC-2: The record of a round is read -> it holds 3 entries with the headings `### dev-1`, `### dev-2` and `### dev-3`; each entry has a line "knows Spec Kit: yes" (as the developer stated), the answer quoted word for word in a `> ` block in the language the developer spoke, and a line "says proofline enforces its rules with scripts: yes" or "no" as judged by the owner from the quoted words.
  PRD ids: AC-35
  Covers: FR-29
- AC-3: The yes answers of a round are counted -> the section contains a last line `result: go` when at least 2 of the 3 entries say "yes", and `result: no-go` otherwise, with the count (for example "2 of 3") on the same line.
  PRD ids: AC-35, DEC-3
  Covers: FR-29
- AC-4: A round ends with `result: no-go` -> the record keeps that round unchanged, states that the promotional design is redone in a separate task and that the check is repeated with 3 developers, and a new section "Round 2" is added when the repeated check is done (then "Round 3" for a third round); this task stays open until a round ends with `result: go`.
  PRD ids: AC-35
  Covers: FR-29
- AC-5: Failure criterion (anti-goal): a round does not count if the owner named the difference, the words "script" or "scripts" or the product name to a developer before the answer, if fewer than 3 developers answered, if an answer is paraphrased instead of quoted, or if the screen shown was the sample file instead of the built home page; the record marks that round "void" and the round's section contains no `result: go` line, even when every developer says "yes".

## Out of scope

- Redoing the promotional design after a no-go: it is a separate design task the lead creates.
- Choosing, recruiting or paying the developers, and any personal data about them.
- Editing `/docs/design/DESIGN-marketing.md`, including its "Gaps" line about the check; the lead decides whether to update it after the result.
- Turkish first-screen testing: the check is made on the English page (the PRD names no Turkish check).
- Measuring A-1 (understanding in about a minute), which no metric covers (Q-2).

## Constraints

- Expected test exception: an owner step with three real people; a test-first RED does not exist. Tested instead by the recorded sections of `ops/FIRST-SCREEN-CHECK.md` and the `result:` line.
- The developers' words are quoted verbatim in `> ` lines in their own language; every other line is English.
- Code tasks never wait on this decision except the cutover (TASK-047, which depends on this task); a no-go reopens the design, not this task's scope.

## Risks

- A no-go reopens the design and delays the launch; that is the purpose of the check.
- The owner's wording of the question can bias the answers; AC-5 bounds it to "what differs?" and voids a round that was prompted.
- Three developers is a small sample; the PRD fixes the number and the 2-of-3 rule, so the task does not widen it.
- The check says nothing about the Turkish page.

## Pre-existing defects

none

## Suggested class

TRIVIAL - one new record document, no executable code, no integration

## Verification commands

- `npm run build`
- `grep -n 'result:' ops/FIRST-SCREEN-CHECK.md`
- `grep -c '^### dev-' ops/FIRST-SCREEN-CHECK.md`
