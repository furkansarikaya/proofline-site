# Task: TASK-007 - Sync pin, lock and verified fetch

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
