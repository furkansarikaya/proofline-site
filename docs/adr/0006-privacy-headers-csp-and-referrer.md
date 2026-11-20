# 0006. Enforce privacy with a strict CSP from vercel.json, keep the origin referrer to the repository, and state privacy and licence in one footer line

Status: accepted
Date: 2026-11-19

## Context

NFR-1 forbids cookies, banners and counting scripts; NFR-7 forbids active HTML from the sync; M-3 counts the `proofline.technology` entry of the repository's referrer list, which exists only when the browser sends a Referer (REVIEW, Never mentioned); Q-3 asks whether the site has a privacy statement, a licence and source line, or no legal pages. Q-5 (i) and the security-header and referrer parts of (p) are open.

## Decision

1. No cookie, banner, analytics or counting script; no reference to a third-party host in any page (fonts and images self-hosted).
2. Response headers for all paths, from vercel.json:
   - `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - for `/(.*)\.md`: `Content-Type: text/markdown; charset=utf-8`; for `/llms.txt`: `Content-Type: text/plain; charset=utf-8`.
   HSTS is not duplicated if the launch checklist shows Vercel sends it; otherwise it is added. Astro `build.inlineStylesheets: 'never'`; no `style=` attribute and no inline `<script>` in site pages, except the JSON-LD data block of the home pages (`type="application/ld+json"`, not executed); the one allowed script file is the controls script of the amendment below.
3. Referrer: links to `https://github.com/furkansarikaya/proofline` carry no `rel="noreferrer"` and the page policy is not `no-referrer`, so the browser sends the origin `https://proofline.technology` (M-3). A browser that sends no referrer is invisible to M-3; the PRD states it.
4. Q-3: no privacy, cookie or terms pages. Every page has one footer line: no cookies and no analytics scripts; the host keeps ordinary request logs; the content is MIT licensed, with a link to `LICENSE` of the proofline repository at the pinned commit. Synced pages also show their source path and the pinned commit or tag (FR-12). The decision "one footer line, no legal pages" is made here; the exact wording is open and is decided together with the promotional design step (`design ui`), by the product owner's choice.
5. `scripts/serve-dist.mjs` serves `dist/` with the semantics and headers of vercel.json (trailing-slash 308, 404 page with status 404, the headers above), so Playwright and Lighthouse see the real CSP; the browser checks listen for `securitypolicyviolation` and fail on any.

## Amendment 2026-11-20: one controls script on the four site pages

The promotional design (`docs/design/DESIGN.md`, header controls) needs a theme button that remembers the choice and a copy button for the install command. The product owner decided (PRD N-5) to allow one same-origin script file `/assets/controls.js`, at most 2048 bytes uncompressed, loaded synchronously in `<head>` (no `async` or `defer`, so the saved theme applies before first paint), with no inline script body.

- The script only reads and writes `localStorage` key `theme`, sets `data-theme` on `<html>`, updates the theme button's accessible name, and runs the copy button. It reads no cookie, makes no request, and counts nothing (NFR-1).
- CSP is unchanged: `script-src 'self'` already allows a same-origin file, and inline scripts stay forbidden.
- Without the script: the theme follows `prefers-color-scheme` by CSS, the theme and copy buttons are hidden (they appear only after the script adds the `js` class), the language link and every other control work, and the command can be selected by hand.
- CI (ADR 0008) fails when a site page has another script, an inline script body, an `async` or `defer` attribute on this one, or when the file is larger than 2048 bytes.

## Alternatives considered

- No CSP: NFR-1 and NFR-7 stay unenforced at runtime; a sync that slips an inline script past the transform would run. Rejected.
- CSP in a `<meta>` tag: cannot carry `frame-ancestors`, is easy to drift per layout, and cannot cover the Markdown files. Rejected.
- Full privacy, cookie and terms pages (the old site had them): they describe processing that does not exist; one true sentence is the smallest correct statement, and the PRD drops legal pages. Rejected.
- `Referrer-Policy: no-referrer` or `noreferrer` links (privacy maximal): M-3 would read zero for ever. Rejected.

## Consequences

- Any future feature that needs inline style or a third-party host must change the CSP in vercel.json, which is visible in review.
- `'wasm-unsafe-eval'` is present for Pagefind (ADR 0004); it allows WebAssembly compilation only, not string eval; pages without script are unaffected. If the search task shows Pagefind runs without it, it is removed. If the Component UI needs inline styles, `style-src` is relaxed for `/docs/*` and `/tr/docs/*` only.
- Cost: no syntax highlighting with inline styles (ADR 0003).

## Evidence

- verified (V7): vercel.json `headers` with `source` and key/value pairs.
- verified (A3): Pagefind runs from the site's own `/pagefind/` folder (same origin).
- verified (REVIEW, Never mentioned): M-3 depends on the Referer header.
- inferred: `strict-origin-when-cross-origin` sends the origin on a cross-origin https navigation (the browser default policy; not read this session); CSP does not apply to a non-executed `application/ld+json` data block (proved by the violation listener); Pagefind needs `'wasm-unsafe-eval'`.
- unverified: Vercel sends HSTS by default; vercel.json can override `Content-Type` for `.md` (both checked by the hosting task with curl right after the switch).
