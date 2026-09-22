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
* [Mount loading UI before readiness](#mount-loading-ui-before-readiness)
* [Application Ownership](#application-ownership)
* [Application and root View communication](#application-and-root-view-communication)
* [Subscription lifetime across stop and restart](#subscription-lifetime-across-stop-and-restart)
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
Marionette sets up the Region, Radio, State, and declared children. Use it to prepare instance
configuration those steps depend on. `initialize(options)` runs after that
setup, including child registration, before State event subscriptions are connected. Owned State is still
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
returned Promises are not awaited. Use `prepareStart` for asynchronous startup
readiness.

Constructor errors propagate to the caller. Marionette does not undo partially
completed initialization or automatically release resources from a constructor
that throws. See the shared [synchronous failure boundary](./view.lifecycle.md#synchronous-failures).
Application's asynchronous lifecycle has its own cancellation and failure contract,
described below.

## Application Lifecycle

`start`, `stop`, `restart`, and `destroy` return a `Promise<boolean>`. The
Promise resolves `true` when the requested target state is reached, including
an idempotent call when that state is already current. It resolves `false` when
a later incompatible operation supersedes the request. `false` is cancellation,
not failure. A current lifecycle hook failure rejects its operation Promise.

Compatible repeated calls share the in-flight Promise. For `restart()`, this
coalescing ends before the `onStart`/`start` completion notification: a restart
requested there begins a new cycle with its own options and Promise. The completed
cycle remains successful if that new cycle later fails or is canceled. An
unconditional restart on every start notification therefore creates a loop.
Completion notifications are synchronous; Marionette does not await their return
values or automatically wait for a cycle they initiate. Before destruction
begins, the latest incompatible operation wins: for example, `stop()` during
startup resolves the earlier `start()` as `false`, completes the stop lifecycle,
and prevents a stale `start` event. A `start()` that supersedes an in-flight
stop waits for the already-running `prepareStop` method before beginning startup;
it does not emit the invalidated `stop` completion. Once destruction begins it is terminal;
`start()` and `restart()` resolve `false`, while `stop()` follows the active
teardown until it has reached a stopped or destroyed state. Completion of an
invalidated asynchronous hook cannot change the Application's running or
destroyed state or emit the invalidated success event.

`isRunning()` describes the active run. It becomes `true` after startup readiness,
before `onStart`, and stays `true` while stop permission or descendant stopping is
pending, including a restart's stop phase. Rejected or canceled stop preserves the
active run. It becomes `false` before successful stop tears down the root, during
startup preparation, and immediately when terminal destruction begins. If
destruction's stop preparation fails before the previous run is stopped, its
running state is restored. It does not report whether a lifecycle operation is
pending.

### Cleanup and stop permission

`onBeforeStop` announces a stop attempt; `prepareStop` supplies its readiness.
Neither means the active run has ended. Keep listeners, request ownership, and
services needed by that run available while permission is pending. Use `onStop`
for synchronous cleanup after successful stopping, such as removing per-run
listeners or invalidating outstanding display requests. Waiting until destruction
alone leaves those resources installed across ordinary stop/restart cycles.

Do not destroy a required service in `prepareStop` merely to await its cleanup.
For example, `removeChildApp('service')` destroys that child; a later readiness
failure cannot restore it. Parent/child stopping is not transactional: children
already stopped before another child fails remain stopped. See
[child ownership](#registering-and-controlling-children) for the partial-failure contract.

Moving asynchronous disposal into `onStop` does not make it awaited. Choose the
service's ownership and readiness policy explicitly when its disposal must finish
before another run can use it. Resources acquired during startup also need a
cancellation/rejection cleanup path; successful-stop cleanup alone does not cover
failed preparation. A replacement start can also adopt pending stop readiness
without emitting the superseded stop notification; dispose any previous run scope
before acquiring its replacement. The [effects guide](./application-effects.md#choose-when-effects-end)
shows an application-owned scope with those paths. Cleanup callbacks remain
subject to the [synchronous failure contract](./view.lifecycle.md#synchronous-failures);
these rules do not add rollback or asynchronous notification handling.

### Lifecycle operations

| Current condition | Operation | Lifecycle | Result |
| --- | --- | --- | --- |
| Not running | `start(options)` | `before:start`, await `prepareStart`, `start` | `true` when running |
| Running | `start(options)` | No-op | `true` |
| Running or starting | `stop(options)` | Invalidates startup when needed, then `before:stop`, await `prepareStop`, `stop` | `true` when stopped; the invalidated start resolves `false` |
| Stopped | `stop(options)` | Stop owned descendants and clear roots without repeating this owner's stop notifications | `true` |
| Any live, non-destroying state | `restart(options)` | Stop when needed, then start | `true` when running |
| Running or starting | `destroy(options)` | Stop when needed, then `before:destroy`, await `prepareDestroy`, `destroy` | `true` when destroyed |
| Stopped | `destroy(options)` | Stop owned descendants, then `before:destroy`, await `prepareDestroy`, `destroy` | `true` when destroyed |
| Destroying | repeated `destroy()` | Shares the active destroy lifecycle | Same in-flight Promise |
| Destroying | `start()` or `restart()` | Terminal no-op | `false` |
| Destroying | `stop()` | Follows active teardown without interrupting it | `true` once stopped or destroyed; rejects if teardown fails before stopping |
| Destroyed | `start()` or `restart()` | Terminal no-op | `false` |
| Destroyed | `stop()` or `destroy()` | Terminal no-op | `true` |

### Preparation methods and notifications

Each operation separates synchronous notifications from asynchronous preparation:

| Phase | Before notification | Awaited work | Completion notification |
| --- | --- | --- | --- |
| Start | `onBeforeStart` / `before:start` | `prepareStart(options, { signal })` | `onStart` / `start` |
| Stop | `onBeforeStop` / `before:stop` | `prepareStop(options, { signal })` | `onStop` / `stop` |
| Destroy | `onBeforeDestroy` / `before:destroy` | `prepareDestroy(options, { signal })` | `onDestroy` / `destroy` |

All notification methods and event listeners run synchronously. Their return values
are not consumed: returned Promises are neither awaited nor given rejection
handlers. Use `prepareStart`, `prepareStop`, and `prepareDestroy` for work the operation must await. They are optional instance
methods, called with `this` as the Application and `(options, context)` arguments.
A synchronous return also completes preparation; a throw or rejected Promise
rejects the operation. Notification callbacks must handle any asynchronous work
and its errors themselves. An unhandled rejected notification Promise can surface
as a host-level unhandled rejection even when the lifecycle operation succeeds;
returning it does not make its failure a readiness failure.

`prepareStart`'s resolved value is passed unchanged as the third argument to
`onStart(application, options, result)` and `start` listeners. Arrays are not
spread or implicitly awaited element by element. When preparation starts several
asynchronous operations, return `Promise.all(requests)` to wait for all of them;
returning the array itself completes preparation without waiting for its Promises.
Without `prepareStart`, the result is `undefined`. The operation's own
Promise still resolves a boolean, not the prepared value. Canceled startup never
emits completion with an obsolete result. Stop and destroy preparation results
are ignored; those methods provide readiness rather than startup data.

Before notifications run before preparation begins. If a `before:start` or
`before:stop` notification supersedes its pending operation, that preparation method
does not run. A synchronous replacement begins its own before-notification
sequence; it cannot adopt preparation that has not begun. Destruction is terminal
and cannot be superseded. A preparation method must not await the same operation whose readiness it is defining.
`restart` composes the stop and start lifecycles; it has no separate preparation method.

Only preparation methods receive the context with an
[`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
Before notifications receive `(application, options)`. When a later operation
invalidates preparation, Marionette aborts its signal before starting replacement
preparation. The signal makes cancellation cooperative; the invalidated operation
still resolves `false` even when a loader ignores it. An operation that adopts an
in-flight stop phase retains that phase's original options and context, without
aborting its signal.

If a replacement start has already canceled the remaining child stops, that
stop phase is no longer adopted. A later `stop()`, `restart()`, or `destroy()`
begins a fresh stop phase with its own options and context.

The context belongs to the readiness phase rather than to one caller's Promise.
Stop and destroy completion notifications receive `(application, options)`; startup
also receives its prepared result.

Child registration establishes ownership, not activation. Start chosen children
explicitly, with their own options. Await required children in `prepareStart`;
optional children may start later without holding up the parent. A parent start
never starts a registered child automatically, including after restart.

After `prepareStop` completes, owned children stop sequentially in registration
order before the owner reaches stopped and emits `stop`. Stop also traverses
already-stopped intermediate owners, releases their prepared/displayed roots,
and stops active descendants. Already-stopped owners skip their own `prepareStop`
as well as `before:stop` and `stop` notifications: only the active descendants need
to deactivate. This also applies to descendant cleanup during restart or destroy.
Restart performs that cleanup before its local startup readiness; application code chooses which children to reactivate.

Descendant `start` and `restart` calls resolve `false` while any owner is in a
stop phase, including the stop portion of restart, or is terminal. They become
eligible again when restart enters startup readiness or a stop completes. An
explicitly later child start under a stopped, nonterminal owner is allowed.
`isRunning()` describes that Application, not an aggregate of its descendants.

A successful stop leaves the owned hierarchy stopped at completion. A superseded
or failed stop retains the existing partial-progress contract: completed children
stay stopped and remaining children can stay active. A direct child destroy can
also supersede its requested stop. Inspect the result and handle rejection; a
`false` result is cancellation, while a current readiness failure rejects.

### Starting an Application

Once configured, await `start(options)` before dispatching work that requires a
running Application. The optional argument is passed unchanged to the lifecycle
methods and events. Its `region` property can bind the Application to a
Region instance before `before:start` and `prepareStart` run:

```javascript
const childRegion = layout.getRegion('content');
await child.start({ region: childRegion, source: 'layout' });
```

An omitted or `undefined` `region` keeps the current host. The supplied Region is
borrowed. Use constructor options to create an Application-owned Region from a
selector, Region class, or definition object. Startup does not construct Regions
or change the `region` constructor configuration; `getRegion()` returns the active
host. A different host passed to `start()` while an Application is running or starting rejects
with `MN0041`; await `stop()` before a new `start({ region })`, or use
`restart({ region })` to stop and select a new host in one operation.
An in-flight start with the same Region instance continues to share
its existing Promise. A compatible restart during stop/start preparation shares
its Promise and keeps the original options; it does not queue newer options. A
restart requesting a different host during preparation supersedes the earlier
operation, which resolves `false`. Once startup commits, a restart from `onStart`
or a `start` listener starts a new cycle, even with the same host. Restart can
replace an unfinished start: it cancels startup,
completes deactivation, and then binds the requested host. Rebinding releases the
Application's displayed root, preserves a prepared root for the new host, and
destroys the previous owned Region.

The `region` key is reserved for host configuration. Use a different option name
for domain data, such as `regionCode`. The startup option must be a Region
instance from the same Marionette runtime.

With a shared borrowed host, `region.empty()` destroys the displayed View and
clears its Application's displayed-root association, but does not stop that
Application or destroy a separately prepared replacement. `application.stop()`
deactivates the feature and clears its own preparation and display. The router
or other shared-host coordinator must choose which Applications run; replacing
or emptying a Region does not make that decision automatically.

The application below loads a session before showing its root View. The supplied
`loadSession({ signal })` function returns a Promise for an object with a
`name` string. It can use `fetch`, a cache, or the project's existing data layer.

<!-- executable-example: application-bootstrap-readiness -->
```javascript
import { Application, View } from 'marionette';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

const SessionView = View.extend({
  template: ({ name }) => `<h1>${escapeHtml(name)}</h1>`
});

export function createSessionApplication({ el, loadSession }) {
  const SessionApplication = Application.extend({
    prepareStart(options, { signal }) {
      return loadSession({ signal });
    },
    onStart(app, options, session) {
      this.showView(new SessionView({ model: session }));
    }
  });

  return new SessionApplication({ region: { el } });
}
```

Create and start it at the application entry point:

Serve this application and its API over HTTPS in production; relative requests
use the application origin.

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

## Mount loading UI before readiness

When loading can fail, mount a shell in `onBeforeStart`, before `prepareStart`
runs. This complete module takes two asynchronous loaders and an unowned child
Application. The parent adopts the child once. Render the shell before retrieving
its Region; pass that fresh Region on every child start, including after restart.
The shell owns loading/error presentation while the child owns the content screen.

<!-- executable-example: application-loading-shell -->
```javascript
import { Application, View } from 'marionette';

const Shell = View.extend({
  template: () => '<p role="status">Loading…</p><main></main>',
  regions: { content: 'main' },
  showStatus(message) { this.el.querySelector('[role="status"]').textContent = message; }
});

export function createWorkspace({ el, child, loadAccount, loadSettings }) {
  const Workspace = Application.extend({
    initialize() { this.addChildApp('content', child); },
    onBeforeStart() {
      this.setView(new Shell());
      this.getView().render();
      this.showView();
    },
    async prepareStart(options, { signal }) {
      const shell = this.getView();
      try {
        const [account, settings] = await Promise.all([
          loadAccount({ signal }), loadSettings({ signal })
        ]);
        if (signal.aborted) { return; }
        const started = await child.start({
          region: shell.getRegion('content'), account, settings
        });
        if (signal.aborted) { return; }
        if (!started) { throw new Error('Required child startup was superseded'); }
      } catch (error) {
        if (signal.aborted) { return; }
        shell.showStatus('Could not load. Try again.');
        throw error;
      }
    },
    onStart() { this.getView().showStatus('Ready'); }
  });
  return new Workspace({ region: { el } });
}
```

Await `workspace.start()` at the entry point and handle its rejection there;
readiness failure still rejects. The mounted error shell remains available
until retry or teardown. The next start replaces it. `Promise.all` waits for
both loaders; returning an array would not wait for its entries. It does not
cancel the other loader when one rejects. Loaders here return values without
committing UI. Child startup is explicit and awaited; registering it alone does
not make the parent wait.

If the parent startup is canceled, `signal.aborted` suppresses further work before
examining the child result. A remaining `false` means the required child was
independently superseded while the parent startup is still current. This example
chooses to reject that parent startup because its required content is not ready;
it does not reinterpret ordinary cancellation as a framework error.

This example covers asynchronous readiness failure, not rollback of synchronous
construction/rendering failures. See [the failure boundary](./view.lifecycle.md#synchronous-failures).
For work after startup, use [completion ownership](./application-effects.md#allow-persistence-without-late-ui-effects),
not the completed preparation signal.

## Application Ownership

An Application may own named child Applications. Ownership is one-way: an
Application locates and controls its children, while children receive required
collaborators explicitly. Internal parent references exist only to enforce
lifecycle and unlink children safely; upward lookup is not public API.

### Declaring static children

Use a `childApps` map, or a function returning that map, for children that can be
constructed without arguments:

```javascript
const Workspace = Application.extend({
  childApps: {
    search: SearchApplication,
    editor: EditorApplication
  },
  initialize() {
    // Both children are already registered, but neither has been started.
    this.getChildApp('search');
  }
});
```

Each parent instance constructs fresh children once, after Region, Radio, and
State setup and before `initialize()`. Constructors receive no arguments;
parent options are not forwarded. Entries register through `addChildApp()` in
JavaScript own enumerable string-key order and follow its ownership rules.
Children must belong to the parent's Marionette runtime. A function declaration
runs once with the parent as `this`, at the same construction step.

A child's own `initialize()` completes before registration, so `getName()` is
still `undefined` there. Its registered name is available in start hooks and
in the parent's `initialize()`. Lookup still returns the general
`ApplicationInstance | undefined` type; declared keys do not infer child-specific
methods.

The declaration is inherited even when a subclass overrides `initialize()`.
A subclass declaration or constructor `childApps` option replaces the entire
inherited map; maps are not merged. A non-undefined `childApps` option takes
precedence through `getOption()` without assigning to the declaration property,
including a getter-only property. Use `{}` to omit inherited children.
`preinitialize()` may configure the declaration property or `this.options.childApps`;
a non-undefined option takes precedence over the property. With native classes, use a
prototype `childApps()` method, getter, or `preinitialize()`, not an instance field assigned after
`super()` has completed construction. TypeScript native subclasses should use a
getter: the public interface declares `childApps` as a property, and TypeScript
rejects overriding a property with a method declaration. This is a declaration-form
restriction, not a consequence of the map-or-function union.

Declaration only constructs and registers. Start chosen children explicitly with
their startup options; parent start/restart does not activate or reconstruct them.
Removing a declared child destroys it and does not recreate it on restart.
Changing the map after construction does not change registered children.
Use explicit `addChildApp()` for dynamic/lazy children or constructors requiring
arguments. Per-child factories, shared instances, and option descriptors are not
declaration forms. Constructor failures follow the synchronous failure boundary
above; there is no partial-construction rollback. Declarations must describe a
finite construction tree. Self-recursive or mutually recursive declarations are
not detected before construction and can exhaust the call stack. The `MN0031`
cycle check applies to ownership relationships between existing instances; it
does not validate a graph of constructors. Invalid declaration shapes have no
guaranteed diagnostic.

### Registering and controlling children

`addChildApp(name, application)` registers an existing live,
parentless Application instance under a non-empty string name and returns that
instance. Registration does not construct or implicitly start the child. Use
`hasChildApp(name)` before constructing a dynamic child when duplicate
allocation matters. Registering the same instance again under its existing
owner and name is an idempotent no-op. A conflicting owner, name, runtime, or cyclic ownership relationship throws
[`MN0031`](diagnostic-catalog.md#look-up-a-code).

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

Owner stop/destroy options are forwarded to children for teardown. Startup inputs
are supplied explicitly by application code. If required `child.start()` returns
`false`, decide how that affects readiness; the example below rejects with a
feature-specific error. A rejected child startup propagates through an awaited
hook. Neither case rolls back children that already started. Explicitly call
`stop()` or `destroy()` after a failed startup when abandoning that attempt;
both clean the running prefix even if the parent never reached running. Retrying
startup may reuse an already-running prerequisite through its idempotent `start`.

`removeChildApp(name, options)` destroys the named child and resolves
with it after destruction. An unknown name resolves with `undefined`. A child
also removes itself from its parent's child hierarchy when destroyed directly. A
running parent stops its children before `before:destroy`, then destroys owned
children in registration order and finally emits the parent's `destroy`
completion. A parent's `prepareDestroy` method can therefore inspect its
stopped, live children. A stopped parent also traverses stopped intermediate owners and stops active
descendants before entering destroy readiness. A concurrent direct child
destroy joins terminal teardown and may remove that child before parent
readiness. If child stop or destroy readiness fails, the parent returns to its
last committed stable state and retains that child so destruction can be retried.

The canonical child-Application pattern is explicit construction followed by
ownership registration, followed by explicit startup of chosen capabilities.
Ownership gives teardown responsibility; it has no per-child lifecycle flags. Put a service
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

  async prepareStart(options) {
    const started = await this.getChildApp('search').start({ source: 'search' });
    if (!started) { throw new Error('Search startup was canceled'); }
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

const DashboardView = View.extend({
  initialize(options) {
    this.status = options.initialStatus;
  },

  template({ status }) {
    return `<button class="refresh">Refresh</button><p class="status">${escapeHtml(status)}</p>`;
  },

  templateContext() { return { status: this.status }; },

  events: {
    'click .refresh': 'requestRefresh'
  },

  requestRefresh() {
    this.trigger('refresh:requested', this, { source: 'button' });
  },

  showStatus(status) {
    this.status = status;
    this.render();
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

## Subscription lifetime across stop and restart

Ordinary `listenTo` and `bindEvents` subscriptions belong to the Application
instance. `stop()` does not remove them, and `restart()` reuses that instance.
`destroy()` calls `stopListening()` for terminal cleanup. A stopped Application
can therefore still receive a service event from an in-flight save or request.

For handlers that should act only during a run, pair registration with explicit
cleanup: remove a `listenTo(source, event, callback)` binding with
`stopListening(source, event, callback)`, or a `bindEvents(source, map)` binding
with `unbindEvents(source, map)`. Preserve callback identity for cleanup, including
functions stored in maps. A map of method-name strings may be recreated if the
methods still resolve to the same functions. Remove the binding when stopping
begins if delivery must cease before asynchronous stop preparation. Reinstall it once for each new run.
If stop can reject and effects must remain active until it succeeds, clean up in
`onStop` instead. Choose that policy explicitly; early cleanup must account for a
failed stop that leaves the Application running. Avoid clearing unrelated
object-lifetime subscriptions.

Unbinding prevents delivery while stopped; it does not cancel the producer or
distinguish an old request from a new run after restart. Use the operation's
abort signal where supported and check current request/run identity before
applying late UI effects. A save may still complete on the server without
permission to navigate a stopped or replaced screen. See
[explicit activation and cleanup](./application-effects.md) for run-owned effects.

## Application state

Application `stateEvents` deliver only while `isRunning()` is true. Initial state
can be seeded in `onBeforeStart` or `prepareStart` without invoking UI or persistence
handlers before the root is ready. `onStart` reads current state for initial display.
Events suppressed before activation or after deactivation are not queued or replayed.
Delivery continues while stop permission is pending and ends before root teardown.

Radio bindings and explicit listeners retain object lifetime. For timers, requests,
loading-time reactions, or deliberately persistent state observation, see
[explicit activation and cleanup](./application-effects.md).


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

For Application-controlled layout composition, select the root, populate its
Regions, then display it. Use `getView()` in controller methods both during
initial detached composition and for later individual Region updates.

```javascript
import { Application, View } from 'marionette';
import HeaderView from './views/header';
import ContentView from './views/content';

const LayoutView = View.extend({
  template: () => '<header></header><main></main>',
  regions: { header: 'header', content: 'main' }
});

const MyApp = Application.extend({
  region: '#root-element',

  onStart() {
    this.setView(new LayoutView());
    this.showHeader();
    this.getView().showChildView('content', new ContentView());
    this.showView();
  },

  showHeader() {
    this.getView().showChildView('header', new HeaderView());
  }
});

const myApp = new MyApp();
await myApp.start();
myApp.showHeader(); // Replace just the header in the displayed layout.
```

`setView()` selects and owns the root without rendering it or resolving the host
Region's element. The first `showChildView()` renders the layout if needed. Its
children are composed while the root is detached. `showView()` then displays that
same tree without rendering it again; attachment propagates to its children.
`start()` remains asynchronous, while these View operations are synchronous.

A layout can also populate its own Regions in `onRender()` when those children
belong to its template lifecycle. Calling `layout.render()` again destroys its
Region children. Update individual Regions when unrelated child identity, input,
or focus must survive.

The Application owns a Region that it constructs from a selector, Region class,
or definition object. Passing an existing Region instance instead borrows that
host. The Application owns a prepared View only until `showView()` hands it to
the Region. After adoption, the Region is the View's sole owner; the Application
keeps only an association with the displayed root it selected. That association
ends when the Region replaces, empties, or detaches the View.

`getView()` returns the prepared View while one is pending, otherwise the
Application's selected displayed View. A View shown directly through the Region
is not adopted or claimable by the Application. Prepare an unowned View with
`setView()` before displaying it through the Application.

Calling `setView(next)` destroys only a previous prepared View. It leaves the
Region's current View visible until `showView()` replaces it through the normal
Region lifecycle. Destroying a prepared View directly clears preparation, exposing
the selected displayed View through `getView()` again. Selecting the
Application's own displayed View with `setView()` also cancels and destroys a
pending replacement, without changing the displayed View.

Stopping the Application destroys any prepared View and empties the host Region
only when its selected displayed View is still current. A replacement or
detached View remains with the Region or caller that now owns it. Destroying the
Application also destroys a Region it constructed, including whatever that
Region currently displays, but never destroys a borrowed Region or an unrelated
View in it. For a Region constructed by the Application, a directly shown View
is also cleared by stop or restart; unmanaged HTML remains when there is no
current View. Restart cleans up the Application's preparation and display before
`onStart` builds a new root. Detaching a View through the host transfers it to
the caller; the Application does not keep ownership of that detached View.

Borrowing does not reserve a Region exclusively. Applications borrowing the same
host keep independent selected roots. Each may prepare a distinct replacement;
displaying one replaces the host's current View and ends the prior Application's
association. Stopping one Application leaves another Application's selected
displayed View in place. A View already displayed in the host, whether selected
by another Application or shown directly through the Region, is rejected by
`setView()` with `MN0003`; detaching it transfers it to the caller, who may then
prepare it with another Application. A prepared View itself has one owner and
cannot be adopted by another Application, Region, or CollectionView until handed
to its host and subsequently detached.

If the Region has no View, stopping the Application leaves unmanaged HTML alone.
`region` can also be passed as a constructor option.

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

### `setView(view)`

Prepare a supported View instance without rendering or displaying it. Returns the
supplied View synchronously. A Region is not required for preparation. The
Application owns the pending View until display, replacement, or cleanup.

Preparing the same pending View again is a no-op. A different View destroys the
previous pending View and its children, leaving the host's displayed View alone.
Passing the Application's own displayed View cancels and destroys a pending
replacement without changing Region ownership or display.

A View owned elsewhere or already displayed in the host is rejected with `MN0003`;
a destroyed View is rejected with `MN0007`. The Application may reselect its own
displayed View while the Region remains its sole owner. A prepared View cannot be
adopted directly by another container:
first display it through its Application, then use the host's `detachView()` to
transfer it. Once displayed, normal Region ownership rules apply, including for
Applications sharing a borrowed host.

Do not call `setView()` or `showView()` reentrantly from a pending View's synchronous
teardown callbacks. Complete its replacement before preparing another View. The
[synchronous failure boundary](./view.lifecycle.md#synchronous-failures) does not
provide nested selection recovery.

Once Application destruction begins, `setView(view)` returns the supplied View
without adopting it. The caller remains responsible for that View.

### `showView(view, options)`

Call `showView()` after preparation to display the pending View through the
Application's host Region. The Region adopts it and the Application releases its
prepared reference and ownership subscription. The root is rendered only if
needed. To pass options, use `showView(undefined, options)`.

Without preparation, `showView()` re-shows the Application's selected displayed
View, or returns `undefined` when no View is selected. A View shown directly by
the Region is not adopted or claimed by this call. Otherwise it returns the View
synchronously. Calling it for the already displayed root is a no-op; supplied
options are ignored and the View is not rendered or attached again.

When no separate composition step is needed, `showView(view, options)` performs
`setView(view)` followed by the same display operation, returning the supplied
View. In either form, the Region handles replacement of its old View.

Configure a Region before displaying a prepared View. Display does not call
`start()` or wait for Application readiness. Once destruction begins, no View is
prepared or displayed, and the supplied argument is returned, if any. A missing
mount allowed by `allowMissingEl` leaves the View prepared and Application-owned;
configure an available host element before a later `showView()`. Inspect
`getRegion().currentView === getView()` with a defined View when you need to
establish actual Region display. `getView()` alone does not establish display or
document attachment.

### `getView()`

Return the prepared View while one is pending, otherwise the Application's
selected displayed View, or `undefined` when neither exists. This is a read-only
synchronous query; it does not render or attach a View. Direct Region display is
not adopted or claimable; prepare the View with `setView()` before displaying it
through the Application. Read `getRegion().currentView` when you need the host's
current display regardless of which owner selected it.
