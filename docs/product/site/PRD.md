# PRD: proofline site

<!-- Sources: docs/product/site FRAME, RESEARCH, COMPETITORS, ASSUMPTIONS, PROBES, PREMORTEM, DECISION. The decision markers in this PRD record the product owner's answers given in the session that wrote it; DEC-3 is already updated to them, and the other matching source documents are updated before the launch checklist closes (Q-5). "RK-n" is a premortem risk, "DEC-n" a DECISION condition, "AS-n" an assumption of ASSUMPTIONS.md, "C-n" a claim of the file named before it, "IN-n" a "so what" line of RESEARCH or COMPETITORS. -->

## Problem

- A first-time visitor cannot yet grasp what proofline is, install it and read its documents on one site as fast as the product owner wants. [assumption: usability estimate "target set by the product owner: about one minute to understand; nothing is measured yet"]
- The team lead who approves adoption leaves a visit that does not answer "why can I trust it", even when the developer who installs is convinced. [assumption: value source agent accepted by user]
- The live site at https://proofline.technology describes itself as a tour of the workflow, roles, gates and skills, not as an install guide. [fact: ref site#C-30]
- The live site has no documents section: the address /docs answers not found. [fact: ref site#C-35]
- The proofline repository has no GitHub release. [fact: ref site#C-25]
- The proofline repository has no git tag. [fact: ref site#C-26]
- GitHub Spec Kit already uses the word "evidence" for its processes. [fact: ref site#C-70]
- Cursor staff confirm that the agent sometimes ignores the rules a project has written. [fact: ref site#C-73]
- GitHub returns the repository views for a window of the last 14 days, so a record kept only by GitHub loses the older days. [fact: web https://docs.github.com/en/rest/metrics/traffic accessed 2026-11-19 "for the last 14 days"]
- The GitHub documentation lists the endpoint /repos/{owner}/{repo}/traffic/views under the fine-grained token permission "Administration", with access read, so a token that reads traffic needs that permission. [fact: web https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens accessed 2026-11-19 "/repos/{owner}/{repo}/traffic/views"]
- The repository clone total is 84885 against 1430 page views, so clone counts do not represent readers. [fact: ref site#C-97]
- The README of the proofline repository states that it is not yet proven on real projects. [fact: web https://github.com/furkansarikaya/proofline accessed 2026-11-19 "It is not yet proven on real projects."]

Who: developers and team leads who use Claude Code and Codex, in English and in Turkish; the developer who installs and the team lead who approves can be two different people. [assumption: value]

## Goals

- G-1: A first-time visitor understands what proofline is from the home page alone.
- G-2: A developer installs proofline and runs a first task by following the site.
- G-3: A team lead finds the answer to "why can I trust it" on the site, limits included.
- G-4: The documents of the proofline repository are readable on the site and stay in step with the repository; the Turkish guides that exist are readable in Turkish.
- G-5: The product owner can read whether the site works without cookies and without scripts that count visitors.
- G-6: The new site replaces the old site on the same domain and the same hosting, with a way back.

## Non-goals

- A blog, pricing and accounts.
- Cookies, a cookie banner and any third-party analytics.
- Languages other than English and Turkish; Turkish pages exist only where this PRD lists them or a Turkish translation exists in the repository.
- Paid tools.
- The choice of technology: the technical design step makes it, together with the design system.
- Redirects from old addresses and any preservation of the old site (decision of FR-19).
- The home page does not list the full set of roles, skills and gates.
- A claim of the time of the first-time installation, until PB-3 is `confirmed` (decision of FR-5).
- "Install command copied" and repository clone counts as success measures.
- Metric targets before the evaluation of FR-30.
- The files of the proofline repository that FR-9 does not list as synced, among them `docs/decisions.md`, `docs/adr/`, `docs/skills/*-decisions.md` and the `references/` and `assets/` folders of the skills.

## User stories

### US-1: As a first-time visitor, I want the home page to show the shortest path and what makes proofline different, so that I understand it without reading the documents

- AC-1: The home page is built -> it shows three steps (install, run one task, see the proof), holds 0 lists of roles, skills or gates, and links to the skills catalogue and to the concepts section.
- AC-2: The first screen of the home page is built in English and in Turkish -> the sentence that says a script blocks a claim that has no proof comes before the first occurrence of the word "evidence" (in Turkish "kanıt") in reading order.

### US-2: As a developer, I want install steps that match the repository, so that the steps work when I follow them

- AC-3: One command line in an install block or a first-task block of the get-started page is changed so that it does not appear in the fenced blocks between the heading "Install" and the heading "What it supports" of the README of the pinned commit (compared after trimming white space and removing a trailing comment that starts with " #") -> the build exits with a non-zero code and names the line.
- AC-4: A page written for the site (not a synced document) matches the case-insensitive pattern `(five|5)[ -]?(minutes?|mins?)` or `(beş|5)[ -]?(dakika|dk)` while PROBES.md has no PB-3 result line with the value `confirmed` -> the build exits with a non-zero code and names the page. The pattern is a guard, not a proof.
- AC-5: The get-started page is built in English and in Turkish -> it says that init and doctor take a few seconds ("init ve doctor birkaç saniye" in Turkish), states that this was measured from an empty folder on a machine where the plugin and the command line tool were already installed, and, while PB-3 is not `confirmed`, gives no time for the first-time installation.

### US-3: As a team lead, I want a page that shows why I can trust proofline and where it is not proven, so that I can approve adoption without watching a run

- AC-6: The home page is opened -> the trust page is reachable in 1 click, and it links to `docs/proof.md` and to `docs/limits.md` as published on the site; the build reports 0 broken internal links on it.
- AC-7: The trust page is read -> it shows at least 1 case of a script or git hook that blocks a claim that has no proof, taken from the proof page, before it uses the word "evidence" to describe proofline.
- AC-8: The trust page is read -> its pinned proofline version and the date of the figures it quotes are generated by the build from the synced proof page at the pinned commit, not written by hand; it links to the "does not prove" section of the proof page, and states that proofline is not yet proven on real projects, as the README does.

### US-4: As a developer who uses both Claude Code and Codex, I want one page for both agents, so that I do not read a versus comparison

- AC-9: The page for Claude Code and Codex is opened -> it covers using proofline with both agents, links to the get-started page, and states the README limit for Codex: Codex as implementer is supported and the other Codex roles are not yet verified in real use.

### US-5: As a searcher, I want to find the guide that answers my question, so that I reach proofline through a descriptive query

- AC-10: The built pages are read -> 100% of the `<title>` elements, meta descriptions, `og:title` and `og:description` tags and structured-data names that carry the name "proofline" also carry the phrase "a deterministic engineering team for Claude Code and Codex" (Turkish pages: "Claude Code ve Codex için deterministik bir mühendislik ekibi"); 0 `<title>` elements of pages written for the site contain the word "evidence" or "kanıt"; the `<title>` of a synced page is its own H1 followed by the name and the phrase, and may contain "evidence" when the H1 does.
- AC-11: The query-to-page map of FR-9 is compared with the built site -> each of the 7 queries has the page that FR-9 names; the Turkish query has its page because the Turkish guide exists.

### US-6: As a Turkish reader, I want Turkish pages where they exist, so that I read in my language

- AC-12: The language is switched to Turkish on the home, get-started, trust and Claude Code and Codex pages -> all prose and interface text on them is in Turkish and each page carries `lang="tr"`; command lines, product names and text quoted from a synced English page are excluded, and a quotation carries its own `lang`.
- AC-13: A Turkish interface page links to a page that has no Turkish translation -> the link leads to the English page, its text says the page is in English, the English page carries `lang="en"`, no /tr/ address exists for it, and hreflang tags appear only on pages that have a translation.
- AC-14: A Turkish page (a guide with a "translated-from" header, or a page written for the site) records an English source version that differs from the English source of the pinned commit -> the page shows a notice that the English page has changed since the translation, with a link to it, and the build exits with code 0.

### US-7: As the maintainer, I want the documents to follow the repository, so that the site never shows old commands

- AC-15: The sync workflow is started by hand with a commit id of the proofline repository -> a pull request opens by itself that changes the pin and the synced documents; nobody copies a document by hand.
- AC-16: A sync pull request is opened -> the build check runs on it, and the pull request cannot be merged while that check fails.
- AC-17: Any synced page is opened -> it shows the commit (or, once tags exist, the tag) it was taken from.
- AC-18: The site is built -> 0 links in the synced documents are unresolved: a relative link whose target is in the synced set leads to the site page, a relative link whose target is outside it leads to the GitHub address of that file at the pinned commit, and the build fails only when the target does not exist at the pinned commit.
- AC-19: A tag exists in the proofline repository whose commit has the pinned commit as an ancestor, and no pull request for it is open -> the next scheduled run of the sync workflow opens a pull request that moves the pin to that tag.

### US-8: As the product owner, I want a weekly record of the repository traffic, so that the history survives GitHub's 14-day window

- AC-20: The workflow of the snapshot job is read -> its only triggers are a weekly schedule and a manual start; no pull request event starts it.
- AC-21: The snapshot job finishes a run -> the saved file holds the star count, the 14 daily entries of views, the referrer list as returned, and a "last snapshot" date equal to the run date.
- AC-22: Two snapshots hold an entry for the same UTC day -> the merged view keeps one row for that day, the one from the snapshot taken last; the merge is tested with two stored snapshots.
- AC-23: The access key of the snapshot job is inspected -> it is a fine-grained personal access token with an expiry date, with resource access to the proofline repository only, and with one repository permission, "Administration" at read access; its expiry date and the residual exposure of FR-27 are recorded in the repository.
- AC-24: The "last snapshot" date is older than the weekly schedule plus the grace value of Q-5, or no snapshot file exists yet -> the build prints a warning and exits with code 0.
- AC-25: A run of the snapshot job fails -> a GitHub issue is opened in the site repository by the job itself.

### US-9: As the product owner, I want the site ownership verified, so that Search Console and Bing Webmaster Tools return data

- AC-26: The site is built with GOOGLE_SITE_VERIFICATION set, and again with it empty -> the first build prints the tag and the log says "verification tag: present"; the second prints no tag and the log says "verification tag: absent"; no log line holds the value; the same holds for BING_SITE_VERIFICATION.
- AC-27: The launch checklist is run -> the verification status in Search Console and in Bing Webmaster Tools is checked by hand and recorded as verified: before the switch of FR-20 when ownership is verified by the DNS record, and right after the switch when the meta-tag fallback of FR-23 is used.

### US-10: As a visitor with an old address, I want to land on a page that helps, so that I find the home page and the documents

- AC-28: Every address of the old sitemap that the new sitemap does not contain is requested with the https scheme on the apex host (the http and www forms follow AC-29 to that address first) -> each answers status 404 and shows the one not-found page, which holds English and Turkish text and links to the home page and to the documents in both languages.

### US-11: As the product owner, I want the old site replaced with a way back, so that the switch does not strand visitors

- AC-29: The switch is made -> https://proofline.technology serves the new site from the same hosting as the old site, and http://proofline.technology and the www address answer with a permanent redirect to the https apex.
- AC-30: The previous publication is restored once in a rehearsal before the launch -> the old site answers again within one step of the hosting, and the step is written in the launch checklist.
- AC-31: The first 7 days after the launch have passed -> the way back of AC-30 was still available on every one of those days, and the product owner records the day it is released.

### US-12: As a crawler or an AI agent that reads the site, I want a sitemap, a robots file and Markdown pages, so that I find every page

- AC-32: The site is built -> `sitemap.xml` lists every page with an https address and 0 http addresses, and `robots.txt` allows all and points to that https sitemap.
- AC-33: A page has an English and a Turkish version -> each lists the other as a reciprocal hreflang alternate in the sitemap and in the page; a page with no Turkish version lists none.
- AC-34: The documentation section is opened by an agent -> an index file lists every synced page with the address of its Markdown version, and each listed Markdown address answers status 200 in a build check.

### US-13: As the product owner, I want the launch conditions checked, so that I do not ship a claim nobody measured

- AC-35: The first screen of the design is shown to 3 developers who know GitHub Spec Kit before the launch -> each looks at it for one minute, then says without prompting what differs; the answers are recorded in the repository; the result is a go when at least 2 of the 3 say in their own words that proofline enforces its rules with scripts, and a no-go otherwise; after a no-go the promotional design is redone, the check is repeated with 3 developers, and the launch waits for a go.
- AC-36: PB-3 is run before the launch -> PROBES.md holds its result line; no page of the site states an install time unless the result is `confirmed`.
- AC-37: The start heading of the README of the proofline repository is read at the pinned commit -> it carries no suffix "(5 minutes)", and the pin is a commit made after that change.
- AC-38: The proofline repository is searched for links to an old site address other than the domain root before the launch -> the search finds 0 such links; the search of 2026-11-19 found 0 in the text files it covered.
- AC-39: The first snapshot of FR-26 is taken on the launch day -> the saved file holds it, and it is the baseline of M-2, M-3 and M-5.
- AC-40: Eight weeks have passed since the launch -> the evaluation of FR-30 is recorded: the Search Console impressions of each of the 7 queries, each query with 0 impressions with a content change task, a target for each of M-1 to M-5 set from its baseline, and for each metric the decision it informs.

## Functional requirements

- FR-1: The home page tells the shortest path only: install it, run one task, see the proof. The full lists of roles, skills and gates stay in the documents and the home page links to them. (RK-1; AS-1)
- FR-2: The first screen of the home page shows the difference before the word "evidence": a script blocks a claim that has no proof (ASSUMPTIONS C-94). (RK-4; AS-10)
- FR-3: A get-started page, written for the site, gives the install steps and the first-task steps for Claude Code and Codex. (G-2; AS-2)
- FR-4: The install blocks and the first-task blocks of the get-started page are written by hand. The build compares each of their command lines with the command lines in the fenced blocks between the heading "Install" and the heading "What it supports" of the README of the pinned commit, after trimming white space and removing a trailing comment that starts with " #" on both sides, and fails when a line of the site does not appear there. An inline code span of the get-started page that starts with a command is compared with the inline code spans of the same README range (the line with `npx skills add`). The blocks of `docs/guides/existing-project.md` are not compared. (RK-2; AS-2, AS-7)
- FR-5: Decision of RESEARCH C-88. The site does not write "install in five minutes". It says the measured part: init and doctor take a few seconds ("init ve doctor birkaç saniye"), measured from an empty folder, with the scope that the plugin and the command line tool were already installed. The first-time installation is not stated until PB-3 is measured. PB-3 is `confirmed` when it meets its locked success threshold, failed when it meets its locked failure threshold, and inconclusive in between; only `confirmed` allows the site to state the time, and then only the time of that run. [decision: by product owner because the first-time installation was not part of the measurement]
- FR-6: PB-3, the first-time installation in a clean user account, is run before the launch and its result is written to PROBES.md. On a failed or inconclusive result no page written for the site states an install time. (DEC-2; AS-2, AS-7)
- FR-7: A trust page answers "why can I trust it". It is reachable in 1 click from the home page; links to the synced proof page (`docs/proof.md`) with its CI results and to the synced limits page (`docs/limits.md`); shows an enforced check before it uses the word "evidence"; shows the pinned version and the date of the figures, generated by the build from the synced proof page at the pinned commit and never written by hand; links to the "does not prove" section of the proof page; and states the README's own limit, that proofline is not yet proven on real projects. (RK-12, RK-4; AS-9; IN-8, IN-10)
- FR-8: One page, written for the site, shows proofline working with both Claude Code and Codex, and states the README limit for Codex: Codex as implementer is supported and the other Codex roles are not yet verified in real use. (IN-5)
- FR-9: The page-source map. Pages written for the site: the home, get-started, trust, Claude Code and Codex, and not-found pages, and the generated index pages. Pages synced from the pinned commit: `docs/guides/*.md` as guides; `docs/concepts/*.md` as concepts; `docs/proof.md` and `docs/limits.md`; `skills/*/SKILL.md` as the skills catalogue. Turkish sources: `docs/guides/tr/gunluk-kullanim.md` and `docs/guides/tr/prompt-katalogu.md`. The 7 queries of RESEARCH map to these pages: "Claude Code workflow" to `docs/guides/daily-use.md` with `docs/concepts/workflow.md`; "Claude Code and Codex" to the page of FR-8; "multi-agent coding workflow" to `docs/concepts/roles.md` and `docs/concepts/gates.md`; "AI code review with evidence" to the trust page and `docs/concepts/evidence.md`; "TDD with AI agents" to `docs/concepts/testing.md`; "Claude Code skills" to the skills catalogue; "yapay zeka ajan iş akışı" to the Turkish guide `docs/guides/tr/gunluk-kullanim.md`. Two pages differ from the page types of the RESEARCH table: "Claude Code workflow" is answered by `docs/guides/daily-use.md` with `docs/concepts/workflow.md` instead of a workflow guide, and "TDD with AI agents" by `docs/concepts/testing.md` instead of a test-first guide with recorded RED and GREEN. [decision: by product owner because the repository has no separate guide on those two subjects] (RESEARCH query-to-page table)
- FR-10: The skills catalogue has one page per `skills/*/SKILL.md` of the pinned commit, and the concepts section has one page per `docs/concepts/*.md`. (RESEARCH C-59, IN-6)
- FR-11: The synced pages are taken from the proofline repository automatically, pinned to one commit now. The pin is one setting. The sync workflow runs on a schedule and by hand: started by hand with a commit id it opens a pull request that changes the pin and the synced pages; once tags exist, a scheduled run that finds a tag newer than the pin opens a pull request that moves the pin to the tag. The credential that lets the build check run on the pull request is named in the technical design. (FRAME C-10; RESEARCH C-61, C-62, C-85; AS-11, AS-14)
- FR-12: Every synced page shows the commit or tag it was taken from. (RK-7)
- FR-13: A sync pull request cannot merge before the build check passes. (RK-7)
- FR-14: Headings and the "translated-from" header lines of the synced documents render without hand edits. A relative link whose target is in the synced set leads to the site page; a relative link whose target is outside it leads to the GitHub address of that file at the pinned commit; the build fails on a target that does not exist at the pinned commit. (AS-11; RK-12)
- FR-15: The documentation section publishes an index file for agents and a Markdown version of every synced page. (IN-11)
- FR-16: The name proofline is always used together with the descriptive phrase "a deterministic engineering team for Claude Code and Codex" (Turkish: "Claude Code ve Codex için deterministik bir mühendislik ekibi") in every `<title>`, meta description, `og:title`, `og:description` and structured-data name that carries the name, and a `<title>` never carries the name alone. The `<title>` of a page written for the site never contains the word "evidence" or "kanıt"; the `<title>` of a synced page is built from the page's own H1 followed by the name and the phrase, so the word may appear there when the source heading holds it. The idea of proof is told in the descriptions and in the page content. The English phrase is built from two sentences of the README ("A deterministic engineering team for coding agents" and "proofline is for developers who let Claude Code or Codex change real code"); the Turkish phrase is its translation. RESEARCH C-60 requires a descriptive phrase and names none. [decision: by product owner because the bare name is shared with other products and the phrase comes from the README] (RK-3; AS-13)
- FR-17: The home, get-started, trust and Claude Code and Codex pages exist in English and Turkish, and so do the navigation and interface text. The not-found page is one page with an English block and a Turkish block, each block with its own `lang`. The skills catalogue, the concepts section and the guides that have no Turkish source exist in English only. Turkish guides exist only where a Turkish translation exists in the repository. For a page without a translation no /tr/ address is made; the Turkish interface links to the English page and the link says the page is in English; hreflang appears only on pages that have a translation; every page carries the `lang` of its own language. [decision: by product owner because a Turkish address without a translation would show English text under a Turkish address] (FRAME limits; RESEARCH C-85; AS-15)
- FR-18: Every Turkish guide reads its "translated-from" header line, and every Turkish page written for the site records the content hash of its English page at the time it was written. When that version (the blob id of a guide's English source, or the recorded hash of a site-written English page) differs from the English source of the pinned commit, the page shows a notice that the English page has changed, with a link to it, without failing the build and without showing a commit or blob id to the visitor. (RK-9)
- FR-19: Decision of RESEARCH C-82. The old addresses are not redirected: the old site is not preserved, the new site goes live from scratch with its own address structure on https://proofline.technology, and an old address that the new site does not define answers not found. There is one not-found page; it holds English and Turkish text and links to the home page and the documents in both languages. [decision: by product owner because the old site will not be preserved]
- FR-20: The cutover. The new site is published on the same domain and on the same hosting as the old site and replaces it. The permanent redirect of http and of www to the https apex is kept; it is a redirect of the canonical host, not of an old address, so it does not conflict with FR-19. The way back is the hosting's step that returns to the previous publication in one step; it is rehearsed once before the launch, written in the launch checklist and kept available for the first 7 days after the launch. The technical design verifies that the hosting offers this step. [decision: by product owner because the new site replaces the old site and the launch needs a way back]
- FR-21: The site publishes `sitemap.xml` and `robots.txt` with https addresses, canonical addresses with https, and reciprocal hreflang pairs only for pages that have a Turkish version. `robots.txt` allows all and points to the sitemap. The sitemap is submitted in Google Search Console and in Bing Webmaster Tools at the launch. (RESEARCH C-31, C-33; IN-7)
- FR-22: Before the launch, the text files of the proofline repository are searched for links to an old site address other than the domain root; any hit is fixed in the repository, and the search is repeated. (RK-8)
- FR-23: Decision of RESEARCH C-83. Ownership in Google Search Console and Bing Webmaster Tools is verified by a DNS TXT record by preference (no code in the site; the product owner adds the record, before the switch of FR-20 so that data exists from the first day). When DNS is not possible, the verification meta tags are read from the environment variables GOOGLE_SITE_VERIFICATION and BING_SITE_VERIFICATION, and no tag is printed when a variable is empty. The site gets no analytics script. [decision: by product owner because the old site had no Search Console and the new site runs without cookies or scripts]
- FR-24: The build log says "verification tag: present" or "verification tag: absent" without printing the value, and the launch checklist includes checking the verification status in Search Console and in Bing Webmaster Tools by hand. (RK-10; AS-6)
- FR-25: Decision of RESEARCH C-86, with the measures of FRAME C-13. Success is read from GitHub stars, the unique visitors of the repository page and the referrers that lead from proofline.technology to the repository (C-86), and from the documentation page visits and the Search Console impressions (FRAME C-13). The documentation page visits are the Search Console clicks on the pages under /docs/ and /tr/docs/, where the synced pages live; they show only visits that come from search, and the site counts nothing inside its pages. Clone counts are not a measure, the bare brand query is not a measure (RESEARCH C-84), and neither is "install command copied". [decision: by product owner because the clone counts include automated clones and the site runs without scripts that count]
- FR-26: Decision of RESEARCH C-87. A GitHub Actions job in the site repository runs weekly and saves a snapshot of the repository traffic and of the star count to a file in the site repository, on the branch that the site is built from. The file keeps the 14 daily entries of views as returned and the referrer list as returned. Snapshots merge by UTC day: when several snapshots hold the same day, the one taken last is valid. The referrer list is a 14-day total with no daily entries, so snapshots of it are kept side by side and are not added. The access key it needs is held as a repository secret. The job exists before the 14-day window loses the days. [decision: by product owner because GitHub keeps only 14 days, the success measures need a longer history, and a repeated day must count once]
- FR-27: The access key of the snapshot job is a fine-grained personal access token with an expiry date, with resource access to the proofline repository only, and with one repository permission: "Administration" at read access, the permission that the GitHub documentation lists for the traffic endpoints (see Problem). That permission is wider than reading traffic, because it also reads repository settings; the product owner accepts this residual exposure and it is recorded next to the token's expiry date. The job runs only on its schedule or by hand, never on a pull request. [decision: by product owner because the traffic endpoints cannot be read with a narrower permission] (RK-5)
- FR-28: Every run of the snapshot job updates a "last snapshot" date in the saved file, and the site build warns when that date is older than the weekly schedule plus the grace value of Q-5, and also when no snapshot file exists yet. A failed run opens an issue in the site repository. (RK-6; AS-12)
- FR-29: Before the launch, once the design exists, the first screen is shown to 3 developers who know GitHub Spec Kit, found and recorded by the product owner. The result is a go when at least 2 of them, after one minute and without prompting, say in their own words the difference from Spec Kit: proofline enforces its rules with scripts. Otherwise it is a no-go: the promotional design is redone, the check is repeated, and the launch waits for a go. [decision: by product owner because the difference from Spec Kit must show without help] (DEC-3; RK-4; AS-10)
- FR-30: Decision on targets. The metrics M-1 to M-5 have no target before the evaluation eight weeks after the launch; until then they are only read. At that evaluation (DEC-4) the Search Console impressions for the descriptive queries are read and compared with the query-to-page table of RESEARCH, the content changes for each query that has none, a target for each metric is set from its baseline, and each metric is recorded with the decision it informs (keep the content, change the content, or stop reading the metric). [decision: by product owner because a number without a baseline would be invented] (DEC-4; RK-11; AS-5, AS-8)
- FR-31: Decision on the README. The product owner has the start heading of the README in the proofline repository (ASSUMPTIONS C-93 quotes it with the suffix "(5 minutes)") changed to the same heading without the suffix "(5 minutes)" before PB-3 is run, and the pin is set to a commit made after that change, so the synced pages state no install time. [decision: by product owner because the install time is not measured]
- FR-32: A launch checklist holds, in this order: the README heading change (FR-31); PB-3 (FR-6); the first-screen check (FR-29); the repository link search (FR-22); the DNS record and, when DNS is used, the ownership check in both consoles (FR-23, FR-24); the rehearsal of the way back (FR-20); the switch (FR-20); the ownership check in both consoles when the meta-tag fallback is used (FR-23, FR-24); the check that the old sitemap addresses answer 404 (FR-19); the submission of the sitemap in both consoles (FR-21); the first snapshot (FR-26); and the listing of the skills catalogue in a skills directory and in awesome-claude-code. (DEC-2, DEC-3; RK-8, RK-10; IN-6; COMPETITORS C-81)

## Non-functional requirements

- NFR-1: No page response sets a cookie, no page shows a cookie banner, and no page loads an analytics or counting script. (FRAME out of scope; RESEARCH C-83)
- NFR-2: The site is static, needs no server, and runs on free hosting with no paid tool. (FRAME limits)
- NFR-3: No build log line holds the value of the access key or any other secret, and no published page holds the access key or any other secret. The values of GOOGLE_SITE_VERIFICATION and BING_SITE_VERIFICATION are not secrets: they appear only inside the verification meta tags of the page head, and no build log line holds them. [decision: by product owner because a verification tag is a public meta tag in the page source] (RK-5, RK-10)
- NFR-4: The build fails on a command line that does not appear in the README (FR-4), on an install-time claim without a confirmed PB-3 (FR-5), and on a link target that does not exist (FR-14). It warns, and never fails, on a stale Turkish page (FR-18) and on a stale traffic snapshot (FR-28).
- NFR-5: On a mobile profile, Largest Contentful Paint is at most 2.5 s and Cumulative Layout Shift is at most 0.1 on the home, get-started, trust and Claude Code and Codex pages and on one synced guide page, in a lab run before the launch; Interaction to Next Paint is at most 200 ms in the field data of the Search Console Core Web Vitals report, read at the evaluation of FR-30 when Search Console has field data for it, and recorded as not available otherwise (it has no lab value). These are the published "good" thresholds. The pages written for the site load JavaScript only when a feature needs it. The technical design names the lab tool and the profile. [decision: by product owner because the thresholds are the published "good" levels]
- NFR-6: The home, get-started, trust and Claude Code and Codex pages meet WCAG 2.2 level AA, shown by an automated checker named in the technical design and by a manual keyboard pass on those pages. The synced pages are checked with the same checker; their findings are reported to the proofline repository and are not a release gate, because their content is outside the site's control. [decision: by product owner because the target is WCAG 2.2 AA]
- NFR-7: The synced Markdown is rendered with raw HTML and scripts removed, so the automatic sync cannot add a script to a page. (RK-7)
- NFR-8: Each workflow of the site repository declares its permissions at the least that its job needs; the snapshot and sync workflows read the proofline repository only with the credentials of FR-11 and FR-27.

## Completeness

- error and empty states: FR-19, FR-18, FR-17, FR-28, AC-24
- permissions and roles: FR-27, FR-13, NFR-8
- personal data and retention: not applicable to this project (no accounts, no cookies, no analytics; the snapshot file holds counts and referrer sites only and is public; the access logs of the hosting are outside the site)
- security: FR-27, NFR-3, NFR-7, NFR-8
- performance: NFR-5
- accessibility: NFR-6, FR-17
- multilingual: FR-17, FR-18, FR-21
- analytics events: M-1, NFR-1
- rollout and migration: FR-19, FR-20, FR-32
- dependencies: FR-11, A-10, A-16

## Success metrics

- M-1: GitHub stars; event: star count read by the weekly job; source: the snapshot file of FR-26; baseline: 1 on 2026-11-19 (RESEARCH C-23)
- M-2: Daily unique visitors of the repository page, added over a week (visitor-days, since the same person on two days counts twice); event: daily unique views read by the weekly job; source: the snapshot file of FR-26, merged by day; baseline: the 14 daily entries of the first snapshot, taken on the launch day, which include the product owner's own visits
- M-3: Referrers from proofline.technology to the repository; event: the entry for proofline.technology in the referrer list read by the weekly job; source: the snapshot file of FR-26, one 14-day list per snapshot, not added; baseline: the list of the first snapshot, taken on the launch day
- M-4: Documentation page visits from search; event: Search Console click on a page under /docs/ or /tr/docs/; source: Search Console; baseline: the first Search Console reading of the launch week
- M-5: Search Console impressions for the 7 descriptive queries; event: impression; source: Search Console; baseline: the first reading taken on the launch day
- M-6: Time of the first-time installation; event: PB-3 stopwatch run by the product owner; source: PROBES.md PB-3 result; baseline: unknown (A-2)

## Assumptions

- A-1: A first-time visitor understands what proofline is in about a minute from the home page alone (AS-1); no metric measures this, and it stays untested after the launch (Q-2). [assumption: usability estimate "target set by the product owner; nothing is measured yet"]
- A-2: A developer installs proofline by following the README steps; only the init and doctor part is measured (PB-1: 5 seconds, on a machine that already had the plugin and the tool), the first-time installation is not (AS-2, AS-7, RESEARCH C-88). [assumption: usability estimate "the README itself promises the time; the init and doctor part was timed by the product owner in PB-1, the first-time installation was not"]
- A-3: The developer who installs and the team lead who approves can be two different people, and the site answers both questions (AS-3). [assumption: value]
- A-4: Most visitors meet the README or a shared link first and reach the site second (AS-4). [assumption: usability]
- A-5: The guides in the documents do the work of content and search optimisation (AS-5). [assumption: value]
- A-6: The cookieless measures (GitHub stars, repository traffic, Search Console) tell whether the site works (AS-6). [assumption: viability]
- A-7: A newly published site gains visibility for descriptive queries such as "Claude Code workflow" through English guides, although the vendor documentation and established blogs hold the first results (AS-8). [assumption: value source agent accepted by user]
- A-8: A team lead accepts a static page as the answer to "why can I trust it" without watching a run (AS-9); no metric measures this, and it stays untested after the launch (Q-2). [assumption: value source agent accepted by user]
- A-9: A visitor who knows GitHub Spec Kit does not read the proofline claim as a copy of it; the difference shows on the first screen (AS-10). [assumption: value source agent accepted by user]
- A-10: The repository documents render correctly on the site without hand edits, and the document sync is a dependency on the pinned commit of the proofline repository (AS-11). [assumption: feasibility source agent accepted by user]
- A-11: GitHub repository traffic keeps the detail to tell visits that come from the site, but only for 14 days, so a regular snapshot is needed (AS-12). [assumption: usability source agent accepted by user]
- A-12: Search Console impressions for the bare name are noisy because other products share the name, so only descriptive queries are measured (AS-13). [assumption: viability source agent accepted by user]
- A-13: One maintainer can keep two languages, the document sync and the release automation running (AS-14). [assumption: viability source agent accepted by user]
- A-14: The Turkish audience is large enough to justify the Turkish pages and guides, although the demand is not measured (AS-15). [assumption: value source agent accepted by user]
- A-15: Clone counts include the clones of the proofline repository's own CI; this is the product owner's explanation and it is not verified (AS-16). [assumption: viability source agent changed by user]
- A-16: The accounts of Google Search Console and Bing Webmaster Tools, the tagging automation of the proofline repository (RESEARCH C-62) and the GitHub Actions scheduled runs are available to the product owner, who owns them; a scheduled run can stop without a visible sign (Q-1). [assumption: feasibility]

## Open questions

### Blocking

- none

### Non-blocking

- Q-1: What is the grace value of the stale-snapshot warning (FR-28), who is told when the scheduled snapshot job stops silently (GitHub can disable a scheduled workflow after a long time without activity in the repository), and who renews the token before its expiry date? The technical design answers it.
- Q-2: How are A-1 (understanding in about a minute) and A-8 (a team lead accepts a static page) settled after the launch, given that M-1 to M-5 measure neither? DECISION says they are tested by shipping; the evaluation of FR-30 decides whether a direct check is added.
- Q-3: Does the site carry a privacy statement, a licence and source line on the synced pages (the skills carry `license: MIT`), or an explicit decision that it has no legal pages? The old site had privacy, cookies and terms pages (RESEARCH, old inventory); the new site has none.
- Q-4: Are the external links of the proof page (CI runs whose logs expire) checked on a schedule, and what happens when one fails? The build checks internal links only (NFR-4).

- Q-5: Left to the technical design: (a) the address structure and prefixes, so that the synced pages live under /docs/ and /tr/docs/ as FR-25 requires; (b) the name and the address pattern of the agent index file (FR-15) and whether pages written for the site get a Markdown version; (c) the hosting, named, with the check that it offers the one-step return of FR-20, the place and order of the rehearsal, and what is done if it offers none; (d) the grace value of the stale-snapshot warning, as in Q-1; (e) the lab tool and the mobile profile of NFR-5 and the accessibility checker of NFR-6; (f) the length of titles and descriptions; (g) the build check of the title rule of FR-16; (h) the credential that lets the build check run on a sync pull request, and what happens to an already open sync pull request when a newer one is due; (i) Q-3, the privacy statement and licence line; (j) the recording of the product owner's decision tags in DECISION.md and the matching source documents before the launch checklist closes (DEC-3 is already updated to the 2-of-3 rule); (k) the order of the rehearsal of the way back (FR-32) against Q-5 (c), and what "previous publication" means on the chosen hosting; (l) whether a fine-grained token also carries a Metadata read permission besides the one permission of FR-27, checked in the GitHub documentation; (m) what the build does when the sentence it reads from the synced proof page is missing; (n) how the title rule of AC-10 is matched (case, whole word or substring), whether the `og:title` tag is checked in the same way, and whether a preview image exists; (o) against what a site-written Turkish page is compared in FR-18 and AC-14, since those pages do not exist in the pinned proofline commit; (p) topics not yet decided: the referrer policy of outgoing links to the repository (M-3 reads zero when the referrer is stripped), the Search Console property type and the zero baselines of M-4 and M-5, DNS and certificate ownership, the staleness of the hand-written Codex limit text, the Turkish index pages, the site navigation, security headers, and a sync pull request whose build check is red; (q) acceptance criteria for FR-10, NFR-1, NFR-5, NFR-7 and NFR-8.

## Rejected proposals

- RP-1 The traffic and the inbound links of the old site are worth keeping through redirects. rejected by user: "eski site korunmayacak"
