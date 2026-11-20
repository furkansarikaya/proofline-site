# Docs surface: approved sample

The product owner's approved sample of the docs surface (`read` mode). It is a look reference, not code to copy one to one. Rules live in [DESIGN.md](../../DESIGN.md) and [DESIGN-docs.md](../../DESIGN-docs.md); where the sample and those documents differ, the documents win.

## What it is
- `index.html`: lists the four sample pages. Open this first (from this folder; the faces load from `../direction-c/fonts/`).
- `en-concept-workflow.html`: a concept page with long tables and code (`docs/concepts/workflow.md`).
- `en-skill-tdd-proof.html`: a skill page (`skills/tdd-proof/SKILL.md`), with the "Shared rules" block folded.
- `en-skills.html`: the skill catalogue (28 skills).
- `tr-guide-gunluk-kullanim.html`: a Turkish guide with the English-only markers in the tree. The "English page changed" notice is shown on purpose to demonstrate it; at the sample's commit the real guide is not stale.
- `docs.css`, `fonts.css`, `docs.js` (2806 bytes; the rule is at most 4096), `search-mock.js` (a stand-in for the Pagefind component: it filters page titles and exists only in the sample).
- `screenshots/`: first screens, desktop (1440 wide) and mobile (390 wide), light and dark, for the four pages (`<page>-<desktop|mobile>-<light|dark>.png`), plus states: mobile tree open, mobile "On this page" open, mobile table, desktop search (English), mobile search (Turkish), tablet (1000 wide) "On this page" open.

## Source of the text
All text comes from the proofline repository at commit `b6d7f0ff` (v0.0.173); the real pages read it from the pin. The sample's links are placeholders (`#`) except GitHub, the edit links and links to files outside the synced set. The sample builder was a throwaway script and is not kept.

## Fonts
The same self-hosted faces as the promotional sample (OFL-1.1; licence texts in `../direction-c/fonts/`). The site hosts its own copies.
