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
- Application parent/child ownership, root View and Region association, startup and
  restart semantics, and teardown are explicit and testable.
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
- The model version, agent harness, permissions, commands, evaluator, expected
  outcomes, repository revisions, and task classification are pinned for each
  benchmark series.
- Every task is assigned to one of two strata before its pilot or scored runs. A
  paired-comparable task uses byte-identical prompts, visible workspaces, hidden
  acceptance tests, commands, and evaluator rules for the Phase 0 revision and release
  candidate; only the installed Marionette revision differs, and the objective is
  achievable through public APIs in both revisions. A candidate-only task is allowed
  only when its acceptance criteria necessarily exercise an accepted public contract
  absent from Phase 0. A poor or failed Phase 0 result never justifies reclassification.
- The stable-v5 benchmark uses at least 10 paired-comparable tasks. Candidate-only
  tasks do not count toward that floor. Across the full candidate corpus, every named
  capability area is exercised by at least two independently scored tasks. One task
  may cover multiple areas, but no single task certifies an area.
- The classification and run count for every task are predeclared, and every count is
  at least 10. A Phase 0 pilot sets each paired-comparable task's count with at least 80
  percent power to detect an absolute regression of 15 percentage points. Release
  decisions use one-sided exact McNemar tests and control family-wise error at 0.05
  with the Holm correction. Sample-size planning uses the conservative Bonferroni
  level of 0.05 divided by the paired-comparable task count and the pilot's one-sided
  95 percent upper confidence bound for discordant pairs under that regression
  alternative. Candidate-only counts, the executable power calculation, and all
  inputs are published before candidate runs.
- Across the full candidate corpus, including both strata, the aggregate fully-correct
  rate has a 95 percent Wilson lower bound of at least 80 percent, and no individual
  task has a fully-correct point estimate below 60 percent. Aborted runs count as not
  fully correct.
- Only the paired-comparable stratum supports relative claims. Relative to its Phase 0
  baseline on the same pinned harness, the candidate's fully-correct point estimate
  does not regress and either improves by at least 20 percentage points or reaches at
  least 95 percent. Cataloged framework-architecture violations per 100 attempted
  paired-comparable runs fall by at least 50 percent, and no paired-comparable task has
  a statistically significant regression after the predeclared correction. Violations
  found before an aborted run still count. Candidate-only results and violations are
  reported separately and never enter a comparative denominator.
- A model, harness, permissions, paired task artifact, evaluator, pairing,
  classification, or statistical-procedure change starts a new benchmark series and
  requires rerunning both the Phase 0 revision and release candidate. Candidate-only
  tasks are frozen after their public contracts are accepted and before candidate
  collection; changing one after collection invalidates the full-corpus candidate
  result and requires a fresh candidate evaluation. Results are not compared across
  unlike series.

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

Phase 1 must define `start`'s return value, readiness and failure semantics, and
reentrant or overlapping start, stop, and restart behavior under the selected
synchronous or awaitable contract. If lifecycle work may remain pending, invalidated
work must settle deterministically without exposing stale success or leaving callers
pending. Migration tests must cover the existing synchronous return contract.

Owned child Applications follow their owner's start, stop, restart, and destroy
lifecycle without per-child lifecycle flags. A capability that must outlive its
current owner belongs to a longer-lived Application and is passed to the shorter-lived
Application explicitly.

`State` is a first-class, event-notifying object composed into an eligible owner rather
than methods mixed into several unrelated classes. Phase 1 selects its concrete API
after testing the current Toolkit vocabulary against representative plain and
stateful objects. No State instance, listener, cleanup registration, or owner
property exists until state is declared, supplied, or first requested. State composed
into a Marionette owner has exactly one owner. Supplying an unowned State transfers
ownership; supplying an already-owned State for composition fails with a stable
diagnostic rather than creating shared or borrowed ownership. Shared data belongs in
an external model, collection, or data-source contract. The owner destroys its State
and releases its State subscriptions at owner destroy. State composed into View or
CollectionView persists across render. State composed into Application persists
across stop and restart. State composed into MnObject persists for the object's
lifetime. State composed into Behavior persists across its owning View's render and
ends when the Behavior is destroyed. If the selected lifecycle permits pending
startup, invalidated startup cannot later mutate State or owned children. Region does
not own State. A Behavior may compose
private State when its concern truly owns that state. State shared with its View
belongs on the View; the Behavior may receive an ordinary reference to that State but
does not compose, own, or destroy it.

