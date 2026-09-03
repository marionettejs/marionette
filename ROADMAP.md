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
non-renderable capabilities. An Application without a parent is a root Application;
a child Application is a nested application scope in its owner's hierarchy.

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
- Ownership and hierarchy are available through public, read-only APIs.
- Region lookup does not unexpectedly render or mutate application state.
- Regions own and mount Views. An Application hosted in a Region coordinates a root
  View; the Application itself never becomes a second Region-renderable object
  category.
- State composition is a first-class, opt-in relationship between MnObject, View,
  CollectionView, Behavior, or Application and an explicit state source. `getState()`
  returns that source unchanged; owners without one allocate no state source or
  subscription.
- The source owns storage and mutation semantics. Marionette owns source selection,
  declarative observation, subscription release, and factory-result disposal without
  implicitly constructing a store from a plain object.
- Application is Marionette's only asynchronous lifecycle and orchestration surface.
  View, Region, CollectionView, rendering, templates, Events, Radio, state-source
  callbacks, and destroy callbacks remain synchronous and never auto-await callback
  results.
- Root imports share one default Radio registry. Each explicit isolated runtime from
  `createMarionette()` owns its runtime classes, adapter configuration, and Radio
  registry.
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
  Applications, state-source composition, behaviors, communication, and teardown
  without inventing a separate API.
- The package ships compact, version-aligned, non-runtime agent material generated
  from the same public metadata: API and lifecycle tables, diagnostics, migration
  guidance, and canonical examples and counterexamples.
- Migration documentation reflects final v5 behavior rather than preserving
  pre-release experiments.

### Optional development and test surfaces

- Development validation reports rule codes with actionable context and is removable
  from production builds.
- A hierarchy inspector is read-only, explicitly enabled, and imported from a separate
  development subpath.
- Test helpers are runner-neutral, imported from a separate test subpath, and verify
  lifecycle, hierarchy, and cleanup without private-field access.
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

Core owns the essential View, Region, Behavior, Application, CollectionView,
state-source composition, lifecycle, event, and error contracts and preserves MnObject
as an optional convenience. Additive APIs are justified when they expose information
the runtime already maintains or make an existing responsibility explicit without
adding work to unused instances.

`MnObject` remains an optional minimal convenience for passive, non-renderable,
evented objects whose lifetime ends at destroy. It has no start, stop, restart, child
ownership, or Region contract and does not imply that an external container manages
it. Plain classes and functions remain canonical when those combined Marionette
conventions are unnecessary. V5 does not rename MnObject or introduce a replacement
class merely to restate this generic contract.

`Application` is a first-class object with start, stop, restart, and owned child
Applications. An Application without a parent is a root Application; separate root
Applications may coexist on a page. Root status describes its place in the
Application hierarchy, not a reason for an Application subtype.

Application, MnObject, View, CollectionView, Region, and Behavior do not form a public
inheritance hierarchy. They compose first-class
collaborators and may satisfy small shared protocols or reuse internal implementation
without exposing inheritance as the application architecture.

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

State composition is a first-class owner-to-source relationship rather than a second
universal model API mixed into unrelated classes. Owners expose only `getState()`,
which returns the exact configured Backbone model, actor, external store, custom
observable, or other source. Application code uses that source's native mutation API;
Marionette does not pretend every source implements keyed setters, reset, or
`change:key`. A source and an owner-local factory are distinct explicit configuration
forms. A supplied source is borrowed: Marionette releases only its own subscriptions.
An owner-local factory creates an owned source: Marionette also disposes that
source at owner destruction through the selected adapter contract. A plain state
object never silently selects and
constructs a store. Borrowing is many-to-one: destroying one owner releases only that
owner's observation and does not alter the shared source or another borrower's
observation. A borrower must not outlive its source; borrowing never extends a source's
independently owned lifetime.

State-source observation is selected explicitly per owner and remains separate from
the model and collection DataApi. A View may consume Backbone domain data while using
an XState actor or another source for orchestration. Marionette owns declarative
`stateEvents`, deterministic setup timing, constructor rollback, and subscription
release; the adapter owns how observation is registered, cleaned up, and, for an owned
owned source, disposed. The protocol does not grow universal create, set, unset,
reset, or destroy operations that unrelated state systems cannot truthfully share.

