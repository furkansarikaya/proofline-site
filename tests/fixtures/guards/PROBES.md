# Probes: guard fixture

The tests copy this file and add one `result:` line to the PB-3 item. The two earlier items are already confirmed.

- PB-1 First probe of the fixture, already run.
  success: the steps finish in 5 minutes or less
  failure: the steps take more than 10 minutes
  locked: pb1-locked
  result: confirmed
  evidence: a note of the fixture, not a measurement
- PB-2 Second probe of the fixture, already run.
  success: every endpoint answers with data
  failure: any endpoint answers with an error
  locked: pb2-locked
  result: confirmed
- PB-3 Third probe of the fixture, not run yet.
  success: the steps finish in 5 minutes or less and no step outside the README is needed
  failure: the steps take more than 10 minutes, or a step outside the README is needed
  locked: pb3-locked
