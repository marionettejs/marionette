# Shared class utilities

Application, View, CollectionView, Region, Behavior, and MnObject share the class and instance utilities below. The Radio section applies specifically to Application and MnObject. See the [API index](../../api.md) for class-specific constructor options and lifecycle hooks.

## Define a class

`Parent.extend(prototypeProperties?, staticProperties?)` returns a child constructor. Prototype properties become instance methods and defaults; static properties belong to the constructor. The child inherits the parent's prototype and receives its enumerable static properties, including `extend`. Child properties override matching parent properties. Objects and arrays are shared values unless you create them per instance.

```js
import { View } from 'marionette';

const Panel = View.extend({
  template: false,
  title: 'Untitled',
  initialize() {
    this.el.setAttribute('aria-label', this.getOption('title'));
  }
});

const panel = new Panel({ title: 'Settings' });
```

Without a `constructor` property, the child forwards construction to its parent. A supplied `constructor` replaces that call: it must call `Parent.call(this, options)` or `Parent.apply(this, arguments)` when it needs the parent's initialization. Marionette's constructors support these calls. Prefer the class's initialization hooks for ordinary setup. An override does not automatically invoke the parent's method; call `Parent.prototype.method.call(this, ...)` when both are needed. `Child.__super__` also refers to `Parent.prototype`.

## Options and initialization

Construction creates `this.options` by shallowly combining the class's `options` object (or the result of its `options()` function) with supplied constructor options. Supplied values take precedence. The source objects are not modified. Each class copies its recognized configuration keys onto the instance; custom options remain available through `getOption`.

`initialize(...)` is a no-op extension hook called during construction with the constructor arguments, including the host View for a Behavior. It does not render a View or start an Application. Application, View, and CollectionView also expose `preinitialize(...)`; their class references describe its position in construction. Region, Behavior, and MnObject do not call a `preinitialize` hook.

| Instance method | Contract and return value |
| --- | --- |
| `getOption(name)` | Returns `this.options[name]` when it is not `undefined`; otherwise returns `this[name]`. Preserves `false`, `0`, `''`, and `null`. Does not invoke a function-valued option. An omitted/null name returns `undefined`. |
| `mergeOptions(options, keys)` | Copies listed own enumerable string properties from `options` onto this instance, skipping `undefined` values. Use an array of option names. Returns `undefined`; nullish options do nothing. |
| `normalizeMethods(bindings)` | Returns a new map with each function value preserved and each method-name string resolved on this instance/prototype. Does not bind the functions or modify the input. Falsy input returns `undefined`. A missing/nonfunction handler throws `MN0019`. |

Defaults and passed options are merged only one level deep. For example, supplying an `events` map replaces the inherited map rather than combining its keys. Resolve a combined map explicitly when that is your intent.

## Binding helpers

These helpers accept maps from a literal event/request name to a function or an instance method-name string. They resolve names using `normalizeMethods`; [Events](events.md) methods such as `listenTo` accept function references directly.

| Instance method | Contract |
| --- | --- |
| `bindEvents(source, bindings)` | Registers through `this.listenTo`, with this instance as callback context. The source needs compatible `on` and `off` methods. |
| `unbindEvents(source, bindings?)` | Removes this instance's matching subscriptions. Without bindings, removes all of its `listenTo` subscriptions to that source. Other listeners remain. |
| `bindRequests(channel, bindings)` | Registers request replies through `channel.reply(bindings, this)`, with this instance as reply context. |
| `unbindRequests(channel, bindings?)` | Removes matching replies owned by this instance. Without bindings, removes all of this instance's replies on that channel. Other owners' replies remain. |

All four return the receiver. A missing/falsy source or channel does nothing. A missing/falsy bindings map makes either bind method a no-op and either unbind method remove all matching bindings owned by the receiver. Event-binding helpers reject an own enumerable `__proto__` event key (`MN0026`).

`bindEvents` has the lifetime tracking of `listenTo`. `bindRequests` does not add request cleanup to `stopListening`; pair manually registered replies with `unbindRequests` when their owner is finished. Application/MnObject [declarative Radio configuration](#declarative-radio-bindings) has its own lifecycle integration.

See [Events and cleanup](events.md#cleanup) for subscription ownership and [state](state.md) for owned versus borrowed state.

## Declarative Radio bindings

Application and MnObject support `channelName`, `radioEvents`, and `radioRequests`. A channel name or binding map may be supplied by a function called with the owner as `this`. Map handlers are callbacks or owner method names. A falsy channel name disables setup.

`channelName` selects a channel through the owner's `Radio` provider during construction. `getChannel()` returns it, or `undefined` when no channel was configured. `radioEvents` uses event-to-handler bindings and `radioRequests` registers request replies with the owner as callback context.

On an Application, these bindings stay active while stopped as well as running; they are not gated like its `stateEvents`. On MnObject, they stay active for its live lifetime. Destruction removes all replies on the configured channel registered with this owner as context, including manual replies, and releases its subscriptions. The shared channel and other owners' registrations remain. Replies on other channels or with another context need explicit cleanup. Reassigning the declarations later does not reinitialize them. `Radio` is a prototype/provider slot, not a recognized constructor option. Use [runtime configuration](../runtime.md#isolation-and-composition) for isolated Radio instances. See the [Radio reference](../../packages/radio.md) for channel scope, events, request/reply methods, and logging. Use [binding methods](#binding-helpers) for explicit owner bindings.