A composed source persists across View and CollectionView render, across a Behavior's
owning View render, across Application stop and restart, and for a MnObject's lifetime.
Every eligible owner releases its state-source subscriptions at destruction and also
disposes the source its factory created. Region does not compose state. A Behavior may create
a private source through its own factory; a source shared with its View is supplied and
borrowed rather than jointly owned.
After Application startup is invalidated, Marionette performs no stale state-source
work or subscription setup. Owner-provided asynchronous hooks must observe cancellation
before mutating any source.

The dependency-free core default is an exact plain object. It is deliberately
non-observable and gains no model-shaped mutation API. The earlier concrete `State`
candidate and export are removed rather than retained as a transitional alias.
Stateless owners pay zero per-instance allocation and retention cost.

Appropriate core additions include public read-only ownership accessors, pure Region
lookup, and shared diagnostics. Resource ownership and extension hooks remain
evidence-dependent 5.x candidates unless required development or test functionality
cannot be built from public lifecycle events and Application hierarchy APIs.

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

- **Selected:** Rename the pre-stable serialized collection template property from
  `items` to `models` without an alias so it matches the selected
  `DataApi.models(collection)` vocabulary before stable v5.
- **Selected:** Root imports retain one default Radio registry and set of runtime
  classes. Optional `createMarionette()` calls create isolated runtimes with their own
  runtime classes, mutable adapter configuration, renderers, and Radio registries.
  Applications do not own or reset Radio channels implicitly; the selected runtime
  owns its registry lifetime.
- **Selected:** Remove the module-global feature registry and its `setEnabled` and
  `isEnabled` exports. No verified app-frontend or Marionette Toolkit consumer uses
  the global API. Configure child event prefixes per View, configure default
  prevention and propagation per trigger, and keep application-owned values in
  an Application-owned state source or explicit application configuration. `DEV_MODE`
  and custom string flags are not retained through aliases or a second registry.
- **Selected:** Build every isolated runtime from the canonical default runtime-class
  contracts and shared configuration helpers. Retain class-level DOM and renderer
  configuration within each runtime. EventDelegator remains a public runtime
  adapter parallel to those seams, with deterministic runtime and per-class installation timing. Each registration
  returns an opaque cleanup operation that Marionette owns and invokes at most once;
  cleanup continues through sibling operations even when one throws.

- **Selected:** `Region.show` and `View.showChildView` accept only a View-like instance.
  The v3/v4 template, string, and options-object convenience implicitly constructed a
  base View and hid allocation and ownership. The representative consumer scan found
  one options-object and three string uses in app-frontend, no use in Marionette
  Toolkit, and no use in the agent benchmark; every found use has a direct explicit
  View construction migration. v5 removes the convenience without an alias.
- **Selected:** View and Region live in their owner-named modules. The declarative
  Region builder lives in `modules/common/build-region.js` as an internal helper;
  the former combined implementation and one-line forwarding modules are removed
  rather than preserved as aliases. Immutable performance evidence retains the
  historical source paths that its exact measurements recorded.
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
  CollectionView, renderer, template, Events, Radio, Marionette-managed state-source
  callbacks, and destroy callbacks stay synchronous. Publish a sync/async contract
  matrix and never auto-await an arbitrary callback. Development validation may
  diagnose accidental Promise returns without changing production semantics.
  Awaitable Application operations include the cooperative cancellation context
  defined above rather than merely ignoring stale completion.
- **Selected:** V5 owns a neutral DataApi boundary for model identity, value reads,
  serialization, ordered model snapshots, entity subscriptions, and normalized
  structural collection changes. Core retains that contract, `setDataApi()`, and the
  dependency-free default for plain objects and arrays. Plain arrays are static ordered
  snapshots: mutating one does not create a live source, and an explicit CollectionView
  render rebuilds its collection-derived children. A live source exposes its ordered
  model snapshot plus one structural observation hook and reports post-mutation `reorder`,
  `reset`, or `update` records; CollectionView owns the single reconciliation path for
  every source. The existing `backbone.js`
  installer and `runtime/backbone-data-api.js` implementation move together into
  `@marionette/adapters/backbone` as one atomic optional integration, keeping `cid`,
  `attributes`, `models`, and Backbone event payloads out of core. This avoids making
  the temporary Backbone-shaped protocol a v5 public contract that would need removal
  in v6. Do not add implicit Backbone detection, per-model wrappers, or a parallel
  reconciliation path. Per-owner state-source selection and observation remain a
  separate contract, not the collection data source and not an automatic reuse of the
  selected DataApi.
