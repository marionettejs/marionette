# @mnjs/router: feature-owned routing

Router is an optional, independently released companion. It is renderer-agnostic:
`@mnjs/html` is the recommended choice for a new application, not a Router
requirement. The example below is verified with Router 0.1.0, HTML 1.0.0 and
Marionette 5.0.1. These are published-package evidence versions, not a requirement
to pin every compatible application to those exact versions.
Router is a pre-v1 package with its own release cadence.
Version 0.1.1 updates the Catalog example to HTML
and the Desk instructions to accept an Adapters version compatible with the
installed core. Its runtime and public API are unchanged from 0.1.0.

## Read the installed contract first

After installation, read `node_modules/@mnjs/router/readme.md` for setup and
capabilities, `node_modules/@mnjs/router/DESIGN.md` for detailed contracts, and
`node_modules/@mnjs/router/examples/catalog/` for the larger shipped example.
These files belong to the installed Router version, not to core's documentation
manifest. When working with HTML, use `node_modules/@mnjs/html/guide.md` and
`node_modules/@mnjs/html/LIT_DIFFERENCES.md`. Read the package versions first.
The [tagged Router source](https://github.com/marionettejs/marionette/tree/router-v0.1.0/packages/router)
is a fallback for 0.1.0 when installed files are unavailable.

Router 0.1.0 requires Node 24.15 or newer and is tested on Chromium only.
Firefox and WebKit are untested. Check the [routing capability and driver
requirements](../guides/routing.md#use-the-optional-router-for-routed-applications)
before constructing it. A memory driver makes tests deterministic; it does not
certify browser navigation, focus, scroll or direct-link server behavior.

## A minimal HTML feature

The [main routing guide](../guides/routing.md#a-minimal-html-feature) contains the copyable Router/RouteApplication HTML example and its startup, navigation, teardown and memory-driver testing instructions. That exact example is executed by the companion documentation check.
