# Routing in Marionette

Marionette does not export a router, depend on a routing library, or require a
routing integration protocol. Route handlers are ordinary application code and
can coordinate Marionette objects without a Marionette-specific adapter.

## Using `Backbone.Router`

Applications that choose Backbone can load the
[bundled Backbone shim](./optional-backbone.md#using-the-bundled-backbone-shim)
before constructing routers:

```javascript
import 'marionette/backbone';
import Backbone from 'backbone';

const Router = Backbone.Router.extend({
  routes: {
    '': 'home'
  },

  home() {
    // Navigate the application with its normal Marionette APIs.
  }
});

new Router();
Backbone.history.start();
```

The shim preserves the identity of [`Backbone.Router`](https://backbonejs.org/#Router)
and adds Marionette's `Events` methods to its prototype. It does not add a
Marionette router or patch `Backbone.History`; routing and history behavior remain
Backbone contracts.

## Using Other Routers

Other routing libraries can be used directly. Marionette does not require an
adapter: route handlers can invoke the application's ordinary Marionette APIs.

For the history and rationale behind removing `Marionette.AppRouter`, see the
[v3 to v4 upgrade guide](./upgrade-v3-v4.md#approuter-was-removed).
