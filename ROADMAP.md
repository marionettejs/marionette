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
UI and Regions own where Views are displayed. Applications own independently active,
non-renderable capabilities. An Application without a parent is the root of one
composition tree; a child Application is a nested application scope.

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
- `MnObject` is an optional minimal non-renderable, evented, destroyable convenience;
  `Application` provides an active lifecycle and owned composition. Parentlessness
  identifies the root Application without creating another class.
- Application parent/child ownership, root View and Region association, asynchronous
  startup, restart invalidation, and teardown are explicit and testable.
- Ownership and topology are available through public, read-only APIs.
- Region lookup does not unexpectedly render or mutate application state.
- Regions own and mount Views. An Application hosted in a Region coordinates a root
  View; the Application itself never becomes a second Region-renderable object
  category.
- State is a first-class, opt-in object composed into MnObject, View, CollectionView,
  Behavior, or Application. Owners without State allocate no state store or
  subscriptions.
- Behavior scope, UI resolution, event delegation, dependencies, and teardown are
  explicit and tested.
- Resource ownership has a canonical opt-in mechanism for timers, listeners,
  subscriptions, cleanup callbacks, and owned resources.
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
  Applications, State, behaviors, communication, and teardown without inventing a
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
  and stateful Views, choosing among plain classes, MnObject, and Application,
  composing Regions and Applications, repairing lifecycle bugs, adding Behaviors,
  implementing an overlay through a shared host Region, using communication
  boundaries, and proving cleanup.
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
- Every named capability area is exercised by at least two independently scored
  tasks. One task may cover multiple areas, but no single task certifies an area.
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

Core owns the essential View, Region, Behavior, Application, CollectionView, State,
lifecycle, event, and error contracts and preserves MnObject as an optional
convenience. Additive APIs are justified when they expose information the runtime
already maintains or make an existing responsibility explicit without adding work to
unused instances.

`MnObject` remains an optional minimal convenience for passive, non-renderable,
evented objects whose lifetime ends at destroy. It has no start, stop, restart, child
ownership, or Region contract and does not imply that an external container manages
it. Plain classes and functions remain canonical when those combined Marionette
conventions are unnecessary. V5 does not rename MnObject or introduce a replacement
class merely to restate this generic contract.

`Application` is an independent first-class object with start, stop, restart, and
owned child Applications. An Application without a parent is the root of one
composition tree; independent roots may coexist on a page. Root status is topology,
not a reason for an Application subtype.

Application, MnObject, View, CollectionView, State, Region, and Behavior do not form a
public inheritance hierarchy. They compose first-class collaborators and may satisfy
small shared protocols or reuse internal implementation without exposing inheritance
as the application architecture.

An Application may coordinate one root View through a Region it constructs and owns
or a borrowed host Region it receives from its owner. The Application shows that View
through the Region; the Application instance is never passed to `Region.show` and
never gains an element or render method. Root and nested Applications use this same
contract. Region remains the only object that mounts or tears down the root View.
Region ownership is explicit: an Application destroys a Region it owns, but never
destroys a borrowed host Region.

Application stop has one-way teardown responsibility. It first stops owned child
Applications, then asks the host Region to empty only when that Region still contains
its root View, then releases running resources and completes its stop lifecycle. It
never destroys the View directly. Calling `Region.empty` first destroys the View and
clears the Application's stale View reference but does not implicitly stop the
Application. A later stop is idempotent and cannot empty an unrelated replacement
View. Restart follows the same stop contract before starting and showing a new root
View.

Phase 1 must define `start`'s return value, readiness signal, and failure propagation,
including how overlapping start, stop, and restart calls settle. An invalidated start
must settle deterministically without exposing stale success or leaving callers
pending, and migration tests must cover the existing synchronous return contract.

Owned child Applications follow their owner's start, stop, restart, and destroy
lifecycle without per-child lifecycle flags. A capability that must outlive its
current owner belongs to a longer-lived Application and is passed to the shorter-lived
Application explicitly.

`State` is a first-class, event-notifying object composed into an eligible owner rather
than methods mixed into several unrelated classes. Phase 1 selects its concrete API
after testing the current Toolkit vocabulary against representative plain and
stateful objects. No State instance, listener, cleanup registration, or owner
property exists until state is declared, supplied, or first requested. State composed
into View or CollectionView persists across render; State composed into Application
persists across stop and restart; State composed into MnObject persists for the
object's lifetime; State composed into Behavior persists across its owning View's
render and ends when the Behavior is destroyed. Every owned State ends at owner
destroy. An invalidated asynchronous start cannot later mutate State or owned
children. Region does not own State. A Behavior may compose private State when its
concern truly owns that state; state shared with its View belongs on the View and is
passed to the Behavior.

Appropriate core additions include public read-only ownership accessors, pure Region
lookup, shared diagnostics, extension hooks with no registered listeners by default,
and narrowly designed resource ownership.

Core does not absorb a statechart runtime, signals runtime, virtual DOM, query layer,
schema system, router, agent protocol, or inspector UI. Optional integrations with
those systems may adapt to the State or data-source contracts without becoming
the canonical implementation.

The existing Marionette Toolkit informs migration but does not define a second v5
object model. Toolkit App responsibilities strengthen the Application contract after
redesign rather than being copied or renamed to Feature. Toolkit Component does not
move into core. A Component with one rendered ownership boundary becomes a View and
composes State only when it owns local mutable state. A floating surface anchored to
one View but displayed in a shared Region becomes a View coordinated by the documented
overlay-host pattern. A coordinator with an independent active lifecycle or multiple
Views and Regions becomes an Application. Static class-level Region injection and
patches that allow Regions to show non-Views are not canonical v5 patterns. V5 does
not ship a Toolkit compatibility adapter as part of this public release plan.

Root-only concerns such as DOM readiness, global error handling, routing, or service
bootstrap are collaborators composed at the root, not conditional branches or a root
subclass inside Application. Root and nested Applications retain the same public API.

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
- State allocation tests prove that plain MnObject, View, CollectionView, Behavior,
  and Application instances create no State, state subscription, cleanup
  registration, or state-owned property. Application child storage is also absent
  until the first child is owned.

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
- Strengthen Application as the single non-renderable lifecycle and ownership scope,
  with parentlessness identifying the root and child Applications representing nested
  scopes. Specify deterministic asynchronous startup, stale-start invalidation,
  restart, root View and Region hosting, canonical child ownership, and teardown
  without adding a Feature alias or inheritance hierarchy.
- Separately define and implement State as a lazy first-class object composed into
  MnObject, View, CollectionView, Behavior, or Application without changing Region's
  renderable contract or conflating State with model and collection data.
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
- Make examples executable and document canonical View-versus-Application,
  State-versus-domain-data, child-ownership, and overlay-host patterns and
  counterexamples.
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
- Validate plain Views, Views composed with State, nested Applications, asynchronous
  Application restart, Application resource cleanup, and shared-host overlays in the
  reference application.
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
