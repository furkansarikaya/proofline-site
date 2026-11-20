# Design: marketing surface (persuade)

Surface `marketing` of `design_docs.design` (home, get started, trust, Claude Code and Codex, not found; English and Turkish). Base: [DESIGN.md](DESIGN.md). Written as the direction contract of the chosen direction C "the quiet instrument"; to be updated after the build.

Approved direction sample: [references/direction-c/](references/direction-c/README.md) (the first screen and one lower section, English and Turkish, light and dark, desktop and mobile). It is a look reference, not code to copy one to one; where it and this document differ, this document wins.

## Visitor mode
`persuade`. The trust page is persuade too, but it is kept calm: measure and rhythm, no showpiece; the single motion is the diagram on the home page.

## Idea and argument
Idea (rival test passed, rival: GitHub Spec Kit): on this page the blocked claim becomes the structure of the page: a task enters as a claim and leaves only with its proof, which Spec Kit's page cannot say because its product is templates and commands.

| Section | Claim | Source |
|---|---|---|
| First screen | A script blocks a claim with no proof. For developers who let Claude Code or Codex change real code. | proofline README "Why proofline"; `docs/product/site/ASSUMPTIONS.md` C-94; PRD FR-2 |
| Diagram | A task passes plan, test, review, security and verify; a failing claim goes back for a fix round. It stops before commit and push. | README "Why proofline", "Quick start"; `.agents/GATES.md` gate set |
| Install to finished run | Install, ask for a task, run it, read how it ended. | README "Install", "Quick start"; the section "Real output" of docs/concepts/workflow.md in the proofline repository |
| Limits | This site was built with proofline and its work is public; wider multi-project use is not proven. | README "Status"; site repository (R-6) |

## Typography use
Headline: step-head, two lines, sentence case, two-tone. English "A script blocks / a claim with no proof." Turkish "Dayanaksız iddiayı / bir script engeller." The words "evidence" and "kanıt" are not used in any title or heading (AC-10); the descriptive phrase "a deterministic engineering team for Claude Code and Codex" is in the lead text.

## Layout rules
- The first screen holds, in this order on every width: headline, description, copyable install command, diagram. On desktop the headline is on the left (7 columns) and the description with the command is on the right (5 columns); on a phone they stack in that order.
- The diagram sits in a hairline frame under the first row; the gate legend (five columns, one line each) is the frame's last row.
- The lower section is one reading column starting at column 4, six columns wide.
- **R-4 Hatching is a small touch.** Hatched fills only as: 26px (12px on a phone) side rails of the diagram frame, and one 14 by 92px tab next to the section headline. No hatched box fills empty space; the unused space stays plain ground.
- No cards, no shadows, no rounded corners, no gradients, no glow.

## The diagram (the one memorable thing)
An isometric drawing in SVG (own drawing, not copied): a belt carries slabs (tasks) through five gate arches labelled `01 PLAN`, `02 TEST`, `03 REVIEW`, `04 SECURITY`, `05 VERIFY`; the entry is labelled `TASK`, the exit `CODE_DONE`. One slab is stopped at REVIEW, marked `BLOCKED`, and sent back; the other leaves.
- **R-1 The red is only the blocked slab.** `--block` (`#c4152b` light, `#e0354a` dark) is used for the fill of the blocked slab in the diagram and nowhere else on the site: not for links, buttons, errors, focus, text or hover. A build check searches the built CSS for the two values and allows only the diagram rule.
- **R-2 No state by colour alone.** The blocked slab carries a cross and the label `BLOCKED`; the finished slab carries a check mark and the label `CODE_DONE`; the finished slab is the accent teal (`--accent`), as chosen. Red and teal differ little in lightness (1.05 in light, 1.51 in dark), so the shapes and labels are what a colour-blind visitor reads; the sample page was rendered through protanopia, deuteranopia, tritanopia and achromatopsia filters to check it.
- **R-3 Motion only here.** A 20 second loop: slab A runs the belt and turns into the accent colour after VERIFY; slab B stops before REVIEW, shows the cross, backs up one step (the fix round) and runs again. Under `prefers-reduced-motion: reduce` there is no animation and the page shows the still frame (blocked slab at REVIEW, finished slab at the exit). Motion is CSS only; no script.
- **R-7 Labels are never smaller than 12px.** The labels in the drawing are 28 drawing units below 721px viewport width, which is at least 12.7px on screen from 460px up (measured 12.7 at 460, 14.0 at 500, 17.3 at 600). Below 460px they are hidden and a key line under the drawing (at least 14px) says what the cross and the check mark mean; the gate legend below is always visible. The cross and check shapes stay in the drawing.
- A text alternative is given on the drawing (`role="img"` with a label, Turkish translation on Turkish pages) and the legend below it lists the five gates in text, so a screen reader and a phone (where the drawing is small) lose nothing.
- Legend sentences come from the README: PLAN "frozen with a scope: file list"; TEST "RED, then GREEN, reproduced by the gates"; REVIEW "never by whoever wrote the change"; SECURITY "cannot be waived"; VERIFY "CODE_DONE only when every required gate passed".

