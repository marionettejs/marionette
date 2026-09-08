# Production and performance

Build and deploy Marionette as part of the application's existing browser
pipeline. Marionette does not require a server renderer, hosted runtime, or paid
service. Choose integrations for required behavior, then measure the resulting
application before changing them for speed.

## Ship a reproducible application

1. Pin the selected Marionette packages through the application lockfile. During
   alpha, align package versions and record the exact source revision when using
   locally packed builds. The same alpha label may describe different source.
2. Use named ESM imports with the application's bundler for a new browser app.
   Import only optional adapter subpaths the application configures. Keep adapter
   configuration before owner construction. Existing supported CommonJS and UMD
   consumers can keep their documented format.
3. Build and test the production artifact, including the actual renderer,
   DataApi/StateApi, and DomApi. Development-server success does not prove the
   published asset paths, CSP, or router fallback work.
4. Serve content-hashed assets with the host's immutable-asset policy. Give the
   HTML entry a policy that permits discovering new asset names. Retain referenced
   assets across a deployment so a still-open page can load its chunks.
5. Exercise startup, deep-link reload, navigation, API failure, and shutdown using
   the deployed artifact. Keep the previous artifact available for a deliberate
   rollback.

Caching behavior depends on the application's server headers; MDN documents the
[distinction between revalidation and immutable assets](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching).

## Deploy the router's URL policy

A history-based router needs the host to serve the application entry for valid
client routes on direct navigation. Missing static files and API paths should keep
their own error behavior. A hash-based router has a different URL/hosting tradeoff.
Preserve the application's existing router where it meets requirements; this
choice does not require changing Marionette's data or state integration.

Do not copy a rewrite configuration from a different host without testing a real
deep URL. The [routing guide](./routing.md) owns the boundary between URL handling,
request cancellation, and Region replacement.

## Measure the interaction that is slow

| Observed problem | Check first | Candidate change |
| --- | --- | --- |
| Typing loses focus or becomes slow | Is a model event rerendering the whole form or collection? | Update the affected control/status; preserve the draft and input node. |
| List refresh destroys unchanged rows | Is the caller invoking full `render()` or replacing source identities? | Use supported provider operations and verify surviving child/source identity. |
| Large screens create too much work | How many Views and DOM nodes are actually needed at once? | Page or virtualize at the application boundary; define focus/selection and cleanup semantics. |
| Root status updates rebuild descendants | Are only root classes/attributes changing? | Use `renderAttributes()` with the existing declarations. |
| Navigation grows listeners/memory | Does each activation acquire resources that survive shutdown? | Release widget/global subscriptions and cancel application-owned work. |
| Incremental rendering is attractive | Which DOM identity must survive, and does the selected adapter preserve it? | Test a supported DomApi on the real screen before adopting it. |

Use browser performance recordings around the actual interaction. Record the
source revision, data size, browser, device, selected integrations, and whether
lifecycle monitoring is enabled. Compare equivalent operations with repeated runs;
a small synthetic result does not establish every application's performance.
[Browser performance measurement](https://developer.chrome.com/docs/devtools/performance/overview)

## Keep optimizations inside the ownership contract

`CollectionView#render()` rebuilds its child tree. An incremental collection event
is a different operation and should not be benchmarked as if it did the same work.
Check input focus, selection, and draft retention alongside elapsed time.

Disabling `monitorViewEvents` changes attachment tracking and events; widgets using
`dom:refresh`/`dom:remove` depend on that contract. It is not a general-purpose
speed switch. Similarly, manually mutating owned descendants or skipping cleanup
may make a benchmark faster while invalidating application behavior.

Marionette does not provide automatic list virtualization, request deduplication,
or server rendering. Add an application policy when those capabilities are
required. Keep each policy testable and avoid attributing its behavior to core.
See [task recipes](./task-recipes.md) and [testing](./testing.md) for the corresponding
ownership assertions.

## Keep diagnostics useful

Capture failures at the application's boundary with enough operation and version
context to reproduce them. Preserve Marionette diagnostic codes so the linked
[diagnostic catalog](../config/diagnostics/catalog.json) can explain the contract.
Avoid logging whole models or request bodies by default; they may contain user
data. Decide source-map visibility according to the application's debugging and
information-exposure requirements.
