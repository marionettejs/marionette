# Routing in Marionette

Marionette does not export a router, depend on a routing library, or require a
routing integration protocol. Route handlers are ordinary application code and
can coordinate Marionette objects without a Marionette-specific adapter.

## Using `Backbone.Router`

Applications that choose Backbone can load the
[optional Backbone adapter](./optional-backbone.md)
before constructing routers:

```javascript
import BackboneApi from '@marionette/adapters/backbone';
import Backbone from 'backbone';
import { setDataApi, setStateApi } from 'marionette';

setDataApi(BackboneApi);
setStateApi(BackboneApi);

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

The integration does not modify [`Backbone.Router`](https://backbonejs.org/#Router)
or `Backbone.History`; routing, history, and their native event behavior remain
Backbone contracts. Marionette does not add a separate router.

## Using Other Routers

Other routing libraries can be used directly. Marionette does not require an
adapter: route handlers can invoke the application's ordinary Marionette APIs.

For the history and rationale behind removing `Marionette.AppRouter`, see the
[v3 to v4 upgrade guide](./upgrade-v3-v4.md#approuter-was-removed).
