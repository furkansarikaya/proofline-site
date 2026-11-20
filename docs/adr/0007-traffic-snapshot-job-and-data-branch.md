# 0007. Save weekly traffic snapshots to an orphan `traffic-data` branch, warn after 10 days, and tell the owner by GitHub issues

Status: superseded by the product owner's decision of 2026-11-20 (PRD L-4): the traffic snapshot job is removed and traffic is read by hand; nothing here is built
Date: 2026-11-19

## Context

FR-26 to FR-28 and AC-20 to AC-25 define a weekly snapshot of the proofline repository's views, referrers and stars, merged by UTC day, with a stale warning and an issue on failure. FR-26 says the file lives "on the branch that the site is built from". Q-1 and Q-5 (d), (l) ask for the grace value, who is told when the schedule stops silently, who renews the token, and whether Metadata read accompanies the one permission of FR-27.

## Decision

1. Workflow `.github/workflows/snapshot.yml`: triggers only `schedule` (weekly) and `workflow_dispatch` (AC-20); top-level `permissions: { contents: write, issues: write }`; secret `TRAFFIC_TOKEN` = fine-grained PAT with an expiry date, resource access to the proofline repository only, repository permission "Administration: read". The token record keeps the exact permission list the creation form shows (Metadata included or not, as shown).
2. Data lives on an orphan branch `traffic-data` (never deployed, ADR 0005), not on `main`: immutable `snapshots/<UTC timestamp>.json` = `{ "last_snapshot": "<UTC date>", "taken_at": "<UTC ISO time>", "stars": n, "views": [ ...as returned ], "referrers": [ ...as returned ] }`, and a derived `merged.json` = `{ "last_snapshot", "days": [{ "day", "count", "uniques", "from": "<snapshot file>" }], "referrers": [{ "taken_at", "list" }] }`. Merge rule: one row per UTC day, the row from the snapshot with the latest `taken_at` wins; referrer lists side by side, never added. `scripts/traffic-merge.mjs` is tested on two stored snapshots that share a day (AC-22). The job pushes with the job's GITHUB_TOKEN; that push starts no workflow (G5).
3. Grace (Q-1, Q-5 d): warn when `last_snapshot` is older than 10 days (weekly 7 + 3 for delayed or dropped scheduled runs), or when no `merged.json` exists (AC-24); exit 0 (NFR-4). The CI build reads the status with `git fetch origin traffic-data`; the Vercel build reads `https://raw.githubusercontent.com/<site repo>/traffic-data/merged.json`; a failed read prints `snapshot status unknown` and exits 0. The status never enters `dist/` (determinism kept).
4. Who is told: a failed snapshot run opens an issue in the site repository (AC-25); the weekly sync workflow (ADR 0003) opens one `snapshot stale` issue when the status is older than 10 days; each workflow first looks for an open issue with the same title and comments on it instead of opening a second. The owner reads GitHub issue mail.
5. Token renewal: `ops/TOKENS.md` holds the expiry date, the permission list as shown at creation and the accepted residual exposure of FR-27 (no secret value). The snapshot job reads that date from `main` and opens an issue when 21 days or fewer remain. The owner renews.
6. Silent stop: GitHub disables scheduled workflows of a public repository (this one is public) after 60 days without repository activity; this cannot be prevented by design. Mitigation: the stale issue from the sync workflow (both workflows would have to stop together to stay silent) and a monthly look at the Actions tab in the launch checklist. Residual risk stays.

## Alternatives considered

- Snapshot commits on `main` (the PRD's wording). Rejected on two remaining reasons, stated as they are now that the 7-day hold is gone (ADR 0005): (1) the Actions identity cannot be relied on to push to `main` once the ruleset of ADR 0008 protects it (bypass actors exist only for organization repositories and do not name GitHub Actions), and a PR per snapshot would need the weekly approval click of a GITHUB_TOKEN PR (G1); (2) every snapshot commit on `main` would be a production deployment with no site change that moves the Hobby rollback target by one, so after a bad deployment followed by a snapshot the only rollback target would carry the same bad code. The deployment budget is not a deciding reason: one deployment a week against 100 per day on Hobby is negligible.
- Workflow artifacts instead of a branch: 90-day retention loses the history the job exists to keep. Rejected.
- A PAT or GitHub App with ruleset bypass to write to `main`: a wider, long-lived write credential (NFR-8, RK-5), and bypass lists are not available on a personal repository. Rejected.
- Grace of 1 day (8 days total): one delayed scheduled run already warns; noise. Grace of 7 days (14 total): two lost weeks of 14-day data before anyone hears, which is the history the job exists to save. Rejected; 10 days keeps at least 4 overlapping days.

## Consequences

- The site build no longer reads the snapshot from its own checkout; the warning depends on a network or git read, with an explicit "unknown" state.
- AC-39's first snapshot on the launch day is a push to `traffic-data`, so it does not move the rollback target of ADR 0005 or interfere with the rehearsal right after the switch.
- PRD wording (owner accepted, see PRD-CHANGES.md): FR-26, FR-28 and AC-39 say "on the branch that the site is built from": here the `traffic-data` branch. AC-23 "one repository permission" (REVIEW R3-5): record the list the form shows.
- Q-5 (l) answer: the GitHub documentation lists Metadata as a read-only repository permission and its URL-template example yields "contents:read and metadata:read"; no sentence says Metadata is mandatory. Closed at token creation by recording the form.

## Evidence

- verified (PRD Problem): traffic views need fine-grained permission "Administration", read; views cover 14 days.
- verified (G4): scheduled workflows of a public repository are disabled after 60 days without activity; schedule runs on the default branch and can be delayed or dropped.
- verified (G5): bypass actors only for organization repositories; GITHUB_TOKEN pushes do not trigger push workflows.
- verified (V1, V2, V9): Hobby rolls back to the immediately previous production deployment only; 100 deployments per day.
- verified (G7): Metadata listed as a read-only permission; the URL-template example; no "mandatory" sentence.
- inferred: artifacts retention of 90 days (GitHub default, not read this session); "repository activity" for G4 is undefined, so a push to `traffic-data` may or may not count.
- verified (owner, 2026-11-19): the site repository is public, so the 60-day rule of G4 applies.
