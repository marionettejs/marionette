### v5.0.0-alpha.2

* Added optional `marionette/jquery-dom-api` adapter for jQuery-backed DomApi
  operations without restoring `$el`
* Fixed Radio circular dependency with log and debug
* Fixed event interop with Backbone
* Fixed delegated event matching so nested matching ancestors fire once per event
* Changed `setEnabled` to reject undocumented feature names with stable diagnostic
  code `MN0027`
* Changed the base `Region#show`, `Region#empty`, and `Region#reset`
  implementations to reject destroyed Regions with stable diagnostic code `MN0028`
* Changed destroyed `View#render` and `CollectionView#render` calls to return the
  instance without resolving templates or running the render lifecycle
* Changed `View#hasRegion` to check own registered Regions without rendering or
  changing View lifecycle state
* Changed `View#getRegions` to return a safe Region snapshot without rendering;
  `View#emptyRegions` remains a render-triggering mutator
* Changed `View#getRegion` to return an own registered Region without rendering;
  child View operations now render before dispatching Region lookup overrides

### v5.0.0-alpha.1

* Removed dependencies

## For previous iterations
[backbone.marionette Changelog](https://github.com/marionettejs/backbone.marionette/blob/master/changelog.md)
