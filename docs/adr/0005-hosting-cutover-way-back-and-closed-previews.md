# 0005. Stay on the existing Vercel project, use Instant Rollback to the new site's previous production deployment as the way back, and keep non-production builds out of search

Status: accepted
Date: 2026-11-19

## Context

FR-20 requires the same domain and the same hosting and a one-step way back to the previous publication; "the technical design verifies that the hosting offers this step". REVIEW R3-3 shows that "previous publication" is ambiguous on a host where the way back is "the last deployment". The user wants preview environments closed to search engines ("önizleme ortamlarının arama motorlarına kapalı olması") and deploys himself ("Deploy'u ben yapacağım"). Q-5 (c), (k) and the DNS, certificate and Search Console parts of (p) are open. The live site is on Vercel (REVIEW: live header).

The product owner decided the way back (2026-11-19, quoted verbatim):

> Geri dönüşü sadeleştir: eski siteye dönmeyeceğiz (eski site korunmuyor). Geri dönüş, yeni sitenin bir önceki production yayınına Vercel'in normal geri dönüşüyle yapılır. Ayrı prova projesi, 7 günlük bekletme ve Ignored Build Step ile main'i tutma kaldırılsın.

and the project (quoted verbatim):

> eski site vercel e bağlıydı ama artık önemi yok bunu bağlarız.

The plan is Hobby, for a personal, non-commercial open-source project (owner).

## Decision

1. Hosting: the existing Vercel project of proofline.technology, connected by the hosting task to this repository with production branch `main` (Git integration). `vercel.json`: `buildCommand: "npm run build"`, `outputDirectory: "dist"`, `trailingSlash: true`, the headers of ADR 0006, `git.deploymentEnabled: { "traffic-data": false }`; Node 24.x via `engines.node`. The orphan `traffic-data` branch (ADR 0007) also carries a minimal `vercel.json` with `git.deploymentEnabled: false`, because which branch's file Vercel reads is not stated; the hosting task pushes once to `traffic-data` and confirms that no deployment is created.
2. Way back (FR-20): Vercel Instant Rollback to the immediately previous production deployment of the new site, which Hobby allows. "Previous publication" (Q-5 k) = the production deployment of the new site that was live before the current one. The old site is not a way back: its last production deployment simply stays in the project and is the previous deployment only at the first push, and it is never used as a target. After a rollback Vercel turns off auto-assignment of production domains, so new pushes to `main` do not go live until the owner promotes a deployment; the launch checklist holds the promote step.
3. Rehearsal (Q-5 c, k; FR-32: right after the switch): once two production deployments of the new site exist (the owner may create the second with a redeploy of `main`), the owner rolls back to the older one on the real project, confirms it is served, then promotes the newer one and confirms that a following push to `main` goes live again (or turns auto-assignment back on). Steps, times and results go into the launch checklist (AC-30). Both deployments are the new site, so the rehearsal never serves the old site.
4. Retention: the hosting task sets and records a deployment retention for production deployments of at least 7 days, so the previous production deployment exists when needed.
5. Switch: connect the project to this repository when `main` is launch-ready; the first production deployment of `main` is the cutover. Same project means no DNS change and the existing certificates for apex and www stay (inferred). Right after the switch the launch checklist checks with curl: `robots.txt` (indexing allowed), http -> https and www -> apex permanent redirects (AC-29), the headers of ADR 0006, the `Content-Type` of a `.md` file, a 308 to the slash form, and an unknown path answering 404 with the bilingual page (V10 does not state the status).
6. Closed outside production, three layers: (1) Deployment Protection, Standard or stronger, set and recorded by the hosting task; (2) Vercel's automatic `X-Robots-Tag: noindex` on previews and outdated production deployments (no custom domain is ever assigned to a branch); (3) an own fail-closed switch: the build is indexable only when `VERCEL_ENV === 'production'` or `SITE_INDEXABLE=1` (CI tests only); otherwise every page has `<meta name="robots" content="noindex, nofollow">`, `robots.txt` is `Disallow: /` and no `sitemap.xml` is emitted; canonical tags always point to `https://proofline.technology`. The build logs `indexing: allowed (VERCEL_ENV=production)` or `indexing: blocked (<reason>)`, never a secret. A deployment that was rolled back from becomes an outdated production deployment, covered by layers 1 and 2.
7. Other items (Q-5 p): http -> https is automatic (308); the www -> apex permanent redirect is set explicitly under Domains by the hosting task. The owner holds the DNS zone; the launch checklist names the provider. TLS is Vercel-managed and renewed automatically. Search Console: a Domain property verified by a DNS TXT record before the switch (FR-23), covering http, https and www; Bing by DNS or by import from Search Console. Baselines: M-4 is zero by construction (the /docs/ prefix answers 404 today) and M-5 on the launch day describes the old site; the checklist records them as "none" and "old site" with the date, and FR-30 sets no target from them.

## Alternatives considered

- Cloudflare Pages: any earlier deployment can be made production again, free; but moving hosting and probably DNS breaks FR-20 "same hosting". Rejected.
- Netlify: deploy-level rollback and deploy previews comparable; same FR-20 objection. Rejected.
- GitHub Pages: no preview deployments, no response headers (no CSP, ADR 0006), no one-step rollback. Rejected.
- Way back to the old site with a hold on `main` and a rehearsal on a throwaway project (the first draft of this ADR): keeps the old site reachable for 7 days, but freezes production for a week and needs dashboard steps; the owner removed it because the old site is not preserved. Rejected by the owner.
- Vercel Pro: rollback to any previously aliased deployment; costs money (NFR-2, Non-goals "paid tools") and the one-step rollback of Hobby is enough for a way back to the previous new-site deployment. Rejected.

## Consequences

- The way back covers one step: a bad deployment followed by another production deployment cannot be undone further than the deployment just before the current one. Production deployments of `main` that carry no site change (for example a snapshot commit) would move that target, which is one reason for the `traffic-data` branch (ADR 0007).
- Between the switch and the second production deployment of the new site there is no new-site rollback target; the owner creates the second deployment and runs the rehearsal right after the switch.
- After a rollback nothing new goes live until the owner promotes; the checklist says so.
- PRD wording (owner accepted): FR-20, FR-32, AC-30 and AC-31 change as in PRD-CHANGES.md.

## Evidence

- verified (V1, V2): Hobby rolls back to the immediately previous production deployment; never-aliased deployments are not eligible; after a rollback auto-assignment of production domains is off; undo by promoting another deployment.
- verified (V3): `VERCEL_ENV` ("production, preview, or development") is available at build time.
- verified (V4, V5): automatic `noindex` header on previews and outdated production deployments, not on a branch custom domain; Standard Protection protects all but production domains.
- verified (V6, V7, V8, V9): retention defaults (Hobby: 30 days, last 3 ready production deployments kept); `git.deploymentEnabled`, `trailingSlash`, `headers`; https 308 and www redirect; Hobby terms (personal or non-commercial use: the owner states the project is personal and non-commercial).
- verified (owner, 2026-11-19): plan Hobby; the old site was deployed by this Vercel project; the project is connected to this repository.
- inferred: existing domain certificates stay when the same project is reconnected; promoting a deployment after a rollback restores automatic assignment for later pushes (checked in the rehearsal).
- unverified: `404.html` served with status 404 (V10); which branch's vercel.json governs `git.deploymentEnabled`; HSTS sent by default (ADR 0006). All three are checked by the hosting task or right after the switch.