- **Selected:** First-party Backbone and jQuery adapters ship only from explicit
  `@marionette/adapters/backbone` and `@marionette/adapters/dom/jquery` subpaths. The
  adapters package has no root barrel, and core does not retain forwarding modules or
  the old `marionette/backbone` and `marionette/jquery-dom-api` paths. Importing one
  adapter must not load the other adapter or its optional peer.
- **Selected sequencing:** Freeze core StateApi/DataApi ownership, observation,
  declarative event-map, and normalized CollectionView reconciliation contracts first.
  Add the optional `@marionette/data` Model, Collection, `triggerMethod`, StateApi, and
  DataApi implementation second. Add Backbone, XState, Redux, and Zustand provider
  adapters afterward. External-store packages remain optional peers or fixture
  dependencies and never enter the core production graph.
- **Gated:** Template cloning is a valid optimized rendering technique, not evidence by itself
  for another renderer API. First measure and document the explicit existing recipe:
  construct the final imported element in `buildChildView`, pass it to the child View,
  and use `template: false`. A first-class DOM-node renderer or element factory ships
  only if public benchmark tasks demonstrate an outcome the existing renderer,
  `setElement`, and `buildChildView` seams cannot express clearly.
- **Selected:** A parent View rerender is a structural DOM and ownership reset. After
  the first render, Marionette resets Regions and destroys their active child Views
  before the renderer commits new parent output, then re-resolves Region elements from
  the new DOM. Marionette does not implicitly preserve, key, detach, reconcile, or
  remount Region children. Long-lived children receive observable state and own their
  presentation invalidation; parents own composition. The explicit sequence
  `detachChildView` → parent render → `showChildView` is the uncommon
  ownership-transfer escape hatch.
- **Selected:** Marionette's first-class renderer category is synchronous and
  container-scoped: Marionette owns a stable `view.el`, and the renderer commits within
  that boundary when `View#render()` is called. HTML, native DOM/template cloning,
  Morphdom or Idiomorph, Lit, and a retained VDOM fixture should prove the category.
  Autonomous component runtimes such as React, Vue, Svelte, Solid, and Preact own an
  exclusive hosted subtree inside a Marionette host View; Marionette does not coordinate
  their internal scheduling, lifecycle, refs, effects, or child ownership.
- **Gated:** Formalize the existing callable renderer as the immediate contract. Add
  `connect`, `disconnect`, or `dispose` protocol surface only when lifecycle fixtures
  prove that ordinary View attach, detach, destroy, and `setElement()` boundaries
  cannot provide exact cleanup for at least two first-class container renderers. Do not
  add asynchronous render completion, `view.el` replacement, shared subtree ownership,
  renderer-managed Regions, or Region-preservation modes.
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
signals runtime. Optional integrations with those systems may implement the explicit
state-source observation or collection-data contracts without becoming the canonical
implementation.

The existing Marionette Toolkit informs migration but does not define a second v5
object model. Toolkit App responsibilities strengthen the Application contract after
redesign rather than being copied or renamed to Feature. Toolkit Component does not
move into core. A Component with one rendered ownership boundary becomes a View and
declares a state-source factory only when it owns that source; a supplied source
remains borrowed. A floating surface anchored to one View but displayed in a shared
Region becomes a View coordinated by the documented overlay-host pattern. A
coordinator with an independent active lifecycle or multiple Views and Regions becomes
an Application. Static class-level Region injection and patches that allow Regions to
show non-Views are not canonical v5 patterns. V5 does not ship a Toolkit compatibility
adapter as part of this public release plan.

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

