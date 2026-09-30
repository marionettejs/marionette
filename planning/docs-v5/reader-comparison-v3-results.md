# Repeated reader comparison — 2026-10-01

**All eight attempts finished; both documentation conditions pass all 80 required behavior checks. Efficiency is task-dependent, with no overall improvement established.**

Seven attempts completed normally. One rebuilt-docs build attempt reached the 35-request admission limit, received two rejected requests, retained complete accounting and passed required behavior, but omitted the requested written explanation. No retries, repairs, replacements or additional judge-model calls occurred.

## Descriptive results

Means below contain two attempts each. They describe this sample and are not statistical estimates of general performance.

| Task | Docs | Tools | Seconds | CLI estimate |
| --- | --- | ---: | ---: | ---: |
| build | original | 21.0 | 309.67 | $0.7778 |
| build | revised | 30.5 | 405.81 | $1.0987 |
| maintenance repair | original | 22.5 | 137.12 | $0.4577 |
| maintenance repair | revised | 13.0 | 89.66 | $0.3762 |

Rebuilt docs were faster and cheaper for both maintenance repetitions. Build time and cost changed direction between repetitions; rebuilt docs used more admitted tools in both. The slower limited attempt raises the rebuilt build means. No claim is made that documentation caused those differences.

Total CLI estimate: **$5.4206382** against the authorized $12 allowance. This is not verified provider billing. Total reader elapsed time was **1884.52 seconds**, excluding evaluation preparation and assessment.

## Individual attempts

| Task | Repeat | Docs | Status | Required checks | Tools | Seconds | CLI estimate |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: |
| build | 1 | original | completed | 13 passed | 21 | 270.79 | $0.6793970 |
| build | 1 | revised | limited | 13 passed | 35 | 513.02 | $1.4023572 |
| maintenance repair | 1 | revised | completed | 7 passed | 10 | 90.35 | $0.3455610 |
| maintenance repair | 1 | original | completed | 7 passed | 22 | 117.68 | $0.4005724 |
| build | 2 | revised | completed | 13 passed | 26 | 298.60 | $0.7949982 |
| build | 2 | original | completed | 13 passed | 21 | 348.55 | $0.8761654 |
| maintenance repair | 2 | original | completed | 7 passed | 23 | 156.56 | $0.5147292 |
| maintenance repair | 2 | revised | completed | 7 passed | 16 | 88.97 | $0.4068578 |

## Source review and delivery

All eight submissions use supported production APIs in the reviewed surface. Seven meet the declared ownership policies; one rebuilt build has a moderate-confidence concern about coupling complete feature readiness to presentation construction. Its lifetime guards and required behavior work; this is not a blanket ban on asynchronous View work or a required-behavior failure.

One upstream build adds a redundant lifecycle cleanup bridge. One upstream maintenance explanation overstates the exclusivity of its lifecycle choice, and its smoke double does not independently check one listener boundary that the separate frozen verifier does verify. One rebuilt build omits the requested explanation. These findings remain separate from functional success; private criteria and solution code are not reproduced here.

The operator was also the source assessor. Assessments were made from opaque source/behavior packages and sealed before retrieval/time/cost were joined. Prior criteria and results were known, and code/explanations can reveal the condition. This is not a fully blind or separately staffed review.

## Retrieval and reading

Three readers used the actual installed helper. There was one helper error: an upstream reader omitted the docs/ source prefix for page lookup; its shell pipeline masked the failure with exit zero. The repaired lookup modes were available in both conditions, so this cohort does not measure their isolated effect.

| Task / repeat / docs | Direct measured reads | Direct file content characters | Shell-returned characters | Helper calls |
| --- | ---: | ---: | ---: | ---: |
| build / 1 / original | 5 | 77,889 | 33,031 | 0 |
| build / 1 / revised | 12 | 138,082 | 47,183 | 4 |
| maintenance repair / 1 / revised | 1 | 9,605 | 53,842 | 0 |
| maintenance repair / 1 / original | 3 | 50,800 | 20,808 | 7 |
| build / 2 / revised | 0 | 0 | 122,565 | 0 |
| build / 2 / original | 8 | 144,255 | 14,092 | 1 |
| maintenance repair / 2 / original | 2 | 39,067 | 59,697 | 0 |
| maintenance repair / 2 / revised | 1 | 9,605 | 55,823 | 0 |

Direct measured file-content characters and shell-returned characters are separate. Shell output includes documentation, discovery, implementation and tests; zero direct reads does not mean no documentation use. Characters are not tokens or necessary reading.

## Conditions and limits

Frozen pre-reset upstream v5 documentation at 74534f719e9ae6bf00fb6061e9f8cb712e92e2ef versus validated rebuilt candidate, identical rc.2 runtime/declarations/dependencies and common updated retrieval tooling. Not released rc.1 and not an isolated helper-effect test.

The rebuilt candidate retained content digest `c22a3bdbc9e7f8ed6903fa69c1120303fce08ef536ec6c2f94b4236a96a4a1d0`. Both corpora retained their prose/navigation/teaching bytes while receiving the same current helper/parser/ranker and regenerated indexes. Each attempt started with the actual installed docs entrypoint and optional helper location, without injected skill text, forced metadata dumps or compulsory reading.

Coverage is supplied-dependency feature construction plus existing integration repair. There is no genuine extension phase, registry acquisition, hosted MCP, client skill activation or production-delivery measurement. The two reserved tasks had been used previously; only the readers and starting workspaces were fresh. Model/provider variability, tool ceilings, common embedded runtime text and a small task set limit causal and framework-wide claims. Prior cohorts are not pooled.

## Verification and disposition

The adapted existing launcher passed 58 safeguard checks; six existing positive/negative/alternative controls and two condition-isolation audits passed. All 2,218 current frozen input hashes, 82 and 1,994 prior-cohort bound hashes, eight initial/final package vectors and sealed assessments verified. All 62 manifest-backed source files remained unchanged. Cleanup completed, with no cohort containers remaining.

**Retain the narrow corrections and pause broad corpus changes.** This run supports the maintenance path in this sample and identifies bounded implementation/delivery weaknesses. It does not establish consistent lower build cost, justify benchmark-specific documentation changes or warrant another automatic evaluation.

Full author-safe figures: [reader-pilot-v3-20261001.json](evidence/reader-pilot-v3-20261001.json). Integrity receipt: [integrity receipt](/Users/paulfalgout/.local/share/marionette-docs-evaluation/20261001/reader-v3/final-integrity.json). Private raw evidence and sealed source assessments remain outside this repository.
