# Runtime isolation

Use named imports from `marionette` when the application shares one configuration.
These exports belong to the default runtime:

```javascript
import { View, Radio, setRenderer } from 'marionette';
```

`createMarionette()` creates an isolated runtime for applications that need
more than one Marionette configuration in the same JavaScript process. This
configuration fragment assumes the application supplies the two renderers and
templates:

```javascript
import { createMarionette } from 'marionette';

const admin = createMarionette();
const storefront = createMarionette();

admin.setRenderer(adminRenderer);
storefront.setRenderer(storefrontRenderer);

const AdminView = admin.View.extend({ template: adminTemplate });
const StorefrontView = storefront.View.extend({ template: storefrontTemplate });
```

Each call returns its own `Application`, `Behavior`, `CollectionView`, `MnObject`,
`Region`, and `View` classes. It also owns independent `DataApi`, `DomApi`,
`StateApi`, EventDelegator configuration, renderer configuration, and `Radio`
channel registry. Changing one runtime does not change the default runtime or another
isolated runtime.

New runtimes start from Marionette's built-in adapter and renderer defaults, not from
later configuration applied to the default runtime. Apply shared application
configuration explicitly to each runtime that needs it.

Implicit composition stays inside the selected runtime. Declarative Regions,
CollectionView's empty Region, and Application's root Region use the owning runtime's
classes. A Region or child Application from another runtime is rejected as an ownership
conflict; construct it from the receiver's runtime instead.

Isolation controls implicit class composition and mutable runtime configuration. It
is not a security boundary: explicitly showing a View-like object from another
runtime remains allowed under the existing Region and CollectionView display
contracts.

The factory is optional. Calling it does not replace the default exports, and
ordinary imports do not create a runtime per View or Application instance. Class-level
setters remain subclass-local within either form.

Configure object-style adapters against the selected runtime's setters. For example,
pass the `@marionette/adapters/dom/jquery` export to `isolated.setDomApi()`.
Likewise, pass the `@marionette/adapters/backbone` export to the isolated
runtime's `setDataApi()` and `setStateApi()` methods when it consumes Backbone
data or state. No implicit adapter configuration crosses runtime boundaries.

## Configuration method contract

Configure a runtime or subclass before creating its instances. The setters run
synchronously; they do not render Views or replace existing event subscriptions.
Changing a class prototype during a live feature is not a coordinated migration
of the feature's adapters or resources.

| Setter | Classes configured by the root or runtime function | Update |
| --- | --- | --- |
| `setDataApi(api)` | `View`, `CollectionView` | Overlays own enumerable methods on each class's current DataApi. |
| `setDomApi(api)` | `View`, `CollectionView`, `Region` | Overlays own enumerable methods on each class's current DomApi. |
| `setStateApi(api)` | `Application`, `Behavior`, `CollectionView`, `MnObject`, `View` | Overlays own enumerable methods on each class's current StateApi. |
| `setRenderer(renderer)` | `View`, `CollectionView` | Replaces template evaluation with the supplied function. |
| `setEventDelegator(delegator)` | `Behavior`, `CollectionView`, `View` | Replaces the delegator with an object exposing `delegate(options)`. |

Root and runtime setter functions return `undefined`. Corresponding class
methods, such as `CustomView.setDataApi(api)`, return that class and configure
its prototype. Subclasses inherit configuration until they receive their own
override. An existing subclass override is not overwritten by subsequently
configuring its parent class.

Omitting an argument is not a reset operation. In particular, object API setters
retain the current overlay, while `setRenderer(undefined)` removes the configured
renderer rather than restoring the default. Use a fresh `createMarionette()`
when a new independent configuration should start from built-in defaults.
