### v5.0.0-alpha.2

* Added optional `marionette/jquery-dom-api` adapter for jQuery-backed DomApi
  operations without restoring `$el`
* Fixed Radio circular dependency with log and debug
* Fixed event interop with Backbone
* Fixed delegated event matching so nested matching ancestors fire once per event
* Changed `setEnabled` to reject undocumented feature names with stable diagnostic
  code `MN0027`
* Changed `Region#show` to reject destroyed Regions with stable diagnostic code
  `MN0028`

### v5.0.0-alpha.1

* Removed dependencies

## For previous iterations
[backbone.marionette Changelog](https://github.com/marionettejs/backbone.marionette/blob/master/changelog.md)
