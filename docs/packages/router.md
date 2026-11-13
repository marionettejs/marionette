# @mnjs/router: feature-owned routing

Router is an optional, independently released companion. It is renderer-agnostic:
`@mnjs/html` is the recommended choice for a new application, not a Router
requirement. The example below is verified with Router 0.1.1, HTML 1.0.0 and
Marionette 5.1.0. These are published-package evidence versions, not a requirement
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
The [tagged Router source](https://github.com/marionettejs/marionette/tree/router-v0.1.1/packages/router)
is a fallback for 0.1.1 when installed files are unavailable.

Router requires Node 24.15 or newer. Check the [routing capability and driver
requirements](../guides/routing.md#use-the-optional-router-for-routed-applications)
before constructing it. A memory driver makes tests deterministic; it does not
exercise browser navigation, focus, scroll or direct-link server behavior.

## Browser coverage

Router 0.1.1's runtime has passing **Chromium, Firefox and Playwright WebKit**
coverage for native Navigation API routing and the explicit History driver.
The [three-engine installed-archive run](https://github.com/marionettejs/marionette/actions/runs/43383924465/job/131748225100)
passed all 162 cases on each engine, with no retries or skips. It verified a
Linux-produced archive on macOS arm64; its runtime matches published Router 0.1.1.
The published 0.1.1 README predates this expanded coverage.

The [validation notes](https://github.com/marionettejs/marionette/blob/ec981e0ba43d14ea1a35695fe3b9b17ad271555d/packages/router/readme.md#known-native-webkit-differences)
describe the tested engine versions and two native WebKit differences involving
fragment removal and overlapping Back calls. In those Back cases, `back()` can
resolve `false` even after a destination becomes ready. Playwright WebKit coverage
does not establish behavior in every shipping Safari or iOS version.

## A minimal HTML feature

The [main routing guide](../guides/routing.md#a-minimal-html-feature) contains the copyable Router/RouteApplication HTML example and its startup, navigation, teardown and memory-driver testing instructions. That exact example is executed by the companion documentation check.