Appropriate core additions include public read-only ownership accessors, pure Region
lookup, shared diagnostics, extension hooks with no registered listeners by default,
and narrowly designed resource ownership.

### API-shape and agent-ergonomics gate

Before stable v5 freezes more runtime surface, the established v3/v4 convenience
contracts must pass a bounded API-shape audit. Historical behavior is evidence, not
an automatic compatibility requirement. Each decision must reconstruct the original
rationale, identify whether the contract is public or merely an internal source
path, scan representative public code, and exercise the explicit replacement in the
reference app and agent benchmark. Available app-frontend and Marionette Toolkit
migrations may reveal implementation or migration problems but do not define the
public contract.

The current evidence establishes these candidate decisions for validation:

- `Region.show` and `View.showChildView` accept a View-like instance. The v3/v4
  template, string, and options-object convenience implicitly constructs a base View,
  hides allocation and ownership, and creates the View-to-Region dependency that led
  v5 alpha to co-locate both implementations. Unless the public scan or benchmark
  demonstrates a stronger contract, v5 removes that convenience and documents
  explicit View construction as the migration.
- If that display contract is accepted, View, Region, and the declarative Region
  builder return to honest owner-named modules. `buildRegion` remains an internal
  helper for declarative Region definitions; one-line forwarding modules and other
  obsolete internal paths are removed rather than preserved as aliases.
- Instance `getOption` and `mergeOptions` remain migration candidates to keep because
  verified public consumers use both and `mergeOptions` provides an explicit
  constructor option whitelist. New core contracts do not expand their role. The
  target-first root utility exports, which take the target instance as their first
  argument instead of calling its method, are separate contracts and are removed when
  no verified public consumer or benchmark task justifies their duplicate call shape.
- Lifecycle callback discovery must be explicit and inspectable. The audit tests
  whether `triggerMethod` should call only instance methods rather than inheriting
  `getOption`'s constructor-option precedence; an options-based lifecycle handler is
  retained only with verified public consumer and benchmark evidence.
- Application lifecycle concurrency is a separate contract decision, not an
  implementation detail. The current v5 core has no other promise-based public
  contract, so Application alone does not establish async lifecycle by momentum.
  Compare the established synchronous lifecycle with an awaitable design against
  races observed in verified public consumers and representative migrations,
  migration cost, implementation complexity, and agent discoverability. If async
  lifecycle wins, define which hooks and notifications are awaited, their failure
  semantics, and their overlap behavior, then prove the selected state machine.
  Otherwise retain synchronous lifecycle and keep async orchestration explicit in
  consumer code.
- The currently documented model and collection data protocol is an explicit but
  Backbone-shaped v5 pre-release contract. A benchmark adapter can satisfy it only by
  reproducing `cid`, `attributes`, `models`, `indexOf`, and exact event payloads.
  Before stable, v5 either freezes that protocol deliberately or replaces it with one
  lean canonical adapter contract and an executable Backbone migration. State remains
  an ownership and local-state concern and does not implicitly solve this data-source
  decision.
- Template cloning is a valid optimized rendering technique, not evidence by itself
  for another renderer API. First measure and document the explicit existing recipe:
  construct the final imported element in `buildChildView`, pass it to the child View,
  and use `template: false`. A first-class DOM-node renderer or element factory ships
  only if public benchmark tasks demonstrate an outcome the existing renderer,
  `setElement`, and `buildChildView` seams cannot express clearly.
- Declarative handler maps, `@ui` references, Backbone-style `extend`, dynamic
  `childView(model)` selection, and centralized DOM adapter and renderer installation
  remain candidate v5 patterns where current evidence shows they are widely used,
  deterministic, and statically understandable. Value-or-function and
  class-or-resolver overloads are assessed individually rather than removed as a
  category.

The gate passes only when every reviewed contract has one documented canonical form,
an executable migration where behavior changes, source and package entrypoints that
name their real owner, no unverified alias or fallback path, and paired agent tasks
that distinguish the retained form from the removed alternative. These are contract
discrimination checks; they use the statistical paired-comparable protocol only when
registered in that benchmark stratum. API-shape changes land as small dedicated
changes rather than being mixed into unrelated lifecycle or ownership work.

Stable v5 removes Underscore as a required Marionette runtime peer without removing
the documented, useful Backbone-era ergonomics of `CollectionView.children`. The
container owns its documented method vocabulary and gains prototype-level iteration;
callback methods use explicit function semantics, `pluck` reads child View properties,
and model attributes are accessed explicitly through the View. Undocumented pure
aliases may be removed, but a method is not removed merely because one private
application does not use it. Private consumers may provide real-world migration
evidence, but never define the public contract or a release gate. Marionette may use
Underscore in development-only Backbone parity coverage, while production entrypoints
and shipped subpaths do not import or require it.

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

