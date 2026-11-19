# Probes: proofline site

<!-- The thresholds were proposed by the agent with the basis below and set by the product owner, who delegated the wording of PB-1 ("eşikleri buna göre kilitle"). A threshold is locked before the probe runs and is never edited; a new probe replaces a wrong one. -->

- PB-1 The product owner follows the README install steps from an empty folder on their own machine, with Claude Code and Codex already installed, up to a `proofline doctor` run, and times it with a stopwatch, tests AS-2. The basis of the success threshold is the README's own promise (C-93); the basis of the failure threshold is twice that time.
  success: the steps finish in 5 minutes or less, no step outside the README is needed and doctor ends with no failing line
  failure: the steps take more than 10 minutes, or a step outside the README is needed, or doctor ends with a failing line the README does not explain
  locked: 2026-11-19T17:57:27.959Z sha256:6524d305dfc121a569d1352b4080d1665ef8b9710b9f69d779e75e28e50d76df
  result: confirmed
  evidence: reported by the product owner after the lock, not timed by the agent: the init and doctor part took 5 seconds from an empty folder, no step outside the README was needed, nothing stuck and doctor ended with no failing line. Limit: the proofline plugin and the command line tool were already installed on that machine, so the first-time installation of the plugin and the tool is not part of this measurement; the result confirms the thresholds only for the init and doctor part.
- PB-2 The traffic endpoints of the repository (views, clones and referrers) are read with the GitHub command line, read-only, by the agent, tests AS-12. The basis: a site can only be measured through GitHub traffic if the referrers are readable.
  success: the views, clones and referrers endpoints all answer with data and the referrers list holds at least one entry
  failure: any of the three endpoints answers with an error
  locked: 2026-11-19T17:57:27.997Z sha256:72582a3a26cdd7fc3eccad66d3aaaa9b74c75978f4b04efb1ff84b314e8f2236
  result: confirmed
  evidence: run on 2026-11-19 after the lock; the views, clones and referrers endpoints all answered with data and the referrers list held two entries (see C-95, C-96 and C-97 in ASSUMPTIONS.md)
- PB-3 The product owner installs the proofline plugin and the command line tool for the first time, by the README steps, in a clean user account where neither is installed, up to a `proofline doctor` run, and times it with a stopwatch, tests AS-2 and AS-7. It runs before the launch of the site. The basis of the success threshold is the README's own promise (C-93); the basis of the failure threshold is twice that time. PB-1 covered only the init and doctor part.
  success: the steps finish in 5 minutes or less and no step outside the README is needed
  failure: the steps take more than 10 minutes, or a step outside the README is needed
  locked: 2026-11-19T18:09:33.732Z sha256:5f8b35fb02aa3eeaac31eafc7b471bd69ff614b3f15420f78aeaf4a8ee7c2ba3
