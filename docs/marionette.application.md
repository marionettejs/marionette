# Marionette.Application

An `Application` gives a feature a place to start, stop, restart, and clean up.
It coordinates asynchronous work and child Applications, with an optional
Region for the feature's view tree.

`Application` includes:
- [Common Marionette Functionality](./common.md)
- [Class Events](./events.class.md#application-events)
- [Radio API](./radio.md#marionette-integration)
- [State API](./marionette.state.md#borrowed-and-owned-sources)

`Application` is an independent class. It does not inherit from `MnObject` and
does not add an element or render method.

The `Application` `cidPrefix` is `mna`.

## Documentation Index

* [Instantiating An Application](#instantiating-an-application)
* [Application Lifecycle](#application-lifecycle)
* [Application Ownership](#application-ownership)
* [Application and root View communication](#application-and-root-view-communication)
* [Application State](#application-state)
* [Application Region](#application-region)
* [Application Region Methods](#application-region-methods)

## Instantiating an Application

When instantiating an `Application` there are several properties, if passed,
that will be attached directly to the instance:
`channelName`, `radioEvents`, `radioRequests`, `region`, `regionClass`,
`stateEvents`

```javascript
import { Application } from 'marionette';

const myApplication = new Application();
```

### Initialization hooks

`preinitialize(options)` runs after `options` and `cid` are assigned, before
Marionette sets up the Region, Radio, and State. Use it to prepare instance
configuration those steps depend on. `initialize(options)` runs after that
setup, before State event subscriptions are connected. Owned State is still
created lazily when `getState()` is first called.

```javascript
const FeatureApplication = Application.extend({
  preinitialize(options) {
    this.channelName = options.featureName;
    this.region = { el: options.element };
  },
  initialize() {
    // The configured Region and Radio channel are now available.
  }
});
```

Both hooks receive the original constructor arguments and run synchronously;
returned Promises are not awaited. Use `onBeforeStart` for asynchronous startup
readiness.

Constructor errors propagate to the caller. Marionette does not undo partially
completed initialization or automatically release resources from a constructor
that throws. Application's asynchronous lifecycle has its own cancellation and
failure contract, described below.

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
stop waits for the already-running `onBeforeStop` readiness hook before beginning startup;
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
| Stopped | `stop(options)` | Empty a root View shown outside startup; otherwise no-op | `true` |
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

Each readiness hook and `before:*` event receives the Application, the
operation options, and a context object with an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal):
`(application, options, { signal })`. When a later operation invalidates
readiness, Marionette aborts its signal before starting replacement readiness.
The signal makes cancellation cooperative; the invalidated operation still
resolves `false` even when a handler ignores it. When a start, restart, or
destroy operation adopts an in-flight stop phase, it also adopts that phase's
original options and context, and does not abort its signal.

If a replacement start has already canceled the remaining child stops, that
stop phase is no longer adopted. A later `stop()`, `restart()`, or `destroy()`
begins a fresh stop phase with its own options and context.

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
through the public hierarchy. Once owner destruction begins, descendant `start`
and `restart` calls resolve `false` so they cannot interrupt terminal teardown.

### Starting an Application

Once configured, await `start(options)` before dispatching work that requires a
running Application. The optional argument is passed to the lifecycle methods
and events.

The application below loads a session before showing its root View. The supplied
`loadSession({ signal })` function returns a Promise for an object with a
`name` string. It can use `fetch`, a cache, or the project's existing data layer.

<!-- executable-example: application-bootstrap-readiness -->
```javascript
import { Application, View } from 'marionette';

const SessionView = View.extend({
  template: () => '<h1></h1>',
  onRender() {
    this.el.querySelector('h1').textContent = this.model.name;
  }
});

export function createSessionApplication({ el, loadSession }) {
  const SessionApplication = Application.extend({
    async onBeforeStart(app, options, { signal }) {
      const session = await loadSession({ signal });
      if (signal.aborted) return;
      this.session = session;
    },
    onStart() {
      this.showView(new SessionView({ model: this.session }));
    }
  });

  return new SessionApplication({ region: { el } });
}
```

Create and start it at the application entry point:

```javascript
const app = createSessionApplication({
  el: document.querySelector('#root-element'),
  async loadSession({ signal }) {
    const response = await fetch('/api/bootstrap', { signal });
    if (!response.ok) throw new Error(`Session request failed: ${response.status}`);
    return response.json();
  }
});

const started = await app.start();
if (started) {
  // Dispatch work that requires the running feature.
}
```

Check the readiness signal after asynchronous work and before mutating
application state. Marionette prevents a canceled operation from emitting its
success event, but cannot undo a stale assignment inside application code.
A current loader failure rejects `start()`; handle it at the application entry
point. Route registration and browser-history startup belong to the router's
owner, outside a feature's restartable `onStart` hook. See
[router integration](./routing.md) for per-navigation loading and cancellation.

## Application Ownership

An Application may own named child Applications. Ownership is one-way: an
Application locates and controls its children, while children receive required
collaborators explicitly. Internal parent references exist only to enforce
lifecycle and unlink children safely; upward lookup is not public API.

`addChildApp(name, application)` registers an existing live,
parentless Application instance under a non-empty string name and returns that
instance. Registration does not construct or implicitly start the child. Use
`hasChildApp(name)` before constructing a dynamic child when duplicate
allocation matters. Registering the same instance again under its existing
owner and name is an idempotent no-op. A conflicting owner, name, runtime, or cyclic ownership relationship throws
[`MN0031`](/errors/MN0031/).

Calls to `addChildApp` after the owner's destruction begins return the supplied
value without inspecting or adopting it. A child from the same runtime whose
destruction has begun is also returned without registration. Live registrations
require the owner and child to belong to the same Marionette runtime.

```javascript
const root = new Application();

if (!root.hasChildApp('search')) {
  root.addChildApp('search', new SearchApplication());
}

const search = root.getChildApp('search');

search.getName(); // 'search'
root.getChildApps(); // { search }
```

`getChildApps()` returns a fresh snapshot. Changing the snapshot does
not change ownership. Child lookup methods are reads; they do not start, render,
or otherwise mutate an Application.

Owner lifecycle options are forwarded to each child. A child failure rejects
the owner operation and leaves the owner in its last committed stable state.
Children that already reached the requested state remain there; retry visits
the same registration order, where completed child operations are idempotent.
An owner transition completes only after every child remains in the requested
stable state. A direct opposing child operation cancels the owner transition,
and superseding the owner from `before:start` or `before:stop` prevents the
stale transition from changing any further children.

`removeChildApp(name, options)` destroys the named child and resolves
with it after destruction. An unknown name resolves with `undefined`. A child
also removes itself from its parent's child hierarchy when destroyed directly. A
running parent stops its children before `before:destroy`, then destroys owned
children in registration order and finally emits the parent's `destroy`
completion. A parent's `onBeforeDestroy` readiness hook can therefore inspect its
stopped, live children. A stopped parent also stops any child that was
started directly before entering destroy readiness. A concurrent direct child
destroy joins terminal teardown and may remove that child before parent
readiness. If child stop or destroy readiness fails, the parent returns to its
last committed stable state and retains that child so destruction can be retried.

The canonical child-Application pattern is explicit construction followed by
ownership registration. Registration means lifecycle ownership; it is not a
dormant service registry and it has no per-child lifecycle flags. Put a service
that must outlive an Application under a longer-lived owner and pass it to the
shorter-lived child as a dependency.

<!-- executable-example: application-child-ownership -->
```javascript
import { Application } from 'marionette';

export const lifecycle = [];

const SearchApplication = Application.extend({
  onBeforeStart(app, options) {
    lifecycle.push(`search:before:start:${ options.source }`);
  },

  onStart(app, options) {
    lifecycle.push(`search:start:${ options.source }`);
  },

  onBeforeStop(app, options) {
    lifecycle.push(`search:before:stop:${ options.source }`);
  },

  onStop(app, options) {
    lifecycle.push(`search:stop:${ options.source }`);
  },

  onDestroy() {
    lifecycle.push('search:destroy');
  }
});

const RootApplication = Application.extend({
  onBeforeStart(app, options) {
    lifecycle.push(`root:before:start:${ options.source }`);
  },

  onStart(app, options) {
    lifecycle.push(`root:start:${ options.source }`);
  },

  onBeforeStop(app, options) {
    lifecycle.push(`root:before:stop:${ options.source }`);
  },

  onStop(app, options) {
    lifecycle.push(`root:stop:${ options.source }`);
  },

  onDestroy() {
    lifecycle.push('root:destroy');
  }
});

export const root = new RootApplication();
export const search = root.addChildApp('search', new SearchApplication());

export const started = await root.start({ source: 'owner' });
export const stopped = await root.stop({ source: 'owner' });
```

## Application and root View communication

Keep the ownership direction visible. The Application constructs the root View,
passes dependencies and initial values down through its options or public methods,
and listens to semantic View events for messages back up. The View should not find
its Application through DOM ancestry or private ownership fields. Use Radio only
when the sender and receiver do not share this direct ownership boundary.

<!-- executable-example: application-root-view-communication -->
```javascript
import { Application, View } from 'marionette';

export const refreshes = [];

const DashboardView = View.extend({
  initialize(options) {
    this.initialStatus = options.initialStatus;
  },

  template() {
    return '<button class="refresh">Refresh</button><p class="status"></p>';
  },

  events: {
    'click .refresh': 'requestRefresh'
  },

  onRender() {
    this.showStatus(this.initialStatus);
  },

  requestRefresh() {
    this.trigger('refresh:requested', this, { source: 'button' });
  },

  showStatus(status) {
    this.el.querySelector('.status').textContent = status;
  }
});

const DashboardApplication = Application.extend({
  region: '#dashboard',

  onStart() {
    const view = new DashboardView({ initialStatus: 'Idle' });
    this.listenTo(view, 'refresh:requested', this.refreshDashboard);
    this.showView(view);
  },

  refreshDashboard(view, request) {
    refreshes.push(request);
    view.showStatus('Updated');
  }
});

export const dashboard = new DashboardApplication();
await dashboard.start();
export const dashboardView = dashboard.getView();
```

## Application state

An Application may compose one [state source](./marionette.state.md). A supplied
`state` is borrowed; a `createState(options)` result is owned. `getState()`
returns the exact source, and `stateEvents` are installed through the selected
StateApi after `initialize`.

Application state persists across stop and restart. Destruction releases its
subscriptions, then disposes its owned state source through StateApi.
Stateless Applications allocate no source or subscription. Asynchronous startup
work must use the readiness context's abort signal before committing values so
invalidated startup cannot apply stale changes.

## Application Region

An `Application` coordinates one root View through a single
[region](./marionette.region.md). The `region` property can be
[defined in multiple ways](./marionette.region.md#defining-regions).

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

The `onStart` callback synchronously renders and shows `RootView`.
`before:render` and `render` run for its template; `before:attach` and `attach`
also run when the Region is attached to a document and lifecycle monitoring is
enabled. `start()` itself remains asynchronous.

`region` can also be passed as an option during instantiation.

The Application owns a Region that it constructs from a selector, Region class,
or definition object. Passing an existing Region instance instead borrows that
host. Stopping the Application empties the Region's current View, including one
shown directly through the Region. Destroying the Application also destroys a Region it
constructed, but never destroys a borrowed Region.

The Application's View is whatever its Region currently shows. Showing a View
through either `app.showView(view)` or `app.getRegion().show(view)` updates what
`app.getView()` returns. Emptying or detaching the Region leaves no current View
without stopping the Application. Restart removes the current View before
`onStart` may show a new View. If the Region has no View, stopping the Application
leaves any unmanaged HTML alone.

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

const myApp = new MyApp({ region: '#foo' });

myApp.getRegion().isSpecial; // true
```

`regionClass` can also be passed as an option during instantiation.

## Application Region Methods

The Marionette Application provides helper methods for managing its attached region.

### `getRegion()`

Return the current host [region object](./marionette.region.md) for the
Application, or `undefined` if none was configured. This synchronous query does
not resolve its element or render a View. The host reference is released when
the Application is destroyed.

### `showView(view, options)`

Display a `View` instance in the Region attached to the Application. This runs the
[`View lifecycle`](./view.lifecycle.md). The Application itself is never passed
to `Region#show` and does not become renderable.

This method is synchronous and returns the supplied View, forwarding `options`
to `Region#show`. Configure a Region before calling it. It does not call
`start()` or wait for Application readiness. Once destruction begins it returns
the supplied View without displaying or adopting it. A missing element allowed
by `allowMissingEl` also leaves the View caller-owned; use `getView() === view`
to check that it was shown.

### `getView()`

Return the Region's `currentView`, including a View shown directly through the
Region or before Application startup. Returns `undefined` when the Region has no
current View or the Application has no Region.
