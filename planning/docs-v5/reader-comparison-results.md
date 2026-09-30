# Original versus rebuilt documentation: reader pilot

2026-09-30. One matched pair completed successfully under both documentation
conditions. The third attempt reached the tool cap; terminating the client left
its final cost aggregate unavailable, so the frozen stop rule preserved three
unstarted cells. **This pilot establishes no improvement over original docs.**

## Qualified measurement

The [frozen protocol](reader-comparison-protocol.md) compares three reserved tasks
under original upstream v5 documentation and rebuilt documentation. Its preparation
status paragraphs describe the prelaunch snapshot; this report owns current status.
Both conditions use identical rc.2 runtime/declarations, dependencies, lookup
tools and attempt limits. Each task has one prompt and one submission phase.

[Qualification evidence](evidence/reader-qualification-20260930.json) records:

- Three positive and three deliberate negative controls on the isolated verifier.
- Three independently implemented valid alternatives on the same route.
- All 29 required behavior checks passing positive and alternative controls;
  every negative triggers its intended failure.
- Five private acceptance clauses unsupported by the brief kept as diagnostics,
  excluded from required functional status.
- 35 runner checks and 16 independent final audit checks passing.
- Six frozen workspaces, 82 bound inputs and 1,911 identical common dependency
  files; all 151 reserved input files unchanged.

Execution freeze: `d6eb0201fe9f3fe4dbf2d3bcf8d210140fcaf6a5852a2c96326177d844e8444f`.
All three attempted cells report `claude-sonnet-5`. Limits were 35 admitted tool
requests, 1,500 seconds and $1.50 CLI-estimated allowance per attempt.

## All six planned cells

| Task | Docs | Attempt | Required behavior | API / ownership review | Tool requests | Seconds | CLI estimate |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| 1 | Original | Completed | 9 passed | API pass; applicable policies established | 25 | 195.82 | $0.6046782 |
| 1 | Rebuilt | Completed | 9 passed | API pass; applicable policies established | 25 | 238.98 | $0.5802440 |
| 2 | Rebuilt | Partial; tool limit | 1 passed, 1 failed, 11 unverified | API error; synchronization concern; provisional | 35 | 350.95 | Unknown |
| 2 | Original | Unstarted | Unverified | Unverified | — | — | — |
| 3 | Original | Unstarted | Unverified | Unverified | — | — | — |
| 3 | Rebuilt | Unstarted | Unverified | Unverified | — | — | — |

There were no operator retries, replacements, coaching or reader repairs. All
three submitted sources and all unstarted cells remain preserved. Package hashes
matched after each attempt, cleanup succeeded and all containers were removed.
All 53 consumer documentation/tooling files checked before and after are unchanged.

The two completed submissions each satisfy five applicable ownership policies;
composition is not exercised by that task. The partial source has five established
policies and one synchronization concern, without a policy violation. Its API error
and blocked runtime checks remain separate from those source assessments. No
unnecessary scaffolding or evidence-tampering indicator was found.

The non-author assessor reviewed opaque source snapshots before condition labels
and retrieval were joined. The assessor had reviewed private qualification controls;
source wording and archive metadata may provide condition clues. This was a
condition-masked review, not a fully blind assessment. Its source/report integrity
validation passed 36 checks.

## What the evidence supports

**Documentation was actually used.** Each completed cell has eight measured consumer
file reads. Original docs had seven observable helper commands; rebuilt docs had
four. Both used 25 total admitted requests. Rebuilt took about 43 seconds longer
while its CLI estimate was about two cents lower. Those mixed, single-pair differences
support no efficiency or quality advantage. Shell/helper counts are syntactic
observations; arbitrary subprocess reads are not exhaustively traced.

**The partial failure has a specific implementation cause.** Its candidate template
accesses `this.model` although the default renderer calls the template without a
View receiver. Captured smoke output and the sealed verifier both show failure;
the relevant template contract had been read before implementation. No dependency
closure or submission-interface failure is supported. Source review also identified
two state/data-to-render gaps whose runtime cases were blocked; they are not extra
executed failures.

The partial attempt spent 21 requests on documentation discovery/substantive reads
and began implementation at request 29. This is a useful investigation lead about
reading cost and task planning. It is unpaired, so it cannot establish an effect of
rebuilt documentation. It does not justify another warning or helper tailored to
this task.

**The accounting stop worked as frozen but prevented further comparison.** All 35
admitted requests completed. Request 36 was rejected and the monitor terminated
the client. That prevented a final CLI result/cost aggregate. Known completed
estimates total $1.1849222; the third attempt and total cost remain unknown. Its
ledger's zero accumulator is not zero spend. Partial token snapshots are not a
replacement for final accounting or provider billing.

## Next bounded change

A separate [worker proposal and local prototype](/Users/paulfalgout/.local/share/marionette-docs-evaluation/20260930/qualification/runner-followup/proposal.md)
passed 20 stub checks. It retains the 35-request admission cap, rejects later tools,
and lets the client finalize within the existing time/CLI-estimate limits. The
checks cover repeated rejections without extra execution, final accounting,
unknown timeout accounting, model mismatch and cumulative allowances. Real clients
may still fail to finalize; that remains a stop condition.

Use a new execution freeze and separately authorized pilot to test this change.
Preserve this stopped run as its own evidence. Keep the consumer corpus unchanged
until a completed comparison or broader reader evidence supports a documentation
change.

## Strengths and weaknesses

**Strengths:** independently checked controls accept alternative designs; runtime
and tooling are matched; real documentation reads are observable; behavior/API/
ownership are separate; partial and unstarted evidence survives the stop.

**Weaknesses:** only one matched task pair completed; original and rebuilt both pass;
task authors had some revised API exposure; current runtime JSDoc/declarations are
shared context; client/account state persists; condition masking is imperfect;
the verifier shares a JavaScript process with submission code; final accounting
can be lost on termination. These support a descriptive pilot, rather than a
framework-wide effectiveness or best-in-class claim.

Two protocol status paragraphs were edited during execution. They changed no task
brief, scoring criterion, prompt, runner code or corpus. The altered version and
interval are recorded, and the exact frozen protocol bytes were restored. All 82
bound inputs match at final verification, but the planning file was not continuously
unchanged during the run. Future live status belongs outside frozen inputs.

## Evidence

[Joined pilot record](evidence/reader-pilot-20260930.json) retains all six statuses,
assessment, retrieval identities, cleanup, package integrity, usage and metadata
drift. [Batch status](/Users/paulfalgout/.local/share/marionette-docs-evaluation/20260930/qualification/runner/results/batch.json),
[assessment](/Users/paulfalgout/.local/share/marionette-docs-evaluation/20260930/qualification/assessment/assessment-summary.json)
and [forensics](/Users/paulfalgout/.local/share/marionette-docs-evaluation/20260930/qualification/forensics/author-safe-findings.json)
point to durable private artifacts. Initial dependency setup error output was
partly overwritten during development; final control and reader evidence is
retained. No registry publication or deployment claim is made by this pilot.
