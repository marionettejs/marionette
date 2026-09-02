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

### Recognizable Marionette source

New v5 production code should read as a deliberate continuation of Marionette rather
than an unrelated framework implemented inside the repository. Established v3/v4 and
Toolkit source patterns are evidence about contributor expectations, not a requirement
to preserve obsolete behavior or dependencies.

- Prefer direct prototype methods, descriptive lifecycle predicates, familiar method
  ordering, and small helpers whose names explain the framework operation they isolate.
- Keep state vocabulary semantic and consistent. Private operation bookkeeping must not
  resemble a new public lifecycle state or rely on vague flags whose meaning changes by
  call site.
- Introduce unfamiliar control flow, helper layers, or module structure only when a
  specific correctness, concurrency, performance, packaging (including native ESM),
  or dependency-removal requirement warrants it. Record that reason where it can be
  reconstructed from the owning issue, tests, or a focused source comment.
- Do not create cosmetic rewrite churn. Correct avoidable authorship drift in focused,
  behavior-preserving changes with proportionate regression coverage.

Before the stable API and runtime freeze, audit every executable production-source
path in the shipped module graph whose source differs from the v5 fork revision,
including work already merged. The [public audit inventory][issue-329] records each
in-scope path's comparison source and one disposition: align with an established
pattern, retain a departure for one of the technical requirements enumerated above,
or open a separate behavior/API issue. A departure without one of those evidenced
requirements is avoidable drift.

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
- State is deliberately small and synchronous. It does not implicitly render Views,
  schedule work, compute derived values, run effects, or persist data.
- Application is Marionette's only asynchronous lifecycle and orchestration surface.
  View, Region, CollectionView, rendering, templates, Events, Radio, State mutation,
  and destroy callbacks remain synchronous and never auto-await callback results.
- Radio retains its module-global channel registry for v5. Applications may use Radio,
  but do not own or isolate its channels.
- Behavior scope, UI resolution, event delegation, dependencies, and teardown are
  explicit and tested.
- Lifecycle boundaries and callbacks remain the canonical cleanup seam. A resource
  registry or extension-hook dispatcher is evidence-dependent 5.x work, not a
  speculative 5.0 contract.
- Framework invariant failures use a common diagnostic type and stable rule code
  instead of incidental JavaScript exceptions.

### Precise static information

- Supported package entrypoints ship first-party declarations; stable v5 does not
  rely on DefinitelyTyped for its root API.
- Public methods, options, events, and lifecycle hooks have useful types and JSDoc.
- Generated API metadata is checked for drift.
- A drift-checked public method contract matrix records return value, mutation or
  rendering behavior, valid lifecycle states, destroying and destroyed behavior,
  synchronous or asynchronous status, and diagnostic codes without forcing
  superficial uniformity across unlike methods.
- Architecture lint rules identify high-value mistakes without executing an app.

### Executable guidance

- Documentation names canonical patterns and counterexamples.
- Examples are run in CI or otherwise verified against the shipped package.
- A compact agent-oriented reference describes lifecycle, ownership, regions,
  Applications, State, behaviors, communication, and teardown without inventing a
  separate API.
- The package ships compact, version-aligned, non-runtime agent material generated
  from the same public metadata: API and lifecycle tables, diagnostics, migration
  guidance, and canonical examples and counterexamples.
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

Application is the one selected promise-based lifecycle boundary. Readiness hooks
receive the Application and caller options first, preserving Marionette convention,
plus a standard readiness context with an `AbortSignal`. The context belongs to the
readiness phase rather than the Promise returned to one caller. Supersession aborts it
synchronously only when no winning operation adopts that readiness; when restart or
destroy inherits an in-flight stop phase, it inherits the same context and signal.
Aborting is ordinary supersession, not failure: it settles the invalidated operation
according to the documented overlap result, while a hook throw or rejection remains a
failure. The context does not make arbitrary event callbacks awaitable, and completion
hooks remain non-awaited notifications. Phase 1 must prove abort and transfer ordering,
hook arguments, repeated-call sharing, and migration from readiness work that
previously had no cancellation channel.

Owned child Applications follow their owner's start, stop, restart, and destroy
lifecycle without per-child lifecycle flags. A capability that must outlive its
current owner belongs to a longer-lived Application and is passed to the shorter-lived
Application explicitly.

