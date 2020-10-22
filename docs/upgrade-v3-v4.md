# Upgrade Guide from v3 to v4

Marionette 4 introduces a number of breaking changes. This upgrade guide will go
through the major changes and describe how to change your application to
accommodate them.

## Required changes
These are breaking changes that need to be handled when migrating from Marionette v3 to v4

#### CompositeView was removed
 * **Old behavior:** `CompositeView` class was provided
 * **New behavior:** `CompositeView` does not exists
 * **Reason:** API simplification
 * **Remedy:** Use `CollectionView` instead. Most features of `CompositeView` were added to `CollectionView`
   and in common cases a class rename is enough. The old `CompositeView` was abstracted to a
   [separate library](https://github.com/marionettejs/marionette.oldcollectionview).

One of the required changes is to explicitly define the `childView` when implementing a recursive (tree) view

   ```javascript
   // with compositeview
   const TreeView = CompositeView.extend({
     template: 'node-template'
   })

   // with collectionview
   const TreeView = CollectionView.extend({
     template: 'node-template',
     childView () {
       return TreeView
     }
   })
   ```

#### NextCollectionView was renamed to CollectionView
 * **Old behavior:** Both `NextCollectionView` and `CollectionView` were provided
 * **New behavior:** Only `CollectionView`, based on `NextCollectionView` is provided. The old `CollectionView` implementation was removed
 * **Reason:** API simplification
 * **Remedy:** Use `CollectionView` instead. The old `CollectionView` was abstracted to a
   [separate library](https://github.com/marionettejs/marionette.oldcollectionview).

#### `childViewEventPrefix` flag is set to false by default
 * **Old behavior:** `childViewEventPrefix` flag was set to true
 * **New behavior:** `childViewEventPrefix` flag was set to false
 * **Reason:** Performance Improvement
 * **Remedy:** It is recommended that child view events are proxied only when necessary.
   Rather than turning it on globally, set the `childViewEventPrefix` per view that needs it.
   Even better explictly define the proxies via `childViewEvents` and `childViewTriggers`.

#### Marionette global instance is not attached to Backbone global instance
 * **Old behavior:** Marionette could be acessed using `Backbone.Marionette`
 * **New behavior:** Marionette is not attached to `Backbone` global instance
 * **Reason:** Support named exports
 * **Remedy:** Import Marionette classes directly or use global Marionette instance (when using as a standalone script)

#### `noConflict` was removed
 * **Old behavior:** `noConflict` allowed for multiple installs of Marionette to be installed
 * **New behavior:** Marionette no longer handles conflicts internally.
 * **Reason:** Isn't useful with ES6
 * **Remedy:** Use package managers if multiple versions are needed.

#### AppRouter was removed
 * **Old behavior:** Marionette included a router
 * **New behavior:** Marionette no longer includes a router
 * **Reason:** AppRouter was used by a minority of cases
 * **Remedy:** Use any router including the extract AppRouter https://github.com/marionettejs/marionette.approuter

#### Renderer class was removed
 * **Old behavior:** The default renderer could be changed by setting `Renderer.render`
 * **New behavior:** `Renderer` does not exists
 * **Reason:** API simplification
 * **Remedy:** Use `Marionette.setRenderer` which accepts a function with same signature as expected by `Renderer.render`

#### `TemplateCache` render removed
 * **Old behavior:** Rendered templates using the `TemplateCache`
 * **New behavior:** Renders templates directly `template(data);`
 * **Reason:** TemplateCache is only used by a minority of users.
 * **Remedy:** If needed use https://github.com/marionettejs/marionette.templatecache

#### Behavior Lookup was removed
 * **Old behavior:** View behaviors could optionally be looked up via the global lookup naming scheme.
 * **New behavior:** Behavior definitions must be defined on the view.
 * **Reason:** Simplify API and no global Marionette instance
 * **Remedy:** Attach behaviors to view definitions.
   In v3
   ```javascript
   const MyBehavior = Marionette.Behavior.extend({...});

   Marionette.Behaviors.behaviorsLookup = function() {
     return {
       FooBehavior: MyBehavior
     };
   };

   const V3View = Marionette.View.extend({
     behaviors: {
       FooBehavior: {}
     }
   });
   ```

   In v4
   ```javascript
   const MyBehavior = Behavior.extend({...});

   const V3View = View.extend({
     behaviors: {
       FooBehavior: MyBehavior
     }
   });
   ```

#### `attachElContent` not called unless the View renderer returns a value
 * **Old behavior:** `attachElContent` was always called
 * **New behavior:** `attachElContent` not called if the render doesn't return a value.
 * **Reason:** Useful for renderers that modify the content directly.
 * **Remedy:** Return at least an empty string if you need to have `attachElContent` called

#### Support for vanilla Backbone.View has changed
 * **Old behavior:** `Backbone.View` instances were supported as is
 * **New behavior:** To support `Backbone.View` is necessary to apply `Marionette.Events` mixin
 * **Reason:** Improve performance
 * **Remedy:** If vanilla `Backbone.View` is not used there's no required change, otherwise, apply the `Marionette.Events` mixin to the
   prototype of the view class intended to be used with `Marionette`. Example:
   ```javascript
   // once, in the application start
   import _ from 'underscore';
   import {Events} from 'backbone.marionette';
   _.extend(Backbone.View.prototype, Events);
   ```

#### `triggerMethodOn` was removed
 * **Old behavior:** This method was use to `triggerMethod` on an object that did not have the method
 * **New behavior:** Objects that need this functionality should mixin `Marionette.Events`
 * **Reason:** Improve performance
 * **Remedy:** Same as supporting a vanilla Backbone.View mentioned above

#### Function isNodeAttached was removed
 * **Old behavior:** Utility function `isNodeAttached` was provided
 * **New behavior:** `isNodeAttached` does not exists
 * **Reason:** API simplification
 * **Remedy:** Use native code: `document.documentElement.contains(el)`

#### View's `template: false` now no-ops the render
 * **Old behavior:** Template was not rendered, but render events were triggered
 * **New behavior:** No render events will occur
 * **Reason:** Prevents incorrect usage of `render`
 * **Remedy:** `template: false` was often used to generate render events when no render was performed.
   Use other hooks or methods when no template will be rendered.

#### View.showChildView and Application.showView now return the shown view
 * **Old behavior:** These methods returned the region
 * **New behavior:** These methods now return the shown view
 * **Reason:** More useful return
 * **Remedy:** Use `getRegion` if the region is needed after this method

#### View data serialization no longer clones the data
 * **Old behavior:** model attributes were always cloned prior to template rendering
 * **New behavior:** model attributes are no longer cloned
 * **Reason:** Improve performance
 * **Remedy:** Unlikely to be an issue but if no `templateContext` is defined templates can modify the actual model data if not careful. Clone if necessary.

#### View `render` is no longer bound to the view
 * **Old behavior:** view.render was bound to the view
 * **New behavior:** view.render is no longer bound to the view
 * **Reason:** Improve performance
 * **Remedy:** In most all cases this won't matter but if you need to call the render function out of the context, use `call` or `apply`.

#### Region no longer supports the `selector` property
 * **Old behavior:** The `selector` or `el` property could be used to set the region `el`.
 * **New behavior:** The `el` property can be used to set the `el`.
 * **Reason:** Simplify API
 * **Remedy:** Rename any `selector` used with Region to `el`.

#### Region `preventDestroy` option was removed from `show` and `empty`
 * **Old behavior:** Option could be used to prevent destroying a leaving view
 * **New behavior:** Option is no longer available
 * **Reason:** Simplify API
 * **Remedy:** Use `detachView` first if you need to remove a shown view without destroying.

#### Internally `_.bind` was replaced with `Function.prototype.bind`
 * **Old behavior:** `_.bind` was used
 * **New behavior:** `Function.prototype.bind` is used
 * **Reason:** Preparing for lodash 5
 * **Remedy:** This may affect anyone hoping to squeeze < IE9 support out of Marionette.

#### `Application`, `Behavior`, and `Region` no longer extend `MnObject`
 * **Old behavior:** These classes extended `Mn.Object`.
 * **New behavior:** These classes no longer extend anything.
 * **Reason:** Shallow inheritance
 * **Remedy:** If modifying the `Object` prototype you may need to modify the others too.

#### `destroy` functions only proxy a single argument
 * **Old behavior:** Any number of arguments passed to a `destroy` functions were passed along to events.
 * **New behavior:** Only one argument is passed
 * **Reason:** Performance Improvement
 * **Remedy:** If you need to pass multiple pieces of data through `destroy` use an object.

#### `defaults` was removed from Behavior
 * **Old behavior:** Both `options` and `defaults` defined on Behavior are default options.
 * **New behavior:** Only `options` define the Behavior's default options
 * **Reason:** Simplify API
 * **Remedy:** Rename any use of `defaults` to `options`.

#### View definition options will not be passed to the view `initialize`.
 * **Old behavior:** `options` defined on the view definition were merged into `options` and passed to the Backbone.View constructor
 * **New behavior:** Only `options` passed in at construction will be passed to the Backbone.View constructor.
 * **Reason:** Performance Improvement
 * **Remedy:** Define any default Backbone.View options on the view instance directly instead of in a nested `options` on the definition.

#### `Error` utility was made private
 * **Old behavior:** The Marionette.Error class was publicly available.
 * **New behavior:** There is no accessible Error class.
 * **Reason:** Simplify API and maintenance

#### `DEV_MODE` which shows deprecation warnings was made a feature flag.
 * **Old behavior:** `DEV_MODE` was set on the global `Marionette` object.
 * **New behavior:** Use `setEnabled` to set the `DEV_MODE` feature flag.
 * **Reason:** There is no longer a global `Marionette` object.

## Recommended changes (deprecations)
These changes are optional, although recommended to make future upgrades easy

#### The default export has been deprecated
 * **Old behavior:** The package was exported as an UMD module with all classes / functions as a property of the default export
 * **New behavior:** Package is exported as a ECMAScript module using named exports. The default export with all classes still
 * **Reason:** Align with current JS standard practice, allow tree shaking
 * **Remedy:** Import each Marionette classses / functions separatedly or with `*` keyword
   Examples:
   ```javascript
   // using ES module syntax
   // old behavior
   import Mn from 'backbone.marionette';
   const MyView = Mn.View.extend({});

   // new behaviors
   // import only needed class/function
   import {View} from 'backbone.marionette';
   const MyView = View.extend({});

   // or import all (kills any chance of tree shaking)
   import * as Mn from 'backbone.marionette';
   const MyView = Mn.View.extend({});

   // or create a module that default exports all functions/classes
   // mymarionette.js -> can be configured as an alias for marionette or any other module name with webpack
   import * as Mn from 'backbone.marionette';
   export default Mn;

   // myview.js
   import Mn from './mymarionette';
   const MyView = Mn.View.extend({});


   // using CommonJS syntax

   // old behavior
   const Mn = require('backbone.marionette');
   const MyView = Mn.View.extend({});

   // new behavior
   const {View} = require('backbone.marionette');
   const MyView = View.extend({});
   ```

#### `Marionette.Object` was renamed to `Marionette.MnObject`

 * **Old behavior:** The Marionette Object class was exported as `Marionette.Object`
 * **New behavior:** The Marionette Object class is exported as `MnObject`
 * **Reason:** Avoid collision with native `Object` class when using with ES imports
 * **Remedy:** Rename `Marionette.Object` to `MnObject`. To easy transition the Object will still be available on default Marionette export

```javascript
   // using ES module syntax
   // old behavior
   import Mn from 'backbone.marionette';
   const MyObj = Mn.Object.extend({});

   // new behaviors
   // import only needed class/function
   import {MnObject} from 'backbone.marionette';
   const MyView = MnObject.extend({});
   ```
