# Original versus rebuilt documentation: second cohort

2026-09-30 UTC / 2026-10-01 Korea. All four authorized attempts finished,
forming two matched task pairs. Both documentation conditions pass all required
behavior checks. **This pilot does not establish an improvement over original docs.**

## Scope and qualification

This is a new cohort, `docs-v5-four-v2-e59bb100178f`, with execution freeze
`11ca0777a0cd1956824c22cec66dff38367b694997874557c5db87b3828d3216`.
It preserves the exact prompts and starting workspaces from the four remaining
cells of the [first cohort](reader-comparison-results.md). The documentation,
tasks, rubric, runtime, model and allowances remain unchanged.

The bounded runner change rejects requests after 35 admitted tools while allowing
the client to emit final accounting within the existing 1,500-second and $1.50
CLI-estimate allowances. Complete in-bound limited submissions can be graded and
the batch can continue. Missing accounting, overrun, model mismatch, timeout,
package mutation or failed cleanup still stops the batch. No additional submission
phase or allowance is granted.

The change passed 55 integration checks. Twenty earlier prototype checks are bound
as prior evidence. An independent audit passed 2,146 input/vector checks and 25
raw-control checks. Unaffected task controls and documentation delivery suites
were not rerun; their frozen qualification evidence remains linked by the run.

## All four outcomes

| Task | Docs | Attempt | Required behavior | Admitted / rejected tools | Seconds | CLI estimate |
| --- | --- | --- | --- | ---: | ---: | ---: |
| 2 | Rebuilt | Limited; final accounting retained | 13 passed | 35 / 3 | 518.90 | $1.2726032 |
| 2 | Original | Limited; final accounting retained | 13 passed | 35 / 1 | 372.93 | $1.0120974 |
| 3 | Original | Completed | 7 passed | 20 / 0 | 136.86 | $0.3407644 |
| 3 | Rebuilt | Completed | 7 passed | 26 / 0 | 146.35 | $0.4086796 |

All four report `claude-sonnet-5`. Their final CLI estimates total $3.0341446,
within the new $6 allowance. These are client estimates; provider billing is not
verified. The prior cohort's missing cost remains unknown and separate.

There were no operator retries, replacement attempts, candidate repairs, coaching
or additional model judges. All four submissions and raw run artifacts are retained.
All 1,994 bound input hashes match at final verification, and all 53 checked
consumer documentation/tooling files remain unchanged.

The independent post-run audit passed 150 execution integrity checks. All final
package/document vectors match, candidate processes were stopped and containers
were independently confirmed absent. All 116 admitted requests completed;
four rejected requests executed no extra tools. The 82 original bound inputs
also match at final verification; the earlier documented metadata-drift interval
remains part of that cohort's history.

## Source review and retrieval

All four source assessments were sealed before condition labels and retrieval were
joined. Production API use passes in all four submissions. Both task-2 submissions
establish all six applicable ownership criteria. Both task-3 submissions establish
the four applicable criteria; data/request policies are not exercised. No unnecessary
scaffolding or source-integrity findings were identified. Assessment integrity
validation passed 77 checks, including frozen contract/rubric/control hashes and
preservation of the earlier sealed assessments.

Delivery remains separate. The rebuilt task-2 submission omits the requested written
ownership explanation. The original task-2 submission includes an explanation with
factual descriptions that differ from its code and Region ownership. Neither issue
is silently converted into an application behavior or ownership failure. Private
specification diagnostics remain descriptive and add no new required penalties.

| Task | Docs | Observable helper commands | Direct measured consumer file reads |
| --- | --- | ---: | ---: |
| 2 | Rebuilt | 3 | 9 |
| 2 | Original | 8 | 5 |
| 3 | Original | 9 | 0 |
| 3 | Rebuilt | 4 | 6 |

Documentation was used in every attempt. Zero direct file reads in the original
task-3 attempt does not mean zero documentation use: it invoked the common lookup
helper, including five page operations. Counts are syntactic observations rather
than measures of comprehension. Arbitrary subprocess reads are not exhaustively
traced. Fewer helper commands under rebuilt docs did not produce fewer total tool
requests or faster completion in this cohort.

## What the comparison can tell us

The accounting change worked with the real client: both tool-limited attempts
retained final aggregates, and the next cells ran. Excess requests were rejected.

The behavior results are tied. Original documentation has lower observed time and
CLI estimates on both new tasks, and fewer requests on task 3. One attempt per
condition supports a descriptive result, not a reliable efficiency ranking.

The first cohort's successful task-1 pair remains a separate result under its
original guard. Its partial task-2 submission remains preserved; this new cohort
does not replace it or turn the combined history into one uniform six-attempt run.

## Strengths, weaknesses and next work

**Strengths:** matched runtime/tool access and exact starting inputs; controls that
accept valid alternative implementations; observable documentation use; separate
behavior, API, ownership and delivery assessments; complete accounting after tool
rejection; preserved source, partial history and integrity evidence.

**Weaknesses:** one attempt per condition per task, one model and a small task set;
task authors had some revised API exposure; current runtime JSDoc/declarations are
shared context; signed-in client/account state persists; condition masking is
imperfect; the verifier shares a JavaScript process with submissions. Time and cost
also include model planning and execution variability. These limits prevent a causal,
framework-wide or best-in-class effectiveness claim.

Confidence is high that this bounded comparison ran as specified and that both
corpora supported the measured outcomes. Improved reader effectiveness remains
unestablished. The earlier partial template failure is not reproduced here, but
remains real preserved evidence; one successful fresh pair does not erase it or
establish its frequency.

Keep the consumer corpus unchanged. This sample does not justify task-specific
warnings, extra helpers or an architecture rewrite. Return to the remaining product
acceptance gates: real consumer migration and exact-artifact website/publication
and deployment validation. A broader effectiveness claim would need independent
tasks and repeated readers, separately authorized, rather than another automatic
round of edits and retesting these exposed tasks.

## Evidence

The [joined second-cohort record](evidence/reader-pilot-v2-20260930.json) includes
all four outcomes, assessments, usage, retrieval identities, input integrity,
cleanup and artifact hashes. The
[execution audit](/Users/paulfalgout/.local/share/marionette-docs-evaluation/20260930/qualification/audit-v2/execution-audit-v2.json)
records post-run integrity checks and output hashes.
The [private batch status](/Users/paulfalgout/.local/share/marionette-docs-evaluation/20260930/qualification/runner-v2/results/batch.json)
records all four terminal attempts. No registry publication or deployment claim is
made by this pilot.
