# Common Marionette Functionality

Marionette classes share a small set of lifecycle, event, request, and option
helpers.

## Documentation Index

* [initialize](#initialize)
* [extend](#extend)
* [Events API](#events-api)
* [triggerMethod](#triggermethod)
* [bindEvents](#bindevents)
* [unbindEvents](#unbindevents)
* [bindRequests](#bindrequests)
* [unbindRequests](#unbindrequests)
* [normalizeMethods](#normalizemethods)
* [getOption](#getoption)
* [mergeOptions](#mergeoptions)
* [The `options` Property](#the-options-property)

### `initialize`

`initialize` is a no-op method that you can override on any Marionette class.
It is called when the class is instantiated and receives the constructor
arguments unchanged. The first argument is conventionally an options object.
Use [`getOption`](#getoption) to read that object together with class defaults.

```javascript
import { MnObject } from 'marionette';

const MyObject = MnObject.extend({
  initialize(options, secondArgument) {
    console.log(options.foo, this.getOption('foo'), secondArgument);
  }
});

new MyObject({ foo: 'bar' }, 'baz'); // logs "bar" "bar" "baz"
```

### `extend`

`extend` is available on Marionette class definitions for
[class-based inheritance](./basics.md#class-based-inheritance).

### Events API

Marionette classes include Marionette's owned [Events API](./events.md). Each
class can emit events and listen to other objects that implement the compatible
event interface. Backbone interoperability is available through the explicit
[`marionette/backbone` shim](./events.md#backbone-interop); the
core Events API does not require Backbone.

The Events API should not be confused with [view `events`](./dom.interactions.md#view-events),
which capture DOM events.

### `triggerMethod`

`triggerMethod` calls a matching method and then triggers an event on the
object. The first letter of each event-name segment is capitalized and `on` is
prepended:

* `triggerMethod('foo')` calls `onFoo` and triggers `foo`.
* `triggerMethod('before:foo')` calls `onBeforeFoo` and triggers `before:foo`.

Arguments after the event name are passed to both the method and event. The
matching method is resolved through `getOption`, runs first with the Marionette
object as its context, and supplies the return value of `triggerMethod`. If that
method throws, the event is not triggered.

```javascript
import { MnObject } from 'marionette';

const MyObject = MnObject.extend({
  onFoo(value) {
    return value.toUpperCase();
  }
});

const object = new MyObject();
object.on('foo', value => console.log(value));

object.triggerMethod('foo', 'bar'); // logs "bar" and returns "BAR"
```

See the [Marionette events documentation](./events.md#triggermethod) for the
complete event and method-handler contract.

### `bindEvents`

`bindEvents(entity, bindings)` uses the Marionette object's `listenTo` API to
bind events from another compatible event emitter. The binding map associates
event names with functions or method names on the listening object. The method
returns the listening object.

Marionette classes and [Radio](./radio.md) channels implement the required
event interface. Backbone models, collections, and other Backbone emitters can
participate after installing the explicit
[`marionette/backbone` shim](./events.md#backbone-interop).

An invalid binding map throws `MarionetteError` code `MN0009`. An own
enumerable `__proto__` event name is rejected with code `MN0026` before any
listener is added. This restriction applies only to entity-event maps;
Marionette's direct Events API supports `__proto__` as an ordinary event name.

### `unbindEvents`

`unbindEvents(entity, bindings)` stops the subscriptions represented by a
binding map. Without a binding map, it stops every subscription that this
Marionette object established to that entity. It does not remove listeners
owned by other objects or direct handlers registered on the entity. The method
returns the listening object.

When selectively unbinding with a map, an own enumerable `__proto__` event name
is rejected with `MarionetteError` code `MN0026` before any listener is removed.

### `bindRequests`

`bindRequests(channel, bindings)` registers replies on a [Radio](./radio.md)
channel. The binding map associates request names with functions or method names
on the Marionette object. Reply methods run with that object as their context,
and `bindRequests` returns the object.

An invalid binding map throws `MarionetteError` code `MN0010`.

### `unbindRequests`

`unbindRequests(channel, bindings)` removes the replies represented by a
binding map. Without a binding map, it removes every reply owned by this object
from that channel. Replies owned by other objects remain registered. The method
returns the object.

> **Warning:** Request bindings created manually retain their owner as reply
> context. To avoid memory leaks, call `unbindRequests` in or before
> `onBeforeDestroy`, and whenever a shorter binding lifetime ends.

`MnObject` and `Application` instead support the declarative `channelName`,
`radioEvents`, and `radioRequests` options; those owned bindings are cleaned up
when the owner is destroyed. A `View` using `bindRequests` directly should call
`unbindRequests` as part of its own cleanup.

The following example shows both event and request bindings remaining scoped to
their owner.

<!-- executable-example: common-owner-bindings -->
```javascript
import { MnObject, Radio } from 'marionette';

const source = new MnObject();
const channel = Radio.channel('common-owner-bindings');
const unrelatedMessages = [];

source.on('status', value => unrelatedMessages.push(value));
channel.reply('status:other', () => 'other');

const Owner = MnObject.extend({
  initialize() {
    this.messages = [];
    this.bindEvents(source, { status: 'onStatus' });
    this.bindRequests(channel, { 'status:current': 'getStatus' });
  },

  onStatus(value) {
    this.messages.push(value);
  },

  getStatus() {
    return this.messages[this.messages.length - 1];
  }
});

const owner = new Owner();
source.trigger('status', 'ready');
const ownerReply = channel.request('status:current'); // "ready"

owner.unbindEvents(source);
owner.unbindRequests(channel);
source.trigger('status', 'after');

const ownerReplyAfterCleanup = channel.request('status:current'); // undefined
const unrelatedReplyAfterCleanup = channel.request('status:other'); // "other"

export {
  Radio,
  owner,
  ownerReply,
  ownerReplyAfterCleanup,
  unrelatedMessages,
  unrelatedReplyAfterCleanup
};
```

### `normalizeMethods`

`normalizeMethods(bindings)` returns a fresh map with method-name strings
replaced by function references from the Marionette object. Only the map's own
enumerable string keys are normalized; inherited, symbol, and non-enumerable
properties are ignored. A literal own `__proto__` entry remains a handler key
without changing the returned object's prototype.

Every supplied handler must be a function or a string that resolves to a
callable own or inherited method on the binding context. Otherwise Marionette
throws `MarionetteError` with code `MN0019`. This invariant also applies to
event and request binding maps, including their unbind operations, and to model,
collection, Radio, and child-view event bindings.

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  initialize() {
    this.normalizedActions = this.normalizeMethods({
      'action:one': 'handleActionOne',
      'action:two': this.handleActionTwo
    });
  },

  handleActionOne() {
    console.log('action:one');
  },

  handleActionTwo() {
    console.log('action:two');
  }
});
```

### `getOption`

`getOption(name)` first reads the named value from the merged `options` object.
If that value is `undefined`, it falls back to the same property on the
instance or its prototype. Explicit option values such as `null`, `false`, `0`,
and an empty string are returned without falling back. Function values are
returned without being invoked.

### `mergeOptions`

`mergeOptions(options, keys)` copies selected option values directly onto the
class instance. `keys` must be an array; other values throw `MarionetteError`
code `MN0033` when options are present. Only requested own enumerable string
properties with values other than `undefined` are copied; inherited, symbol,
and non-enumerable properties are ignored.

### The `options` Property

A class-level `options` property supplies defaults. Marionette creates a fresh
`this.options` object for each instance by merging those defaults with the
constructor options; constructor values take precedence. The `options` argument
received by `initialize` remains the raw object supplied by the caller, so use
`getOption` when class defaults must be included.

`mergeOptions` is separate: it copies only named values directly onto the
instance for APIs that need instance properties.

<!-- executable-example: common-options -->
```javascript
import { MnObject } from 'marionette';

const service = { name: 'example' };
const Example = MnObject.extend({
  enabled: true,
  options: {
    mode: 'default'
  },

  initialize(options) {
    this.rawMode = options.mode;
    this.mergeOptions(options, ['service']);
  }
});

const example = new Example({
  enabled: false,
  service,
  extra: 'kept only in this.options'
});
const rawMode = example.rawMode; // undefined

example.getOption('mode'); // "default"
example.getOption('enabled'); // false
example.getOption('extra'); // "kept only in this.options"
console.log(example.service === service); // true

export { example, rawMode, service };
```

## Marionette Classes

Marionette provides classes for building a view tree and application structure.

[Continue Reading...](./classes.md).
