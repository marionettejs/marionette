### Unreleased

* Remove public `silent` mutation behavior from `@mnjs/data`. Construction remains
  notification-free; subsequent mutations publish their documented events so
  subscribed Views and collection observers remain synchronized.

### v5.0.0-beta.5

> An Application can keep its children without keeping yesterday’s living room.

* Separate Application root ownership from its host Region. Stopping an Application
  releases its prepared and displayed roots without clearing another Application's
  replacement in a borrowed Region. Prepare roots with `setView()` and hand them
  to the Region with `showView()`; displaying a View directly through a Region
  does not transfer Application ownership.
* Accept an existing Region in `start({ region })` and `restart({ region })`, so
  retained child Applications can follow recreated parent layouts. Constructor
  Region definitions remain owned; startup Regions are borrowed. Use `restart()`
  when changing the host of an active Application.
* Add `childApps` constructor maps or functions for static, no-argument children.
  Construct and register them once before parent initialization; activation stays
  explicit. Subclass and option declarations replace inherited maps. Use
  `addChildApp()` for dynamic children or constructor arguments.
* Expand executable lifecycle and migration guidance, and direct documentation
  retrieval toward relevant contracts. These changes do not establish measured
  agent-effectiveness or stable-v5 readiness.
* Shard Windows release certification while retaining the complete fixture gate.

### v5.0.0-beta.4

> Events announce. Preparation waits. Apparently those needed separate job descriptions.

* Separate Application preparation from lifecycle notifications. Await
  `prepareStart`, `prepareStop`, and `prepareDestroy`; `onBefore*` hooks and
  `before:*` events are synchronous notifications. Pass `prepareStart`'s resolved
  value unchanged to `onStart` and `start` as the third argument. Migrate async
  `onBefore*` work to the corresponding preparation method.
* Preserve inferred startup result types for optional preparation methods, including
  `undefined` when the method is absent.
* Include referenced consumer resources in documentation exports and keep maintainer
  material out of the packaged consumer documentation.
* Clarify packaged and copied agent-skill helper paths, with executable lookup
  examples checked against the installed documentation.

### v5.0.0-beta.3

> Fewer surprise events and surprise startups, because whitespace is not an API and ownership is not a scheduler.

* Add `Application#setView(view)` and no-argument `showView()` so an Application
  can compose a complete root View tree before handing it to its Region. `getView()`
  returns the prepared View first and the displayed View after handoff.
* Make child Application activation explicit. Registration owns teardown without
  starting children; parent restart does not automatically reactivate registered children.
  Successful stop and destruction drain active descendants through stopped owners,
  and descendant `start()` or `restart()` resolves `false` while an ancestor is
  stopping or terminal.
* Resolve `triggerMethod` lifecycle hooks from instance and prototype methods only;
  constructor-option hooks no longer override or suppress those methods.
* Treat Events and Radio request names as literal strings across registration,
  dispatch, and removal. Replace whitespace-batched operations with separate calls
  or map entries; object-form event dispatch and the shared `eventSplitter` export
  are removed.
* Remove View Region registration/removal lifecycle events. Observe a specific
  Region's destruction lifecycle when teardown notification is required.
* Fix `getOption` so numeric zero and empty-string property keys resolve through
  the normal option-before-instance lookup.
* Clarify selector-backed versus Element-backed Region placeholder identity after
  a parent render, with public regression coverage for replacement and cleanup.
* Improve the typed starter's View ownership and missing-field rendering, and add
  consumer-first migration and native/Backbone routing guidance.
* Add executable Application guidance for explicit effect lifetimes, navigation,
  and latest-request refreshes that preserve active View and row identity.

### v5.0.0-beta.2

> Now with source maps, so “the AI wrote it” is slightly less useful as a debugging strategy.

* Add embedded authored TypeScript source maps to runtime ESM and CommonJS outputs
* Add the optional `marionette/eslint` consumer plugin with the `MN0040` private-member rule
* Ship a generated compact contract reference, troubleshooting recipes, and optional MCP discovery guidance
* Ship a TypeScript starter with version-matched npm dependencies, application agent instructions,
  typecheck, consumer lint, unit tests, Vite, and browser regressions