`State` is a first-class, event-notifying object composed into an eligible owner rather
than methods mixed into several unrelated classes. Its canonical API lives on State;
owners expose only `getState()` and do not duplicate Toolkit's keyed getter,
setter, toggle, presence, or reset wrappers. No State instance, listener,
cleanup registration, or owner property exists until state is declared,
supplied, or first requested. State composed
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

The selected State contract commits every key in a multi-key write before events,
emits ordered `change:key` events, and then emits one aggregate `change` event per
write. Both event forms carry the same stable change object with `changed` and
`previous` maps plus caller metadata. Nested writes complete synchronously as their
own operations. Defaults, reset, reads after destroy, lifecycle-safe write
no-ops, owner cleanup, and declarative `stateEvents` are explicit parts of the
contract. It does not implicitly rerender a View, add effects
or computed values, schedule asynchronous work, persist data, or replace shared domain
models. Stateless owners pay zero per-instance allocation and retention cost.

Appropriate core additions include public read-only ownership accessors, pure Region
lookup, and shared diagnostics. Resource ownership and extension hooks remain
evidence-dependent 5.x candidates unless required development or test functionality
cannot be built from public lifecycle events and topology APIs.

### API-shape and agent-ergonomics gate

Before stable v5 freezes more runtime surface, the established v3/v4 convenience
contracts must pass a bounded API-shape audit. Historical behavior is evidence, not
an automatic compatibility requirement. Each decision must reconstruct the original
rationale, identify whether the contract is public or merely an internal source
path, scan representative public code, and exercise the explicit replacement in the
reference app and agent benchmark. Available app-frontend and Marionette Toolkit
migrations may reveal implementation or migration problems but do not define the
public contract.

This roadmap names the public contracts and decision hypotheses so the release gate
is auditable. Implementation acceptance cases and per-contract work status belong in
their dedicated GitHub issues. Unless a statement explicitly describes current
source, declarative language records the target v5 contract rather than claiming its
implementation is already complete.

The current evidence establishes these selected decisions, gated candidates, and
current-evidence findings:

- **Selected:** Radio retains its existing module-global registry for v5. Do not add an isolated
  Radio factory, Application injection, or Application-owned channel lifetime without
  new public evidence. Documentation must make that process-wide scope explicit.
- **Selected:** Remove the module-global feature registry and its `setEnabled` and
  `isEnabled` exports. No verified app-frontend or Marionette Toolkit consumer uses
  the global API. Configure child event prefixes per View, configure default
  prevention and propagation per trigger, and keep application-owned values in
  Application State or explicit application configuration. `DEV_MODE` and custom
  string flags are not retained through aliases or a second registry.
- **Selected:** Retain the current root bootstrap and class-level DOM, renderer, and event-delegator
  configuration. Document installation timing and precedence where unclear; do not
  redesign these seams without a concrete defect.

- **Gated:** `Region.show` and `View.showChildView` accept a View-like instance. The v3/v4
  template, string, and options-object convenience implicitly constructs a base View,
  hides allocation and ownership, and creates the View-to-Region dependency that led
  v5 alpha to co-locate both implementations. Unless the public scan or benchmark
  demonstrates a stronger contract, v5 removes that convenience and documents
  explicit View construction as the migration.
- **Gated:** If that display contract is accepted, View, Region, and the declarative Region
  builder return to honest owner-named modules. `buildRegion` remains an internal
  helper for declarative Region definitions; one-line forwarding modules and other
  obsolete internal paths are removed rather than preserved as aliases.
- **Gated:** Instance `getOption` and `mergeOptions` remain migration candidates to keep because
  verified public consumers use both and `mergeOptions` provides an explicit
  constructor option whitelist. New core contracts do not expand their role. The
  target-first root utility exports, which take the target instance as their first
  argument instead of calling its method, are separate contracts and are removed when
  no verified public consumer or benchmark task justifies their duplicate call shape.
- **Gated:** Lifecycle callback discovery must be explicit and inspectable. The audit tests
  whether `triggerMethod` should call only instance methods rather than inheriting
  `getOption`'s constructor-option precedence; an options-based lifecycle handler is
  retained only with verified public consumer and benchmark evidence.
