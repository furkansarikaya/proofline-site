# Research: proofline site, search demand and the current state

Sources: web tools were available (a search tool limited to US results, page fetches, the GitHub API through `gh`). The search tool is not Google and returns no rank or volume, so every "first results" claim below says which pages appeared and what type they are, never at which position.

## Search plan

- SQ-1 Is the repository public and what does it say about itself (C-6)?; queries: GitHub API repos/furkansarikaya/proofline | repository tree; sources: official-docs, data
- SQ-2 Is the old site live and which addresses does it serve (C-7, redirect inventory)?; queries: HTTP fetch of the site, its sitemap and robots file | probes of redirect behaviour; sources: official-docs, data
- SQ-3 What intent and page types does "Claude Code workflow" bring?; queries: "Claude Code workflow"; sources: official-docs, forums
- SQ-4 What intent and page types does "Claude Code and Codex" bring?; queries: "Claude Code and Codex"; sources: official-docs, reviews
- SQ-5 What intent and page types does "multi-agent coding workflow" bring?; queries: "multi-agent coding workflow"; sources: official-docs, forums
- SQ-6 What intent and page types does "AI code review with evidence" bring?; queries: "AI code review with evidence"; sources: official-docs, reviews
- SQ-7 What intent and page types does "TDD with AI agents" bring?; queries: "TDD with AI agents"; sources: official-docs, forums
- SQ-8 What intent and page types does "Claude Code skills" bring?; queries: "Claude Code skills"; sources: official-docs, forums
- SQ-9 What intent and page types does the Turkish query "yapay zeka ajan iş akışı" bring?; queries: "yapay zeka ajan iş akışı"; sources: official-docs, forums
- SQ-10 Does one data source give a search volume for these seven queries?; queries: "monthly search volume claude code keyword data"; sources: data
- SQ-11 Which site page should answer which query (derived from SQ-3 to SQ-9, no new source)?; queries: none; sources: data
- SQ-12 Does another product use the name "proofline" in search (added after the SQ-2 results, not in the first plan)?; queries: "site:proofline.technology"; sources: forums, data

## Claims