* Certify portable candidate starters, repeated Vite updates, installed consumer maps,
  ownership boundaries, and browser performance/retention evidence

This candidate changes development support and distribution tooling, not the core
runtime API. Agent-effectiveness benchmarks remain unscored.

### v5.0.0-beta.1

> A little structure for your app, because “the AI seemed confident” is not an architecture.

* Established `@mnjs` as the companion package scope: utils, radio, data, and
  adapters; the core package remains `marionette`
* Added a packaged application starter and beta trial guide, plus release
  authorization restricted to one exact prerelease version

* Added optional `createMarionette()` runtime factories with independent class
  families, mutable adapters, renderer configuration, and Radio channel registries;
  ordinary named imports remain one default runtime built through the same composition
  path
* Made ESM the canonical distribution for new applications while retaining
  CommonJS and both UMD outputs as v5 compatibility distributions; UMD and AMD
  consumers are asked to identify their usage in the public issue tracker before
  the six-month post-5.0.0 distribution review
* Added a neutral DataApi for model identity, reads, serialization, ordered
  model snapshots, entity subscriptions, and structural collection changes
* Renamed the pre-stable `DataApi.items(collection)` method to
  `DataApi.models(collection)` without a compatibility alias
* Renamed the pre-stable serialized collection template property from `items` to
  `models` without a compatibility alias
* Changed `Region#show` and `View#showChildView` to require an explicitly
  constructed View-like instance; template functions, strings, and View-options
  objects no longer allocate a hidden base View
* Split the internal View, Region, and declarative Region builder implementations
  into owner-named modules and removed the obsolete combined source path
* Added explicit `View#renderAttributes()` and `CollectionView#renderAttributes()`
  root-attribute refreshes; the default `DomApi.setAttributes` now removes
  nullish entries while leaving omitted keys untouched
* Added the optional `@mnjs/data` package with observable Model and ordered
  Collection sources plus matching DataApi and StateApi adapters
* Added the optional `@mnjs/adapters` package with explicit Backbone and
  jQuery subpaths and no root barrel; removed the previous core adapter subpaths.
  The Backbone integration configures DataApi and StateApi explicitly while
  preserving native Backbone objects, prototypes, listeners, and event methods;
  its `models()` method returns a copied ordered snapshot rather than exposing
  Backbone's mutable internal collection array
* Changed the default model and collection contract to plain objects and arrays;
  Backbone-specific data and event shapes now remain inside the explicit
  `@mnjs/adapters/backbone` integration
* Removed `children.findByModelCid`; `findByModel` uses the configured DataApi key
* Replaced the alpha concrete `State` with exact state-source composition and an
  independent StateApi observation contract; supplied sources are borrowed,
  `createState(options)` results are owned, and the lazy default is a plain object
* Changed CollectionView structural updates to render in-place updates, recreate
  child Views for immutable same-key replacements, drain reentrant observations,
  recover the latest source after reconciliation hook failures, and move survivor
  nodes without recreating or rerendering unchanged Views
* Changed `viewComparator: false` to disable presentation sorting while
  `sortWithCollection` continues reconciling structural changes to source order;
  use `sortWithCollection: false` to preserve manually managed child order
* Moved the optional jQuery-backed DomApi integration to
  `@mnjs/adapters/dom/jquery`
  operations and opt-in View, CollectionView, and Behavior `$el` compatibility
* Require concrete DOM elements for View and CollectionView `el`; resolve
  selectors and unwrap jQuery collections at the call site
* Removed the undocumented alpha-only `Behavior#setElement`; retarget
  Behaviors through their owning View's `setElement` method
* Fixed CollectionView child identity indexes so prototype-collision cids and
  same-cid impostors cannot corrupt ownership or mutate unowned Views
* Fixed removal-only, unfiltered CollectionView updates with default collection
  ordering or ordering disabled to preserve surviving child DOM, focus, selection,
  media, and custom-element connection state without firing sort or child-render
  lifecycles for unchanged survivors
* Removed the undocumented alpha-only named `Requests` export; request/reply
  methods remain owned by the built-in `Radio` singleton and its channels
