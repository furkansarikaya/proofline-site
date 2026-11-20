# Launch checklist

This is the ordered list of owner steps from the finished site to the switch of https://proofline.technology, and the steps right after it. Do the steps in order. Each step names the task that performs it, the place where its result is written, and one observable condition that says it is done. This file holds no result: results go to the place named on the `Record:` line.

## Launch steps

### Step 1: README heading change and single Version line upstream

Change the README heading and make the Version line appear once, in the proofline repository, so that the site and the README tell the same thing.

Task: none, an owner action in the proofline repository
Record: the merged pull request in the proofline repository; nothing is written under ops/
Done when: the README of the proofline repository on its default branch shows the changed heading and exactly one Version line.

### Step 2: Manual pin update when needed

The pin is in `sync/pin.json` and the lock in `sync/lock.json`. When the owner wants a different pin than the launch pin, the owner runs the lock command of `scripts/sync.mjs` (`npm run sync:lock`, with the new commit and tag) and merges the change in a normal pull request that `ci / verify` checks.

The launch pin is the tag v0.0.173 (commit b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd). When the owner keeps it, no update is needed and this step is done without a change.

A pin change after step 5 repeats step 5.

Task: TASK-043
Record: ops/SETTINGS.md, row Launch pin at the switch (written at step 7)
Done when: `sync/pin.json` on `main` holds the pin the owner wants to launch with and `ci / verify` is green on it.

### Step 3: PB-3

Run PB-3 of docs/product/site/PROBES.md: the owner installs the proofline plugin and the command line tool by the README steps in a clean user account, up to a `proofline doctor` run, and times it with a stopwatch.

Task: TASK-044
Record: docs/product/site/PROBES.md, the PB-3 result line
Done when: the PB-3 result line in docs/product/site/PROBES.md holds a result (confirmed, failed or inconclusive).

### Step 4: First-screen check

Read the first screen of the home page in English and in Turkish, as a new visitor would, and check it against the claim the site makes.

Task: TASK-045
Record: docs/product/site/PROBES.md, the first-screen check result
Done when: the first-screen check result is written for both languages.

### Step 5: Repository link search

Run `npm run check:launch` to search the built site for links to the proofline repository and for any address that is not the final one. A hit is corrected in the proofline repository and the search is repeated until it finds 0 hits other than the domain root.

Task: TASK-041
Record: the output of the last run, in the pull request that closes the step; nothing is written under ops/
Done when: the last run of `npm run check:launch` found 0 hits other than the domain root.

### Step 6: DNS record and ownership check in both consoles

Add the DNS TXT record for ownership before the switch. Ownership is verified by the DNS TXT record before the switch. Then check the status by hand in both consoles (Google Search Console and Bing Webmaster Tools). Write the status in `ops/SETTINGS.md`: the row Search Console Domain property status and the row Bing Webmaster Tools method and status. Write only the status and the method, never a verification token.

Task: TASK-046
Record: ops/SETTINGS.md, rows DNS provider and TXT record, Search Console Domain property status, Bing Webmaster Tools method and status
Done when: both rows hold a status and the owner has seen that status by hand in both consoles.

### Step 7: The switch

Owner actions in the Vercel dashboard, in this order:

1. Connect the existing Vercel project to the repository with production branch `main`.
2. Set Deployment Protection (Standard or stronger).
3. Set production deployment retention of at least 7 days.
4. Set the permanent www to apex redirect.
5. Record each setting with its date in `ops/SETTINGS.md`.
6. Run `npm run check:launch` right after the first production deployment (robots.txt, the redirects, the response headers, the not-found status).

Task: TASK-047
Record: ops/SETTINGS.md, rows Launch pin at the switch, Vercel project connected with production branch main, Deployment Protection level, Production deployment retention, www to apex redirect, Vercel plan, Preview deployment closed to visitors without a login
Done when: the last run of `npm run check:launch` after the first production deployment passes and every row named above holds a value and a date.

### Step 8: Rehearsal of the way back

Do this on the live site, once, before announcing anything:

1. Create the second production deployment (a redeploy of `main` when nothing changed).
2. Roll back with Instant Rollback to the previous production deployment of the new site.
3. Confirm it is served at https://proofline.technology.
4. Promote the newer deployment.
5. Confirm a later push to `main` goes live.

After a rollback new pushes to `main` do not go live until the owner promotes a deployment.

Promote step: in the hosting dashboard, open the Deployments list of the project, pick the deployment to serve and use Promote.

Read the retention value (at least 7 days) from the retention row of `ops/SETTINGS.md` and check that the deployment to return to is still inside it. Write what happened in the section Rehearsal record below.

Task: TASK-048
Record: ops/LAUNCH.md, section Rehearsal record
Done when: the three fields of the section Rehearsal record are filled and the last push to `main` of the rehearsal is live.

### Step 9: Ownership check in both consoles when the meta-tag fallback is used

Skip this step when the DNS record of step 6 was used. When the meta-tag fallback was used because DNS was not possible, check the status in both consoles right after the switch, by hand, and write it in `ops/SETTINGS.md`: the row Search Console Domain property status and the row Bing Webmaster Tools method and status. Write the variable names only, never a value.

Task: TASK-049
Record: ops/SETTINGS.md, rows Search Console Domain property status, Bing Webmaster Tools method and status, Verification variables set in the Vercel project when DNS is not possible
Done when: both consoles show the property as verified, or this step is marked as skipped because DNS was used.

### Step 10: Check that the old sitemap addresses answer not found

Run `npm run check:launch`. It reads `ops/old-sitemap.txt` and requests each old address in its https form on the apex host. Each one must answer status 404 with the one bilingual not-found page. No old address is redirected.

Task: TASK-049
Record: ops/LAUNCH.md, section Launch record
Done when: all 94 addresses of `ops/old-sitemap.txt` answered status 404 with the bilingual not-found page.

### Step 11: Submission of the sitemap in both consoles

Submit the sitemap of the new site in Google Search Console and in Bing Webmaster Tools, and look at each console to see that it accepted the file.

Task: TASK-049
Record: ops/LAUNCH.md, section Launch record
Done when: both consoles show the sitemap as accepted.

### Step 12: Listing of the skills catalogue in a skills directory and in awesome-claude-code

Submit the skills catalogue of proofline to one skills directory and to awesome-claude-code, each by that list's own way of submitting.

Task: TASK-049
Record: ops/LAUNCH.md, section Launch record
Done when: both submissions are made and each has an address of the submission or of the listing.

## Rehearsal record

Written at step 8 by TASK-048.

- steps:
- time:
- result:

## After the launch (post-launch)

None of these is a launch step.

- TASK-032 builds the Lighthouse CI budget for the site; it is not a launch step.
- TASK-035 adds the sync workflow that keeps the pinned content current; it is not a launch step.
- TASK-036 observes the first sync pull request and sets the repository settings of ops/SETTINGS.md rows marked post-launch; it is not a launch step.

TASK-050 is the evaluation of the launch; it starts eight weeks after the launch-day steps are completed.

## Launch record

launch-day steps completed (UTC date):
