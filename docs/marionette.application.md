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
* [Application Ownership](#application-ownership)
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

Each readiness method and `before:*` event receives the Application, the
operation options, and a context object with an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal):
`(application, options, { signal })`. When a later operation invalidates
readiness, Marionette aborts its signal before starting replacement readiness.
The signal makes cancellation cooperative; the invalidated operation still
resolves `false` even when a handler ignores it. When a start, restart, or
destroy operation adopts an in-flight stop phase, it also adopts that phase's
original options and context, and does not abort its signal.

The context belongs to the readiness phase rather than to one caller's Promise.
Completion methods and events receive only `(application, options)`.

Owned child Applications participate in the same operation. After the owner's
`before:start` readiness, children start sequentially in registration order
before the owner reaches running and emits `start`. After `before:stop`
readiness, children stop in that order before the owner reaches stopped and
emits `stop`. Restart and destroy compose those same phases.

If a direct child operation supersedes an owner-requested child start or stop,
the owner operation resolves `false`, retains its prior stable state, and does
not emit its completion event. Children that already reached the requested
state remain there. `isRunning()` describes that Application, not an aggregate
of every descendant state; callers receiving `false` can inspect child state
through the public topology. Once owner destruction begins, descendant `start`
and `restart` calls resolve `false` so they cannot interrupt terminal teardown.

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

  async onBeforeStart(app, options, { signal }) {
    const response = await fetch('/api/bootstrap', { signal });
    this.model = new MyModel(await response.json());
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

## Application Ownership

An Application may own named child Applications. A parentless Application is
the root of its composition tree; independent roots may coexist. Root and child
Applications have the same class and public API.

`addChildApp(name, application)` registers an existing live,
parentless Application instance under a non-empty string name and returns that
instance. Registration does not construct or implicitly start the child. Use
`hasChildApp(name)` before constructing a dynamic child when duplicate
allocation matters. Registering the same instance again under its existing
owner and name is an idempotent no-op. A conflicting owner or name throws
[`MN0031`](/errors/MN0031/).

Calls to `addChildApp` after either Application's destruction begins
are lifecycle-safe no-ops and return the supplied value. They do not inspect or
adopt it.

```javascript
const root = new Application();

if (!root.hasChildApp('search')) {
  root.addChildApp('search', new SearchApplication());
}

const search = root.getChildApp('search');

search.getName(); // 'search'
search.getParentApp(); // root
search.getRootApp(); // root
root.getChildApps(); // { search }
```

`getChildApps()` returns a fresh snapshot. Changing the snapshot does
not change ownership. The topology methods are reads; they do not start,
render, or otherwise mutate an Application.

Owner lifecycle options are forwarded to each child. A child failure rejects
the owner operation and leaves the owner in its last committed stable state.
Children that already reached the requested state remain there; retry visits
the same registration order, where completed child operations are idempotent.

`removeChildApp(name, options)` destroys the named child and resolves
with it after destruction. An unknown name resolves with `undefined`. A child
also removes itself from its parent's topology when destroyed directly. A
running parent stops its children before `before:destroy`, then destroys owned
children in registration order and finally emits the parent's `destroy`
completion. A parent's destroy-readiness handler can therefore inspect its
stopped, live child topology. A stopped parent also stops any child that was
started directly before entering destroy readiness. If a child's destroy
readiness fails, the parent remains live and retains that child so destruction
can be retried.

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