Declarative definition helpers, adapter implementations beyond the selected
Backbone, jQuery, native observable-list, keyed snapshot observer, and XState actor
categories, new CollectionView strategies, and renderer integrations remain
evidence-dependent. They may be explored after the foundation is measurable, but do
not block stable v5 without benchmark evidence. The neutral DataApi boundary and the
named first-party adapter categories above are selected for 5.0; further adapters
remain evidence-dependent 5.x candidates.

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
- State-source allocation tests prove that plain MnObject, View, CollectionView,
  Behavior, and Application instances create no source, subscription, cleanup
  registration, or state-source property. Application child storage is also absent
  until the first child is owned.

Agent-tooling-only changes should produce byte-identical production entrypoints except
for version and source-map metadata. Core contract improvements may add bytes or work
when explicitly called, within the budgets above. Exceptional-path diagnostic detail
is allowed. Resource ownership may allocate only after the first registration.
The package backstop and every adopted consumer-scenario ceiling are independent hard
gates; passing one does not compensate for failing another.

## Public proving grounds

External examples and benchmarks answer different questions and remain advisory
unless a later roadmap decision explicitly promotes one into a release gate. Pursue
them in this order:

1. Finish the Marionette v5 [js-framework-benchmark][js-framework-benchmark]
   implementation. It supplies the hot keyed-list and retained-memory signal, but its
   benchmark-specific code does not define idiomatic application structure.
2. Modernize the existing [Backbone.Marionette TodoMVC example][todomvc-marionette]
   for v5 and submit it to the maintained [TodoMVC][todomvc] set. This is the highest
   priority public normal-application artifact: it must demonstrate idiomatic
   composition, routing and filtering, editable child Views, persistence, collection
   changes, and lifecycle cleanup while passing TodoMVC's shared behavioral suite.
3. Build a [RealWorld][realworld] implementation in a dedicated repository following
   its starter-kit flow. Its shared API, CSS, and end-to-end suite give it the highest
   architectural evidence value: API requests, authentication, routing, forms, nested
   screens, error states, and asynchronous replacement exercise lifecycle races,
   stale-request handling, Region replacement, teardown, and data-adapter ergonomics.
   Its maintenance cost is accepted only after the smaller TodoMVC reference is current.
4. Add Marionette to the [Framework Benchmarks weather application][framework-benchmarks]
   if its maintainers are receptive. Its bundle, load, CPU, memory, build, and code
   characteristics complement the list-operation focus above.
5. Track [Speedometer][speedometer-3] rather than optimizing specifically for
   admission. Maintaining a current, idiomatic TodoMVC implementation is useful
   groundwork but does not imply inclusion in a browser-vendor-selected workload.

[Builder.io framework-benchmarks][builder-framework-benchmarks] and
[UIBench][uibench] remain lower-priority investigations. The former uses
best-effort generated framework code, which makes idiomatic Marionette harder to
defend; the latter offers useful rendering cases but less current ecosystem reach.
Standalone bundle-size comparisons do not prove application-framework fitness and
remain covered by Marionette's own release budgets.

Together the selected proving grounds provide four distinct signals: peak list
performance, understandable small-application code, realistic application
architecture, and startup, bundle, and resource cost. Results follow the external
benchmark evidence rules above and never justify a default API solely because a
benchmark-specific implementation is fast.

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
  contracts while freezing state-source composition, StateApi/DataApi observation,
  normalized reconciliation, extension, and additional Application ownership. The Application
  lifecycle-hook decision recorded below settles its target
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
- Freeze and document the neutral DataApi model and collection protocol for 5.0,
  including its exact identity, serialization, event-payload, static-array, live-source,
  normalized post-mutation record, and optional Backbone package contracts. Keep
  Backbone-specific data shapes out of core, keep structural collection observation
  separate from per-model subscriptions, and make unsupported observation explicit
  rather than returning a silent fake cleanup function.
- Implement the optional `@marionette/data` Model, Collection, `triggerMethod`,
  StateApi, and DataApi only after the neutral core contracts above close. Keep that
  concrete reactive implementation outside core.
