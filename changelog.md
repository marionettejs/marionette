### v5.0.0-alpha.2

* Added optional `marionette/jquery-dom-api` adapter for jQuery-backed DomApi
  operations and opt-in View, CollectionView, and Behavior `$el` compatibility
* Changed jQuery-wrapped View and CollectionView `el` inputs to fail with the
  same `MN0001` migration diagnostic as selector strings
* Removed the undocumented alpha-only `Behavior#setElement`; retarget
  Behaviors through their owning View's `setElement` method
* Fixed CollectionView child identity indexes so prototype-collision cids and
  same-cid impostors cannot corrupt ownership or mutate unowned Views
* Fixed removal-only, unsorted, unfiltered CollectionView updates to preserve
  surviving child DOM, focus, selection, media, and custom-element connection state
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
* Changed `setEnabled` to reject non-string and blank feature names with stable
  diagnostic code `MN0027`; custom string feature names remain supported
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
* Changed Application lifecycle operations to return `Promise<boolean>`, added
  `stop`, `restart`, and `isRunning`, and made later incompatible operations
  cancel stale lifecycle success without rejecting ordinary cleanup races;
  readiness hooks receive an operation context with a cooperative abort signal
* Added explicit named child Application ownership, pure parent/root/child
  topology queries, and deterministic owner-driven child destruction

### v5.0.0-alpha.1

* Removed dependencies

## For previous iterations
[backbone.marionette Changelog](https://github.com/marionettejs/backbone.marionette/blob/master/changelog.md)