Declarative definition helpers, adapter implementations beyond the required stable
model and collection data protocol, new CollectionView strategies, and renderer
integrations remain evidence-dependent. They may be explored after the foundation is
measurable, but do not block stable v5 without benchmark evidence. Deciding whether
to freeze or replace the current model and collection data protocol is a Phase 1 gate, not
a Phase 5 candidate.

## Runtime cost contract

Phase 0 records an authoritative baseline after already-approved dependency work.
The stable release then requires:

- Development, test, lint, benchmark, and rule-catalog modules are absent from the
  production module graph.
- Optional features add no instance property, collection, subscription, or registry
  until used.
- The adopted Phase 0 package-size baseline is immutable: 49,500 Brotli-11 bytes at
  commit `31151c9cb5cb1e11d30da4332f58ca8b56cf2fe4`. Adding a capability,
  adopting a production subpath, or approving a larger budget never resets that
  baseline or rewrites its artifact measurements.
- CI retains an aggregate shipped-package backstop: the Brotli-11 sum of every
  shipped JavaScript artifact. Its initial ceiling is 51,975 bytes, five percent
  above Phase 0. This sum measures distribution footprint across supported delivery
  formats; it is not the number of bytes loaded by one application. CI also compares
  every artifact's Brotli-11 measurement and every production module graph with the
  exact pull request base. Existing-artifact Brotli-11 growth above one percent
  requires explicit issue approval and evidence.
- Before a runtime-cost-sensitive capability adds a production subpath or requests a
  package or consumer-scenario ceiling amendment, an exact-base prototype must record
  every artifact delta and applicable canonical consumer scenario. Ordinary
  implementation pull requests remain exact-base measured; forecasts from source
  lines, module counts, or another feature are not evidence for raising a ceiling.
- Canonical consumer scenarios use the pinned release toolchain, keep declared peer
  dependencies external, tree-shake and minify the result, and measure Brotli-11 for
  the root entrypoint alone, each opt-in production subpath alone, and the root
  entrypoint combined with each opt-in subpath. Each scenario is a versioned fixture
  that pins its entry source, exercised exports, bundler and minifier configuration,
  command, and expected artifact set. Equivalent ESM, CommonJS, and UMD delivery
  formats remain individually measured and compared with the exact pull request base;
  consumer scenarios do not sum them as though one application executes every format.
  A scenario is not adopted until it records a versioned Brotli-11 baseline and an
  explicit ceiling.
- Removing an external runtime dependency requires an exact-base complete prototype
  and a separate dependency-inclusive application-bundle scenario that records both
  the removed dependency and its owned replacement cost. That evidence may justify a
  two-stage ceiling amendment when shipped artifacts grow, but it never rewrites the
  immutable Phase 0 baseline or changes peer-external canonical scenario history.
- A new production subpath still requires exact-head approval and evidence. Its full
  set of new shipped artifacts counts against the aggregate package backstop, while
  its subpath-only and root-plus-subpath scenarios record the cost paid by consumers
  that opt in. The first merged size of each shipped artifact becomes that artifact's
  later pull-request comparison base without changing Phase 0.
- Before any ceiling may change, the performance contract must implement a versioned,
  two-stage budget-amendment protocol rather than re-baselining. A governance change
  records the immutable Phase 0 baseline, previous and proposed ceilings, exact
  prototype commit and scenario reports, approval and evidence URLs, rationale, and
  rollback condition. Only a later implementation may consume that base-owned
  authorization; a runtime implementation cannot authorize or raise its own ceiling.
- On a pinned release runner, there is no confirmed median regression above five
  percent and no confirmed p95 regression above ten percent for View
  construction/destruction, render/rerender, delegation, Region show/empty, and
  ordinary CollectionView work.
- Large-list operation-count evidence includes at least 1,000 visible children and covers initial
  render, append one, append many, remove one, reset or clear, targeted update, and
  destroy. Deterministic cases record created, attached, moved, detached, and
  destroyed node counts in addition to timing; a real-browser run validates focus,
  selection, media, and custom-element connection behavior. A removal-only update
  with no active filter and `viewComparator: false` moves no surviving child node.
- External comparative benchmarks are advisory evidence. An accepted result records
  the upstream benchmark revision, exact Marionette commit, complete committed patch
  or reproducible diff, browser and hardware profile, commands, and raw samples. A
  stale framework pin may inform investigation but cannot support an exact-current
  claim, and a benchmark-specific optimization does not become the default API merely
  because it is conforming and fast.
