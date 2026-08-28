# Agent-ready Marionette v5

Date: 2026-08-27
Status: Governing project strategy

## Decision

Marionette v5 will be released as stable only when the framework is demonstrably
good for AI-agent development and remains a clean, fast runtime.

Pre-releases may continue while that work is in progress. `5.0.0` is the public
promise that Marionette's contracts, documentation, diagnostics, types, and tooling
are coherent enough for agents and humans to make correct changes without hidden
application knowledge.

Agent readiness does not justify mandatory runtime machinery. The default production
path must stay small and predictable:

- Prefer static analysis, generated metadata, documentation, and test helpers.
- Compile or strip development checks from production builds.
- Put optional runtime capabilities behind explicit subpath imports and opt-in use.
- Add no per-instance state, subscription, observer, or allocation to applications
  that do not use an optional feature.
- Reject features whose measured runtime or bundle cost is not justified by measured
  agent-development value.

This file is the strategy authority. Detailed work and status belong in GitHub issues,
not parallel numbered roadmaps.

## Product thesis

Marionette is valuable when an application benefits from explicit ownership,
deterministic lifecycle, named composition boundaries, and small imperative views.
Those properties can also make a codebase unusually tractable for coding agents, but
only when the framework exposes and documents its actual contracts.

Marionette applies those properties at two composition levels. Views own rendered
UI and Regions own where Views are displayed. Features own independently active,
non-renderable application capabilities beneath the singular Application root.

The goal is not to turn Marionette into an autonomous coding product or compete with
renderer-centric frameworks. The goal is to make Marionette applications easy to
inspect, change, test, and verify with general-purpose development agents.

## Non-negotiable principles

### Public evidence only

Every release claim must be reproducible from this public repository. Benchmarks,
fixtures, prompts, expected results, and evaluators must not depend on a private
application, private repository, customer data, or undocumented maintainer context.

### One canonical pattern

For common tasks, documentation and APIs should lead to one preferred pattern. Avoid
aliases, transitional dual paths, or several equally blessed ways to express the same
ownership or lifecycle relationship. When a pattern is superseded, remove or clearly
deprecate it instead of teaching both indefinitely.

### Explicit contracts over inference

Important facts should be discoverable without reading private fields or reverse
engineering control flow. This includes lifecycle state, parent/child ownership,
region identity, Behavior ownership, event/request contracts, and teardown duties.

### Stable identifiers, flexible prose

Framework diagnostics and machine-readable rules need stable codes. Human-readable
messages may improve without becoming an API. A shared rule catalog should connect
runtime diagnostics, lint rules, documentation, tests, and benchmark evaluation.

### Performance is a feature

Bundle size, startup work, allocations, render time, and retained resources are
release concerns. Hosted timing measurements are informative because shared runners
are noisy. Deterministic size and API checks can be hard gates; timing and allocation
regressions become hard gates on a controlled runner with an established variance
budget.

## What agent-ready means

### Coherent runtime contracts

- Lifecycle methods and events have documented state machines and ordering.
- `MnObject` is the minimal non-renderable, evented, destroyable object; `Feature`
  adds an active lifecycle and owned composition; `Application` is the singular,
  non-nestable root Feature.
- Feature parent/child ownership, root View and Region association, asynchronous
  startup, restart invalidation, and teardown are explicit and testable.
- Ownership and topology are available through public, read-only APIs.
- Region lookup does not unexpectedly render or mutate application state.
- Regions own and mount Views. A Feature hosted in a Region coordinates a root View;
  the Feature itself never becomes a second Region-renderable object category.
- `MnObject`, View, CollectionView, Feature, and Application share one opt-in local
  state vocabulary. Unused instances allocate no state store or subscriptions.
- Behavior scope, UI resolution, event delegation, dependencies, and teardown are
  explicit and tested.
- Resource ownership has a canonical opt-in mechanism for timers, listeners,
  subscriptions, and disposable objects.
- Framework invariant failures use a common diagnostic type and stable rule code
  instead of incidental JavaScript exceptions.

### Precise static information

- Supported package entrypoints ship correct declarations.
- Public methods, options, events, and lifecycle hooks have useful types and JSDoc.
- Generated API metadata is checked for drift.
- Architecture lint rules identify high-value mistakes without executing an app.

### Executable guidance

- Documentation names canonical patterns and counterexamples.
- Examples are run in CI or otherwise verified against the shipped package.
- A compact agent-oriented reference describes lifecycle, ownership, regions,
  features, local state, behaviors, communication, and teardown without inventing a
  separate API.
- Migration documentation reflects final v5 behavior rather than preserving
  pre-release experiments.

