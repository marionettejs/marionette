# Documentation reading trial

This is a bounded editorial check, not an agent-performance benchmark or a release
gate result. The September 2026 trial used an independent agent with no preceding
implementation discussion. It started at `docs/agents.md` and `docs/readme.md`,
followed their links, answered three tasks, then inspected source to check the
answers. It did not execute an application.

## Tasks and expected decisions

| Task | Required decisions |
| --- | --- |
| Existing Backbone models and router; a detail request completes after another navigation | Retain the router and models; configure DataApi on the appropriate View classes; choose StateApi separately; cancel and suppress stale completion; let the Region own replacement; verify slow/fast success and failure, teardown, and browser history. |
| New application needs an observable list and local selection | Start with the native data package for collection observation; plain local selection is sufficient unless subscription is needed; supply a child View; retain default DOM/rendering; do not introduce a router or isolated runtime without a requirement. |
| Adopt prerendered Region content and later replace it | Wrap the existing populated element in a View, then establish Region ownership with show; resolve existing elements from actual DOM; replace through the Region and verify destruction and mount preservation. |

The agent reached these decisions and checked them against the source. Its reading
paths included the integration decision guide, routing, Application, StateApi,
provider package readmes, prerendered DOM, Region, and lifecycle references.

## Defects the trial exposed

- The Region replacement example omitted its required markup and put a dot inside
  `className`. Its prose also attributed replacement to the wrong operation.
- Backbone setup examples selected StateApi even for a data-only task.
- The native data package's first example introduced runtime isolation and state
  setup before establishing a need for either.

These findings led to corrections in the canonical pages and a follow-up executable
check for the Region example. They demonstrate why navigation, defaults, and
copyable setup must be reviewed together.

## Repeat after material changes

Give a reader the task and the two entry pages, without the expected decisions.
Record the links they follow and where they guess. Check their answer against
source and run the relevant executable example or application interaction. Correct
the earliest page that led to a wrong choice, then repeat that task.

Use additional tasks for immutable collection replacement, shared-state disposal,
renderer selection, migration, and diagnostics as those guides change. Record
exact package/source and test commands with each run. Do not derive comparative
accuracy, token savings, or reliability percentages from this three-task pilot.
The [agent benchmark contract](../../benchmarks/agent/README.md) governs broader
paired evaluations and remains a separate body of work.

## Context7 public-index check

On September 8, 2026, the public `/marionettejs/marionette` index completed with
1,300 snippets. This indexed the existing public branch, before these local docs
and `context7.json` changes were published; it did not validate the proposed scope.

The topic query `routing Backbone router DataApi StateApi` returned migration and
installation snippets that configured both APIs, and a routing snippet that
implied those adapters were required by Backbone.Router. That recommendation is
incorrect for a router-only task. The canonical routing, installation, provider,
and upgrade examples now distinguish each adapter's capability. The proposed
Context7 exclusions also keep before/after migration material out of general
retrieval; those pages remain available directly for explicit upgrade tasks.

Public registration is complete. Ownership verification, configured indexing, and
a repeat retrieval check remain publication steps: the proof and configuration
must first be available on the public default branch. Do not describe this initial
index as curated or make it the required agent entry. After publication, repeat
this query and the three tasks above, inspect the source links and setup, and
reject results that select StateApi or DataApi solely because a router is present.
No paid plan, shared API credential, or website dependency was introduced.

## Independent implementation trials

A subsequent trial gave three fresh agents installed packages, the portable skill,
and a task each: latest navigation, editable list updates, and widget lifetime.
All three submitted implementations passed the withheld acceptance checks after
completion. The [saved implementations and reports](https://github.com/marionettejs/marionette/blob/master/benchmarks/docs/results/2026-09-08/README.md)
include the exact documentation digest and the limitations of this local snapshot.
The [trial procedure](https://github.com/marionettejs/marionette/blob/master/benchmarks/docs/README.md)
withholds acceptance files until an attempt ends and does not configure paid inference.

The widget reader found misleading Region reuse prose, which was corrected.
These trials add implementation evidence to the earlier reading check; they remain
separate from the scored release benchmark and the deferred complete application.