* Removed the alpha-only request/reply methods from `Application`, `Behavior`,
  `CollectionView`, `MnObject`, `Region`, and `View`; use `Radio.channel(name)`,
  the top-level `Radio` API, or an owner's `bindRequests`/`radioRequests`
  integration instead
* Fixed selective `unbindRequests` cleanup to preserve a replacement reply
  owned by another object
* Fixed Radio circular dependency with log and debug
* Fixed event interop with Backbone
* Fixed delegated event matching so nested matching ancestors fire once per event
* Fixed callable Behavior `events` and `triggers` to resolve after Behavior
  initialization
* Fixed CollectionView empty Region construction to occur after `initialize`
* Removed the module-global feature registry and the `setEnabled` and `isEnabled`
  exports; configure child event prefixes per View, trigger DOM behavior per
  trigger, and application-owned values through a state source or explicit configuration
* Preserved `emptyView` resolver returns of `undefined`, `null`, or `false` as
  disabled empty-view states
* Changed the base `Region#show`, `Region#empty`, and `Region#reset`
  implementations to no-op once Region destruction begins
* Changed `Region#detachView` once destruction begins to return `undefined`
  without transferring the current View out of Region-owned teardown
* Changed destroyed `View#render` and `CollectionView#render` calls to return the
  instance without resolving templates or running the render lifecycle
* Changed base `View#setElement` and `CollectionView#setElement` calls once
  destruction begins to return the instance without changing its element
* Changed base `CollectionView#addChildView` calls once destruction begins to
  return the supplied View without inspecting or managing it
* Changed base `View#delegateEntityEvents` and
  `CollectionView#delegateEntityEvents` calls once destruction begins to return
  the instance without resolving host or Behavior maps or binding subscriptions
* Changed direct `Behavior#delegateEntityEvents` calls once the owning View's
  destruction begins to return the Behavior without resolving maps or binding
  subscriptions
* Changed base `View#bindUIElements`, `CollectionView#bindUIElements`, and
  direct `Behavior#bindUIElements` calls once the owning View's destruction
  begins to return the receiver without resolving or binding UI
* Changed `View#hasRegion` to check own registered Regions without rendering or
  changing View lifecycle state
* Changed `View#getRegions` to return a safe Region snapshot without rendering;
  `View#emptyRegions` remains a render-triggering mutator
* Changed `View#getRegion` to return an own registered Region without rendering;
  child View operations now render before dispatching Region lookup overrides
* Added `Region#getOwner` and `Region#getName` as pure queries over the existing
  registered View relationship
* Changed Region registration to treat the existing owner/name relationship as
  an idempotent no-op and reject conflicting ownership or names with stable
  diagnostic code `MN0030`
* Changed named View Region operations to require string names and reject
  empty names with diagnostic code `MN0032`
* Changed Application lifecycle operations to return `Promise<boolean>`, added
  `stop`, `restart`, and `isRunning`, and made later incompatible operations
  cancel stale lifecycle success without rejecting ordinary cleanup races;
  readiness hooks receive an operation context with a cooperative abort signal
* Added explicit named child Application ownership, pure owner-side child
  queries, and deterministic owner-driven child destruction; parent references
  remain private lifecycle state rather than public upward lookup
* Changed owned child Applications to start and stop sequentially with their
  owner while conflicting direct child operations cancel owner completion
* Changed Application root View teardown to empty only its current View on stop,
  destroy constructed Regions, and preserve borrowed host Regions
* Removed target-first common-method exports from the package root, including
  their generic plain-object adapter; use the corresponding method on each
  Marionette instance
* Trust declared argument shapes for option keys, callbacks, bindings, View and
  Behavior configuration, and adapter methods; retire their custom shape errors
  and type private immediate-child propagation as an array
* Removed the historically documented `Radio.log` and `Radio.debugLog`
  replacement hooks; the built-in Radio now owns one diagnostic and tuning
  output path
* Internalized the Radio Channel constructor and registry; obtain channels
  through `Radio.channel(name)`
* Changed borrowed top-level Radio methods to dispatch through the imported
  singleton instead of accepting an alternate receiver and registry

### v5.0.0-alpha.1

* Removed dependencies

## For previous iterations
[backbone.marionette Changelog](https://github.com/marionettejs/backbone.marionette/blob/master/changelog.md)