## Real output as the visual material
The lead's final message of a real run (the section "Real output" of docs/concepts/workflow.md in the proofline repository, pinned commit) is shown as an excerpt, text unedited, with the line that says which parts were left out and a link to the source. **R-5** It is always marked `lang="en"`, also on a Turkish page, and the Turkish caption says it is quoted from the English source. Terminal and command blocks are marked `lang="en"` and `translate="no"`.

## Limits and trust statement (R-6)
The limits section of the home page and the trust page must say, together and in this order, in the page's language:
- English: "This site was built with proofline, and its tasks and pull requests are public (site repository). Wider use across many projects is not yet proven (README, Status)."
- Turkish: "Bu site proofline ile yapıldı; task'ları ve pull request'leri herkese açık (site reposu). Daha geniş, çok projeli kullanım henüz kanıtlanmadı (README, Status)."

"Site repository" links to `https://github.com/furkansarikaya/proofline-site` and "README, Status" to the README at the pinned commit. The sentence "not yet proven on real projects" is never shown alone. **No number of tasks, pull requests or CI runs is written by hand:** a count appears only when the build reads it from the site repository (and then it carries the date it was read), otherwise it is left out. (The first version of the page states no count.)

## Footer (one line, ADR 0006)
- English: "No cookies and no analytics scripts. The host keeps ordinary request logs. MIT licensed (LICENSE). Built with proofline."
- Turkish: "Çerez ve analitik betiği yok. Barındırıcı olağan istek günlüklerini tutar. MIT lisanslı (LICENSE). proofline ile yapıldı."

"LICENSE" links to the proofline repository's LICENSE at the pinned commit; "Built with proofline" / "proofline ile yapıldı" links to `https://github.com/furkansarikaya/proofline-site`. It wraps on a phone but stays one paragraph.

## Copy rules
- No install time ("five minutes", "beş dakika") until PB-3 is confirmed (C-88, AC-4).
- No statistic, review, customer logo or third-party product logo; every number and claim carries its source in the page or in this document.
- Turkish pages: sentences in Turkish; technical terms stay English as in AGENTS.md (commit, pull request, CI, test, review, hook, workflow, task, run); proofline's own names (roles, skills, commands, class and gate names) are never translated.

## States of the first screen
| State | Behaviour |
|---|---|
| No script (controls script blocked or failed) | Everything reads; the command can be selected by hand; the language link navigates; the theme follows the system by CSS; the theme and copy buttons are hidden. |
| Copied | A polite live region announces "Copied" / "Kopyalandı" and the button shows a check mark for under two seconds. When the clipboard is refused the command is selected and the region says so. |
| Reduced motion | The diagram is a still frame. |
| Narrow (phone) | Order: headline, description, install command, diagram, key, legend; the diagram frame keeps 12px rails; below 460px the drawing labels are hidden (R-7); command lines wrap instead of scrolling. |

## Gaps
- The trust page and the other three pages are not designed here; they follow these rules and are specified by their own tasks.
- The first-screen check with three developers who know Spec Kit (FR-29, AC-35) has not been run; this design is not yet a go.
