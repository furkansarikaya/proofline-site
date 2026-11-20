# Task: TASK-007 - Sync pin, lock and verified fetch

**Status:** done

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-001
prd: site
---

## Goal

The build fetches the documents of the proofline repository at one pinned commit, checks every file against a committed lock by git blob id and sha256, caches them, and stops with a message naming the file when anything differs; a lock command regenerates the lock for a pin, so the pin can be moved by hand with a normal pull request.

## Context

Request (user's words, from the technical design step, quoted in `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md`):

> sabitlenmiş commit'in belgelerini build sırasında alan bir script; bağlantıları site adreslerine çeviren, eşitleme kümesi dışındakileri GitHub adresine döndüren, Türkçe kılavuzları da alan, deterministik

Launch scope decision of the product owner (2026-11-20), which makes the manual pin update the way the version moves until the sync workflow exists:

> 035 ve 036 (otomatik sync PR'ı), 037, 038 ve 039 (trafik anlık görüntüsü) ve 032 (Lighthouse bütçesi) yayından sonraya ertelensin: task olarak yazılsın ama "post-launch" etiketiyle ve lansman task'larının (047 ve sonrası) bağımlılıklarından çıkarılsın. Yayından önce proofline sürümü elle güncellenir.

- Source requirements in `/docs/product/site/PRD.md`: FR-11 (pin, lock, build-time fetch, documents not committed), the user story AC-47 (two builds from the same pin and lock give the same output hash), and sections L-1 and L-3 of "Launch scope decision (2026-11-20)".
- ADR `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` points 1 to 4 (pin, lock, determinism, synced set); architecture components C7 and C15 and the boundary rows C15-C7 and C15-proofline in `/docs/design/ARCHITECTURE.md`.
- Existing: `.gitignore` already holds `.cache/`; `package.json` has `"build": "astro build"` and `check:determinism` (`scripts/check-dist.mjs`); there is no `sync/` folder and no `scripts/sync.mjs`.
- The launch pin is the tag `v0.0.173`, commit `b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd` (the tag object is a commit, verified).
- The lock shape is `{commit, files: [{path, role: page|input, blob, sha256}], tree_sha256}` (ADR 0003 point 2, architecture boundary C15-C7). `README.md` is a read-only input (`role: input`) that TASK-010 reads; the synced set is the six globs of FR-9: `docs/guides/*.md`, `docs/guides/tr/*.md`, `docs/concepts/*.md`, `docs/proof.md`, `docs/limits.md`, `skills/*/SKILL.md`.
- Expected scope (7 paths): `sync/pin.json`, `sync/lock.json`, `scripts/sync.mjs`, `scripts/lib/` (archive reading, blob id, the synced-set constant), `package.json` (scripts `sync`, `sync:lock`, and `build` runs the fetch first), `tests/sync.test.mjs`, `tests/fixtures/sync/`.
- Assumption: the archive address can be replaced by an environment variable (a `file:` path or a local test server) so that tests make no network request; the default is `https://codeload.github.com/furkansarikaya/proofline/tar.gz/{commit}`.
- Assumption: `tree_sha256` is the sha256 of the lines `path`, a tab, `type`, a tab, `blob` (one line for each file with type `blob`, and one for each directory with type `tree` and an empty blob), sorted by path with plain string comparison, as ADR 0003 describes it.
- Assumption: the lock command takes its commit from `sync/pin.json` (with an optional commit argument that rewrites `sync/pin.json` first), so a manual pin update is one command followed by a normal pull request.
- Assumption: a tar reader and the blob id (`blob {length}`, a NUL byte, the content, hashed with sha1) are written in plain `.mjs` with Node's `zlib` and `crypto`; no dependency is approved for this task.

## Acceptance criteria

- AC-1: `sync/pin.json` is read -> it holds `commit` `b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd` and `tag` `v0.0.173` and no other key.
  Covers: FR-11
- AC-2: A pin file with a commit of 39 characters, with an upper-case hex digit, or with a tag `latest` is given to any `scripts/sync.mjs` command -> the command exits non-zero and the message names `sync/pin.json` and the field.
  Covers: FR-11
- AC-3: The exported synced-set constant is read and a fixture archive with files inside and outside the six globs is selected -> the constant holds exactly the six globs, `docs/guides/tr/x.md` is selected, and `docs/decisions.md`, `docs/adr/0001.md` and `skills/a/references/y.md` are not.
  Covers: FR-11
- AC-4: The lock command runs on a fixture archive -> `sync/lock.json` holds `commit` equal to the pin's commit, one entry for each file of the synced set with `role` `page` and one for `README.md` with `role` `input`, entries sorted by path, and `tree_sha256` as in the Context assumption; the blob id of each entry equals the output of `git hash-object` for the same bytes and the sha256 equals the sha256 of those bytes.
  Covers: FR-11
- AC-5: The lock command runs twice on the same archive -> the two `sync/lock.json` files are identical byte for byte and hold no date or time.
  Satisfies: AC-47.
  Covers: FR-11
- AC-6: The lock command finishes -> it prints one summary line with the number of files for each group (guides, Turkish guides, concepts, proof and limits, skills, input).
  Covers: FR-11
- AC-7: The fetch command runs with a fixture archive that matches the lock -> it exits 0 and `.cache/sync/{commit}/` holds every file of the lock with the same bytes, and a listing of every file and directory of the archive (also those outside the synced set) that a later task can read.
  Covers: FR-11
- AC-8: One byte of a synced file in the archive is changed while the lock stays as it is -> the fetch exits non-zero, the message names the path and says whether the blob id or the sha256 differs, and a second fetch with the archive unavailable also exits non-zero, so a failed run leaves no cache that passes.
  Covers: FR-11
- AC-9: The lock holds a right sha256 and a wrong blob id for one file, and the reverse for another -> each fetch exits non-zero naming that file and the field that differs.
  Covers: FR-11
- AC-10: A file named in the lock is missing from the archive, and in another run a file that matches the synced set is in the archive and not in the lock -> both fetches exit non-zero and name the path and which side lacks it.
  Covers: FR-11
- AC-11: The lock names a commit other than the pin's -> every command that reads both exits non-zero and the message names both commits.
  Covers: FR-11
- AC-12: A second fetch runs with the cache filled and the archive address unreachable -> it exits 0 and makes no request.
  Covers: FR-11
- AC-13: A cached file is changed by one byte, first with the archive unreachable and then with it available -> the first run exits non-zero naming the path, and the second downloads the archive again, verifies it, rewrites the cache and exits 0.
  Covers: FR-11
- AC-14: The archive request answers 404, or the connection fails -> the fetch exits non-zero, the message holds the address it asked for, and no cache of another commit is used in its place.
  Covers: FR-11
- AC-15: The repository is checked after a fetch -> `git check-ignore` reports `.cache/sync/` as ignored, `git ls-files` lists 0 paths under `.cache/` and 0 synced documents, and `sync/` holds only `pin.json` and `lock.json`.
  Covers: FR-11
- AC-16: `npm run build` runs with a tampered fixture archive -> it exits non-zero from the fetch step with the message of AC-8 and writes no new HTML to `dist/`; with a matching archive the fetch runs before `astro build` and the build exits 0.
  Covers: FR-11
- AC-17: The fetch runs twice from an empty cache on the same fixture archive -> the two cache trees give the same sha256 over their sorted paths and contents.
  Satisfies: AC-47.
  Covers: FR-11
- AC-18: At delivery, with network access, `node scripts/sync.mjs fetch` runs against the live archive of the launch pin, and `npm run check:determinism` runs -> both exit 0, and the committed `sync/lock.json` equals what the lock command produces for the pin.
  Satisfies: AC-47.
  Covers: FR-11
- AC-19: Failure criterion (anti-goal): the task is not done if the fetch compares the archive with the cache or with itself instead of with the committed lock, if a lock is accepted for a commit other than the pin's, if a failed verification leaves a cache that a later run accepts, or if any document is committed to the repository, even when every fixture test is green.

## Out of scope

- The Markdown transform, link map, pin facts and the routes (TASK-008, 009, 010, 011).
- The sync workflow that opens the pull request, tag-follow, the `sync-red` draft and the approval-required behaviour (TASK-035 and TASK-036, post-launch); until then the pin is moved by hand with the lock command in a normal pull request that `ci / verify` checks.
- Choosing a newer proofline version than the launch pin; the check that the README at the pin has no "(5 minutes)" suffix (TASK-043, TASK-041).
- Authenticated requests, API calls for tags or compare status, and any token (none is needed for the public archive).
- Adding `.cache/` to `.gitignore`: the line is already there; this task only asserts it (AC-15).

## Constraints

- Expected test exception: the request to the live codeload address has no test-first RED and does not run under `npm test` (tests make no network request); it is the verification command of AC-18, and the fetch logic is tested on fixture archives.
- ADR 0003 point 2: the verified bytes are the extracted file contents, not the archive bytes (the compression is not promised to be stable); the cache is `.cache/sync/{commit}/`.
- ADR 0003 point 3: inputs sorted by path, no clock, no network except the pinned archive.
- ADR 0001: plain `.mjs` scripts and `node --test`; the dependencies of `package.json` stay exact versions and none is added.

## Risks

- Every first build now needs `codeload.github.com`; an outage fails the build visibly instead of publishing stale pages (ADR 0003 consequences). The cache keeps repeat local builds offline.
- `tests/site.test.mjs` builds the site, so its "built site" group needs the network or a primed cache in CI and on a developer machine.
- A real tar archive can carry entries the fixtures do not (long names, symbolic links, a global header); the live run of AC-18 is the check.
- The lock is a security-relevant file: a wrong lock accepted in a pull request would pin wrong text; the lock diff shown in a pull request is the review point.

## Pre-existing defects

none

## Suggested class

COMPLEX - new integration (network fetch of an external archive) with an integrity check across scripts, build wiring and committed data; CRITICAL considered: no secret or credential, public archive, no workflow or deploy change

## Verification commands

- `npm ci`
- `npm test`
- `node scripts/sync.mjs fetch`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-007 -->
- run: TASK-007
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-20T14:05:18Z
- runtime: claude
- session: 8bfe83d7-18e5-44d1-9008-a045f052b9c8
- estimate: size M
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-007 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-007 -->
# Completion Report: TASK-007

<!-- proofline:summary:begin -->
Changed: the build now fetches the proofline documents of one pinned commit, checks every file against a committed lock by git blob id and sha256, caches them, and stops naming the file when anything differs; a lock command regenerates the lock for a pin.
Verify: `npm test`
<!-- proofline:summary:end -->

Written by the lead from run evidence only.

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-007 — Sync pin, lock and verified fetch; class COMPLEX; tier full; branch `proofline/TASK-007-sync-pin-lock-and-verified-fetch`
- Changed: `sync/pin.json` (AC-1, AC-2, AC-11, AC-15, AC-18), `sync/lock.json` (AC-4, AC-15, AC-18), `scripts/sync.mjs` (AC-2, AC-4 to AC-14, AC-16 to AC-19), `scripts/lib/tar.mjs`, `scripts/lib/sync-set.mjs`, `scripts/lib/lock.mjs`, `package.json` (scripts only: `build` runs the fetch first, plus `sync` and `sync:lock`), `tests/sync.test.mjs` (AC-1 to AC-19)
- Knowledge step: `docs/design/ARCHITECTURE.md` rows C15, C15-C7 and C15-C16 now describe the built scripts, the pin tag form and the `listing.tsv` format; the cache folder must be addressed by the pinned commit, because a killed fetch can leave `<commit>.tmp-*` or `<commit>.bad-*` folders next to it.
- Not changed, as the task says: `tests/site.test.mjs`, `.github/`, `.gitignore`; no fixtures folder (the tests build their archives in code); no dependency.
- Design choices that differ from the task text: the lock command writes the lock first and the pin only after a successful download (a failed run leaves both files as they were), and the tar reader also checks every header checksum and fails closed on links, unsafe paths, duplicate paths and a second top folder.
- Live data: the launch pin is the tag `v0.0.173`, commit `b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd`. A fetch of the live archive from an empty cache verified and cached 51 files and 2052 listing entries in about 1 to 6 seconds, and a second fetch made no request. A fresh lock run is byte-identical to the committed `sync/lock.json`.

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| `scripts/sync.mjs` | fetch, lock, cache and concurrency tests fail before the script exists; later rounds added tests that failed first | `npm test` passes | implementer |
| `scripts/lib/tar.mjs` | archive reader tests fail before the module exists | `npm test` passes | implementer |
| `scripts/lib/sync-set.mjs` | synced set test fails before the module exists | `npm test` passes | implementer |
| `scripts/lib/lock.mjs` | pin, lock and hash tests fail before the module exists | `npm test` passes | implementer |
| `tests/sync.test.mjs` | strengthened after review findings | `npm test` passes | implementer |
| `sync/pin.json`, `sync/lock.json`, `package.json` | exempt: committed data and a scripts-only change, covered by the tests | `npm test` passes | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm ci`, `npm test`, `node scripts/sync.mjs fetch`, `npm run build`, `npm run check:determinism`, `npm run check:links`, `npm run test:axe`

## Assumptions

- AS-1 (medium): the live archive of the launch pin yields the same bytes on every request — unverified in the plan register; the live fetch passed against a lock made from an earlier download, in several gates.
- AS-3 (low): a fetch inside the npm build script does not break the existing site and determinism tests — unverified in the plan register; both pass.
- AS-4 (low): the lock command writes the lock first and the pin after a successful download — unverified in the plan register; covered by tests.

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 1 | none |
| REVIEW_PLAN | pass | high | 1 | REVIEW_PLAN-1 REVIEW_PLAN-2 |
| REVIEW_RULES | pass | high | 1 | REVIEW_RULES-1 REVIEW_RULES-2 |
| REVIEW_TESTS | pass | medium | 1 | none |
| SECURITY | pass | high | 1 | SECURITY-1 SECURITY-2 |
| QA | pass | high | 1 | none |
| VERIFY | pass | high | 1 | none |

Fix rounds used: 1 of 2.

- REVIEW_PLAN: REVIEW_PLAN-1 info the three extra tests and the move-aside change are not named in the plan tests list one by one; REVIEW_PLAN-2 info the Architecture text does not describe the aside-folder mechanism or the test seam.
- REVIEW_RULES: REVIEW_RULES-1 info the new concurrency test and the third new test pin current behaviour; REVIEW_RULES-2 info the lock command writes the lock and the pin as two separate atomic writes, so a crash between them leaves a mismatched pair that the next command refuses naming both commits.
- SECURITY: SECURITY-1 info on a case-insensitive file system two locked files whose names differ only in letter case end up as one cache file (not exploitable: the bytes always come from the reviewed lock, and the deploy build runs on a case-sensitive system); SECURITY-2 info the download has no size limit apart from the 512 MiB unpacked limit (the only source is the pinned codeload address).

The run went through several review rounds before the final ones: a git-dependent test, a race of concurrent fetches on a damaged cache, a missing header checksum check, a delayed fetch that could remove a repaired cache, a hollow test for that case, and a leftover moved-aside folder under a reused process id. Each was fixed and re-checked on the final tree; the user approved a new fix-round budget once (amendment 001 added a test entry to the plan) and the mutation budget was raised within the batch cap. The tests gate counted its mutants again for each changed tree, keeping the earlier counts as files.

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_RULES:concurrency: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- SECURITY:dependencies: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)

## QA Result

QA: PASS (high); all 52 frozen scenarios passed on the final tree, including the leftover moved-aside folder case and the header checksum case.

## Unsupported Checks

- REVIEW_RULES:contract: `sync/pin.json` and `sync/lock.json` are not OpenAPI, AsyncAPI or JSON Schema documents and the contract tool reports them unsupported; not proven: a machine comparison of the two data files and the consumers outside this repository (the contracts were reviewed by hand against the code, `docs/design/ARCHITECTURE.md` and ADR 0003)

## Amendments

- 001-stale-fetch-test: added a test entry for AC-13 and AC-19 to the plan (a stale fetch with an unreachable archive cannot remove a cache another fetch repaired) after the tests gate found a hollow test; no scope, criterion, contract or dependency changed; the user approved the new fix-round budget; the QA plan was derived again for the new plan hash.

## Execution

Generated from the decision records by `agent.sh report-execution TASK-007` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| architect | - | claude | opus | high | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | runtime set by the operator |
| reviewer | plan | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| implementer | - | claude | opus | high | large_diff | runtime set by the operator; escalated (ESCALATED_MODEL) |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| reviewer | contract | claude | sonnet | high | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | runtime set by the operator |
| security_reviewer | - | claude | opus | high | large_diff,fix_round_2 | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | runtime set by the operator |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| implementer | - | claude | sonnet | high | large_diff | runtime set by the operator |
| implementer | - | claude | sonnet | high | large_diff | runtime set by the operator |
| implementer | - | claude | sonnet | high | large_diff | runtime set by the operator |
| implementer | - | claude | sonnet | high | large_diff | runtime set by the operator |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| verifier | - | claude | sonnet | medium | large_diff | agent path |

## Known Limitations / Follow-up

- Every first build now needs `codeload.github.com` or a warm `.cache/sync/<commit>/`; this was accepted in the task risks.
- Role notes for the user: some gate roles made a few more read-only live requests to codeload than the one the task authorized (an empty address override counts as unset); nothing was written or changed by them. The security reviewer recorded in `findings.json` that its validator wants a worktree name starting with `exploit-proof-`, while the real path follows the role's naming rule, and kept the real path. The dependencies focus of the first round ran an audit command that sends package names to an advisory service; it reported no vulnerability. In the final round the audit was not run (no network for that role), so known vulnerabilities are neither reported nor ruled out.
- Reviewers left some files under `.agents/runs/` of the main working tree (outside the task worktree); they are git-ignored and are removed after cleanup.
- Observation of the implementer: the local-server tests need an environment that allows binding 127.0.0.1.

## Execution

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 41)
- Gate REVIEW_PLAN: ran on the final tree: pass (gate REVIEW_PLAN, record 43)
- Gate REVIEW_RULES: ran on the final tree: pass (gate REVIEW_RULES, record 42)
- Check REVIEW_RULES:concurrency: ran on the final tree: pass (focus REVIEW_RULES:concurrency, record 48)
- Check REVIEW_RULES:contract: unsupported: it could not run here (focus REVIEW_RULES:contract, record 44); nothing is claimed
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 47)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 45)
- Check SECURITY:dependencies: ran on an EARLIER tree (focus SECURITY:dependencies, record 37; fix rounds used in the run: 1, as in the Facts block); it is not a check of the final tree
- Gate QA: ran on the final tree: pass (gate QA, record 46)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 49)
- Visual/browser check: not part of this run (no QA:visual gate); no visual, browser or screenshot check is claimed

Final message line (paste it unchanged): Verification claims (from the ledger): 7 of 7 gates hold a record for the final tree; not on the final tree: SECURITY:dependencies (earlier tree); visual/browser check: not part of this run (no QA:visual gate); no visual, browser or screenshot check is claimed.
Claims-hash: 4132352ae3214bc0080917f33cb43c54f7121072269e8ca71da54b8609ea810d
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-007` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1 REVIEW_PLAN-2
- Gate REVIEW_RULES: pass (unsupported: contract); findings: REVIEW_RULES-1 REVIEW_RULES-2
  - Focus REVIEW_RULES:concurrency: pass; findings: REVIEW_RULES-1
  - Focus REVIEW_RULES:contract: unsupported; findings: REVIEW_RULES-1 REVIEW_RULES-2
- Gate REVIEW_TESTS: pass; findings: none
- Gate SECURITY: pass; findings: SECURITY-1 SECURITY-2
  - Focus SECURITY:dependencies: pass; findings: SECURITY-1 SECURITY-2
- Gate QA: pass; findings: none
- Gate VERIFY: pass; findings: none
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 1 of 2
- Refreezes: 1
- Files changed (task-owned paths): 8
- Worker-evidence run records: total 16, ended pass 10, ended fail 6 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-007 -->
