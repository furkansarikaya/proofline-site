# Decision: proofline site

decision: build

- DEC-1 Build the proofline site (a static, cookieless, two-language introduction and documentation site that replaces the old site), resting on AS-1, AS-2, AS-5, AS-8, AS-9, AS-10 (untested, tested by shipping) and on PB-1 and PB-2 (confirmed).
- DEC-2 PB-3, the first-time installation timing, runs before the launch; if it fails, the "five minutes" claim of the site or the README changes before launch (PB-3, AS-2, AS-7, RESEARCH C-88).
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
