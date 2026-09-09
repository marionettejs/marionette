# Usability evaluation and comparative research

Use this plan to collect evidence for the [stable-v5 usability gate](../../ROADMAP.md#demonstrated-usability).
Stable means dependable contracts and demonstrated application usability. Comparative
research asks when a framework is more effective than another choice. These have
separate acceptance policies and reports.

This is a preparation procedure. No pilot, frozen policy, scored evaluation, or
stabilization result is established by this document. The existing
[prototype corpus](README.md) supplies fixtures and evaluator controls; it is not yet
a complete build/change/repair evaluation or a cross-framework runner.

## 1. Explore before setting acceptance

Choose realistic work from public application development and anonymous migration
reproductions. Include building a feature, extending an existing application,
repairing a seeded defect, and asking a fresh agent to maintain another agent's work.
Include successive changes that can expose loss of drafts or focus, async races,
regressions, and resource leaks. Map editing, navigation, collections, overlays,
async work, and cleanup to executable checks and document gaps.

Run a bounded exploratory pilot to learn task difficulty, failure modes, and useful
measurements. Preserve its results as pilot evidence. Use those findings to justify
the release evaluation's repetitions, task-level and aggregate acceptance criteria,
and human-assistance limits. Do not count pilot attempts in that evaluation or tune
acceptance to a previously observed candidate score.

Before any paid pilot or evaluation, declare and obtain authorization for its exact
model/runner profile, permissions, run count, spend ceiling, and elapsed-time budget.
Creating this plan or running local reference controls does not authorize paid runs.

## 2. Freeze a reviewable evaluation policy

Record the following in the evaluation's public evidence directory before attempts:

| Input | Required record |
| --- | --- |
| Objective | Release usability or comparative research; exact claim and exclusions |
| Tasks | Prompts, starter revisions, build/change/repair families, sequence and handoff rules |
| Acceptance | Frozen tests, helpers, fixtures, screenshots, discovery, review rubric, and passing criteria |
| Candidate | Source commit and exact package integrity; supporting docs and application revisions |
| Agent | Model version, runner version/settings, tools, permissions, documentation/network access |
| Resources | Repetitions, attempt limits, spend/time ceilings, retries, human-assistance rules |
| Analysis | Task-level reporting, aggregation, uncertainty, and handling of failures and infrastructure faults |
| Stabilization | Duration, required workflows, issue severity policy, and evidence refresh rules |

The policy must be executable and approved before collection. Until it is selected
and evaluated, the release usability gate remains open. There is no automatic
historical-version comparison or inherited numerical improvement threshold.
Changes to models, prompts, acceptance, candidate artifacts, or other frozen inputs
start a new series; preserve the prior results and explain the change.

## 3. Qualify and isolate the work

Run the original public application and frozen tests first. Record test inventory,
existing failures, exclusions, backend services, data fixtures, browser versions,
and environment. Keep source-framework UI dependencies and non-UI reuse explicit.
Do not call a workflow migration a whole-application replacement.

Withheld acceptance tests and reference solutions must be inaccessible to the agent.
Use enforced isolation, not merely a new directory. Give agents only the declared
public materials and feedback, then stop their processes before independent
acceptance. The existing local evaluator is not a security sandbox or a model runner.

Judge requested behavior and documented public contracts. Valid idiomatic solutions
need not match a reference solution's structure. A task specifically requiring a
Behavior or other named API is a contract exercise, not a neutral architecture test.
Do not require unsupported synchronous recovery; apply the documented
[synchronous failure boundary](../../docs/view.lifecycle.md#synchronous-failures).

## 4. Record every outcome

For each attempt retain the prompt, input hashes, submission, trace, commands,
acceptance results, elapsed time, available token/spend records, repair cycles, and
all human intervention. An assisted success is not an unassisted success. Timeouts
and abandoned work remain unsuccessful attempts; do not publish only best-of runs.
Record unavailable cost or timing data as unknown.

Report fully correct tasks, existing-behavior regressions, success on later changes,
accessibility and lifecycle failures, time, and spend. Cost per successful task
includes failed attempts; when no attempt succeeds, report that directly. Publish
per-task and per-configuration results before aggregates so easy tasks cannot hide
repeated failures. Avoid an unexplained composite framework score.

Classify failure causes with evidence: framework defect, documentation gap,
unsupported requirement, harness problem, or model error. Multiple causes may apply.
A cause label never converts failed behavior into a pass. Apply predeclared rules
for infrastructure reruns and retain both the original and rerun records.

## 5. Make the release decision

The maintainer reviews the frozen policy and complete results, including gaps and
interventions. Repeated framework or documentation failures need a fix and fresh
evaluation, or a support limitation justified in a new policy and series. Do not
silently remove a difficult requirement or reclassify a failed task after collection.

Complete the predeclared stabilization period and workflow coverage. Verify
integration fixes in affected applications and contract suites against the final
candidate. Identify earlier evidence retained only as history and remaining checks;
a new version label alone does not transfer a previous result. Publish the release
decision and limitations alongside the evidence. Package certification and explicit
publication authorization remain separate requirements.

## Independent ai-framework-benchmark

The proposed separate project starts with React, Vue, and Marionette. Its initial
question is how often a pinned agent system delivers complete behavior without
human rescue within a resource budget. Start with realistic documented stacks;
label any core-framework-only experiment separately. Define and date the model
selection rule rather than treating "mid-tier" as a permanent category.

Use equivalent behavioral specifications and shared independent acceptance checks,
while allowing idiomatic framework-specific starters and implementations. Pin
component libraries, tooling, documentation access, and environment. Report model,
runner, and framework effects separately where the experiment can distinguish them;
do not attribute a runner or ecosystem advantage solely to a core framework.

Allow additional frameworks through a documented contribution contract: a reproducible
starter, passing controls, declared dependencies, and the same acceptance criteria.
Framework maintainers can review idiomatic usage but cannot weaken shared tests.
Include failures, uncertainty, and predeclared sampling/analysis rules. Results may
favor different frameworks for different tasks. Neither a leaderboard win nor
completion of this independent project is required for stable v5.
