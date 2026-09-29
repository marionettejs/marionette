# Stage 1 review and assessment

Three subagents inspected Application contracts, View/state contracts, and drafted the evaluation rubric. The parent reconciled findings, wrote the brief, and ran source checks. Existing v5 documentation was not consulted.

## Claude review

The review-with-claude skill received the completed brief, rubric, source evidence, and actual check results. It received no private application code or existing framework docs. The initial review identified unspecified integration/startup/request defaults and ambiguity between functional success and architecture-policy grading.

After revision and additional checks, Claude's final verdict was: **Ready to proceed to the runnable slice. No blockers.**

Changes prompted by review:

- Chose an explicit visible-shell/required-child startup sequence and verified its cancellation behavior.
- Specified a current refresh controller, result/error acceptance checks, inactive refresh handling, and obsolete-root cleanup.
- Made startup-failure cleanup explicit.
- Separated outcome/API checks from policy scores; justified alternative ownership designs can pass.
- Specified selection retention and clearing behavior for the first task.

We retained architecture adherence as an explicit measured outcome. Comparing an adequate API reference against that reference plus architectural guidance intentionally tests whether the guide teaches those policies. That does not establish that every alternative architecture is defective.

## Correction after review

The reviewed version selected Backbone. The user subsequently chose `@mnjs/data`, which is now the guide and slice default. Historical adapter test results are not evidence for this choice. Claude’s verdict applies to the reviewed version; the later integration selection has not had another Claude review.

Full review transcripts remain in the original temporary workspace. This repository retains the actionable review summary and measured evidence without duplicating the entire review input.

## Evidence boundary clarified after review

Framework tests and source probes are contract evidence only. Their setup code is not a model application, and passing them is not architectural approval. The proposed consumer design needs its own review before becoming the teaching reference. This clarification does not invalidate the measured API behavior.

## Strengths

- API behavior is supported by source inspection, 542 passing tests across 20 suites, and two source-level probes. Those checks do not establish good application architecture.
- The short introductory guide is separate from contracts, evidence, and evaluator instructions.
- Functional behavior and architectural adherence are graded separately.
- A concrete startup/request policy gives the runnable slice a starting point without new helper infrastructure.

## Weaknesses

- No independent agent has used the guide to build a consumer feature; effectiveness is unproven.
- The selected `@mnjs/data` path still needs integration-specific retention and consumer checks.
- Architecture grading remains partly manual and requires evidence-based treatment of alternatives.
- The request policy, installed-package discovery, and deliberate-defect harness remain unimplemented.
- The probes now persist in the repository but are not wired into an automated test command. Re-run them after relevant source/version changes and integrate relevant cases with the consumer slice.

## Next step

Pin the consumer scaffold with `@mnjs/data`, then build the first runnable slice and verify that deliberately broken variants fail. Freeze tasks and budgets before an effectiveness campaign.
