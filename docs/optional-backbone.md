# Optional Backbone

Starting with v5, Backbone is **optional**. Marionette core does not import Backbone and works against any object that satisfies the small emitter/data-shape contracts described below.

`Backbone.Model` and `Backbone.Collection` are one valid implementation of these contracts. Any other implementation — a hand-rolled adapter, a thin wrapper over a different state library, a class you ship yourself — is equally valid as long as it satisfies the protocol.

> **Note**: the contract on this page is Backbone-shaped because Marionette's internals are still Backbone-shaped. A leaner data-adapter surface is being explored for v5 before the stable release. See [Status and direction](#status-and-direction) before writing a new adapter from scratch.

## Documentation Index

* [Why this exists](#why-this-exists)
* [Listener side vs. emitter side](#listener-side-vs-emitter-side)
* [Model protocol](#model-protocol)
* [Collection protocol](#collection-protocol)
* [Events Marionette consumes](#events-marionette-consumes)
* [Worked adapter example](#worked-adapter-example)
* [Using the bundled Backbone shim](#using-the-bundled-backbone-shim)
* [Status and direction](#status-and-direction)

## Why this exists

Marionette v4 and earlier required Backbone at runtime and assumed any `model` or `collection` passed to a view was a Backbone entity. In v5, Marionette core is decoupled from Backbone so applications can:

- Ship Marionette without bundling Backbone.
- Drive Marionette views from a non-Backbone data layer.
- Continue to use Backbone exactly as before via the explicit [`marionette/backbone`](#using-the-bundled-backbone-shim) subpath.

This document describes the **minimum** Marionette needs from a model or collection. It is intentionally narrow. It is not an attempt to re-specify Backbone.

## Listener side vs. emitter side

The contract below is for **emitters** — the model or collection objects an application hands to a Marionette view, region, or behavior.

The matching **listener side** (`listenTo`, `stopListening`, `listenToOnce`, `once`) is owned by Marionette itself through its built-in `Events` mixin. Marionette views, collection views, behaviors, and `MnObject` already provide these listener methods and use them internally to subscribe to your models and collections.

**Adapter authors do not need to implement `listenTo`, `stopListening`, `listenToOnce`, or `once` on their models or collections.** Marionette will only call `.on(...)` and `.off(...)` on the emitter; it tracks its own bindings on the listener side.

## Model protocol

A value used as a `model` on a `View`, `CollectionView`, or `Behavior` must expose:

| Member | Signature | Purpose |
| --- | --- | --- |
| `cid` | `string` | Stable per-instance client id. Used by `CollectionView` to map models to child views. |
| `attributes` | `object` | Plain data object serialized into templates. |
| `get(key)` | `(key: string) => any` | Read a single attribute. Used by template helpers, view filters, and comparators. |
| `on(event, handler, context)` | `(event: string, handler: Function, context?: any) => any` | Subscribe a handler to an event. |
| `off(event?, handler?, context?)` | `(event?: string, handler?: Function, context?: any) => any` | Remove handlers. Calls may omit any trailing argument; Marionette relies on Backbone-shaped semantics where missing arguments match anything. |
| `trigger(event, ...args)` | `(event: string, ...args: any[]) => any` | Emit a named event. Arguments are forwarded verbatim to handlers. |

### Notes

- `cid` must be unique among models that may coexist in a single collection view. The exact format does not matter; uniqueness does.
- `attributes` is read directly by Marionette's default template serializer. If your model stores data elsewhere, expose a snapshot under `attributes`.
- `get` must return the attribute value associated with `key`. It is invoked from `viewComparator` and `viewFilter` paths and from user-defined templates.
- The emitter is not required to implement `listenTo`, `stopListening`, `once`, or any other listener-side method. See [Listener side vs. emitter side](#listener-side-vs-emitter-side).

## Collection protocol

A value used as a `collection` on a `CollectionView` (or on a `View` for `collectionEvents`) must expose the emitter methods listed for models — `on`, `off`, `trigger` — plus:

| Member | Signature | Purpose |
| --- | --- | --- |
| `models` | `Array<Model>` | Ordered array of model instances. `CollectionView` iterates this to build and order child views. |
| `indexOf(model)` | `(model: Model) => number` | Returns the index of `model` in `models`, or `-1`. Used to keep child view order in sync with collection order. |

`models` must be an array (or array-like with the same index/length semantics). Each element must satisfy the [model protocol](#model-protocol).

### Mutation

Marionette never mutates `models` directly. Applications are free to manage the collection's contents in whatever way they like (push, splice, reassign), as long as the appropriate events fire after the mutation completes.

## Events Marionette consumes

`CollectionView` subscribes to a small set of Backbone-shaped collection events when a `collection` is attached. Adapter authors must fire these with the documented payloads if they want sort and update behavior to work:

| Event | Arguments | When to fire |
| --- | --- | --- |
| `sort` | `(collection, options)` | After the order of `models` has changed without add/remove/merge. If `options.add`, `options.remove`, or `options.merge` is truthy, `CollectionView` defers ordering to the matching `update`. |
| `reset` | `(collection, options)` | After `models` has been wholly replaced. `CollectionView` rebuilds all children. |
| `update` | `(collection, options)` | After one or more models have been added or removed. `options.changes` must be `{ added: Model[], removed: Model[], merged: Model[] }`. |

`add`, `remove`, and `change` are part of the broader Backbone event shape that Marionette **passes through** to user-defined `collectionEvents` and `modelEvents`. They are documented here for completeness:

| Event | Arguments | When to fire |
| --- | --- | --- |
| `add` | `(model, collection, options)` | After a model has been added to the collection. |
| `remove` | `(model, collection, options)` | After a model has been removed from the collection. |
| `change` | `(model, options)` | After one or more attributes on a model have changed. Marionette does not consume `change` internally; it is forwarded to `modelEvents` bindings. |

Adapter authors who do not need sort-with-collection or update-driven child management can omit `sort` and `update` and rebuild via `reset`. The minimum useful surface is whatever events the application's `collectionEvents` / `modelEvents` reference.

## Worked adapter example

The following is a deliberately minimal non-Backbone adapter. It is enough to drive a `CollectionView` and is intended as a starting point, not a production data layer.

```javascript
// A tiny event emitter that satisfies Marionette's emitter contract.
class Emitter {
  constructor() {
    this._handlers = [];
  }

  on(event, handler, context) {
    this._handlers.push({ event, handler, context });
    return this;
  }

  off(event, handler, context) {
    this._handlers = this._handlers.filter(h => {
      if (event && h.event !== event) { return true; }
      if (handler && h.handler !== handler) { return true; }
      if (context && h.context !== context) { return true; }
      return false;
    });
    return this;
  }

  trigger(event, ...args) {
    for (const h of this._handlers.slice()) {
      if (h.event === event) {
        h.handler.apply(h.context, args);
      }
    }
    return this;
  }
}

let cidSeq = 0;

class AdapterModel extends Emitter {
  constructor(attributes = {}) {
    super();
    this.cid = `m${++cidSeq}`;
    this.attributes = { ...attributes };
  }

  get(key) {
    return this.attributes[key];
  }

  set(key, value) {
    this.attributes[key] = value;
    this.trigger(`change:${key}`, this, value);
    this.trigger('change', this);
  }
}

class AdapterCollection extends Emitter {
  constructor(models = []) {
    super();
    this.models = models.map(m => m instanceof AdapterModel ? m : new AdapterModel(m));
  }

  indexOf(model) {
    return this.models.indexOf(model);
  }

  add(model) {
    const m = model instanceof AdapterModel ? model : new AdapterModel(model);
    this.models.push(m);
    this.trigger('update', this, { changes: { added: [m], removed: [], merged: [] } });
    return m;
  }

  remove(model) {
    const idx = this.models.indexOf(model);
    if (idx === -1) { return; }
    this.models.splice(idx, 1);
    this.trigger('update', this, { changes: { added: [], removed: [model], merged: [] } });
  }

  reset(models = []) {
    this.models = models.map(m => m instanceof AdapterModel ? m : new AdapterModel(m));
    this.trigger('reset', this, {});
  }
}
```

Used with a `CollectionView`:

```javascript
import { CollectionView, View } from 'marionette';

const ChildView = View.extend({
  tagName: 'li',
  template: ({ name }) => name
});

const ListView = CollectionView.extend({
  tagName: 'ul',
  childView: ChildView
});

const collection = new AdapterCollection([
  { name: 'one' },
  { name: 'two' }
]);

const list = new ListView({
  el: document.querySelector('#app'),
  collection
});

list.render();

collection.add({ name: 'three' }); // CollectionView appends a new <li>
```

This adapter is sufficient for `CollectionView` rendering, child view ordering driven by `update`, and full reset. Add `sort` emission if `sortWithCollection` is in play, and `change` emission on models if templates depend on attribute changes.

## Using the bundled Backbone shim

Applications that already use Backbone do not need to write any of the above. Marionette ships a small shim at the `marionette/backbone` subpath that wires Marionette's `Events` mixin onto `Backbone.Model`, `Backbone.Collection`, `Backbone.View`, and `Backbone.Router`:

```javascript
import 'marionette/backbone';
```

Importing this module is the v5 equivalent of "Marionette uses Backbone." It is a side-effect import that mutates Backbone's prototypes; it does not re-export a `Mn` namespace and does not change Marionette's public surface.

The shim is the recommended path for applications migrating from v4 and for any application that mixes Backbone classes with Marionette classes — particularly when a Backbone class is on the **listener side** (for example a `Backbone.View` subclass calling `listenTo`). The shim swaps Backbone's `Events` for Marionette's `Events` on all four Backbone prototypes so listener-side bookkeeping stays consistent across the two libraries.

A plain `Backbone.Model` or `Backbone.Collection` already satisfies the emitter protocol on this page without the shim, because Marionette only calls `.on(...)`, `.off(...)`, and reads `.cid` / `.attributes` / `.get(...)` / `.models` / `.indexOf(...)` on the emitter. The shim is not required just to use Backbone entities with Marionette views.

The protocol on this page is broader than the shim. The shim is one implementation of the protocol; this page describes the protocol itself.

## Status and direction

This page describes the contract Marionette **currently** consumes in v5. That contract is Backbone-shaped because Marionette's internals are still Backbone-shaped — for example, the default template serializer reads `model.attributes` and `collection.models` directly, and `CollectionView` reacts to `update` events whose payload carries `options.changes.{added, removed, merged}`. Adapter authors writing against a non-Backbone data layer today must produce those shapes.

A leaner data-adapter surface is being explored as part of v5 before the stable release. Likely directions include:

- A single `subscribe(listener) => unsubscribe` channel in place of named `on` / `off` / `trigger` events on the emitter.
- A `serialize(entity)` (or similar) hook so views no longer read `attributes` off the entity directly.
- Caller-supplied identity (a `keyFor(item)` callback) instead of `cid` living on the entity.
- A snapshot-style read for collection contents instead of a mutable `models` array.

If you are writing a new non-Backbone adapter, the safest hedge is to **keep it thin**: a small class whose only job is to map your real data source to the shapes documented above. When the leaner surface lands, that thin layer is what changes; your application code does not.

Tracking and design discussion for the v5 data-adapter surface lives in the v5 plan tracker (see [#40](https://github.com/marionettejs/marionette/issues/40) and [#18](https://github.com/marionettejs/marionette/issues/18)). Specifics of this contract — field names, event shapes — are not yet stable for v5 final.
