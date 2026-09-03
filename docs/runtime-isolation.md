# Runtime isolation

Named imports from `marionette` belong to one default runtime. Existing applications
can continue importing and configuring those exports directly:

```javascript
import { View, Radio, setRenderer } from 'marionette';
```

`createMarionette()` creates an isolated runtime for applications that need
more than one Marionette configuration in the same JavaScript process:

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

Implicit composition stays inside the selected runtime. Declarative Regions, the default
View created by `Region#show`, CollectionView's empty Region, and Application's root
Region use the owning runtime's classes. A Region or child Application from another
runtime is rejected as an ownership conflict; construct it from the receiver's
runtime instead.

Isolation controls implicit class composition and mutable runtime configuration. It
is not a security boundary: explicitly showing a View-like object from another
runtime remains allowed under the existing Region and CollectionView display
contracts.

The factory is optional. Calling it does not replace the default exports, and
ordinary imports do not create a runtime per View or Application instance. Class-level
setters remain subclass-local within either form.

Configure object-style adapters against the selected runtime's setters. For example,
pass the `marionette/jquery-dom-api` export to `isolated.setDomApi()`. The current
side-effect-only `marionette/backbone` installer configures the default runtime only;
the separately packaged Backbone adapter planned after `@marionette/data` will make
that integration selectable for isolated runtimes. No implicit adapter configuration
crosses runtime boundaries. Until that adapter ships, an isolated runtime given a
Backbone collection fails with `MN0037`, while a Backbone model uses the plain-object
default and its attributes are not read from `model.attributes`. Keep Backbone data
on the default runtime during this temporary packaging gap.
