# Marionette.Application

The `Application` is Marionette's non-renderable lifecycle scope. It provides
asynchronous start, stop, restart, and destroy coordination plus an optional
Region for a view tree.

`Application` includes:
- [Common Marionette Functionality](./common.md)
- [Class Events](./events.class.md#application-events)
- [Radio API](./radio.md#marionette-integration)

`Application` is an independent class. It does not inherit from `MnObject` and
does not add an element or render method.

The `Application` `cidPrefix` is `mna`.

## Documentation Index

* [Instantiating An Application](#instantiating-an-application)
* [Application Lifecycle](#application-lifecycle)
* [Application Region](#application-region)
* [Application Region Methods](#application-region-methods)

## Instantiating an Application

When instantiating a `Application` there are several properties, if passed,
that will be attached directly to the instance:
`channelName`, `radioEvents`, `radioRequests`, `region`, `regionClass`

```javascript
import { Application } from 'marionette';

const myApplication = new Application({ ... });
```

## Application Lifecycle

`start`, `stop`, `restart`, and `destroy` return a `Promise<boolean>`. The
Promise resolves `true` when the requested target state is reached, including
an idempotent call when that state is already current. It resolves `false` when
a later incompatible operation supersedes the request. `false` is cancellation,
not failure. A current lifecycle hook failure rejects its operation Promise.

Compatible repeated calls share the in-flight Promise. Before destruction
begins, the latest incompatible operation wins: for example, `stop()` during
startup resolves the earlier `start()` as `false`, completes the stop lifecycle,
and prevents a stale `start` event. A `start()` that supersedes an in-flight
stop waits for the already-running stop-readiness hook before beginning startup;
it does not emit the invalidated `stop` completion. Once destruction begins it is terminal;
`start()` and `restart()` resolve `false`, while `stop()` follows the active
teardown until it has reached a stopped or destroyed state. Completion of an
invalidated asynchronous hook cannot change the Application's running or
destroyed state or emit the invalidated success event.

`isRunning()` is `true` only after startup readiness completes and while the
Application is running. It is `false` before the first start, during lifecycle
transitions, after stop, and after destroy.

### Lifecycle operations

| Current condition | Operation | Lifecycle | Result |
| --- | --- | --- | --- |
| Not running | `start(options)` | `before:start`, await readiness, `start` | `true` when running |
| Running | `start(options)` | No-op | `true` |
| Running or starting | `stop(options)` | Invalidates startup when needed, then `before:stop`, `stop` | `true` when stopped; the invalidated start resolves `false` |
| Stopped | `stop(options)` | No-op | `true` |
| Any live, non-destroying state | `restart(options)` | Stop when needed, then start | `true` when running |
| Running or starting | `destroy(options)` | Stop when needed, then `before:destroy`, `destroy` | `true` when destroyed |
| Stopped | `destroy(options)` | `before:destroy`, `destroy` | `true` when destroyed |
| Destroying | repeated `destroy()` | Shares the active destroy lifecycle | Same in-flight Promise |
| Destroying | `start()` or `restart()` | Terminal no-op | `false` |
| Destroying | `stop()` | Follows active teardown without interrupting it | `true` once stopped or destroyed; rejects if teardown fails before stopping |
| Destroyed | `start()` or `restart()` | Terminal no-op | `false` |
| Destroyed | `stop()` or `destroy()` | Terminal no-op | `true` |

The `onBeforeStart`, `onBeforeStop`, and `onBeforeDestroy` methods may return a
Promise. Their corresponding `before:*` events still fire synchronously, but
event-listener return values are not readiness inputs. `onStart`, `onStop`,
`onDestroy`, and their matching events are completion notifications and are not
awaited. A `before:*` method must not await the same operation whose readiness it
is defining. `restart` composes the stop and start lifecycles; it does not add a
parallel restart hook path.

### Starting an Application

Once configured, await `start(options)` before dispatching work that requires a
running Application. The optional argument is passed to the lifecycle methods
and events.

```javascript
import Bb from 'backbone';
import { Application } from 'marionette';

const MyApp = Application.extend({
  region: '#root-element',

  initialize(options) {
    console.log('Initialize');
  },

  onBeforeStart(app, options) {
    this.model = new MyModel(options.data);
  },

  onStart(app, options) {
    this.showView(new MyView({model: this.model}));
    Bb.history.start();
  }
});

const myApp = new MyApp();

const started = await myApp.start({
  data: {
    id: 1,
    text: 'value'
  }
});

if (!started) {
  // A later stop, restart, or destroy superseded this startup.
}
```

[Live example](https://jsfiddle.net/marionettejs/k05dctyt/)

## Application Region

An `Application` provides a single [region](./marionette.region.md) for attaching a view tree.
The `region` property can be [defined in multiple ways](./marionette.region.md#defining-regions)

```javascript
import { Application } from 'marionette';
import RootView from './views/root';

const MyApp = Application.extend({
  region: '#root-element',

  onStart() {
    this.showView(new RootView());
  }
});

const myApp = new MyApp();
await myApp.start();
```

[Live example](https://jsfiddle.net/marionettejs/uzc8or6u/)

This will immediately render `RootView` and fire the usual triggers such as
`before:attach` and `attach` in addition to the `before:render` and `render`
triggers.

`region` can also be passed as an option during instantiation.

### `regionClass`

By default the [`Region`](./marionette.region.md) is used to instantiate the `Application`'s region.
An extended Region can be provided to the `Application` definition to override the default.

```javascript
import { Application, Region } from 'marionette';

const MyRegion = Region.extend({
  isSpecial: true
});

const MyApp = Application.extend({
  regionClass: MyRegion
});

const myApp = new Application({ region: '#foo' });

myApp.getRegion().isSpecial; // true
```

`regionClass` can also be passed as an option during instantiation.

## Application Region Methods

The Marionette Application provides helper methods for managing its attached region.

### `getRegion()`

Return the attached [region object](./marionette.region.md) for the Application.

### `showView(view)`

Display a `View` instance in the region attached to the Application. This runs the [`View lifecycle`](./view.lifecycle.md).

### `getView()`

Return the view currently being displayed in the Application's attached
`region`. If the Application is not currently displaying a view, this method
returns `undefined`.
