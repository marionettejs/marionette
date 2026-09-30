# Frozen source-search baseline

Step 1 of the [follow-up checklist](../../follow-up-checklist.md), measured before
consumer docs, ranking, metadata or runtime changes. Starting revision:
`b1a2b39e6bde6ce5605b0cfff00f9408652f4b39`.

The exact revision is recorded in [results.json](results.json); its provenance also
records hashes for every consumer page, navigation, questions, section extraction,
search and the measurement script. The runtime remains the starting revision.

## Selection and execution

An independent subagent selected [15 questions](questions.json) from public
navigation and contracts. It did not read the ranking implementation, retrieval
tests, planning evidence or previous question lists, and did not run searches before
selection. The parent preserved the wording, accepted section choices and required
facts; it normalized the JSON field names for the runner. Questions span readiness,
refresh, composition, existing HTML, Region reuse, UI/events, cleanup, row identity,
filtering, owned state, provider scope, imperative controls and the persistence boundary.

The runner validated that every named answer section resolves exactly once and
contains every required factual excerpt before calculating results. No cases were
removed or reworded after observing rankings. It invokes the existing canonical
source helper and extracts the existing consumer navigation; it does not export,
install or rebuild anything.

```sh
node planning/docs-v5/probes/lookup-screen.mjs \
  planning/docs-v5/evidence/lookup-baseline-20260930/questions.json \
  > /tmp/mnjs-lookup-candidate.json
```

For later comparisons, write a new result file. Preserve the original questions and
baseline. Compare the recorded page/search hashes as well as the counts; metadata
changes must not silently redefine the question set or acceptance sections.

## Results

| Measurement | Result |
| --- | --- |
| Recorded expected section first | 1 / 15 |
| First result contains all recorded factual excerpts for an accepted answer | 4 / 15 |
| Recorded expected section somewhere in five results | 4 / 15 |
| Some result in five contains all recorded factual excerpts | 13 / 15 |
| First result is the page heading, including descendants | 13 / 15 |
| No search results | 0 / 15 |
| Total characters returned across all questions and hits | 760,012 |

The important distinction is answer presence versus section precision. For example,
the restart and child-readiness questions return the complete Application reference
first. It contains the recorded facts, but each response starts with 20,052
characters rather than the focused contract. The source search is therefore often
finding relevant material while delivering excessive or poorly ordered context.

Two questions have no complete recorded evidence in the first five: surviving-source
listener cleanup and DataApi configuration across parent/child classes. Their expected
answers were validated in the corpus. This is a retrieval gap under these queries,
not a demonstrated documentation omission.

## Verification and interpretation

- A second run reproduced provenance, summary and every result exactly; only the
  measurement timestamp changed.
- Independent assertions checked result counts, expected ranks and returned-character
  totals. A deliberately nonexistent expected heading made the runner fail.
- `node --test test/agent-docs/retrieval.test.mjs test/agent-docs/discovery.test.mjs`:
  **9 passed**. Those existing shorter queries remain a separate authored regression
  set; their passing result does not invalidate this broader baseline.
- The selection subagent subsequently reviewed the frozen measurement. This later
  review independently checked hit identities, spans, factual flags, ranks, totals
  and provenance hashes, and found no calculation errors. It verified that all
  question wording and expected facts match its original selection. This later
  review does not make the exposed questions unseen again.

This is source-helper retrieval evidence. It is not installed-tooling, website,
peer-library, human comprehension or model application evidence. Literal excerpts
underestimate semantically equivalent answers: the existing-HTML guide answers its
question in different words, and the data package introduction explains the absence
of persistence without the selected setup-page wording. The page-heading measure
also includes useful short guides, so a whole-page result is not automatically bad.

Character totals include overlapping returned sections and are neither unique text
nor model tokens. Evaluate necessary context and correctness, not minimal size alone.
These questions are now visible to authors: use them for regression comparison, and
reserve independently authored unseen tasks for the later teaching trial. Do not add
question-specific wording or ranking rules to improve this screen.
