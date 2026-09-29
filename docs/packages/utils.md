# @mnjs/utils

Shared utilities for components that need Marionette's conventions without importing its UI classes. Marionette, Radio, and native data use these same implementations. Add `@mnjs/utils` as a direct dependency when your code imports it, using the same candidate version as core; see [installation](../quick-start.md#obtain-the-development-candidate).

## Component methods

`Events` supplies the [shared Events contract](../api/shared/events.md). The other methods below use their receiver as the owner. Mix them into a component or call them with `.call(owner, ...)`. A plain component has no automatic destruction lifecycle: release the subscriptions and replies it owns when it is finished.

```js
import { Events, getOption, triggerMethod, bindEvents, unbindEvents } from '@mnjs/utils';

const source = Object.assign({}, Events);
const component = {
  ...Events, getOption, triggerMethod, bindEvents, unbindEvents,
  options: { label: 'Inbox' },
  onOpen() { return this.getOption('label'); },
  onChanged(label) { this.options.label = label; }
};
component.bindEvents(source, { changed: 'onChanged' });
source.trigger('changed', 'Archive');
const label = component.triggerMethod('open');
component.unbindEvents(source);
```

| Export | Contract |
| --- | --- |
| `getOption(name)` | [Option lookup](../api/shared/common.md#options-and-initialization): defined values in `this.options` take precedence over `this[name]`; functions are returned, not invoked. Accepts string, number, or symbol keys, including `0` and `''`. A nullish/omitted name returns `undefined`. |
| `mergeOptions(options, keys)` | [Selected option copying](../api/shared/common.md#options-and-initialization). Returns `undefined`; an own enumerable `__proto__` option is copied as a data property without changing the receiver's prototype. |
| `normalizeMethods(bindings)` | [Method-name resolution](../api/shared/common.md#options-and-initialization). Returns a new function map or `undefined` for falsy input; resolves own enumerable entries without binding or subscribing. |
| `triggerMethod(event, ...args)` | Calls the matching `onEvent` hook before triggering the event; returns the hook's result without awaiting it. See [hook dispatch](../api/shared/events.md#trigger-events-and-hooks). |
| `bindEvents(source, bindings)` / `unbindEvents(source, bindings?)` | [Event binding helpers](../api/shared/common.md#binding-helpers), requiring the receiver's `listenTo` / `stopListening`. Return the receiver. |
| `bindRequests(channel, bindings)` / `unbindRequests(channel, bindings?)` | [Request binding helpers](../api/shared/common.md#binding-helpers), registering replies with the receiver as context. Return the receiver; `stopListening` does not remove replies. |

## Value and method resolution

| Export | Arguments and result |
| --- | --- |
| `getValue(object?, key?, fallback?)` | Reads `object[key]`; only `undefined` selects the fallback. If the selected value is a function, calls it with `object` as `this` and no arguments. A nullish object selects the fallback. |
| `resolveMethod(context, method, name)` | Returns a supplied function unchanged, or resolves a string/boxed-string method name on the context/prototype. `name` identifies the binding in the `MN0019` error when resolution fails. Does not bind the function. |
| `normalizeBindings(context, bindings)` | Returns a resolved function map, without subscribing. Like `normalizeMethods.call(context, bindings)`, but rejects an own enumerable `__proto__` event key with `MN0026`. Pass a bindings object. |

These operations are synchronous. Getters and callbacks can throw; errors propagate to the caller.

```js
import { getValue, resolveMethod, normalizeBindings } from '@mnjs/utils';

const settings = { prefix: 'Team', title() { return `${this.prefix} inbox`; } };
const title = getValue(settings, 'title');
const fallback = getValue(settings, 'missing', 'Inbox');
const handler = resolveMethod(settings, 'title', 'read:title');
const bindings = normalizeBindings(settings, { 'read:title': 'title' });
```

## Constructors and errors

`extend.call(Parent, prototypeProperties?, staticProperties?)` creates a child function constructor. See [class extension](../api/shared/common.md#define-a-class) for forwarding, initialization, shared prototype values, and `__super__`. Prototype/static copying evaluates enumerable accessors. Inherited enumerable parent statics are copied too. Extending a native `class` requires an explicit constructor that constructs the parent; the default forwarding uses `Parent.apply`, which native classes do not support. Prefer ordinary `class extends` for native classes.

`MarionetteError` is the same constructor exported by core; see [errors and diagnostics](../api/errors.md).

## Small standalone helpers

| Export | Arguments and result |
| --- | --- |
| `isString(value)` | Returns whether the value has the String tag, including primitive and boxed strings. Does not coerce the value to a string. |
| `setProperty(target, key, value)` | Assigns a property and returns `undefined`. For `__proto__`, defines an own writable, enumerable, configurable data property without replacing the target prototype. |
| `uniqueId(prefix?)` | Returns the next decimal sequence ID as a string, with an optional string prefix. One counter belongs to each loaded utils module instance, independent of other libraries. It is not a persistent or globally unique ID. |

## Event-building helpers

Most components should use `Events` directly. These exports support custom event implementations; they do not register subscriptions or create an owner lifetime.

| Export | Arguments and result |
| --- | --- |
| `buildEventArgs(nameOrMap, callback?, context?, listener?)` | Returns descriptors shaped `{ name, callback, context, listener }`. A literal name produces one descriptor; an object produces one for each own enumerable key in key order. Names are not split on whitespace. For map input, the second argument supplies context when the third is `undefined`. |
| `callHandler(callback, context, args?)` | Calls the function with the supplied receiver and an array or `arguments` object, defaulting to no arguments. Returns its result. |
| `onceWrap(callback, offCallback)` | Returns a wrapper that calls `offCallback(wrapper)` before its first callback invocation, forwarding its receiver and arguments. Later calls return the saved result. It is consumed before cleanup, so recursive calls or calls after cleanup/callback failure do not retry. Errors propagate; until a result is saved, repeated calls return `undefined`. |

```js
import { buildEventArgs, callHandler, onceWrap, uniqueId, setProperty, isString } from '@mnjs/utils';

const receiver = { prefix: 'Hello' };
const greet = function(name) { return `${this.prefix}, ${name}`; };
const descriptors = buildEventArgs({ greet }, receiver);
const greeting = callHandler(greet, receiver, ['Ada']);
const removals = [];
const greetOnce = onceWrap(greet, wrapper => removals.push(wrapper));
const first = greetOnce.call(receiver, 'Ada');
const repeated = greetOnce.call(receiver, 'Grace');
const key = uniqueId('component-');
const values = {};
setProperty(values, key, first);
const isLabel = isString(first);
```

## Types and entrypoints

The package supplies ESM, CommonJS, and TypeScript declarations and has no runtime dependencies. Import from `@mnjs/utils`; there are no public helper subpaths. Bundlers can retain imported helpers because the package declares no side effects.

Type exports include `Bindings`, `EventCallback`, `EventMap`, `EventSource`, `EventMethods`, `EventsContract`, `MarionetteErrorInstance`, `MarionetteErrorConstructor`, and the extension composition types `Merge`, `Constructed`, and `CallableParent`. `Bindings` accepts method-name maps whose handlers are checked at runtime. Value-resolution helpers return `unknown`; narrow their results before using them as application values.

```ts
import { getValue, callHandler, type EventMap } from '@mnjs/utils';

const value: unknown = getValue({ label: 'Inbox' }, 'label');
const label: string = typeof value === 'string' ? value : '';
const handlers: EventMap = { open() {} };
const count: number = callHandler((value: number) => value + 1, undefined, [1]);
void [label, handlers, count];
```
