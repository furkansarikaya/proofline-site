# Task: TASK-046 - DNS TXT record and Search Console / Bing verification (owner step)

---
origin: prd:site
type: chore
size: S
depends_on:
  - TASK-040
prd: site
---

## Goal

Before the switch the product owner has verified ownership of proofline.technology in Google Search Console and Bing Webmaster Tools, preferably with a DNS TXT record, and the method, provider and dates are recorded, so Search Console data exists from the first day of the new site.

## Context

- PRD requirements: FR-23 (verification by a DNS TXT record by preference, before the switch; the meta-tag fallback only when DNS is not possible), FR-24 (the launch checklist includes checking the verification status in both consoles by hand), NFR-3 (the values of the verification tags are not secrets, but no build log line holds them), AC-27 (checked by hand and recorded: before the switch when DNS is used, right after the switch when the meta-tag fallback is used).
- Sources: `/docs/adr/0005-hosting-cutover-way-back-and-closed-previews.md` (point 7: a Domain property verified by a DNS TXT record before the switch, covering http, https and www; Bing by DNS or by import from Search Console; the owner holds the DNS zone; the checklist names the provider; rollback: remove the TXT record), `/docs/product/site/RESEARCH.md` (C-83).
- The fallback exists in the code: the build prints the meta tags when `GOOGLE_SITE_VERIFICATION` or `BING_SITE_VERIFICATION` is set (TASK-006). The existing Vercel project already exists before the switch, so the owner can set the two variables there before TASK-047 connects it to this repository.
- This task fills rows of `ops/SETTINGS.md` created by TASK-040: "DNS provider and TXT record", "Search Console Domain property status", "Bing Webmaster Tools method and status" and "verification variables set in the Vercel project when DNS is not possible, names only". Step 6 and step 9 of `ops/LAUNCH.md` point to those rows.
- Expected scope: `ops/SETTINGS.md` (1 path).

## Acceptance criteria

- AC-1: User step: the owner adds the property "proofline.technology" of type Domain in Google Search Console and adds the DNS TXT record the console shows at the DNS provider of the zone -> the console shows the property as verified, and the rows "DNS provider and TXT record" and "Search Console Domain property status" of `ops/SETTINGS.md` hold the provider name, the record type `TXT`, the status `verified` and the date (UTC) of the console check.
  PRD ids: AC-27
  Covers: FR-23
- AC-2: User step: the owner verifies proofline.technology in Bing Webmaster Tools by the DNS record or by importing it from Search Console -> the row "Bing Webmaster Tools method and status" holds the method (`DNS TXT` or `import from Search Console`), the status `verified` and the date (UTC).
  PRD ids: AC-27
  Covers: FR-23
- AC-3: Both rows of AC-1 and AC-2 are read -> they show dates earlier than the date of the row "Vercel project connected with production branch main" (which is still empty when this task is done), because the status is checked before the switch; the rows state that the check was made by hand in the console.
  PRD ids: AC-27
  Covers: FR-24
- AC-4: DNS is not possible for the owner -> the rows record the reason "DNS not possible" with the date, the row "verification variables set in the Vercel project" records that `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` are set for the production environment of the Vercel project (names only, date), the Search Console and Bing rows say `pending: checked right after the switch (TASK-049)`, and TASK-049 then checks them.
  PRD ids: AC-27
  Covers: FR-23, FR-24
- AC-5: `ops/SETTINGS.md`, every other file of the repository and the build log are searched for the TXT record value and for the content of the verification meta tags -> 0 occurrences; the rows hold names, methods, statuses and dates only.
  Covers: NFR-3
- AC-6: Failure criterion (anti-goal): the task is not done if a status is written as `verified` without a console showing it, if a verification value (the TXT string or the meta tag content) is copied into a repository file, or if the cutover row is filled by this task, even when the DNS record was added.

## Out of scope

- The meta-tag code and the build log lines (TASK-006).
- The cutover, the Vercel connection, retention and redirects (TASK-047) and the sitemap submission (TASK-049).
- Reading Search Console data or setting up reports; no analytics script (FR-23).
- Removing a TXT record (the rollback of this step, done by the owner if ever needed).

## Constraints

- Expected test exception: an owner step in two web consoles and a DNS zone; a test-first RED does not exist. Tested instead by the recorded rows of `ops/SETTINGS.md` and by the absence check of AC-5.
- ADR 0005 point 7: a Domain property (not a URL-prefix property) verified before the switch.
- All text written is English; names, methods and dates are ASCII.

## Risks

- DNS propagation can delay the console check; the row is written only after the console shows verified, so the task can stay open for hours.
- If the owner uses the fallback, verification waits until after the switch (TASK-049) and the first days of data may be incomplete; this is the cost the PRD names (AC-27).
- The Domain property covers http, https and www; the record is at the zone, so removing it later removes the verification for all three.

## Pre-existing defects

none

## Suggested class

TRIVIAL - recorded values in one operations document, no executable code, no integration of ours (the consoles and DNS are the owner's)

## Verification commands

- `grep -n 'DNS provider and TXT record' ops/SETTINGS.md`
- `grep -rn 'google-site-verification=' . --include='*.md' --include='*.json' --include='*.mjs' --exclude-dir=node_modules --exclude-dir=dist`
- `npm run build`
