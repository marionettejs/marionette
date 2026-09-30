# Section ranking comparison

Checklist step 4, 2026-09-30. This changes the offline helper in the canonical and
plugin skills. Consumer prose and the frozen questions were not edited during this
step. It does not change website or hosted MCP search.

## Change

Score each heading's own text rather than lending it every descendant's words.
Section reads retain their original nested spans. Use BM25 term scoring with fixed
`k1 = 1.2`, `b = 0.75`, a heading boost of 2 and ancestor boost of 0.25. Rarer words
carry more weight; repetition saturates and section length is normalized. The
[Lucene reference](https://lucene.apache.org/core/9_12_1/core/org/apache/lucene/search/similarities/BM25Similarity.html)
documents the BM25 defaults and IDF formula; the heading and ancestor boosts are
our additions, not Lucene defaults.

Identifiers are indexed intact and as camel-case components. Queries use the
corpus's component vocabulary so casing and page order cannot change expansion.
Unknown identifiers remain unmatched instead of guessing API names. Ordinary
language words can still match independently. Inline Markdown link destinations
are excluded from body scoring; this is not a complete Markdown/HTML parser.

No query-specific rules, preferred page lists, runtime dependencies or model calls
were added. The constants were chosen by the author and are fixed across queries.
The cases were visible during implementation, so these are exposed regressions.

## Matched comparison

[Before](before.json) and [after](after.json) have identical page hashes, navigation
hash and frozen question hash. The before run uses the current corpus after symbol
guidance changes; the original [frozen baseline](../lookup-baseline-20260930/README.md)
is preserved separately. A repeat execution reproduced the final result apart from
its timestamp. The result files retain source, algorithm and measurement hashes.

| Measurement on the same 15 questions | Before | After |
| --- | --- | --- |
| Recorded expected section first | 1 | 9 |
| Recorded expected section in five results | 4 | 13 |
| First result contains all recorded factual excerpts | 4 | 9 |
| Some result in five contains all recorded factual excerpts | 13 | 14 |
| First result is a page heading | 13 | 1 |
| Characters returned across five hits per query | 760,012 | 171,594 |

Returned text decreased 77.4%. It counts overlapping result spans, not unique text,
tokens, latency or cost. The strongest evidence here is improved section precision
and less returned context. Literal evidence can occur inside a parent span and can
miss equivalent prose, so it is not an answer-correctness score.

### Remaining questions and regressions

| Question | Expected section rank | Interpretation |
| --- | --- | --- |
| reader-04: adopt existing HTML and destroy it | 2 | First result is the short existing-HTML guide, which explains the behavior with different wording. |
| reader-05: move a live View between Regions | Absent from five | A broader Region result still contains the recorded evidence. The focused answer is missed. |
| reader-07: link triggers prevent navigation | 5 | First result is a navigation check rather than the prevention-flags contract. |
| reader-11: filter and retain rows | 2 | List-composition guidance comes before the specific filtering contract. |
| reader-12: dispose created versus supplied state | 2 | State creation comes before the explicit disposal contract. |
| reader-13: configure parent and child DataApi | Absent from five | The expected provider section is still missed. |

The [nine existing authored queries](existing-queries.json) all retain their expected
section within five results, but three rank worse: `bindUIElements` 1→2,
`initialize options` 2→5 and `observeCollection` 2→4. `getUI`, `delegateEvents`
and editable-row sorting improve; three others are unchanged. We did not retune
weights or rewrite questions to erase these tradeoffs.

## Verification and review

Generic tests cover parent/descendant isolation, full nested section reads, rare
terms versus repeated common terms, inline link paths, duplicate query terms,
empty inputs, casing, compound collisions, shuffled multi-section input, unknown
API names and noise from identifier components. The existing plugin test verifies
byte-for-byte helper parity.

Claude received the scoring diff, generic tests, same-corpus summaries and known
regressions. Its first review found no scoring blocker, but raised ordering,
weak-test and evidence-label concerns. We merged compound components deterministically,
sorted a copy of the section input, strengthened rarity and ancestor tests and
added identifier-noise coverage. We retained case-consistent rejection of unknown
compound names rather than the proposed fallback. A follow-up review approved with
minor corrections, asked for current installed verification and clearer changed-file
scope, and reiterated that exposed questions do not establish generalization.

Reviews: [initial](</Users/paulfalgout/.ai-reviews/20260930T081758Z-review-with-claude.md>)
and [follow-up](</Users/paulfalgout/.ai-reviews/20260930T082349Z-review-with-claude.md>).
The plugin copy is part of this change and is tested for parity. The final section-order
fix and extra noise test were added after the follow-up review and tested locally;
the reviewer did not inspect those final bytes.

Final validation:

- **37 focused tests passed:** CLI lookup, retrieval, discovery and plugin parity.
- Affected JavaScript lint and diff whitespace checks passed.
- Final replay, identical before/after corpus and question hashes, and all nine
  saved authored-query ranks were verified against the current code/test output.
- Fresh package staging and installed-tarball checks passed on the final helper
  bytes, including `getUI` first-result/section retrieval, symbol lookup and the
  existing consumer recipes: 46 executable fences, 20 type fixtures and 15
  TypeScript examples.
- The [installed report](installed-report.json) records tarball hashes and content
  digest `da08ee8b9ff3f932fa0b998490b0a17f0ddbe706fda31f922ac49830457630d8`.
  Its `sourceDirty: true` identifies local working changes at
  `b1a2b39e6bde6ce5605b0cfff00f9408652f4b39`. We verified its content digest and
  packaged helper hash against the final source. No runtime source changed, so
  package staging and installed verification were used without a full runtime rebuild.

## Limits and next work

This supports keeping the ranking change for these regressions. It does not prove
better outcomes for unseen readers, human understanding, application architecture,
website search or MCP. Identifier components can admit irrelevant partial matches;
an unknown camel-case query differs from spelling its parts as separate words.
Those are lexical recall/precision limits, not reasons to invent undocumented APIs.

Next is the bounded Application reference detail, then the two workflow explanations.
Fresh-reader validation remains a later, independently frozen same-runtime trial.
