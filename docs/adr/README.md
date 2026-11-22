# Architecture decision records

Decisions of the proofline site, numbered and never renumbered. The overview is in [../design/ARCHITECTURE.md](../design/ARCHITECTURE.md).

Each entry links the file and gives its title and, in brackets, the first word of its status line; the full status is in the file.

- [0001. Build the site with Astro 7 as a static site, npm and Node 24.x](0001-astro-static-site-and-toolchain.md) [accepted]
- [0002. Fix the address table, two locales without fallback, one translation index, and the title rules](0002-addresses-languages-hreflang-and-titles.md) [accepted]
- [0003. Fetch the pinned documents at build time against a lock, transform them deterministically, and move the pin by a GITHUB_TOKEN pull request](0003-document-sync-pin-lock-and-sync-workflow.md) [accepted]
- [0004. Search the documents with Pagefind's Component UI on docs pages only](0004-static-search-with-pagefind.md) [accepted]
- [0005. Stay on the existing Vercel project, use Instant Rollback to the new site's previous production deployment as the way back, and keep non-production builds out of search](0005-hosting-cutover-way-back-and-closed-previews.md) [accepted]
- [0006. Enforce privacy with a strict CSP from vercel.json, keep the origin referrer to the repository, and state privacy and licence in one footer line](0006-privacy-headers-csp-and-referrer.md) [accepted]
- [0007. Save weekly traffic snapshots to an orphan `traffic-data` branch, warn after 10 days, and tell the owner by GitHub issues](0007-traffic-snapshot-job-and-data-branch.md) [superseded]
- [0008. Gate every change with one required CI check that builds twice, checks dist/, runs axe and Lighthouse, and verifies workflow permissions](0008-ci-checks-budgets-and-workflow-permissions.md) [accepted]
- [0009. Run browser checks with the Playwright library under node:test](0009-browser-checks-with-the-playwright-library-under-node-test.md) [accepted]
- [0010. Add the contact page at /contact/ and /tr/iletisim/, a last "Contact" menu entry, and plain links with a mailto address](0010-contact-page-address-and-links.md) [accepted]
- [0011. Register each site-written page pair as one entry of the translation index](0011-translation-index-pairs-are-index-entries.md) [accepted]