- After `@marionette/data`, move first-party Backbone and jQuery runtime adapters into a separately published
  `@marionette/adapters` workspace package, initially with only explicit `./backbone`
  and `./dom/jquery` exports and no root barrel. Replace the mutating Backbone installer
  with one combined `BackboneApi` behind `./backbone`; consumers pass it explicitly to
  the selected runtime's `setDataApi()` and `setStateApi()` methods. The integration
  uses Backbone's native event methods, preserves listeners registered before
  configuration, returns copied ordered model snapshots, does not modify Backbone
  objects or prototypes, and never calls
  `Backbone.Model#destroy()` during owned-state cleanup. Do not extract core's DataApi
  contract, `setDataApi()`, or its default for plain objects and arrays. Remove the old
  core subpaths rather than forwarding them, keep peers optional and isolated, and make
  build, package, performance, and release verification require both distributions.
  Migrate the existing `v1` consumer-bundle entries and manifest to the canonical
  adapter imports rather than inventing a `v2` solely for this package move, and add
  negative package fixtures proving the removed core subpaths no longer resolve.
- Remove the module-global feature registry as selected through the v3/v4
  compatibility audit. Preserve the canonical default behavior through existing
  local View and trigger options, migrate application-owned values to an owned state
  source or explicit configuration, and do not add an alias or replacement registry.
- Retain one default runtime and provide optional `createMarionette()` isolation
  for runtime classes, mutable adapters, renderers, and Radio registries. Stabilize EventDelegator as a public
  registration and cleanup boundary with exact listener options, attempt-all teardown,
  constructor-failure rollback, native focus/blur ordering, and executable optional
  jQuery evidence. Close documentation gaps in process scope, installation timing, and
  precedence without adding EventDelegator-specific factories, injection, or duplicate
  configuration paths.
- Close the related lifecycle leaks before the first integration candidate: failed
  View and CollectionView construction after rendering, failed MnObject and Application
  construction after Radio registration, public `off()` disabling owned Radio cleanup,
  state-source subscription release, or factory-owned source disposal, empty
  `listenTo` ledgers, and constant `replyOnce` removal by original value.
  Constructor rollback preserves the construction error while attempting every owned
  cleanup exactly once.
- Keep request/reply adaptation private to Requests: move the constant-or-function
  callback helper into `mixins/requests.js`, preserve constant replies and original
  identity, and remove the obsolete utility. Remove `RequestsMixin` from `CommonMixin`;
  let `EventsMixin` supply `triggerMethod` without a duplicate CommonMixin entry.
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
- Define and implement one pay-for-play [owner-to-state-source composition
  contract][issue-191] for MnObject, View, CollectionView, Behavior, and Application
  without changing Region's renderable contract or conflating state with model and
  collection data. Replace implicit `new State(definition)` with explicit source and
  per-owner factory forms; return the exact source from `getState()`; treat supplied
  sources as borrowed and sources created by an owner-local factory as owned; and
  route declarative `stateEvents`
  through an explicitly selected per-owner observation adapter. Keep DataApi
  read/collection-oriented, do not invent a universal mutation protocol, and remove
  the obsolete concrete `State` implementation, export, tests, and documentation.
- Make ownership and hierarchy publicly readable without mutation.
- Harden Region lookup and View/Region ownership semantics. Lock down parent rerender
  as destructive structural reset: destroy active Region children exactly once before
  renderer commit, re-resolve Region elements afterward, preserve an explicitly
  detached View only through caller-owned transfer, and prevent stale Region or adapter
  callbacks from mutating destroyed children.
- Formalize the synchronous callable renderer and its stable-element ownership boundary,
  then run HTML, native DOM/template-clone, Morphdom or Idiomorph, Lit, and retained-VDOM
  conformance through rerender, attach/detach/reattach, `setElement()`, destruction, and
  post-destroy collection. Expand the adapter protocol only for lifecycle gaps those
  fixtures prove cannot be solved by existing View boundaries.