- C-20 (SQ-1) The repository furkansarikaya/proofline is public. [fact: data `gh api repos/furkansarikaya/proofline --jq .visibility` sha256:cde1925e8f892f5ddaadebfecbdd060398f5d76d3d19224f60d08343d3bbde20]
- C-21 (SQ-1) The repository description is the project's one-line pitch, "No evidence, no claim", for Claude Code and Codex. [fact: data `gh api repos/furkansarikaya/proofline --jq .description` sha256:e64365e80c4a4cfa11bd6ff7b147ff59115ab1656ef74229bf06df87f4ed2318]
- C-22 (SQ-1) The repository's homepage field already points to https://proofline.technology. [fact: data `gh api repos/furkansarikaya/proofline --jq .homepage` sha256:e621ad56d631bcdb220bcc652c413d5e15c0d8c44a4ebabaafdfe8f26801aae4]
- C-23 (SQ-1) The repository has one star today, so the star baseline for the success measure is one. [fact: data `gh api repos/furkansarikaya/proofline --jq .stargazers_count` sha256:4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865]
- C-24 (SQ-1) The repository topics already cover most target queries: agent-skills, claude-code, code-review, codex, multi-agent, tdd, workflow and others. [fact: data `gh api repos/furkansarikaya/proofline --jq '.topics|join(",")'` sha256:769be88407ecd22d9fe16be027bdccdec90eef2ca30257c4f98bb7c382467da8]
- C-25 (SQ-1) The repository has no GitHub release at all, so the frame's "pinned release" has no release to pin today. [fact: data `gh api repos/furkansarikaya/proofline/releases --jq length` sha256:9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa]
- C-26 (SQ-1) The repository has no git tag either, so a pin has to be a commit until a first tag exists. [fact: data `gh api repos/furkansarikaya/proofline/tags --jq length` sha256:9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa]
- C-27 (SQ-1) The translation staleness check from frame C-11 exists as a file in the repository (`tests/ci/translation-stale.mjs`); its header says a stale translation warns and never fails. [fact: data `gh api repos/furkansarikaya/proofline/contents/tests/ci/translation-stale.mjs --jq .sha` sha256:52673666905ce797de3ce4cea3946ddedb69d1760d9cf2cf23495ea08954b851]
- C-28 (SQ-2) The old site is live: its home page answers with a success status. [fact: data `curl -sS -o /dev/null -w '%{http_code}' https://proofline.technology/` sha256:27badc983df1780b60c2b3fa9d3a19a00e46aac798451f0febdca52920faaddf]
- C-29 (SQ-2) The old site's home page title is the same pitch as the repository. [fact: web https://proofline.technology/ accessed 2026-11-19 "Proofline — No evidence, no claim"]
- C-30 (SQ-2) The old site's home page describes itself as a tour of the workflow, roles, gates and skills, not as an install guide. [fact: web https://proofline.technology/ accessed 2026-11-19 "Explore the Proofline workflow, roles, gates and skills."]
- C-31 (SQ-2) The old site has a sitemap and every address in it is written with the http scheme, including the Turkish twin of each page. [fact: web https://proofline.technology/sitemap.xml accessed 2026-11-19 "<loc>http://proofline.technology/tr/faq/</loc>"]
- C-32 (SQ-2) The old site's sitemap lists ninety-four addresses (see the inventory below). [fact: data `grep -o '</loc>' .agents/local/scratch/sitemap.txt | wc -l | tr -d ' '` sha256:6fc16b03d8c15b9885876848a301a01816cccaf7b48e74f2b51db99c007a3bd5]
- C-33 (SQ-2) The robots file allows everything and points to the http sitemap. [fact: web https://proofline.technology/robots.txt accessed 2026-11-19 "Sitemap: http://proofline.technology/sitemap.xml"]
- C-34 (SQ-2) The http address and the www address both redirect permanently to the https apex, so a redirect layer already exists on the old host. [fact: data `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' http://proofline.technology/` sha256:cbdd019ee0fb543b50935f644214ab6b793d35bda9496ae01dd9c6d29b8d3b4e]
- C-35 (SQ-2) The old site has no /docs section: the address answers not found, and its documents are the skills and agents pages. [fact: data `curl -sS -o /dev/null -w '%{http_code}' https://proofline.technology/docs` sha256:6b3c238ebcf1f3c07cf0e556faa82c6b8fe96840ff4b6b7e9962a2d855843a0b]
- C-36 (SQ-3) A result for "Claude Code workflow" is the vendor's own documentation page, an official-docs page type. [fact: web https://code.claude.com/docs/en/common-workflows accessed 2026-11-19 "Common workflows - Claude Code Docs"]
- C-37 (SQ-3) Other results for "Claude Code workflow" are third-party pattern guides, a vendor blog type. [fact: web https://www.mindstudio.ai/blog/claude-code-5-workflow-patterns-explained accessed 2026-11-19 "Claude Code Workflow Patterns Explained: From Sequential to Fully Autonomous"]
- C-38 (SQ-3) Other results for "Claude Code workflow" are personal "my workflow" posts, a practitioner blog type. [fact: web https://invertedpassion.com/my-claude-code-workflow/ accessed 2026-11-19 "My Claude Code workflow"]
- C-39 (SQ-3) The intent behind "Claude Code workflow" is informational: a reader who already uses Claude Code wants a method to copy. [assumption: value]
- C-40 (SQ-4) A result for "Claude Code and Codex" is a comparison page that asks the reader to pick one agent. [fact: web https://roadmap.sh/claude-code/vs-codex accessed 2026-11-19 "Claude Code or Codex? How to Pick the Right AI Agent"]
- C-41 (SQ-4) The intent behind "Claude Code and Codex" is a choice between the two agents, so nearly every result is a "versus" comparison and none of the pages I could open serves a reader who uses both. [assumption: value]
- C-42 (SQ-5) A result for "multi-agent coding workflow" is a vendor blog that defines the term and lists patterns. [fact: web https://www.tembo.io/blog/multi-agent-ai-coding-workflows accessed 2026-11-19 "Multi-Agent AI Coding Workflows (2026) – Tembo"]
- C-43 (SQ-5) A result for "multi-agent coding workflow" is a framework vendor's own post on roles such as architect, tester and coder. [fact: web https://flutter.dev/blog/building-multi-agent-dev-teams accessed 2026-11-19 "Architects, testers, and coders: Building multi-agent development teams"]
- C-44 (SQ-5) A result for "multi-agent coding workflow" is a guide from a tool vendor about scaling software development with several agents. [fact: web https://www.augmentcode.com/guides/multi-agent-ai-software-development accessed 2026-11-19 "How Multi-Agent AI Scales Software Development | Augment Code"]
- C-45 (SQ-5) The intent behind "multi-agent coding workflow" is a mix of learning the term and evaluating how to set it up; the results talk about roles and orchestration, and the first results I read do not name evidence or gates in their titles. [assumption: value]
- C-46 (SQ-6) A result for "AI code review with evidence" is a blog whose title says that AI review hallucinates without evidence. [fact: web https://frontman.sh/blog/ai-code-review-hallucination/ accessed 2026-11-19 "AI Code Reviews Hallucinate Without Evidence | Frontman"]
- C-47 (SQ-6) A result for "AI code review with evidence" is a review vendor's guide that calls evidence the basis of trustworthy review. [fact: web https://coderabbit.ai/guides/code-context accessed 2026-11-19 "Code context: The evidence behind trustworthy AI code review"]
- C-48 (SQ-6) The intent behind "AI code review with evidence" is to evaluate review tools and to find a reason to trust AI findings; this is the query closest to the proofline pitch "No evidence, no claim" (C-21). [assumption: value]
- C-49 (SQ-7) A result for "TDD with AI agents" is a blog on whether agents make test-driven development more practical. [fact: web https://blog.logrocket.com/agentic-tdd-coding-agents/ accessed 2026-11-19 "How do coding agents make TDD more practical? - LogRocket Blog"]
- C-50 (SQ-7) A result for "TDD with AI agents" is an essay that asks whether TDD still matters when agents write the code. [fact: web https://blog.openreplay.com/tdd-agents-writing-code/ accessed 2026-11-19 "Does TDD Still Matter When Agents Write the Code?"]
- C-51 (SQ-7) The intent behind "TDD with AI agents" is a developer asking how to keep an agent honest about tests; the results are opinion posts and tutorials. [assumption: value]
- C-52 (SQ-8) A result for "Claude Code skills" is the vendor's own skills documentation, an official-docs page type. [fact: web https://code.claude.com/docs/en/skills accessed 2026-11-19 "Extend Claude with skills - Claude Code Docs"]
- C-53 (SQ-8) A result for "Claude Code skills" is a skills directory with an install command, a registry page type. [fact: web https://skills.sh/agent/claude-code accessed 2026-11-19 "Skills for Claude Code — Install via the skills CLI"]
- C-54 (SQ-8) A result for "Claude Code skills" is an explainer blog on what skills are and why they matter. [fact: web https://datanorth.ai/blog/claude-code-skills-what-are-they-and-why-are-they-important accessed 2026-11-19 "Claude Code Skills: What are they and why are they important"]
- C-55 (SQ-8) The intent behind "Claude Code skills" is mixed: learning what a skill is, and finding a skill to install. [assumption: value]
- C-56 (SQ-9) A result for "yapay zeka ajan iş akışı" is a Turkish article on agent workflow patterns in general. [fact: web https://techsy.io/tr/blog/yapay-zeka-ajan-is-akisi-desenleri accessed 2026-11-19 "AI Ajan İş Akışı Desenleri: 7 Desen, Hangisi Ne Zaman?"]
- C-57 (SQ-9) A result for "yapay zeka ajan iş akışı" is a Turkish page on design patterns of agentic AI in general. [fact: web https://aimultiple.com/tr/agentic-ai-design-patterns accessed 2026-11-19 "5 Agentic AI Tasarım Desenleri ve Gerçek Dünya Örnekleri"]
- C-58 (SQ-9) The Turkish query brings general agentic-AI explainers and automation-builder pages, and none of the results the tool listed is about coding agents, so a Turkish page about coding-agent workflows would meet little direct competition. [assumption: value]
- C-59 (SQ-11) The queries map to seven page types: an install and quick-start page, a "why trust it" evidence page, a Claude Code and Codex page, a guides section for workflow and TDD, a skills catalogue, a Turkish guides section and a concepts section (table below). The user added the concepts section as the seventh type. [assumption: usability source agent changed by user]
- C-60 (SQ-12) The search tool shows other products also called Proofline (an evidence-preservation app and a directory entry for a construction tracker), so the bare brand query is shared; the name is therefore always used together with a descriptive phrase, in page titles, in descriptions and in structured data. [assumption: viability source agent accepted by user]
- C-61 (SQ-1) The site's documents are pinned to one specific proofline commit for now, because the repository has no tag (C-25, C-26). [decision: by product owner because the repository has no release or tag yet]
- C-62 The product owner will have every proofline release tagged automatically in the repository as separate work; when tags exist, the pin moves from the commit to the tag and the release pull-request automation is bound to the tag. [decision: by product owner because a tag is the stable pin the automation needs]
- C-63 (SQ-2) SUPERSEDED by C-82 on 2026-11-19: the old addresses /legal/cookies/ and /tr/legal/cookies/ redirect permanently to the privacy page, because the new site uses no cookies. The reason for the change: the old site is not preserved and no old address is redirected. [decision: by product owner because the new site has no cookies and no cookies page]
- C-64 (SQ-2) SUPERSEDED by C-82 on 2026-11-19: the new site writes its sitemap addresses and its canonical addresses with https. The reason for the change: this decision belonged to the redirect work, and the address structure of the new site is now set from scratch in the technical design. [decision: by product owner because the old sitemap and canonicals use http (C-31)]
- C-65 (SQ-2) SUPERSEDED by C-82 on 2026-11-19: the old skill pages (/skills/<slug>/) get a counterpart in the new skill catalogue and the old agent pages (/agents/<slug>/) get a counterpart as role pages; the redirect table is written on that basis. The reason for the change: without redirects an old address needs no counterpart. [decision: by product owner because every old skill and agent address must lead to a page with the same subject]
- C-82 (SQ-2) The old addresses are not redirected: the old site is not preserved, the new site goes live from scratch with its own address structure, the old addresses answer not found, and the not-found page points clearly to the home page and the documents, in both languages. This replaces C-63, C-64 and C-65. [decision: by product owner because the old site will not be preserved]
- C-83 (SQ-2) Ownership of the site in Google Search Console and Bing Webmaster Tools is verified by a DNS TXT record by preference (no code in the site; the product owner adds the record); when DNS is not possible, the verification meta tags are read from the environment variables GOOGLE_SITE_VERIFICATION and BING_SITE_VERIFICATION and no tag is printed when a variable is empty; the site gets no analytics script. [decision: by product owner because the old site had no Search Console and the new site runs without cookies or scripts]
- C-84 The bare brand query is not a success measure; descriptive queries such as "Claude Code workflow" are the measured ones. [decision: by product owner because the bare name is shared with other products (C-60)]
- C-86 Clone counts are not a success measure; success is read from GitHub stars, the unique visitors of the repository page and the referrers that lead from proofline.technology to the repository. [decision: by product owner because the clone counts include automated clones (AS-16 in ASSUMPTIONS)] [claim updated 2026-11-20: success is read from GitHub stars, documentation page clicks and Search Console impressions now; the unique visitors and referrers measures were removed by PRD L-4 / FR-25]
- C-87 A GitHub Actions job in the site repository runs weekly and saves a snapshot of the repository traffic (views and referrers) and of the star count to a file or to a separate branch; the access key it needs is held as a repository secret. [decision: by product owner because GitHub keeps only a short traffic history (C-95 in ASSUMPTIONS) and the success measures need a longer one] [claim updated 2026-11-20: the weekly snapshot job was removed, superseded by PRD L-4]
- C-88 The "five minutes" claim of the site rests only on the init and doctor part, which the product owner timed from an empty folder on a machine that already had the plugin and the command line tool (PB-1 in PROBES); the first-time installation of the plugin and the tool is not measured, and the claim keeps that scope until it is. [decision: by product owner because the first-time installation was not part of the measurement]
- C-85 The Turkish side is limited to interface texts and the Turkish guides that already exist; the document sync and the release automation open pull requests by themselves. [decision: by product owner because one maintainer has to keep two languages and two automations running]

## Query to page map

| Query | Intent (C-39 to C-58) | Page that should answer it |
|---|---|---|
| Claude Code workflow | learn a method | guide: the proofline workflow in Claude Code |
| Claude Code and Codex | choose or combine agents | one page: proofline with both, one installation |
| multi-agent coding workflow | learn and evaluate | concepts section: roles and gates (the concepts documents of the repository) |
| AI code review with evidence | evaluate and trust | evidence page: "No evidence, no claim" and how a verdict is proven |
| TDD with AI agents | how to keep agents honest | guide: test-first run with recorded RED and GREEN |
| Claude Code skills | learn and install | skills catalogue with a page per skill |
| yapay zeka ajan iş akışı | learn (Turkish) | Turkish guide, only where a translation exists |

## Old site address inventory

SUPERSEDED as a work list (2026-11-19, C-82): the old addresses are not redirected, so the redirect table below is not carried into the PRD. The inventory and the table stay as information about the old site.

The inventory is read from the sitemap of the old site (C-31, C-32) on 2026-11-19. Each entry exists in two languages: the address as written and the same address under `/tr/`. The new site must answer each of these addresses with a permanent redirect or the same page. Sitemap and canonical addresses use `http`, and the old host already redirects `http` and `www` to `https` (C-34); the new site uses `https` for both (C-64). New paths are not fixed yet (technical design step), so targets below are page types.

```text
/                       /faq/            /skills/          /agents/        /how-it-works/
/legal/privacy/         /legal/cookies/  /legal/terms/
/skills/<slug>/ for: api-design concurrency-proof contract-proof data-design debug-proof design-sync docs-writer evidence-map explain-html exploit-proof intent-grill llm-wiki performance-proof plan-contract product-assess product-discovery product-spec proof-review proofline proofline-lead qa-plan system-design task-author tdd-proof test-trust ui-design verify-proof visual-proof
/agents/<slug>/ for: architect data-architect designer explorer implementer lead qa reviewer security-reviewer task-author verifier
```

Redirect table, SUPERSEDED by C-82 (each row held for the address and for its `/tr/` twin):

| Old address | New target (page type) | Status |
|---|---|---|
| `/skills/<slug>/` (28 pages) | the page of that skill in the skill catalogue | decided (C-65) |
| `/skills/` | skill catalogue index | decided (C-65) |
| `/agents/<slug>/` (11 pages) | the role page of that agent | decided (C-65) |
| `/agents/` | roles index | decided (C-65) |
| `/legal/cookies/` | privacy page, permanent | decided (C-63) |
| `/legal/privacy/` | privacy page (same subject) | follows from C-63 |
| `/`, `/faq/`, `/how-it-works/`, `/legal/terms/` | home, questions, concepts or terms page | open: set in the information architecture |
| `/tr/` twins of skill and agent pages | the Turkish page where a translation exists | open: the fallback where no Turkish page exists (English page or not found) |

## Searched, not found

- SQ-10 No single data source gave a search volume for any of the seven queries. One result mentioned a figure for a related phrase but did not name the data source behind it, so it is not used; no volume appears in this file as a fact.
- SQ-12 The search tool returned no page of proofline.technology for the query "site:proofline.technology", and an attempt to open proofline.live failed, so I could not read the other products' pages myself.
- SQ-4 Two comparison pages (datacamp.com and sitepoint.com) and one tutorial (realpython.com) answered the fetch with a bot check page ("Just a moment..."), so their titles could not be quoted.
- SQ-6 The page of a code-review vendor listed for the query (codeant.ai) now shows an unrelated home title, so it is not used.
- Whether Google indexes the old site, how many impressions it has and which queries lead to it: not visible without Search Console access.

## Rejected proposals

## So what

- IN-1 The repository has no release and no tag, so the frame's plan to take documents from a pinned release and open a pull request on every new release cannot start. evidence: C-25, C-26, C-61, C-62; so what: the documentation section is pinned to one commit now and moves to the tag once the tagging work lands, so the information architecture treats the pin as a single setting that changes later.
- IN-2 The old site is a catalogue of agents, skills and legal pages in two languages with no documents section, and all of its addresses are written with http. evidence: C-31, C-32, C-35, C-82; so what: the old inventory is information only; no redirect work enters the PRD, the old addresses answer not found, and the information architecture is free of the old structure (superseded reading: a counterpart for every skill and agent address, C-65).
- IN-3 The old site has a cookies legal page while the new site will use no cookies. evidence: C-31, C-32, C-82, C-83; so what: the new site has no cookies page and no analytics script, and the old cookies address is one of the not-found addresses like the others (superseded reading: a permanent redirect to the privacy page, C-63).
- IN-4 "AI code review with evidence" is the query closest to the proofline pitch and its results are vendor blogs about unverified findings. evidence: C-21, C-46, C-47, C-48; so what: positioning should lead with the evidence claim and a page that shows how a verdict is proven, ahead of the generic multi-agent story.
- IN-5 The "Claude Code and Codex" results are "versus" comparisons. evidence: C-40, C-41; so what: a page that shows proofline working with both agents answers a need that the comparisons leave open and belongs in the information architecture.
- IN-6 "Claude Code skills" brings official docs and a skills directory, so a skills catalogue page plus a listing in a directory is a route to the same readers. evidence: C-52, C-53, C-55; so what: the skills section stays in the site's scope and the directory listing is part of the launch checklist rather than of the site.
- IN-7 No volume could be established for any query. evidence: C-39, C-41, C-45, C-48, C-51, C-55, C-58; so what: ranking the pages by search volume is not possible now, so the scope decision should be made on intent fit and the volume should be read from Search Console after the launch.
