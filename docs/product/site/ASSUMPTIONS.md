# Assumptions: proofline site

<!-- importance and evidence are high|medium|low, never a number. Claim ids written as "FRAME C-n", "RESEARCH C-n" and "COMPETITORS C-n" point to the file of the same folder; C-90 and up are facts of this file. AS-1 to AS-6 come from the frame; AS-7 to AS-15 were proposed by the agent and accepted by the user. The user named AS-10 the most important for the main message of the site. -->

- AS-1 A first-time visitor understands what proofline is in about a minute from the home page alone, because of FRAME C-1. [assumption: usability estimate "target set by the product owner; nothing is measured yet"] importance: high; evidence: low; riskiest: yes
- AS-2 A developer installs proofline in about five minutes by following the README steps, because of FRAME C-1 and C-93. PB-1 measured only the init and doctor part from an empty folder, on a machine where the plugin and the command line tool were already installed; the first-time installation of both is not measured, so the claim rests on that part only (RESEARCH C-88). [assumption: usability estimate "the README itself promises the time (C-93); the init and doctor part was timed by the product owner (PB-1), the first-time installation was not"] importance: high; evidence: low; riskiest: yes
- AS-3 The developer who installs and the team lead who approves can be two different people, and the site has to answer both "how do I install it" and "why can I trust it", because of FRAME C-5. [assumption: value] importance: medium; evidence: low
- AS-4 Most visitors meet the README or a shared link first and reach the site second, because of FRAME C-9. [assumption: usability] importance: medium; evidence: low
- AS-5 The guides in the documents do the work of content and search optimisation, because of the limits in the frame and RESEARCH C-36 and C-37. [assumption: value] importance: high; evidence: low; riskiest: yes
- AS-6 The cookieless measures (GitHub stars, GitHub repository traffic, Search Console) tell whether the site works, because of FRAME C-13. [assumption: viability] importance: medium; evidence: low
- AS-7 The README install steps work on a clean machine that already has Claude Code and Codex, with no step outside the README, because of C-93. PB-1 ran on a machine that already had the plugin and the tool, so a clean machine is not yet tested. [assumption: feasibility source agent accepted by user] importance: high; evidence: low; riskiest: yes
- AS-8 A newly published site gains visibility for descriptive queries such as "Claude Code workflow" through English guides, although the vendor documentation and established blogs already hold the first results, because of RESEARCH C-36 and C-37. [assumption: value source agent accepted by user] importance: high; evidence: low; riskiest: yes
- AS-9 A team lead accepts a static page as the answer to "why can I trust it" without watching a run, because of FRAME C-5. [assumption: value source agent accepted by user] importance: high; evidence: low; riskiest: yes
- AS-10 A visitor who knows GitHub Spec Kit does not read the proofline claim as a copy of it; the difference shows on the first screen, because of C-90 and C-94. [assumption: value source agent accepted by user] importance: high; evidence: low; riskiest: yes
- AS-11 The repository documents render correctly on the site without hand edits: relative links, headings and the translation header lines. To be verified as a probe in the technical design step (document sync). [assumption: feasibility source agent accepted by user] importance: medium; evidence: low
- AS-12 GitHub repository traffic keeps enough detail and history to tell the visits that come from the site, because of FRAME C-13. Tested by PB-2: the detail is there (referrers by site), but the history starts on a recent day (C-95), so a snapshot has to be saved regularly. [assumption: usability source agent accepted by user] importance: medium; evidence: medium
- AS-13 Search Console impressions for the bare name are noisy because other products share the name (RESEARCH C-60), so only descriptive queries are measured (RESEARCH C-84). [assumption: viability source agent accepted by user] importance: medium; evidence: low
- AS-14 One maintainer can keep two languages, the document sync and the release automation running; the sync and the automation open pull requests by themselves to reduce the work (RESEARCH C-85). [assumption: viability source agent accepted by user] importance: medium; evidence: low
- AS-15 The Turkish audience is large enough to justify the Turkish interface text and the existing Turkish guides, although the demand is not measured (RESEARCH C-58). [assumption: value source agent accepted by user] importance: medium; evidence: low

- AS-16 Clone counts of the repository do not represent readers: the likely cause is that the proofline repository's own CI clones the repository on every run and those clones are counted. This is the product owner's explanation and it is not verified, by the product owner's decision; the success measures no longer use clone counts (RESEARCH C-86), because of C-97. [assumption: viability source agent changed by user] importance: medium; evidence: low

## Facts

- C-90 GitHub Spec Kit says its processes keep evidence ahead of implementation. [fact: ref site#C-70]
- C-91 Cursor staff confirm that the agent sometimes ignores the rules a project has written. [fact: ref site#C-73]
- C-92 The proofline repository has no git tag. [fact: ref site#C-26]
- C-93 The repository README names its quick start as 5 minutes. [fact: web https://github.com/furkansarikaya/proofline accessed 2026-11-19 "Quick start (5 minutes)"]
- C-94 The repository README says scripts and git hooks, not prompts, enforce the rules. [fact: web https://github.com/furkansarikaya/proofline accessed 2026-11-19 "scripts and git hooks, not prompts, enforce the rules"]

- C-95 The first day of the repository's traffic history is 2026-11-05, while the repository was created on 2026-10-09, so the history holds only the recent days. [fact: data `gh api repos/furkansarikaya/proofline/traffic/views --jq '.views|first|.timestamp'` sha256:42c62d16e7cdfd026d1cf59b51918dc903775e60fc6839417702a1c59476f665]
- C-96 The repository's page views in that history total 1430. [fact: data `gh api repos/furkansarikaya/proofline/traffic/views --jq .count` sha256:e043c662bc456d809131f79ac8444973f9aed48a3287965dab7964a5f080c180]
- C-97 The repository's clones in the same history total 84885, far more than the views, so clone counts include a large share of something other than readers (see AS-16 for the likely cause). [fact: data `gh api repos/furkansarikaya/proofline/traffic/clones --jq .count` sha256:99d24c595e3ab1f3651a381d4a5ba694fa02e089d492144c4348e239b9abb474]

## Rejected proposals

- RP-1 The traffic and the inbound links of the old site are worth keeping through redirects. rejected by user: "eski site korunmayacak" (the old site is not preserved; RESEARCH C-82 replaces the redirect decisions)