- A timing regression is confirmed only after an independent repeat in the same
  environment. Hosted CI warns at ten percent but does not fail on timing alone.
- Resource tests run at least 100 attach/detach cycles and prove zero registrations
  while detached and at most one while attached. At least 1,000 mount/destroy cycles
  leave no framework-owned references in deterministic ownership containers.
- Allocation tests prove that unused instances have no property, collection,
  subscription, or registry entry for an unused optional capability; opt-in resource
  storage begins only at the first registration.
- State allocation tests prove that plain MnObject, View, CollectionView, Behavior,
  and Application instances create no State, state subscription, cleanup
  registration, or state-owned property. Application child storage is also absent
  until the first child is owned.

Agent-tooling-only changes should produce byte-identical production entrypoints except
for version and source-map metadata. Core contract improvements may add bytes or work
when explicitly called, within the budgets above. Exceptional-path diagnostic detail
is allowed. Resource ownership may allocate only after the first registration.
The package backstop and every adopted consumer-scenario ceiling are independent hard
gates; passing one does not compensate for failing another.

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

- Complete the API-shape and agent-ergonomics gate for existing public contracts
  before freezing additional Application, State, or extension surface.
- Before the next v5 alpha, resolve the known detached-element attachment and
  CollectionView removal-only update correctness gaps. Detailed acceptance criteria
  and browser cases belong in their GitHub issues.
- Select and document the stable model and collection data protocol independently of
  State. Either deliberately freeze the current Backbone-shaped fields and event
  payloads or replace them with one lean adapter contract; do not ship both as
  canonical paths. Re-evaluate CollectionView update bookkeeping against the selected
  protocol before freezing either implementation.
- Decide whether Application lifecycle remains synchronous or becomes Marionette's
  first promise-based public contract, then specify only the selected state machine
  and add transition-table or model-based tests. Do not freeze an Application-only
  async convention before the API-shape evidence gate passes.
- Strengthen Application as the single non-renderable lifecycle and ownership scope,
  with parentlessness identifying the root and child Applications representing nested
  scopes. Specify deterministic startup and restart semantics under the selected
  lifecycle contract, root View and Region hosting, canonical child ownership, and
  teardown without adding a Feature alias or inheritance hierarchy.
- Separately define and implement State as a lazy first-class object composed into
  MnObject, View, CollectionView, Behavior, or Application without changing Region's
  renderable contract or conflating State with model and collection data.
- Make ownership and topology publicly readable without mutation.
- Harden Region lookup and View/Region ownership semantics.
- Specify Behavior scope, dependencies, delegation, and teardown.
- Introduce the shared diagnostic type, code catalog, and error semantics.
- Remove Underscore as a required runtime peer while preserving the documented
  ChildViewContainer vocabulary, making its callback and View-property semantics
  explicit, and validating optional Backbone integration (#241).
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
- Validate plain Views, Views composed with State, nested Applications, the selected
  Application startup and restart contract, Application resource cleanup, and
  shared-host overlays in the reference application.
- Close correctness, documentation, packaging, browser, and performance gaps exposed
  by the reference application.
- Complete v5 reference and migration documentation.

Gate: all stable release criteria below pass.

### Phase 5: Evidence-dependent candidates

Benchmark declarative definition helpers, adapter implementations beyond the Phase 1
model and collection data protocol, rendering seams, alternative CollectionView
strategies, and optional integrations. These
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
- Production source and shipped subpaths contain no Underscore import or required
  Underscore peer; the owned ChildViewContainer contract and Backbone integration pass
  their documented source, distribution, and packed-package tests.
- No release criterion depends on a private consumer or unpublished fixture.
- Known migration and behavior differences are documented, and no obsolete v5
  pre-release path is presented as canonical.
- Every contract in the API-shape and agent-ergonomics gate has an explicit keep or
  remove decision, an exercised migration when removed, truthful source ownership,
  and no unverified duplicate root utility or internal forwarding path.
- The selected model and collection data protocol passes compatibility tests when the
  current protocol is retained or is replaced with an exercised Backbone
  migration. The selected protocol passes source, distribution, packed-package, and
  real-browser tests.
- Large-list operation-count scenarios pass source, distribution, packed-package, and
  real-browser tests.
- Detached-element attachment semantics pass source, distribution, packed-package,
  and real-browser tests.
- The optimized rendering recipe passes source, distribution, packed-package, and
  real-browser tests.
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
