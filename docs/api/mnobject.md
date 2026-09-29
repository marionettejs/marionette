# MnObject

[API index](../api.md) · [Application](application.md) · [Shared utilities](common.md)

MnObject gives a nonvisual object Marionette's events, options, state, Radio bindings and synchronous destruction. Use it when an object needs these lifetime services. A plain function or object is enough without them; an Application is appropriate when work needs start/stop, asynchronous preparation, or owned UI.

## Track draft changes

This object records whether a borrowed draft has changed since the last `markSaved()` call. It owns its tracking state and releases its draft subscription when destroyed. It does not save data or compare the draft with a server snapshot.

```js
import { MnObject } from 'marionette';
import { Model, StateApi } from '@mnjs/data';

const DraftChanges = MnObject.extend({
  createState() { return new Model({ dirty: false }); },
  initialize({ draft }) {
    this.listenTo(draft, { change: () => this.getState().set('dirty', true) });
  },
  markSaved() { this.getState().set('dirty', false); },
}).setStateApi(StateApi);

const draft = new Model({ title: 'Untitled' });
const changes = new DraftChanges({ draft });
draft.set('title', 'Quarterly summary');
changes.getState().get('dirty'); // true
changes.markSaved();
changes.destroy();
```

The draft remains available after `changes.destroy()`. Its owner disposes it when finished. `@mnjs/data` supplies observable data here; API access and persistence require a [separate solution](../setup.md#observable-data-and-api-access).

## Construction and options

`new MnObject(options?)` merges options, assigns `cid`, configures Radio and state access, calls `initialize(options)`, then binds `stateEvents`. Radio bindings are available during initialization. State is created lazily; calling `getState()` in `initialize` is supported. There is no `preinitialize` hook.

| Option | Contract |
| --- | --- |
| `state` | Exact borrowed source, taking precedence over the class's state source and `createState`. A function remains the source itself. |
| `stateEvents` | Event-to-handler map or function returning one. Values are callbacks or MnObject method names. Observation begins after `initialize`. |
| `channelName` | Radio channel name or function returning one. Falsy disables declarative Radio setup. |
| `radioEvents`, `radioRequests` | Event/reply maps or functions returning maps, with callbacks or MnObject method names as values. See [Radio bindings](common.md#declarative-radio-bindings). |

Resolver functions run with the object as `this`. Custom options remain in `options` and are available through `getOption(name)`; they do not automatically become instance properties. `modelEvents` and `collectionEvents` are not built-in MnObject declarations. Use `listenTo` or `bindEvents` to observe a separate source.

`MnObject.extend(prototypeProperties?, staticProperties?)` defines a subclass. `cidPrefix` defaults to `'mno'`. `initialize` defaults to a no-op. Common constructors, custom constructor invocation, option utilities and binding helpers are documented in [class utilities](common.md).

## State and communication

| Member | Contract |
| --- | --- |
| `createState(options)` | Override to create owned state. Receives original constructor options; defaults to a plain object. |
| `getState()` | Returns the same owned or borrowed source for the object's lifetime. |
| `State` | StateApi provider, not the source. |
| `MnObject.setStateApi(api)` | Overlays the receiving class's StateApi and returns that class. Configure before construction. |
| `getChannel()` | Returns the configured Radio channel, or `undefined`. |
| `Radio` | Radio provider on the class/prototype; not a recognized constructor option. |

[State](state.md) defines observation and owned/borrowed disposal. [Events](events.md) covers `on`, `once`, `off`, `trigger`, `triggerMethod`, `listenTo`, `listenToOnce`, and `stopListening`. State and declarative Radio bindings stay active throughout the live object's lifetime. MnObject has no running/stopped state.

Use [declarative Radio bindings](common.md#declarative-radio-bindings) when the object's lifetime owns channel subscriptions/replies. Destruction removes all replies on the configured channel registered with this object as context, including manual `bindRequests` calls. Replies on other channels or with another context need explicit cleanup; `stopListening` only handles event subscriptions.

## Destruction and ownership

`destroy(options?)` is synchronous and returns the object. `isDestroyed()` is false until destruction commits and true before `onDestroy`. Repeated or reentrant destruction returns the same object without repeating the lifecycle.

| Event | Hook | Arguments and timing |
| --- | --- | --- |
| `before:destroy` | `onBeforeDestroy` | `(object, options)` before Radio/state cleanup, while `isDestroyed()` is false. |
| `destroy` | `onDestroy` | `(object, options)` after marking destroyed and releasing Radio bindings and owned state. Event subscriptions are cleared afterward. |

Hooks run before event subscribers. Returned Promises are ignored; complete required asynchronous work before calling `destroy()`, or use an Application lifecycle when that coordination belongs to the object. Exceptions propagate; destruction is not transactional. A throw in `before:destroy` interrupts cleanup and leaves destruction marked in progress, so calling `destroy()` again does not retry it. Keep teardown hooks synchronous and reliable.

Normal destruction releases outgoing `listenTo` subscriptions and incoming event subscriptions automatically. Final listener cleanup still runs if the `destroy` notification throws. Other subscribers on a shared data source/channel remain intact. State produced by `createState` is disposed through the configured StateApi; supplied state is borrowed and survives.

MnObject does not own arbitrary fields or constructor arguments. Assigning it to an Application field does not register it for destruction: that owner must call its `destroy()` when finished. Similarly, extra resources created by a MnObject need explicit cleanup in its lifecycle hooks. An overridden `destroy` must call the parent implementation to retain these guarantees.

There are no rendering, Region, child Application, `start`, `stop`, or `restart` methods on MnObject.

## TypeScript

Import the runtime constructor as `MnObject` and the instance contract as `MnObjectInstance` from `marionette`. `MnObjectInstance<Options, State>` describes custom options and the state source. `MnObjectConstructor` describes the extensible constructor; `extend` preserves declared methods and state inference. There is no exported `MnObjectOptions` alias. Channel and state provider types are linked from their shared contracts.
