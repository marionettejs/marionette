# Events

Application, View, CollectionView, Region, Behavior, and MnObject provide these synchronous event APIs. This page describes object events; see [View runtime](view-runtime.md) for DOM bindings and child event forwarding, and [state](state.md) for provider-based state observation.

## Names, maps, and callback context

An event name is one literal string. Colons are a naming convention; spaces do **not** separate multiple events. Use a map to register several names. Map keys are own enumerable string properties and map values must be functions, not method-name strings. The [binding helpers](common.md#binding-helpers) additionally accept method names.

```js
import { View } from 'marionette';

const listener = new View({ template: false });
const source = new View({ template: false });

listener.listenTo(source, {
  selected(view) { this.selectedView = view; },
  cleared() { this.selectedView = undefined; }
});

source.trigger('selected', source);
source.destroy();
listener.destroy();
```

`on`/`once` call ordinary functions with the supplied context, or the source as `this` when no truthy context is supplied. `listenTo`/`listenToOnce` use the listening object as context. Arrow functions retain their lexical `this`.

## Subscribe and unsubscribe

| Method | Contract |
| --- | --- |
| `on(name, callback, context?)` / `on(map, context?)` | Adds callbacks to this source. Repeated registrations add repeated calls. |
| `once(name, callback, context?)` / `once(map, context?)` | Registers a separate one-time callback per name. Each is removed before being invoked, including if it throws or triggers the same event recursively. |
| `off(name?, callback?, context?)` / `off(map, context?)` | Removes callbacks on this source that match all supplied filters. An omitted/null name matches every name. `off()` removes all callbacks, including other objects' subscriptions to this source. |
| `listenTo(source, name, callback)` / `listenTo(source, map)` | Subscribes to another source and records the subscription on this listener. The source must implement compatible `on(name, callback, context)` and `off(name, callback, context)` methods. A nullish source does nothing. |
| `listenToOnce(source, name, callback)` / `listenToOnce(source, map)` | The tracked form of `once`. Each mapped name has an independent one-time callback. |
| `stopListening(source?, name?, callback?)` / `stopListening(source, map)` | Removes this listener's matching subscriptions. Omit the name to remove all its subscriptions to the source; omit the source to select all its sources. `stopListening()` removes every tracked subscription. |

All methods in this table return the receiver. Removing a one-time callback can use the original function reference. For selective removal, retain the same function reference used to subscribe; creating a new arrow function does not match the old one. The map forms of `on`, `once`, and `off` also accept a third explicit context argument, which takes precedence over the second when it is not `undefined`.

## Trigger events and hooks

| Method | Contract and return value |
| --- | --- |
| `trigger(name, ...args)` | Synchronously calls that event's listeners with the supplied arguments, followed by `all` listeners with `(name, ...args)`. Returns the source. |
| `triggerMethod(name, ...args)` | Calls the matching instance/prototype hook, then triggers the event with the same arguments. Returns the hook's result, or `undefined` if no callable hook exists. |

`triggerMethod('before:render', view)` calls `onBeforeRender(view)` before emitting `before:render`. Each colon-separated segment begins with a capital letter in the hook name. Hooks come from the instance/prototype, not from `options`.

Delivery is synchronous and follows registration order for each event. Callback return values do not cancel an event. A synchronous exception stops the dispatch and propagates to the caller. If the hook throws, `triggerMethod` does not emit the event. Returned Promises are not awaited: an asynchronous hook's result is returned while event listeners run immediately.

An `all` subscription observes event names as well as payloads. It is useful for event forwarding; ordinary feature subscriptions should name the intent they need.

## Cleanup

Destroying a native Marionette object removes its outgoing `listenTo` subscriptions and its incoming callbacks after its final destruction notifications. Native listener bookkeeping is released too: a retained Application does not need a `destroy` handler that calls `stopListening(view)` for each replaced View. Native `@mnjs/data` Models and Collections also release events on destruction.

Application `stop()` preserves subscriptions to surviving sources; it is not Application destruction. Use `stopListening(source, ...)` when a subscription's useful lifetime ends before either object is destroyed. `off()` removes incoming callbacks; `stopListening()` removes outgoing subscriptions. Neither is a substitute for the other's direction.

External sources follow their own cleanup contracts. If an external source can end while its Marionette listener survives, release the listener's subscription explicitly unless the source's integration guarantees equivalent cleanup. Emitting an event named `destroy` alone does not destroy an object or clear subscriptions.

[API index](../api.md) · [Shared utilities](common.md) · [View runtime configuration](view-runtime.md)
