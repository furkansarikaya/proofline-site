# Task: TASK-042 - Decision tags in the source documents and snapshot references removed from the design documents

---
origin: prd:site
type: docs
size: S
depends_on:
  - TASK-001
prd: site
---

## Goal

Every decision the product owner gave in the PRD session is recorded in the product document it names, so the PRD, `DECISION.md` and the other source documents tell the same story before the launch checklist closes, and `docs/design/ARCHITECTURE.md` and ADRs 0005, 0006 and 0008 no longer describe the traffic snapshot job that the product owner removed (PRD L-4).

## Context

- This task closes PRD open question Q-5 (j): "the recording of the product owner's decision tags in DECISION.md and the matching source documents before the launch checklist closes, a documentation task, open". It is outside the functional requirements; no `Covers:` line is needed.
- The condition comes from `/docs/product/site/REVIEW.md` (section "Conditions"): "Record the decision tags that have no source file in DECISION.md or the matching source documents, update DEC-3 to the 2-of-3 rule and DEC-2 to FR-31, before the launch checklist closes (Q-5(j))". The comment on top of `/docs/product/site/PRD.md` says DEC-3 is already updated and the other matching source documents are updated before the launch checklist closes.
- Decision tags: the PRD holds 29 items that end in `[decision: by product owner because ...]` (`grep -c '\[decision: by product owner' docs/product/site/PRD.md` returns 29): AC-15, AC-30, AC-31, FR-5, FR-9, FR-11, FR-16, FR-17, FR-19, FR-20, FR-23, FR-25, FR-29, FR-30, FR-31, FR-32, NFR-3, NFR-4, NFR-5, NFR-6, N-1, N-2, N-3, N-4, N-5, N-6, L-1, L-2 and L-4 (FR-26 and FR-27 were removed with the snapshot job). The count was 28 when this task was written; N-6 (the contact page, recorded by TASK-025 on 2026-11-20) is the 29th. Some name a source claim that already records them (FR-5 names RESEARCH C-88, FR-19 names C-82, FR-23 names C-83, FR-25 names C-86 and FRAME C-13, FR-29 names DEC-3, FR-30 names DEC-4); most name none.
- Current state of `/docs/product/site/DECISION.md`: DEC-2 reads "if it fails, the 'five minutes' claim of the site or the README changes before launch"; FR-31 removes the README suffix before PB-3 whatever the result. DEC-3 already carries the 2-of-3 rule ("Changed 2026-11-19 by the product owner").
- `PRD-CHANGES.md` does not exist and the PRD already carries its changes; this task must not create it (ADR 0005 and `/docs/design/ARCHITECTURE.md` still mention it as a reference; they are not edited here).
- Added scope (the product owner's instruction after the removal of the snapshot job, PRD L-4):

> ARCHITECTURE.md ile ADR 0005, 0006 ve 0008'deki snapshot atıflarının temizlenmesini TASK-042'nin kapsamına ekle.

- Further added scope (the product owner's instruction of 2026-11-20 when this task was updated): the baselines of M-4 and M-5 in ADR 0005 point 7 and in `docs/design/ARCHITECTURE.md` follow the fixed values of the PRD, and two items of the PRD section "Problem" that belong to the removed snapshot job are marked as no longer used:

> ADR 0005 madde 7 ve ARCHITECTURE.md'deki M-4 ve M-5 başlangıç ifadelerini PRD'deki sabit değerlerle (ikisi de 0) uyumlu yap; PRD'nin Problem bölümündeki GitHub trafiğinin 14 günü ve token izni maddelerini, kaldırılan snapshot işine ait oldukları için "artık kullanılmıyor" diye işaretle.

- Today: PRD L-4 and the measures M-4 and M-5 of the PRD fix both baselines at 0 ("M-4 and M-5 are 0", "baseline: 0 (set by the product owner, L-4)"); ADR 0005 point 7 still says "M-4 is zero by construction ... M-5 on the launch day describes the old site; the checklist records them as "none" and "old site"", and `docs/design/ARCHITECTURE.md` says "M-4 baseline none, M-5 baseline old site" (the Search engines row of the context list) and "M-4 none, M-5 old site" (the Q-5 closure row (p)). The two items of the PRD "Problem" section are the fact lines "GitHub returns the repository views for a window of the last 14 days ..." and "The GitHub documentation lists the endpoint /repos/{owner}/{repo}/traffic/views under the fine-grained token permission "Administration" ...", each ending in a `[fact: web ...]` tag.
- The snapshot job, the `traffic-data` branch, `snapshot.yml`, the token `TRAFFIC_TOKEN` and `ops/TOKENS.md` no longer exist in the plan. ADR 0007 already has the Status line "superseded" and is not edited again. `docs/design/ARCHITECTURE.md` (the context table, components C10 to C12 and C24, the boundary rows, the migration step "Launch day", the ADR list entry for 0007, the Q-5 closure rows, the proposed AC-45, task proposals 7 and 8, the open risks and "Brief items found wrong") and ADRs 0005, 0006 and 0008 hold such references; ADR 0006 may hold none, which the search of AC-8 then shows.
- Expected scope: `docs/product/site/DECISION.md`, a source claim that needs a matching line elsewhere adds at most the file that holds it (`docs/product/site/RESEARCH.md`, `docs/product/site/FRAME.md`, `docs/product/site/ASSUMPTIONS.md`), `docs/design/ARCHITECTURE.md`, `docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md`, `docs/adr/0006-privacy-headers-csp-and-referrer.md`, `docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md`, and `docs/product/site/PRD.md` for the two marked lines of the section "Problem" only (at most 9 paths).

## Acceptance criteria

- AC-1: `docs/product/site/DECISION.md` is read -> it holds a section "Decisions recorded from the PRD" with one list item for each of the 29 PRD items that carry a decision tag; each item starts with the PRD id (for example `- FR-11:`), repeats the reason of the tag after "because" word for word, and names either the source line that already records it (file and claim id, for example `RESEARCH C-88`) or says "recorded here".
- AC-2: The PRD items whose tag names no source claim are listed -> none of them is missing from the section of AC-1, and no item of the section lacks a tag in the PRD (the section holds exactly 29 items; `grep -c` of the PRD tag and of the section items return the same number).
- AC-3: DEC-2 in `docs/product/site/DECISION.md` is read -> it states the decision of FR-31: the README start heading loses its "(5 minutes)" suffix before PB-3 is run and the pin is a commit made after that change, so the synced pages state no install time whatever the PB-3 result; it names FR-31 and keeps the PB-3 wording of the entry.
- AC-4: DEC-3 in `docs/product/site/DECISION.md` is read -> it still carries the 2-of-3 rule (at least 2 of 3 developers who know GitHub Spec Kit say in their own words that proofline enforces its rules with scripts after one minute and without prompting; otherwise no-go) and the "Changed 2026-11-19" sentence; the task leaves it as it is.
- AC-5: A tag that names a source claim (RESEARCH C-82, C-83, C-86, C-87, C-88 and FRAME C-13) is compared with that claim -> each claim holds the same decision as the PRD item; where a claim differs in substance, the claim line is brought in line with the PRD and the change is listed under the section of AC-1 as "claim updated" with the claim id.
- AC-6: The tag of an item names no document that holds a matching line and the reason cannot be matched to one (the items of the "Notes from the promotional design step" N-1 to N-6 and of the "Launch scope decision" L-1, L-2 and L-4 come from the design and split steps, not from an earlier source document) -> the section of AC-1 lists the item with the words "recorded here, no earlier source document" and the date of the step it came from (2026-11-20).
- AC-7: `docs/product/site/PRD-CHANGES.md` is searched for -> it does not exist after the task, and no file in the repository is created with that name.
- AC-8: `docs/design/ARCHITECTURE.md`, `docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md`, `docs/adr/0006-privacy-headers-csp-and-referrer.md` and `docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` are searched, case-insensitive, for `snapshot`, `traffic-data`, `TRAFFIC_TOKEN` and `TOKENS.md` -> every remaining hit is on a line that says the job is removed or superseded (PRD L-4); a search of ADR 0006 returning no hit is a pass.
- AC-9: `docs/design/ARCHITECTURE.md` is read -> its ADR list shows 0007 as superseded by PRD L-4; the workflow list names `ci.yml` and `sync.yml` only; the proposed AC-45 reads as the PRD's AC-45 now reads (every workflow has a top-level `permissions` block that is not `write-all`, and no workflow uses a secret other than the workflow's own GITHUB_TOKEN); task proposal 7 says it was removed (PRD L-4) and task proposal 8 holds no item about `traffic-data` or a first snapshot; the migration step "Launch day" has no snapshot.
- AC-10: ADR 0005 and ADR 0008 are read -> each keeps every decision that does not concern the snapshot job unchanged (the diff of each file touches only lines that held a match of AC-8 and, in ADR 0005, the baseline sentence of point 7 (AC-11), plus one added line "Amendment 2026-11-20: the traffic snapshot job (ADR 0007) was removed by the product owner (PRD L-4); the references to it are deleted."), and ADR 0006 gets that line only if it had a match.
- AC-11: ADR 0005 point 7 and `docs/design/ARCHITECTURE.md` are read for the baselines of M-4 and M-5 -> ADR 0005 point 7 states that the baselines of M-4 and M-5 are the fixed value 0 set by the product owner (PRD L-4) and no longer says "none" or "old site" for them; `docs/design/ARCHITECTURE.md` (the Search engines row of the context list and the Q-5 closure row (p)) states M-4 baseline 0 and M-5 baseline 0 in the same way; the remaining text of point 7 (http to https, the www redirect, the DNS zone, TLS, the Search Console and Bing verification, "FR-30 sets no target from them") is unchanged; a search of the two files for the words "old site" next to M-5 and for "M-4 baseline none" returns 0 hits.
- AC-12: The section "Problem" of `docs/product/site/PRD.md` is read -> the two fact lines about the 14-day window of the GitHub traffic views and about the fine-grained token permission "Administration" for the traffic endpoint each end with the added marker ` [no longer used: belongs to the removed traffic snapshot job, PRD L-4]` after their existing `[fact: ...]` tag, the tags themselves are unchanged, no other line of the PRD changes (the diff of the PRD shows exactly those two changed lines), and the count of decision tags in the PRD still returns 29.

## Out of scope

- Editing `docs/product/site/PRD.md` except the two marked lines of the section "Problem" (AC-12); the comment on top and the text of Q-5 (j) stay as they are; editing ADR 0007, other ADRs and other design documents than the ones in the expected scope; the PRD comment keeps its present wording.
- Correcting the references to `PRD-CHANGES.md` in `ARCHITECTURE.md` and ADR 0005 (reported, not changed here).
- Creating `PRD-CHANGES.md`, or any other new file.
- New decisions: the task records the product owner's tags; it does not decide, reword or add one.
- Decisions of other kinds (`[assumption: ...]` tags and "rejected by user" lines such as RP-1).

## Constraints

- Expected test exception: documents only (task type `docs`); no executable code and no test-first RED. Tested instead by the counts and presence checks in "Verification commands" and by a reading of each item against the PRD line.
- The reasons are copied word for word from the PRD; in the design documents only the snapshot references change; product text and quotes stay in English as the PRD writes them.
- The entries of `DECISION.md` keep its present style (`- DEC-n ...` lines under their sections); the new section follows its existing sections.

## Risks

- A source claim that already records a decision in different words may hide a real difference; AC-5 makes the comparison explicit, and an unclear difference is reported rather than guessed.
- The comment on top of the PRD still says the other documents are updated later; it stays stale after this task because the PRD is out of scope.
- ADR 0005 and the ARCHITECTURE mention `PRD-CHANGES.md`; this task edits both files for the snapshot references only, so the `PRD-CHANGES.md` references stay and the lead decides whether they are corrected in a separate change.
- Removing a snapshot sentence from an ADR decision point can leave a numbered list or a sentence broken; AC-10 checks the surrounding decisions stay intact.

## Pre-existing defects

- docs/design/ARCHITECTURE.md, docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md: both refer to `PRD-CHANGES.md`, which does not exist in the repository -- decision: report

## Suggested class

STANDARD - text-only change to up to eight product and design documents (more than 2 files rules out TRIVIAL), no executable code, no design choice

## Verification commands

- `npm ci`
- `npm test`
- `grep -c '\[decision: by product owner' docs/product/site/PRD.md`
- `grep -c 'no longer used: belongs to the removed traffic snapshot job' docs/product/site/PRD.md`
- `grep -c 'M-4 baseline none' docs/design/ARCHITECTURE.md`
- `grep -n 'Decisions recorded from the PRD' docs/product/site/DECISION.md`
- `ls docs/product/site/PRD-CHANGES.md`
- `grep -n -i 'snapshot\|traffic-data\|TRAFFIC_TOKEN\|TOKENS.md' docs/design/ARCHITECTURE.md docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md docs/adr/0006-privacy-headers-csp-and-referrer.md docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md`
