# Routing in Marionette

Connect your chosen router to the application's ordinary Marionette APIs. Route
handlers can show a View or start a feature's Application. Marionette does not
export a router, depend on a routing library, or require a routing adapter.

## Using `Backbone.Router`

Import Backbone directly to use `Backbone.Router`. When the application also
uses Backbone models, collections, or state, configure the
[optional Backbone adapter](./optional-backbone.md) as shown here:

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
