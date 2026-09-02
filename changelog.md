### v5.0.0-alpha.2

* Made ESM the canonical distribution for new applications while retaining
  CommonJS and both UMD outputs as v5 compatibility distributions; UMD and AMD
  consumers are asked to identify their usage in the public issue tracker before
  the six-month post-5.0.0 distribution review
* Added a neutral DataApi for model identity, reads, serialization, ordered
  collection items, entity subscriptions, and structural collection changes
* Changed the default model and collection contract to plain objects and arrays;
  Backbone-specific data and event shapes now remain inside the explicit
  `marionette/backbone` integration
* Removed `children.findByModelCid`; `findByModel` uses the configured DataApi key
* Replaced the alpha concrete `State` with exact state-source composition and an
  independent StateApi observation contract; supplied sources are borrowed,
  `createState(options)` results are owned, and the lazy default is a plain object
* Changed CollectionView structural updates to distinguish in-place updates from
  immutable same-key replacements, rebind child model events, and move survivor
  nodes without recreating or rerendering their Views
* Added optional `marionette/jquery-dom-api` adapter for jQuery-backed DomApi
  operations and opt-in View, CollectionView, and Behavior `$el` compatibility
* Changed jQuery-wrapped View and CollectionView `el` inputs to fail with the
  same `MN0001` migration diagnostic as selector strings
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
* Changed named View Region operations to require non-empty string names and
  reject property-key coercion with stable diagnostic code `MN0032`
* Changed Application lifecycle operations to return `Promise<boolean>`, added
  `stop`, `restart`, and `isRunning`, and made later incompatible operations
  cancel stale lifecycle success without rejecting ordinary cleanup races;
  readiness hooks receive an operation context with a cooperative abort signal
* Added explicit named child Application ownership, pure parent/root/child
  topology queries, and deterministic owner-driven child destruction
* Changed owned child Applications to start and stop sequentially with their
  owner while conflicting direct child operations cancel owner completion
* Changed Application root View teardown to empty only its current View on stop,
  destroy constructed Regions, and preserve borrowed host Regions
* Removed target-first common-method exports from the package root, including
  their generic plain-object adapter; use the corresponding method on each
  Marionette instance
* Changed `mergeOptions` to require its documented Array of option names with
  diagnostic code `MN0033`, and removed generic object traversal from private
  immediate-child propagation
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