### Optional development and test surfaces

- Development validation reports rule codes with actionable context and is removable
  from production builds.
- A topology inspector is read-only, explicitly enabled, and imported from a separate
  development subpath.
- Test helpers are runner-neutral, imported from a separate test subpath, and verify
  lifecycle, topology, and cleanup without private-field access.
- Machine-readable output includes a schema version. Only documented fields are
  stable; ordering and presentation-only fields are not accidental contracts.

### Measured agent outcomes

- A public task corpus covers representative maintenance work: implementing plain
  and stateful Views, composing Regions and Features, repairing lifecycle bugs,
  adding Behaviors, implementing an overlay through a shared host Region, using
  communication boundaries, and proving cleanup.
- The model version, agent harness, prompt, repository revision, commands, evaluator,
  and expected outcomes are pinned for each benchmark series.
- The stable-v5 benchmark uses at least 10 tasks. A Phase 0 pilot predeclares the
  paired-run count for each task; each count is at least 10 and provides at least 80
  percent power to detect an absolute regression of 15 percentage points. Release
  decisions use one-sided exact McNemar tests and control family-wise error at 0.05
  with the Holm correction. Sample-size planning uses the conservative Bonferroni
  level of 0.05 divided by the task count and the pilot's one-sided 95 percent upper
  confidence bound for discordant pairs under that regression alternative. The
  executable power calculation and inputs are published before candidate runs.
- The aggregate fully-correct rate has a 95 percent Wilson lower bound of at least
  80 percent, and no individual task has a fully-correct point estimate below 60
  percent. Aborted runs count as not fully correct.
- Relative to the Phase 0 baseline on the same pinned harness, the fully-correct point
  estimate does not regress and either improves by at least 20 percentage points or
  reaches at least 95 percent. Cataloged framework-architecture violations per 100
  attempted runs fall by at least 50 percent. Violations found before an aborted run
  still count.
- No individual task has a statistically significant paired regression after the
  predeclared multiple-comparison correction.
- A model or harness change starts a new benchmark series and requires rerunning both
  the Phase 0 revision and release candidate. Results are not compared across unlike
  series.

## Architecture boundaries

Core owns the essential MnObject, View, Region, Behavior, Feature, Application,
CollectionView, lifecycle, event, local-state, and error contracts. Additive APIs are
justified when they expose information the runtime already maintains or make an
existing responsibility explicit without adding work to unused instances.

`MnObject` remains the minimal non-renderable object whose lifetime ends at destroy.
`Feature` extends MnObject with start, stop, restart, and owned child Features.
`Application` extends Feature as the root of one composition tree and guarantees the
Feature contract. An Application cannot be added as a child of a Feature or another
Application. Root singularity applies per composition tree; independent Application
instances may coexist on a page.

A Feature may be hosted in a Region supplied by its owner and may coordinate one root
View in that Region. Hosting does not give the Feature an element or render method,
and the Region receives and manages the View rather than the Feature. Application
uses the same hosting contract for its root Region. Phase 1 must define assignment,
replacement, stop, restart, external Region emptying, and destroy semantics without
creating dual View ownership. Region remains the only object that mounts or tears
down a hosted View: Feature stop may ask its host Region to empty only when that
Region still contains the Feature's root View, and Feature never destroys the View
directly. External replacement clears the Feature's stale View reference but does not
implicitly stop an otherwise independently active Feature.

Owned child Features follow their owner's start, stop, restart, and destroy lifecycle
without per-child lifecycle flags. A capability that must outlive its current owner
belongs to a longer-lived Feature or Application and is passed to the shorter-lived
Feature explicitly.

The local-state contract is built in but pay for play. It provides one compact,
event-notifying vocabulary across eligible state owners; Phase 1 selects the concrete
method names after testing the current Toolkit vocabulary against representative
plain and stateful objects. It creates no store, listener, cleanup registration, or
instance property until state is declared, supplied, or first mutated. Local state
is owned by the object and distinct from an external domain model or data source.
View and CollectionView state persists across render; Feature and Application state
persists across stop and restart; MnObject state persists for the object's lifetime;
all local state ends at destroy. An invalidated asynchronous start cannot later
mutate state or owned children. Region does not become a state owner, and Behavior
state should normally live on its owning View.

Appropriate core additions include public read-only ownership accessors, pure Region
lookup, shared diagnostics, extension hooks with no registered listeners by default,
and narrowly designed resource ownership.

Core does not absorb a statechart runtime, signals runtime, virtual DOM, query layer,
schema system, router, agent protocol, or inspector UI. Optional integrations with
those systems may adapt to the local-state or data-source contracts without becoming
the canonical implementation.

