# Frame: proofline site

## Problem

- C-1 A first-time visitor does not grasp what proofline is quickly, cannot install it quickly and cannot read its documents on a site [assumption: usability estimate "target set by the product owner (about one minute to understand, about five minutes to install); nothing is measured yet"]
- C-2 A visit that does not answer "why can I trust it" loses the team lead who approves adoption even if the developer who installs it is convinced [assumption: value source agent accepted by user]
- C-3 The "install command copied" signal is a weak proxy for real installs and cannot be measured without cookies or scripts, so it is not a success measure [decision: by product owner because it is a weak proxy and a cookieless site cannot count it]

## Who

- C-4 The readers are developers and team leads who use Claude Code and Codex, in English and in Turkish [assumption: value]
- C-5 The developer who installs and the team lead who approves can be two different people, and the site must answer "how do I install it" and "why can I trust it" [assumption: value source agent accepted by user]

## Situation today

- C-6 The proofline repository is public at https://github.com/furkansarikaya/proofline [assumption: feasibility]
- C-7 An old site is live at https://proofline.technology; the new site replaces it on the same domain, and the old addresses are not redirected: they answer not found (changed 2026-11-19, replaces the earlier line that asked for redirects; see RESEARCH C-82) [decision: by product owner because the old site is not preserved]
- C-8 The old site's repository is being archived and the new site is built from scratch [decision: by product owner because the old site is replaced rather than extended]
- C-9 Most visitors see the README or a shared link first and reach the site second, so the site is a second-stage surface [assumption: usability source agent accepted by user]
- C-10 Documents change with every proofline release and go stale if copied by hand; the site takes them from a pinned release automatically and a pull request updates the site on every new release [decision: by product owner because manual copies drift from the releases]
- C-11 The proofline repository already tests its Turkish guides for staleness [assumption: feasibility]
- C-12 The main competitor is using a plain coding agent with nothing added; the named alternatives are Spec Kit, skill and workflow collections for Claude Code and Codex, Cursor rules and Aider [assumption: value source agent accepted by user]

## Success measures

- C-13 Success is read from GitHub stars, GitHub repository page views (unique visitors), referrers from the site to the repository, documentation page visits and Search Console impressions; clone counts are not a measure (changed 2026-11-19, see RESEARCH C-86) [decision: by product owner because the site runs without cookies or banners and the clone counts include automated clones] [claim updated 2026-11-20: PRD L-4 removed the unique visitors and referrers measures]

## Out of scope

- Choice of technology and hosting (decided in the technical design step with the design system).
- A blog, pricing and accounts.
- Cookies, a cookie banner and any third-party analytics.
- Languages other than English and Turkish.
- Paid tools.

## Limits

- The site is static, needs no server and uses free hosting; the domain already exists.
- Interface text is in two languages; documents are in Turkish only for the guides that have a translation.
- The guides in the documents do the work of content and SEO.

## Decision this discovery supports

- First the scope and information architecture of the site, then the positioning; the product owner decides.

## Unknowns to settle in research

- Settled on 2026-11-19: the repository and the old site are as C-6 and C-7 state (RESEARCH C-20 to C-35); no redirect list is needed, the old addresses answer not found.
- What the closest alternatives in C-12 promise their first-time visitor in the first screen.
- How visitors reach the repository today: the repository traffic gives the referrers (ASSUMPTIONS PB-2). The old site had no Search Console, so there is no search history to read; the new site starts one.

## Rejected proposals

