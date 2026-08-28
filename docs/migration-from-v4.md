# Marionette v4 to v5 Compatibility Ledger

This ledger records the public compatibility boundary between Marionette v4
and v5. It is a reference, not the full procedural upgrade guide. Detailed
upgrade steps that are not already documented are tracked in
[the stable-release documentation issue](https://github.com/marionettejs/marionette/issues/147).

Status values describe the v5 outcome:

- **Preserved**: the supported public behavior remains available.
- **Changed**: the public behavior remains relevant but has a different contract.
- **Removed**: the v4 behavior is not supported in v5.
- **Optional**: the behavior is available only through an explicit opt-in.
- **Renamed**: the capability remains under a different name.
- **Documented**: the public extension point is retained and called out here.

## Compatibility ledger

| Area | v4 behavior | v5 behavior | Status | Migration note |
| --- | --- | --- | --- | --- |
| Package name | Installed as `backbone.marionette`. | Published as `marionette`. | Changed | Replace the package name. See [Installing Marionette](./installation.md#install). |
| Install command | `npm install backbone.marionette` installed Marionette under the v4 name. | Install core with `npm install marionette underscore`; add optional peers only when used. | Changed | See [peer dependencies](./installation.md#peer-dependencies). |
| Default export namespace | Namespace-style default import usage was supported. | A default namespace export is not supported. | Removed | Use named imports. See [Quick start](./installation.md#quick-start); final migration guidance is tracked in [#147](https://github.com/marionettejs/marionette/issues/147). |
| Named exports | Classes and utilities were available as named exports. | Named exports are the supported module API. | Preserved | Import only what is needed, for example `import { View, Region } from 'marionette';`. |
| `DEV_MODE` deprecation warnings | `setEnabled('DEV_MODE', true)` enabled deprecation warnings. | The warning capability is removed; `setEnabled('DEV_MODE', true)` no longer enables warnings. | Removed | Remove the flag call. Future deprecations require cataloged diagnostics. |
| Backbone dependency | Backbone was a required runtime dependency and supplied core entity and view behavior. | Marionette core does not import Backbone. | Optional | Install Backbone only for Backbone models or collections. See [Optional Backbone](./optional-backbone.md). |
| Explicit Backbone shim | Backbone integration was applied as part of the v4 dependency relationship. | `marionette/backbone` explicitly patches Backbone with Marionette event helpers. | Optional | Import `marionette/backbone` only when the shim is required. See [Using the bundled Backbone shim](./optional-backbone.md#using-the-bundled-backbone-shim). |
| jQuery dependency | jQuery commonly backed Backbone view and Marionette DOM behavior. | Marionette core does not import jQuery. | Optional | Install jQuery only when using `marionette/jquery-dom-api`. See [jQuery DOM adapter is optional](./installation.md#jquery-dom-adapter-is-optional). |
| Optional jQuery DomApi | jQuery-backed DOM operations were part of the common v4 stack. | The `marionette/jquery-dom-api` subpath provides explicitly selected jQuery-backed DOM methods. | Optional | Configure it at app boot with `setDomApi`. See [jQuery DOM compatibility](../upgradeGuide.md#jquery-dom-compatibility). |
| `$el` | Views commonly exposed a jQuery-wrapped `$el`. | Core and the optional jQuery DomApi do not create `$el`. | Removed | Set `$el` in an application-specific view layer if legacy code still requires it. See [jQuery DOM compatibility](../upgradeGuide.md#jquery-dom-compatibility). |
| `view.$(selector)` | Returned a jQuery collection in the common Backbone/jQuery configuration. | Delegates to `DomApi.findEl`, which returns a native `NodeList` by default or a jQuery collection with the optional adapter. | Changed | Prefer native collection APIs, or opt into `marionette/jquery-dom-api`. See [jQuery DOM compatibility](../upgradeGuide.md#jquery-dom-compatibility). |
| Region `el` | Accepted a selector string or DOM element. | Selector-string and DOM-element support are preserved. | Preserved | No change is required. Region remains the Marionette mount-point abstraction. See [View `el` is element-only](../upgradeGuide.md#view-el-is-element-only). |
| View `el` | Selector strings commonly worked through Backbone and jQuery. | `View` accepts a DOM element only and throws a migration hint for strings. | Changed | Resolve selectors at the call site with `document.querySelector(...)`. See [View `el` is element-only](../upgradeGuide.md#view-el-is-element-only). |
| CollectionView `setElement` | Selector strings commonly worked through inherited Backbone view behavior. | `CollectionView#setElement` accepts a DOM element only and throws for strings. | Changed | Resolve selectors before calling `setElement`. See [View `el` is element-only](../upgradeGuide.md#view-el-is-element-only). |
| Detach semantics | jQuery detach operations preserved jQuery listener and data bookkeeping for detached nodes. | The native DomApi is the default; v4-style listener-preserving jQuery detach behavior requires the optional adapter. | Changed | Use `marionette/jquery-dom-api` only when detach-and-reinsert code relies on jQuery bookkeeping. See [`detachContents` policy](../upgradeGuide.md#detachcontents-policy). |
| Radio | Applications commonly consumed the separate `backbone.radio` package. | Marionette exports its built-in `Radio` implementation as a named export. | Changed | Use `import { Radio } from 'marionette';`; do not add `backbone.radio` for Marionette internals. Further migration examples are tracked in [#147](https://github.com/marionettejs/marionette/issues/147). |
| UMD global | Script builds exposed the `Marionette` global. | The UMD build continues to expose the `Marionette` global with named API properties. | Preserved | Existing direct-script integrations can retain the global while updating changed APIs. |
| CJS entry | CommonJS consumers could require Marionette. | `require('marionette')` resolves to the CJS build and returns named API properties. | Preserved | Destructure the required API instead of expecting a restored default namespace contract. |
| ESM entry | ES module named imports were supported. | `import` resolves to the ESM build and named imports remain supported. | Preserved | Use named imports from `marionette`. |
| Underscore peer version | The supported peer range included Underscore 1.11 and 1.12. | The minimum supported version is `1.13.0`; the peer range is `underscore@^1.13.0`. | Changed | Upgrade Underscore before installing v5. See [peer dependency requirements](../upgradeGuide.md#peer-dependency-requirements). |
| Event bookkeeping rename | Backbone-compatible private event fields such as `_events`, `_listeningTo`, and `_listenId` could be observed. | Marionette's built-in Events implementation uses private `_rdEvents`, `_rdListeningTo`, `_rdListeners`, and `_rdListenId` fields. | Renamed | Do not read or write event bookkeeping fields; use `on`, `off`, `listenTo`, and `stopListening`. Procedural guidance is tracked in [#147](https://github.com/marionettejs/marionette/issues/147). |
| `Mn.Object` | The default namespace exposed an `Object` alias for the Marionette object class. | The alias is not restored. | Removed | Use `import { MnObject } from 'marionette';`; final migration guidance is tracked in [#147](https://github.com/marionettejs/marionette/issues/147). |
| `MnObject` | The Marionette object class was available as the named `MnObject` export. | `MnObject` remains a named export. | Preserved | Import it directly: `import { MnObject } from 'marionette';`. |
| Framework errors | Framework invariant failures exposed names and prose messages without stable machine identifiers. | `MarionetteError` is a named export and framework invariant failures expose stable `MNxxxx` codes. | Changed | Catch `MarionetteError` and branch on `error.code`; do not parse message prose or legacy documentation URLs. |
| `@ui` reference validation | Missing `@ui` keys could normalize to an `undefined` selector or fail incidentally later. | Every `@ui.<name>` reference must name an own, declared `ui` key; otherwise Marionette throws `MN0018` during normalization. | Changed | Define the `ui` key or replace the reference with a literal selector. |
| Handler validation | Missing string handlers and invalid non-function values could be silently omitted during delegation or binding. | Every supplied handler must be a function or a string that resolves to a callable method; otherwise Marionette throws `MN0019` before delegation or binding. | Changed | Define or remove the named method, or supply the handler as a function. |
| `onShow` | `Region` invoked `onShow(region, view, options)` for its `show` lifecycle event. | The Region `show` event and `onShow` method convention remain supported. | Preserved | No lifecycle rename is required. |
| Native DomApi customization | Applications could replace or partially override Marionette's DomApi globally or per class. | The native DomApi is the default and remains customizable with `setDomApi` or class-level setters. | Documented | Customization applies to `View`, `CollectionView`, and `Region`. |
| EventDelegator customization | DOM event delegation was supplied through Backbone view and jQuery behavior. | Native delegation is the default and can be customized globally with `setEventDelegator` or per class. | Changed | Custom delegators must provide compatible `delegate` and `undelegateAll` methods. Detailed examples are tracked in [#147](https://github.com/marionettejs/marionette/issues/147). |

## Reading changed and removed rows

The highest-impact migration boundaries are:

- update the package name and imports before addressing runtime behavior;
- keep default-namespace and `Mn.Object` compatibility out of new v5 code;
- explicitly opt into Backbone or jQuery compatibility only where an
  application still needs it;
- resolve `View` and `CollectionView` selector strings before construction or
  `setElement`, while leaving Region selector strings unchanged; and
- audit code that depends on `$el`, jQuery-shaped `view.$()` results, or
  jQuery-preserved detach bookkeeping.

The full ordered migration procedure and remaining before-and-after examples are
tracked in issue #147.
