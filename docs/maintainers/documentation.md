# Documentation strategy and editorial rules

Documentation should help an agent make a correct change and help a human
understand and review it. Precision, explicit choices, and working examples serve
both readers. Agent-led development is the priority; it does not require a second
API or a separate set of facts.

## Own each fact once

The library repository owns public behavior, reference pages, task guides,
examples, diagnostics, migration guidance, and the consumer agent entry. Review
those changes with the code they describe. Keep v4-to-v5 migration guidance focused on adopting the current contract.
For older versions, the documentation index links briefly to the
`backbone.marionette` repository; do not reintroduce historical starter or
pre-v5 upgrade sections.

The website repository owns visual design, navigation, browser search, and
interactive presentation. It consumes the documentation artifact from an exact
library revision. Render HTML and provide clean Markdown from that same source.
Do not maintain a second handwritten Region reference, copied API table, or agent
prompt that can silently diverge from the library.

Website introductions may explain why someone would choose Marionette, show an
interactive example, or give a human reader more context. Those pages must link
to the canonical contract and identify the example's tested runtime. A playground
using an older pinned bundle must not imply it demonstrates newer source behavior.

Maintainer instructions live in [the maintainer guide](./readme.md) and
[CONTRIBUTING.md](../../CONTRIBUTING.md). Root `AGENTS.md` is a short bootstrap;
agent-specific entry files point to it. Consumer instructions live in
[Build with Marionette](../agents.md). Do not ship maintainer release procedures
as if they were instructions for building an application.

## Start each page with the decision it helps make

A task guide follows this order when the task needs each part:

1. State the task and the conditions where this pattern applies.
2. Name the recommended approach and its resource owner.
3. Show a complete example with imports and explicit setup.
4. Explain the result the reader should observe.
5. Cover relevant failure, cancellation, and teardown behavior.
6. Link to the precise reference and any conditional alternatives.

A short task does not need six headings. Keep important setup beside the example
so a retrieved excerpt still makes sense. Label intentionally incomplete fragments;
do not present undefined application helpers as a runnable starter.

An API reference identifies the owner, signature, arguments, result, lifecycle
conditions, side effects, relevant diagnostics, and linked executable evidence.
State whether a method returns synchronously or a Promise, whether it mutates or
renders, and what happens during destruction when that distinction matters.
Document real differences instead of making unlike methods appear uniform.

A migration page names the old behavior, the replacement, and how to verify the
change. Keep obsolete APIs inside that explicit migration context. A plan, issue,
or future release gate must not look like an available capability.

## Make choices deterministic without hiding alternatives

Use this decision order throughout the docs:

1. Preserve the application's established integration when it meets the task.
2. For new code, start with built-in behavior if it supplies the required capability.
3. Select a supported integration when the application needs its semantics.
4. Write a custom adapter only for a requirement those choices do not meet.

Name the condition that changes the recommendation. Avoid an unranked catalog of
libraries or a vague instruction to choose whatever fits. Record tested package
versions and source assumptions in examples. Choosing a DataApi does not choose a
StateApi, renderer, DomApi, EventDelegator, or router; link to
[Choosing integrations](../choosing-integrations.md) for their separate contracts.

A router belongs to the application stack. Explain the seam between URL handling,
application navigation, and Marionette lifecycle in [routing](../routing.md).
Do not imply a router is part of Marionette merely because an example uses one.

## Use a consistent voice

Write as a competent colleague explaining what the code does. Lead with concrete
verbs and use the framework's public names consistently. Prefer a short example
and its reason over abstract claims about flexibility or developer experience.

Use ordinary language around exact contracts. A human should be able to read the
page without decoding agent jargon. A little dry humor belongs in introductions;
keep signatures, warnings, diagnostics, and lifecycle rules literal. Avoid hype,
claims of measured agent gains without evidence, and repeated slogans in reference
pages.

Make code useful for retrieval: explicit imports, no hidden setup, stable headings,
small examples focused on one decision, and links to the next required contract.
Put version and provenance in generated metadata rather than repeating the same
release label in every paragraph.

## Preserve provenance across formats

Every published documentation artifact identifies its package version and complete
source revision. During prerelease work, the version alone is insufficient: two
builds labeled with the same alpha version can expose different behavior.

Publish the consumer guide, per-page Markdown, versioned indexes, and HTML from the
same input. Use `llms.txt` as a concise discovery index, not a promise that every
agent reads it. Keep the authoritative facts in the linked pages. A combined text
bundle may help offline tools, but must carry the same provenance and clear page
boundaries.

Local edits must not masquerade as an immutable commit artifact. Build metadata
must identify a dirty or local preview, or require a clean revision for a release
artifact. Record example runtime provenance separately if it differs from the docs.
Keep past release artifacts immutable and update the current pointer deliberately.

The current export, validation, and publication commands belong in
[the documentation build guide](../../docs-site/README.md). Website build changes
and a locally reviewed artifact do not themselves authorize deployment.

## Keep distribution usable at zero service cost

The operating constraint is zero additional service spending, including when
traffic grows. Prefer static HTML, Markdown, downloaded artifacts, and browser-side
search. Rebuild on source or release changes, not on each reader request. Select
hosting with an appropriate free static-asset policy and verify its current terms
before enabling publication; free tiers still have operational limits.

Context7 is an optional distribution and retrieval channel for the public
repository. Configure its source scope so current documentation is not mixed with
historical guides, maintainer policy, or benchmark proposals. Users connect through
their own accounts and quotas. Never place a maintainer's shared API credential in
the public website or proxy reader requests through it. Follow the free plan's
limits; do not enable paid overages or an automatic upgrade. Verify current terms
at [Context7 plans](https://context7.com/plans) before changing the setup.

A Context7 search outage or quota limit must leave the canonical static documents
readable. Treat its result as a retrieved excerpt whose version still needs
checking. Adding the public repository to an index is distinct from claiming its
ownership or publishing a new source revision.

Do not require a hosted AI chat, paid search backend, or server-side generation
to read documentation. The optional documentation MCP must serve the same verified
corpus within the authorized free hosting limits. Keep static and installed docs
available independently; a service outage must not prevent application work.

## Give tools a specific job

Static docs explain the contract. Executable fixtures establish the behavior they
assert. The documentation MCP provides structured retrieval over that same corpus. It must not become a requirement for using the library.

The website's WebMCP tools operate its live examples and playground. Keep that
boundary explicit: inspecting an example is not inspecting the reader's app, and a
browser tool is not a remote docs server. Expose only the example's supported
operations; keep them optional and outside the library's production import graph.

## Review in two passes

First verify correctness against source, package exports, and the example's actual
behavior. A matching executable marker only connects a snippet to a fixture; run
the fixture to establish its assertions. Check links, anchors, version selection,
and generated Markdown as well as the rendered page.

External live examples, including older JSFiddle links, are illustrative until
their package and source provenance are verified. Their presence is not current
version evidence. Prefer repository-owned fixtures for canonical patterns.

Then review the reading path. Can a reader identify the relevant version, choose an
approach, find required setup, understand ownership, and verify the result without
private knowledge? Test a few representative retrieval and implementation tasks
using the published formats, record failures, and fix the pages those failures
expose. Use the [agent benchmark](../../benchmarks/agent/README.md) for broader
performance claims; a small editorial trial is not a scored release result.