- Specify Behavior scope, dependencies, delegation, and teardown.
- Introduce the shared diagnostic type, code catalog, and error semantics.
- Remove Underscore as a required runtime peer while preserving the documented
  ChildViewContainer vocabulary, making its callback and View-property semantics
  explicit, and validating optional Backbone integration (#241).
- Specify the requirements and cost boundaries for later opt-in extension hooks and
  resource ownership without implementing either runtime path in this phase.
- After runtime and package contracts stop moving, relocate core production modules
  under `src/` as one deliberate taxonomy change, including `MarionetteError` at
  `src/modules/error.js`. Update build inputs, coverage, fixtures, source links, and
  declarations atomically; do not retain forwarding source paths.

Gate: core invariants are documented, testable through public APIs, and add no
measurable work to unrelated instances beyond approved budgets. The public authorship
audit covers every executable production-source path in the shipped module graph whose
source differs from the v5 fork revision, with avoidable drift corrected and
substantial remaining departures justified.

### Phase 2: Static guidance

- Ship readable first-party TypeScript declarations for constructor options,
  ownership and hierarchy, state sources, owner-local factories, observation adapters, the
  selected data protocol, Application lifecycle results and
  operation context, optional Backbone and jQuery adapters, and the public/internal
  boundary. Prefer structural types over elaborate type-level machinery.
- Treat TypeScript readiness as a release contract: exercise root and every supported
  subpath from ESM and CommonJS fixtures, type adapter configuration and lifecycle
  callbacks precisely, and verify declaration contents in both packed packages.
- Complete JSDoc and generated API metadata, including a drift-checked public method
  contract matrix for return, mutation/rendering, lifecycle validity, terminal
  behavior, sync/async status, and diagnostics.
- Build high-value architecture lint rules using the shared rule catalog.
- Make examples executable and document canonical View-versus-Application,
  state-source-versus-domain-data, borrowed-versus-factory-owned state,
  child-ownership, and overlay-host patterns and counterexamples.
- Document stable layouts and reactive children: render downward for initial
  composition, propagate observable state afterward, and treat a parent rerender as
  structural ownership reset. Cross-link the View, Region, renderer-adapter, and
  migration guidance rather than duplicating the contract.
- Publish the compact agent-oriented reference and include its version-aligned API
  metadata, lifecycle and return tables, diagnostic catalog, migration material, and
  canonical examples and counterexamples in the package without adding them to a
  production module graph.

Gate: types, docs, examples, lint rules, and runtime vocabulary agree, and drift checks
run in CI without loading new production code.

### Phase 3: Development and test support

- Add removable development validation.
- Add the optional hierarchy inspector with a versioned output schema.
- Add runner-neutral lifecycle, hierarchy, and cleanup test helpers.
- Build development and test support from public lifecycle events and hierarchy APIs.
  Do not add extension-hook dispatch to 5.0 unless required public `marionette/dev` or
  `marionette/test` functionality is proven impossible without it.
- Separate and verify production, development, and test package surfaces.

Gate: production bundles prove optional surfaces are absent unless imported;
development and test fixtures exercise every public helper.

### Phase 4: Integration and benchmark closure

- Once the remaining runtime correctness blockers close, pack an unpublished early
  integration candidate for the benchmark, Toolkit migration, app-frontend migration
  probe, and package fixtures. Use that evidence while package boundaries, source layout,
  declarations, and documentation are completed; do not wait for speculative Phase 5
  APIs before testing the code broadly.
- After that early candidate is available, complete the selected
  [collection-data track][issue-376] before the full release candidate. Add the native
  observable ordered collection and the
  shared keyed snapshot observer and XState actor adapters without adding source-specific
  reconciliation to CollectionView. Verify initial render, exact add/remove, reorder,
  reset, empty transitions, sorting, filtering, retained-model updates, same-key
  immutable replacement, pre-render mutation, repeated render, setup rollback,
  idempotent destruction, late notification, shared-source observation, and reentrant
  notification behavior through public APIs. Marionette destroys views and its own
  subscriptions but never stops caller-owned actors.
- Measure Backbone exact-event, native direct-record, and keyed snapshot-observer updates at
  representative 1,000- and 10,000-model sizes. Exact-event and native sources must not
  regress to snapshot diffing; each relevant snapshot notification performs at most
  one keyed O(n) comparison; unrelated notifications are no-ops; unchanged child Views
  retain identity; and core plus every optional adapter is measured as a separate
  production graph and packed import.
- Run the fixed agent corpus against the complete release candidate.
- Validate plain Views, Views with supplied and factory-owned state sources, nested
  Applications, the selected Application
  startup and restart contract, Application cleanup through public lifecycle
  callbacks, and shared-host overlays in the reference application.
- Close correctness, documentation, packaging, browser, and performance gaps exposed
  by the reference application.
- Complete v5 reference and migration documentation.

Gate: all stable release criteria below pass.

### Phase 5: Evidence-dependent candidates

Benchmark declarative definition helpers, renderer lifecycle extensions, alternative
CollectionView strategies, optional integrations, pay-for-play resource ownership,
and the smallest extension-hook contract justified by a public consumer that cannot
use lifecycle events and hierarchy APIs. The selected opt-in `createMarionette()` keeps
the default runtime while providing measured runtime-class and Radio isolation;
future runtime factory expansion still requires evidence. These experiments
target 5.x and do not block stable v5. Unsuccessful candidates are documented and
closed rather than retained as dormant APIs.

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
- Core and `@marionette/adapters` pack, install, type-check, measure, and verify as
  separate required release artifacts. The removed core adapter paths do not resolve,
  and each explicit adapter subpath proves that its unrelated optional peer stays out
  of the graph.
- State-source composition accepts only explicit sources and per-owner factories;
  `getState()` preserves source identity; several owners may borrow one source, and
  destroying one releases only its observation while the source and other borrowers
  remain live; public `off()` cannot disable later subscription release or owned-source
  disposal; every eligible owner releases subscriptions and disposes each factory
  result exactly once after subscription release; plain objects remain exact and do not
  trigger implicit store construction; and model/collection DataApi selection does not
  choose the state-source adapter.
- Plain arrays are documented and tested as static snapshots. The later
  `@marionette/data` collection plus Backbone, Redux Toolkit, Zustand vanilla,
  plain-record XState Store, and XState v5 actor adapters must pass the same normalized CollectionView reconciliation and
  lifecycle contract. Malformed records, duplicate keys, missing synchronous snapshots,
  invalid cleanup values, and unordered selector results produce actionable diagnostics.
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
- Removal of the module-global feature registry, default-versus-isolated Radio scope,
  runtime-local adapter installation precedence, and the canonical `createMarionette()`
  factory are documented; no replacement flag registry or duplicate factory
  path is presented as canonical.
- Every contract in the API-shape and agent-ergonomics gate has an explicit keep or
  remove decision, an executable migration when behavior changes, paired agent tasks
  that distinguish the selected form from the rejected alternative, truthful source
  ownership, and no unverified duplicate root utility or internal forwarding path.
- The selected neutral DataApi protocol passes compatibility, source,
  distribution, packed-package, and real-browser tests.
- Parent rerender conformance proves active Region children are destroyed exactly once
  before both default and custom renderer commits, Region elements resolve from the new
  DOM, explicit detach transfers ownership, and stale callbacks cannot mutate destroyed
  children. View, Region, renderer, and migration documentation teach the same rule.
- Renderer conformance proves synchronous commit within stable `view.el`, exact cleanup
  through attach/detach, `setElement()`, and destroy, and post-destroy collection for the
  selected first-class renderer category without loading optional renderer dependencies
  into core.
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
- Core production source has one documented `src/` taxonomy, no obsolete forwarding
  paths, and build, coverage, declarations, source links, and package fixtures agree on
  `src/modules/error.js` as the `MarionetteError` owner.
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
[issue-376]: https://github.com/marionettejs/marionette/issues/376
[issue-190]: https://github.com/marionettejs/marionette/issues/190
[issue-191]: https://github.com/marionettejs/marionette/issues/191
[issue-104]: https://github.com/marionettejs/marionette/issues/104
[js-framework-benchmark]: https://github.com/krausest/js-framework-benchmark
[todomvc]: https://github.com/tastejs/todomvc
[todomvc-marionette]: https://github.com/tastejs/todomvc/tree/master/examples/backbone_marionette
[realworld]: https://github.com/realworld-apps/realworld
[framework-benchmarks]: https://github.com/Lissy93/framework-benchmarks
[speedometer-3]: https://webkit.org/blog/15131/speedometer-3-0-the-best-way-yet-to-measure-browser-performance/
[builder-framework-benchmarks]: https://github.com/BuilderIO/framework-benchmarks
[uibench]: https://github.com/localvoid/uibench
