# Entity events

[`View`, `CollectionView`, and `Behavior`](./classes.md) can declaratively
listen to events from an attached `model` or `collection`. The configured
[`DataApi.subscribe()`](./data.api.md#adapter-contract) owns the entity's
subscription and teardown mechanics; Backbone is optional.

## Handler ownership and arguments

`modelEvents` and `collectionEvents` map entity event names to method names or
function callbacks. Entity arguments pass through unchanged.

- A View or CollectionView handler runs with that View or CollectionView as
  `this`.
- A Behavior listens to its owning View's `model` and `collection`, but its
  handler runs with the Behavior as `this`. Use `this.view` to reach the owner.

<!-- executable-example: entity-events-ownership -->
```javascript
import { Behavior, Events, View } from 'marionette';

class Model {}
Object.assign(Model.prototype, Events);

const StatusBehavior = Behavior.extend({
  modelEvents() {
    this.modelEventsResolutionCount = (this.modelEventsResolutionCount || 0) + 1;
    return {
      'change:status': 'onStatus'
    };
  },

  onStatus(model, status) {
    this.view.behaviorCall = {
      arguments: [model, status],
      owner: this
    };
  }
});

const StatusView = View.extend({
  behaviors: [StatusBehavior],

  modelEvents() {
    this.modelEventsResolutionCount = (this.modelEventsResolutionCount || 0) + 1;
    return {
      'change:status': 'onStatus'
    };
  },

  onStatus(model, status) {
    this.viewCall = {
      arguments: [model, status],
      owner: this
    };
  }
});

const model = new Model();
const view = new StatusView({ model });

model.trigger('change:status', model, 'ready');

export { Model, model, view };
```

Function callbacks are also supported directly:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  collectionEvents: {
    update(collection, options) {
      console.log('Added models:', options.changes.added);
    }
  }
});
```

If a View has both entities, Marionette delegates both maps:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  modelEvents: {
    'change:status': 'render'
  },

  collectionEvents: {
    update: 'render'
  }
});
```

## Resolver and delegation lifecycle

Each map may be a function returning an object. Marionette calls the resolver
with its owner as `this` and no arguments whenever `delegateEntityEvents()`
performs a delegation. The resolved map is cached for the matching
`undelegateEntityEvents()` call.

Initial entity-event delegation happens after the View or CollectionView's
`initialize` method returns. Assigning a different `model` or `collection`
later does not automatically move existing subscriptions. Undelegate while the
old entity is still assigned, replace it, and then delegate the new entity:

```javascript
view.undelegateEntityEvents();
view.model = replacementModel;
view.delegateEntityEvents();
```

Do not use repeated `delegateEntityEvents()` calls as an idempotent refresh;
delegate only after the matching undelegation.

After a View or CollectionView's destruction completes successfully, its tracked
entity subscriptions have been removed. Once destruction starts, its base
`delegateEntityEvents()` returns the same instance without resolving its maps or
delegating the attached Behaviors' maps. A direct
`Behavior#delegateEntityEvents()` call also returns the Behavior without
resolving maps or binding once its owning View's destruction starts. These
guards derive from the host lifecycle only; reusing a Behavior after calling
`Behavior#destroy()` while its host remains live is outside this contract. A
custom override owns its behavior unless it delegates to the guarded base
method. `undelegateEntityEvents()` remains available during teardown so cleanup
can complete.

## Event-map names

Entity-event maps cannot contain an own enumerable `__proto__` event name.
Marionette throws `MarionetteError` code `MN0026` before binding or selectively
unbinding such a map because third-party entity event implementations may not
safely store that name.

Marionette does not reject other names inherited from `Object.prototype`, such
as `constructor` and `toString`. Marionette's Events API supports those names
and continues to support `__proto__`, but third-party emitters may not safely
support every prototype-collision name.

## Backbone entities

A plain `Backbone.Model` or `Backbone.Collection` satisfies the default
subscription protocol for event-only use. The canonical Backbone setup is still
to import the integration before constructing entities or Views; it also selects
Backbone identity, reads, serialization, ordered model snapshots, structural
observations, and unified listener bookkeeping:

```javascript
import 'marionette/backbone';
import Backbone from 'backbone';
import { View } from 'marionette';

const model = new Backbone.Model();
const view = new View({ model });
```

See [Optional Backbone](./optional-backbone.md) for the integration's exact boundary.