- **Selected:** Application lifecycle is the selected asynchronous boundary. Only Promises returned
  by its readiness hooks are awaited; completion hooks and every View, Region,
  CollectionView, renderer, template, Events, Radio, State, and destroy callback stay
  synchronous. Publish a sync/async contract matrix and never auto-await an arbitrary
  callback. Development validation may diagnose accidental Promise returns without
  changing production semantics. Awaitable Application operations include the
  cooperative cancellation context defined above rather than merely ignoring stale
  completion.
- **Current evidence:** The remaining Backbone data coupling is narrow rather than
  architectural. V5 owns Events, `extend`, Radio, lifecycle, and DOM delegation; the
  root runtime does not import Backbone, while the optional `marionette/backbone`
  subpath does. The current
  CollectionView and template paths still assume `model.cid`, `model.attributes`,
  `collection.models`, `collection.indexOf(model)`, and exact Backbone `sort`, `reset`,
  and `update` payloads. `modelEvents` and `collectionEvents` require only an emitter
  with `on` and `off` and remain independent declarative bindings.
- **Selected:** Retain the current documented Backbone-shaped model and collection data
  protocol for 5.0. This selects an interface shape, not a Backbone dependency:
  Marionette core remains Backbone-optional, and any conforming model, collection, or
  adapter remains valid. The generalized data-source seam in [#104][issue-104] has no
  public benchmark failure or second source implementation satisfying its required
  evidence, so it remains an evidence-dependent 5.x candidate rather than a
  stable-release blocker. Do not add implicit Backbone detection, per-model wrappers,
  or a parallel reconciliation path. State remains an owned local-state concern, not
  the collection data source.
- **Gated:** The existing optional Backbone import side effect is an acceptable legacy install
  seam. If the protocol prototype proves an explicit idempotent `installBackbone`
  operation clearer or safer, select it through the same migration evidence. Do not
  churn the seam for theoretical import purity, and do not retain both installation
  forms as canonical without a verified deployment-order requirement and removal
  condition.
- **Gated:** Template cloning is a valid optimized rendering technique, not evidence by itself
  for another renderer API. First measure and document the explicit existing recipe:
  construct the final imported element in `buildChildView`, pass it to the child View,
  and use `template: false`. A first-class DOM-node renderer or element factory ships
  only if public benchmark tasks demonstrate an outcome the existing renderer,
  `setElement`, and `buildChildView` seams cannot express clearly.
- **Gated:** Declarative handler maps, `@ui` references, Backbone-style `extend`, dynamic
  `childView(model)` selection, and centralized DOM adapter and renderer installation
  remain candidate v5 patterns where current evidence shows they are widely used,
  deterministic, and statically understandable. Value-or-function and
  class-or-resolver overloads are assessed individually rather than removed as a
  category.
- **Selected:** Maintain or generate the public method contract matrix from executable metadata and
  use it to find real lifecycle, return, mutation, and diagnostic inconsistencies.
  Different responsibilities may deliberately have different return styles.

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
schema system, router, agent protocol, or inspector UI. Passing the platform
`AbortSignal` to Application readiness is a bounded lifecycle contract, not a general
signals runtime. Optional integrations with those systems may adapt to the State or
data-source contracts without becoming the canonical implementation.

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
measurable, but do not block stable v5 without benchmark evidence. The current
Backbone-shaped interface protocol is selected for 5.0; generalizing that seam is the
evidence-dependent 5.x candidate in [#104][issue-104].

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
- Large-list operation-count evidence includes at least 1,000 visible children and
  covers initial render, append one, append many, remove one, reset or clear,
  targeted update, and destroy. Deterministic cases record created, attached, moved,
  detached, and destroyed node counts in addition to timing; a real-browser run
  validates focus,
  selection, media, and custom-element connection behavior.
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

- Complete the remaining API-shape and agent-ergonomics gate for existing public
  contracts before freezing State, extension, or additional Application ownership
  surface. The Application lifecycle-hook decision recorded below settles its target
  shape by retaining core Marionette's subject-first lifecycle convention, meeting the
  verified Toolkit/app-frontend asynchronous-readiness need through that single hook
  path, and rejecting parallel compatibility seams. Executable implementation and
  migration evidence remain required before this part of the gate passes. Broader
  Application ownership work remains tracked by [#190][issue-190].
- Complete the [production-runtime authorship audit][issue-329] for every in-scope path
  that differs from the v5 fork revision. Correct avoidable drift in naming, state
  vocabulary, method and helper boundaries, ordering, and control flow; document
  warranted departures without changing a settled contract merely to reproduce
  historical implementation details.
- Before the next v5 alpha, resolve the [detached-element attachment gap][issue-327]
  and [CollectionView removal-only update gap][issue-328]. Detailed acceptance
  criteria and browser cases remain in those issues.
- Freeze and document the current Backbone-shaped model and collection protocol for
  5.0, including its exact identity, serialization, event-payload, and optional package
  contracts. Keep [#104][issue-104] in the evidence-dependent 5.x phase unless the
  public benchmark first satisfies that issue's implementation requirements.
- Remove the module-global feature registry as selected through the v3/v4
  compatibility audit. Preserve the canonical default behavior through existing
  local View and trigger options, migrate application-owned values to State or
  explicit configuration, and do not add an alias or replacement registry.
- Retain the module-global Radio architecture and the existing root bootstrap plus
  class-level DOM, renderer, and event-delegator configuration. Close documentation
  gaps in process scope, installation timing, and precedence without adding factories,
  injection, or duplicate configuration paths.
- Specify Application as Marionette's first promise-based public lifecycle contract
  and add transition-table or model-based tests. Preserve Marionette lifecycle
  signatures with the subject first. Treat Promises returned by `onBeforeStart`,
  `onBeforeStop`, and `onBeforeDestroy` as their operations' only readiness inputs;
  keep `onStart`, `onStop`, and `onDestroy` as non-awaited completion notifications.
  Completion return values are ignored and asynchronous completion work owns its error
  handling. A readiness hook throw or rejection rejects the operation before its target
  is reached and restores the prior stable state. A synchronous completion-hook throw
  rejects the operation after retaining the target state already reached. Repeated
  calls of the same operation kind share the active operation. Before destruction, a
  different operation kind supersedes it before its target state is reached. Once
  destruction begins it is terminal, and stale readiness completion cannot mutate
  state or emit an invalidated completion event. Do not add Toolkit's `beforeStart`,
  `triggerStart`, or `finallyStart` extension seams.
- Give each awaitable Application readiness hook a standard operation context with an
  `AbortSignal`. Supersession aborts before replacement readiness begins unless the
  winning operation adopts the in-flight readiness phase; adopted stop readiness keeps
  the same context and signal. Cancellation follows the ordinary supersession result
  rather than the failure path. Verify hook arguments, abort and transfer ordering,
  repeated-call sharing, and migration for consumer readiness work that cooperatively
  stops on abort.
- Strengthen Application as the single non-renderable lifecycle and ownership scope,
  with parentlessness identifying the root and child Applications representing nested
  scopes. Specify deterministic startup and restart semantics under the selected
  lifecycle contract, root View and Region hosting, canonical child ownership, and
  teardown without adding a Feature alias or inheritance hierarchy.
- Separately define and implement State as a lazy first-class object composed into
  MnObject, View, CollectionView, Behavior, or Application without changing Region's
  renderable contract or conflating State with model and collection data. Keep it
  synchronous and deliberately small: one stable change payload, atomic multi-key
  writes, explicit defaults/reset/nested-write/destroy semantics, optional declarative
  event binding only when justified, and no rendering, effects, computed values,
  persistence, or scheduling.
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
measurable work to unrelated instances beyond approved budgets. The public authorship
audit covers every executable production-source path in the shipped module graph whose
source differs from the v5 fork revision, with avoidable drift corrected and
substantial remaining departures justified.

### Phase 2: Static guidance

- Ship readable first-party TypeScript declarations for constructor options,
  ownership and topology, State, the selected data protocol, Application lifecycle
  results and operation context, optional Backbone and jQuery adapters, and the
  public/internal boundary. Prefer structural types over elaborate type-level
  machinery.
- Complete JSDoc and generated API metadata, including a drift-checked public method
  contract matrix for return, mutation/rendering, lifecycle validity, terminal
  behavior, sync/async status, and diagnostics.
- Build high-value architecture lint rules using the shared rule catalog.
- Make examples executable and document canonical View-versus-Application,
  State-versus-domain-data, child-ownership, and overlay-host patterns and
  counterexamples.
- Publish the compact agent-oriented reference and include its version-aligned API
  metadata, lifecycle and return tables, diagnostic catalog, migration material, and
  canonical examples and counterexamples in the package without adding them to a
  production module graph.

Gate: types, docs, examples, lint rules, and runtime vocabulary agree, and drift checks
run in CI without loading new production code.

### Phase 3: Development and test support

- Add removable development validation.
- Add the optional topology inspector with a versioned output schema.
- Add runner-neutral lifecycle, topology, and cleanup test helpers.
- Build development and test support from public lifecycle events and topology APIs.
  Do not add extension-hook dispatch to 5.0 unless required public `marionette/dev` or
  `marionette/test` functionality is proven impossible without it.
- Separate and verify production, development, and test package surfaces.

Gate: production bundles prove optional surfaces are absent unless imported;
development and test fixtures exercise every public helper.

### Phase 4: Integration and benchmark closure

- Run the fixed agent corpus against the complete release candidate.
- Validate plain Views, Views composed with State, nested Applications, the selected
  Application startup and restart contract, Application cleanup through public
  lifecycle callbacks, and shared-host overlays in the reference application.
- Close correctness, documentation, packaging, browser, and performance gaps exposed
  by the reference application.
- Complete v5 reference and migration documentation.

Gate: all stable release criteria below pass.

### Phase 5: Evidence-dependent candidates

Benchmark declarative definition helpers, the generalized data-source seam in
[#104][issue-104], rendering seams, alternative CollectionView strategies, optional
integrations, pay-for-play resource ownership, and the smallest extension-hook
contract justified by a public consumer that cannot use lifecycle events and topology
APIs. These experiments target 5.x and do not block stable v5. Unsuccessful candidates
are documented and closed rather than retained as dormant APIs.

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
- First-party declarations cover the root API and supported adapters without requiring
  DefinitelyTyped, and package-local agent metadata plus the public method contract
  matrix pass generation and drift checks while remaining outside production graphs.
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
- The sync/async matrix names Application readiness as the only awaited lifecycle
  surface, and Application cancellation tests prove exact abort ordering and ordinary
  supersession semantics without making other Marionette callbacks awaitable.
- Removal of the module-global feature registry, Radio process scope, and adapter
  installation precedence are documented; no replacement flag registry, duplicate
  factory, or configuration path is presented as canonical.
- Every contract in the API-shape and agent-ergonomics gate has an explicit keep or
  remove decision, an executable migration when behavior changes, paired agent tasks
  that distinguish the selected form from the rejected alternative, truthful source
  ownership, and no unverified duplicate root utility or internal forwarding path.
- The retained model and collection data protocol passes compatibility, source,
  distribution, packed-package, and real-browser tests.
- Large-list operation-count scenarios pass source, distribution, packed-package, and
  real-browser tests.
- CollectionView removal-only update semantics pass source, distribution,
  packed-package, and real-browser tests.
- Detached-element attachment semantics pass source, distribution, packed-package,
  and real-browser tests.
- The existing `buildChildView` plus `setElement` plus `template: false` optimized
  rendering recipe passes source, distribution, packed-package, and real-browser
  tests.
- The production-runtime authorship audit is complete, its corrective changes are
  merged, and every substantial departure from established Marionette source patterns
  has a recorded technical justification.
- No unapproved build, lint, type, or test warning remains.

Pre-releases may expose experimental APIs. Before stable, they may be changed or
removed based on evidence. After stable, public APIs, diagnostic codes, and documented
schema fields follow semantic versioning. Deprecations require a removal plan;
compatibility aliases or dual paths require a verified active consumer or a
non-atomic persisted-data migration and must name their removal condition.

### Six-month distribution review

Six calendar months after `5.0.0` is published, review the retained distribution
formats without changing the v5 support contract. Evaluate support reports, public
code usage, package-size impact, and maintenance cost. UMD is the first removal
candidate for v6, followed by CommonJS, while ESM remains canonical. Do not promise,
deprecate, or schedule either removal without evidence from this checkpoint and a
separate major-version decision.

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
9. Does the implementation follow established Marionette source patterns, and which
   concrete requirement warrants each substantial departure?

If these questions cannot be answered, the proposal remains a candidate and does not
block stable v5.

[issue-327]: https://github.com/marionettejs/marionette/issues/327
[issue-328]: https://github.com/marionettejs/marionette/issues/328
[issue-329]: https://github.com/marionettejs/marionette/issues/329
[issue-190]: https://github.com/marionettejs/marionette/issues/190
[issue-104]: https://github.com/marionettejs/marionette/issues/104
