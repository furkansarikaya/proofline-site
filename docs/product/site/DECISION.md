# Decision: proofline site

decision: build

- DEC-1 Build the proofline site (a static, cookieless, two-language introduction and documentation site that replaces the old site), resting on AS-1, AS-2, AS-5, AS-8, AS-9, AS-10 (untested, tested by shipping) and on PB-1 and PB-2 (confirmed).
- DEC-2 PB-3, the first-time installation timing, runs before the launch. Changed 2026-11-20 by the product owner (PRD FR-31): the README start heading loses its "(5 minutes)" suffix before PB-3 is run, and the pin is a commit made after that change, so the synced pages state no install time whatever the PB-3 result; the "five minutes" claim of the site and of the README does not stand on PB-3 (PB-3, AS-2, AS-7, RESEARCH C-88).
- DEC-3 Before the launch, once the design exists, the first screen is shown to 3 developers who know GitHub Spec Kit. The result is a go when at least 2 of them, after one minute and without prompting, say in their own words the difference from Spec Kit (proofline enforces its rules with scripts); otherwise it is a no-go (AS-10, RK-4). Changed 2026-11-19 by the product owner: this replaces "a few developers ... with the product owner's go".
- DEC-4 Eight weeks after the launch, the Search Console impressions for the descriptive queries are read and compared with the query-to-page table of RESEARCH; the content changes when they are absent (AS-8, AS-5, RK-11).

## Context

The product owner asked for a site that lets a first-time visitor understand proofline in a minute, install it in five minutes and read its documents. The frame, the research, the competitor reading, 16 assumptions, three probes and a premortem of 12 risks stand behind this decision. PB-1 (the init and doctor part, 5 seconds, on a machine that already had the plugin and the tool) and PB-2 (the repository traffic can be read, but its history is short) are confirmed. PB-3 is locked and not run. The old site is not preserved and its addresses are not redirected (RESEARCH C-82).

## Decision

Build, decided by the product owner on 2026-11-19, with the three launch conditions DEC-2 to DEC-4. The agent proposed this decision with its evidence and its rejected alternatives; the product owner chose it.

## Consequences

Seven assumptions with importance high and evidence low are untested at the time of the decision: AS-1, AS-2, AS-5, AS-7, AS-8, AS-9 and AS-10. Most of them (AS-1, AS-5, AS-8, AS-9) can only be tested by shipping and reading Search Console and the GitHub traffic snapshots; AS-2 and AS-7 are tested by PB-3 before the launch; AS-10 by the first-screen check of DEC-3. There was no user interview and no opportunities document, and the red team step was skipped by the product owner's decision, so no independent agent attacked the most-trusted assumptions; the premortem and the competitor reading are the only challenge the plan has had. The "five minutes" claim on the site rests only on the init and doctor part until PB-3 is run (RESEARCH C-88). Clone counts are not a success measure (AS-16, RESEARCH C-86), and the weekly traffic snapshot job (RESEARCH C-87) has to exist before the history is lost.

## Rejected

- Clarify first (interviews, an opportunities document): rejected, it costs time and promises no new evidence source, since nobody has been recruited for interviews and most of the risk is only testable after the launch.
- Stop: rejected, the evidence shows no reason to give up (the problem exists, the cost is low and the domain is otherwise left with an old site that is not maintained).

## Decisions recorded from the PRD

Each item below carries a decision tag in the PRD (`docs/product/site/PRD.md`). The reason after the word because is copied from the PRD tag; the source says where an earlier document records the decision, or that it is recorded here. The items N-1 to N-6, L-1, L-2 and L-4 have no earlier source document.