The existing Marionette Toolkit informs migration but does not define a second v5
object model. Toolkit App responsibilities move into the Feature contract after
redesign rather than by copying the implementation. Toolkit Component does not move
into core: an inline Component becomes a stateful View, an overlay Component becomes
a View coordinated by an explicit host, and a durable multi-View Component becomes a
Feature. Static class-level Region injection and patches that allow Regions to show
non-Views are not canonical v5 patterns. V5 does not ship a Toolkit compatibility
adapter as part of this public release plan.

For stable v5, an overlay host is a documented reference-application pattern around a
real Region, not a shipped class, new core renderable, or Region replacement. The
pattern accepts a View plus placement context such as an anchor, delegates display
and replacement to the Region, and owns overlay policy such as positioning,
exclusivity, and cleanup. The public reference application must prove the pattern
using only public Marionette contracts. Core does not absorb tooltip, popover,
positioning policy, or an OverlayHost class without separate public evidence.

`marionette/dev` may provide validation and inspection. It must be separately
importable, tree-shakeable, safe to omit, and incapable of changing production
semantics. Enabling it may add development-only cost; merely installing Marionette
must not.

`marionette/test` may provide runner-neutral assertions and observation helpers. It
must use public contracts and must not be loaded by production entrypoints.

Lint rules, codemods, documentation generators, and benchmark tooling belong outside
the runtime graph. They should consume the same documented rule catalog and public
metadata rather than encode a second model of Marionette.

Declarative definition helpers, generalized data-source adapters, new CollectionView
strategies, and renderer integrations remain evidence-dependent. They may be explored
after the foundation is measurable, but do not block stable v5 without benchmark
evidence.

## Runtime cost contract

Phase 0 records an authoritative baseline after already-approved dependency work.
The stable release then requires:

- Development, test, lint, benchmark, and rule-catalog modules are absent from the
  production module graph.
- Optional features add no instance property, collection, subscription, or registry
  until used.
- Cumulative production Brotli-11 growth is no more than five percent over the adopted
  Phase 0 baseline. CI compares every production subpath with the pull request base;
  growth above one percent requires explicit issue approval and benchmark evidence in
  addition to the cumulative absolute ceiling.
- A new production subpath has no base-relative percentage: it requires the same
  explicit approval and evidence, and its full Brotli-11 size counts against the
  cumulative Phase 0 ceiling. Its first merged size becomes its comparison base for
  later pull requests without resetting the Phase 0 baseline.
- On a pinned release runner, there is no confirmed median regression above five
  percent and no confirmed p95 regression above ten percent for View
  construction/destruction, render/rerender, delegation, Region show/empty, and
  ordinary CollectionView work.
- A timing regression is confirmed only after an independent repeat in the same
  environment. Hosted CI warns at ten percent but does not fail on timing alone.
- Resource tests run at least 100 attach/detach cycles and prove zero registrations
  while detached and at most one while attached. At least 1,000 mount/destroy cycles
  leave no framework-owned references in deterministic ownership containers.
- Allocation tests prove that unused instances have no feature-owned property,
  collection, subscription, or registry entry; opt-in resource storage begins only at
  the first registration.
- State allocation tests prove that plain MnObject, View, CollectionView, Feature, and
  Application instances create no state store, state subscription, cleanup
  registration, or state-owned property. Feature child storage is also absent until
  the first child is owned.

Agent-tooling-only changes should produce byte-identical production entrypoints except
for version and source-map metadata. Core contract improvements may add bytes or work
when explicitly called, within the budgets above. Exceptional-path diagnostic detail
is allowed. Resource ownership may allocate only after the first registration.

## Work phases

The phases describe dependency order, not separate releases. Work may overlap only
when it does not bypass an earlier gate.

### Phase 0: Governance and evidence

- Replace conflicting plans with this strategy and one live issue hierarchy.
- Restore clean contributor installation by removing unused development dependencies.
- Guarantee that tested source, built bundles, packed tarballs, and published artifacts
  represent the same code.
- Repair the repository front door, contribution workflow, migration links, and
  canonical examples.
- Pin the supported release-runner, Node, package-manager, browser, and documentation
  publication profile.
- Establish bundle, startup, allocation, render, and retention baselines.
- Publish a neutral reference application and agent task corpus.
- Pin the initial benchmark harness and record its baseline.
- Define the rule-catalog format, severity model, and ownership.

Gate: a clean contributor can reproduce performance and agent baselines from public
instructions, and every release blocker maps to this strategy.

### Phase 1: Core contracts

- Specify lifecycle state machines and add transition-table or model-based tests.
- Introduce Feature as the nested non-renderable lifecycle and ownership scope while
  keeping Application the singular, non-nestable root Feature and MnObject the
  minimal base. Specify deterministic asynchronous startup, stale-start invalidation,
  restart, root View and Region hosting, canonical child ownership, and teardown.
- Separately define and implement one lazy local-state contract for MnObject, View,
  CollectionView, Feature, and Application without changing Region's renderable
  contract or conflating local state with model and collection data.
- Make ownership and topology publicly readable without mutation.
- Harden Region lookup and View/Region ownership semantics.
- Specify Behavior scope, dependencies, delegation, and teardown.
- Introduce the shared diagnostic type, code catalog, and error semantics.
- Specify the requirements and cost boundaries for later opt-in extension hooks and
  resource ownership without implementing either runtime path in this phase.

Gate: core invariants are documented, testable through public APIs, and add no
measurable work to unrelated instances beyond approved budgets.

### Phase 2: Static guidance

- Complete declarations, JSDoc, and generated API metadata.
- Build high-value architecture lint rules using the shared rule catalog.
- Make examples executable and document canonical View-versus-Feature, local-state,
  child-ownership, and overlay-host patterns and counterexamples.
- Publish the compact agent-oriented reference.

Gate: types, docs, examples, lint rules, and runtime vocabulary agree, and drift checks
run in CI without loading new production code.

### Phase 3: Development and test support

- Add removable development validation.
- Add the optional topology inspector with a versioned output schema.
- Add runner-neutral lifecycle, topology, and cleanup test helpers.
- Implement only the extension hooks required by these public development/test
  consumers, with no listener or allocation cost when unused.
- Separate and verify production, development, and test package surfaces.

Gate: production bundles prove optional surfaces are absent unless imported;
development and test fixtures exercise every public helper.

### Phase 4: Integration and benchmark closure

- Add pay-for-play resource ownership and extension integrations justified by the
  earlier evidence.
- Run the fixed agent corpus against the complete release candidate.
- Validate plain and stateful Views, nested Features, asynchronous Feature restart,
  Feature resource cleanup, and shared-host overlays in the reference application.
- Close correctness, documentation, packaging, browser, and performance gaps exposed
  by the reference application.
- Complete v5 reference and migration documentation.

Gate: all stable release criteria below pass.

### Phase 5: Evidence-dependent candidates

Benchmark declarative definition helpers, generalized data-source and rendering
seams, alternative CollectionView strategies, and optional integrations. These
experiments do not block stable v5. Unsuccessful candidates are documented and closed
rather than retained as dormant APIs.

## Stable v5 release criteria

`5.0.0` may be published only when:

- All Phase 0-4 gates pass on the release commit.
- The public agent benchmark meets its functional, task-floor, improvement,
  architecture-violation, and non-regression thresholds.
- Production entrypoints contain no development inspector, validation, benchmark, or
  test-helper code unless an application explicitly imports an allowed opt-in runtime
  feature.
- Bundle and controlled-runner performance budgets pass; shared-runner timings show
  no unexplained regression.
- Supported entrypoints, declarations, the Chromium/Firefox/WebKit versions and host
  runtimes pinned in the Phase 0 release profile, examples, install fixtures, and 100
  percent line and branch coverage pass CI.
- Coverage configuration explicitly includes every production, development, and test
  subpath; adding a subpath cannot silently leave its implementation outside the gate.
- Stable diagnostic codes and documented machine-readable schemas have been reviewed
  as public contracts.
- No release criterion depends on a private consumer or unpublished fixture.
- Known migration and behavior differences are documented, and no obsolete v5
  pre-release path is presented as canonical.
- No unapproved build, lint, type, or test warning remains.

Pre-releases may expose experimental APIs. Before stable, they may be changed or
removed based on evidence. After stable, public APIs, diagnostic codes, and documented
schema fields follow semantic versioning. Deprecations require a removal plan;
compatibility aliases or dual paths require a verified active consumer or a
non-atomic persisted-data migration and must name their removal condition.

## Decision rules for new proposals

Every proposal must answer:

1. Which observed agent failure or framework contract does it address?
2. Can the benefit be demonstrated on the public benchmark or reference app?
3. Is the solution static, development-only, test-only, or runtime?
4. What bundle, startup, allocation, render, and retention cost does it add?
5. Can the same outcome be achieved by exposing an existing fact instead of adding a
   new abstraction?
6. What becomes the one canonical pattern, and what obsolete pattern is removed?
7. Which rule code, documentation, test, and evaluator prove the contract?
8. What is the rollback or deprecation path if the evidence is negative?

If these questions cannot be answered, the proposal remains a candidate and does not
block stable v5.