- AC-15: the sync workflow, started by hand with a commit id, opens a pull request that changes the pin and the lock; because the documents are taken from the pinned commit during the build and are not committed to the site repository; recorded here.
- AC-30: the product owner returns once to the previous production deployment of the new site in one hosting step; because the old site is not preserved and the way back is the new site's previous publication (OD-1); recorded here.
- AC-31: after a return, a push to the production branch does not go live until a deployment is promoted, and deployments are kept at least 7 days; because the 7-day hold of the old site was removed (OD-1); recorded here.
- FR-5: the site does not write "install in five minutes" and states only the measured init and doctor part; because the first-time installation was not part of the measurement; recorded in RESEARCH C-88.
- FR-9: the page-source map: pages written for the site, pages synced from the pinned commit, and the 7 queries mapped to pages; because the repository has no separate guide on those two subjects; recorded here.
- FR-11: the synced pages are taken from the proofline repository automatically, pinned to one commit, with a lock and a sync workflow; because the documents are taken from the pinned commit during the build; recorded here; related claims FRAME C-10, RESEARCH C-61, C-62, C-85 hold their own reasons.
- FR-16: the name proofline is always used with the descriptive phrase in titles, descriptions and structured data; because the bare name is shared with other products and the phrase comes from the README; recorded here; related claim RESEARCH C-60 (requires a descriptive phrase, names none).
- FR-17: pages exist in both languages only where a Turkish source exists; the other pages are English only; because a Turkish address without a translation would show English text under a Turkish address; recorded here; related claim RESEARCH C-85 holds its own reason.
- FR-19: the old addresses are not redirected and answer not found; because the old site will not be preserved; recorded in RESEARCH C-82.
- FR-20: the cutover on the same domain and hosting, with the way back as the one-step return to the previous deployment of the new site; because the old site is not preserved and the way back is the new site's previous publication (OD-1, OD-2); recorded here.
- FR-23: ownership in Search Console and Bing Webmaster Tools is verified by a DNS TXT record by preference, and the site gets no analytics script; because the old site had no Search Console and the new site runs without cookies or scripts; recorded in RESEARCH C-83.
- FR-25: success is read once, eight weeks after the launch, from the star count, the documentation page clicks and the Search Console impressions; clone counts are not a measure; because the clone counts include automated clones and the site runs without scripts that count; recorded in RESEARCH C-86 and FRAME C-13 (both claim updated, see below).
- FR-29: the first screen is shown to 3 developers who know GitHub Spec Kit; go when at least 2 name the difference from Spec Kit; because the difference from Spec Kit must show without help; recorded in DECISION DEC-3.
- FR-30: the metrics M-1, M-4 and M-5 have no target before the evaluation eight weeks after the launch; because a number without a baseline would be invented; recorded in DECISION DEC-4.
- FR-31: the README start heading loses the suffix "(5 minutes)" before PB-3 is run and the pin is a commit made after that change; because the install time is not measured; recorded here and in DECISION DEC-2 (rewritten to this decision).
- FR-32: the launch checklist holds its steps in a fixed order, starting with the README heading change; because the rehearsal needs two deployments of the new site and the old site is not a way back (OD-1); recorded here; DEC-2 and DEC-3 are named in the item.
- NFR-3: no build log line and no published page holds the access key or any other secret; because a verification tag is a public meta tag in the page source; recorded here.
- NFR-4: the build fails on a command line missing from the README, an install-time claim without a confirmed PB-3, a missing link target or a missing figure; because a missing or stale figure on the trust page defeats AC-8; recorded here.
- NFR-5: mobile Largest Contentful Paint at most 2.5 s, Cumulative Layout Shift at most 0.1, Interaction to Next Paint at most 200 ms; because the thresholds are the published "good" levels; recorded here.
- NFR-6: the main pages meet WCAG 2.2 level AA, shown by an automated checker and a manual keyboard pass; because the target is WCAG 2.2 AA; recorded here.
- N-1: the site is built with proofline, its source is public, and the limits section and the trust page say so; because the site itself is real use of proofline and the public record shows it; recorded here, no earlier source document (2026-11-20).
- N-2: no count of tasks, pull requests or CI runs is written by hand on any page; because a hand-written count goes stale and breaks the rule that every number has a source; recorded here, no earlier source document (2026-11-20).
- N-3: the footer line of ADR 0006 closes Q-3 with a fixed wording that links Built with proofline to the site repository; because the wording was left to the design step; recorded here, no earlier source document (2026-11-20).
- N-4: the header has a repository icon link, a theme button and a language link, each at least 44 by 44 pixels; because the controls are part of the promotional design; recorded here, no earlier source document (2026-11-20).
- N-5: the main pages load exactly one small same-origin controls script of at most 2048 bytes; because remembering the theme and copying the command need a script, and one small same-origin file keeps the privacy and performance rules; recorded here, no earlier source document (2026-11-20).
- N-6: a contact page in English and Turkish with four links and no form; because visitors need one place to reach the maintainer, and plain links with a mailto address do that without a form, a server or a third-party script; recorded here, no earlier source document (2026-11-20).
- L-1: the first launch contains the core only; the sync pull request workflow and the Lighthouse CI budget come after it; because the launch needs the site, not its automation; recorded here, no earlier source document (2026-11-20).
- L-2: consequences the product owner accepts for the first launch (no lab check of NFR-5 before launch, no snapshot step in FR-32); because the automation is not needed for the first publication; recorded here, no earlier source document (2026-11-20).
- L-4: the weekly traffic snapshot is removed completely, with M-2 and M-3; success is read by one look at the stars and Search Console; because the product owner reads nothing from GitHub by hand, and one look at the stars and Search Console after eight weeks is enough; recorded here, no earlier source document (2026-11-20).

Claims updated to match the PRD (a marker naming PRD L-4 was added to each claim and its text and decision tag were kept):

- RESEARCH C-86: claim updated, the unique visitors and referrers measures were removed by PRD L-4 and FR-25; success is read from stars, documentation page clicks and Search Console impressions now.
- RESEARCH C-87: claim updated, the weekly snapshot job was removed and the claim is superseded by PRD L-4.
- FRAME C-13: claim updated, the unique visitors and referrers measures were removed by PRD L-4.
