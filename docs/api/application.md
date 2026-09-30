# Application

[API index](../api.md) · [View](view.md) · [Region](region.md)

Application coordinates preparation, composition, and state for a feature lifetime. It can own a root View, registered child Applications, and a destination Region. A local control can remain a View; use an Application when the feature needs this lifecycle boundary.

Choose the owner by what must survive: a feature can retain data, pending work, and decisions across View replacement. A [local model edit](view.md#local-interaction-and-feature-coordination) can stay in its View.

## Prepare before showing UI

This standalone TypeScript example loads a summary before activating its UI. It expects `/summary.json` to return an object with a string `title`. The Application owns the request and the View renders the result.

```ts
import { Application, View, type ApplicationInstance, type LifecycleContext } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

type Summary = { title: string };
const SummaryView = View.extend({
  template: ({ title }: Summary) => html`<h1>${title}</h1>`,
}).setDomApi(LitDomApi);

const SummaryApplication = Application.extend({
  async prepareStart(_options: unknown, { signal }: LifecycleContext): Promise<Summary> {
    const response = await fetch('/summary.json', { signal });
    if (!response.ok) throw new Error('Could not load the summary.');
    return response.json();
  },
  onStart(_app: ApplicationInstance, _options: unknown, summary: Summary) {
    this.showView(new SummaryView({ model: summary }));
  },
});

const mount = document.createElement('section');
document.body.append(mount);
const app = new SummaryApplication({ region: { el: mount } });
await app.start();
```

`prepareStart` may return a value or Promise. Its successful result reaches `onStart`; a failed request rejects `start()`. The caller handles that rejection at the feature's error boundary. `stop()` cancels a pending start or tears down active UI. `restart()` loads again and replaces the feature's root; it is not an in-place data refresh.

This example uses plain response data, which the default DataApi serializes unchanged. For observable local data, use [native data setup](../integrations/setup.md#observable-data-and-api-access) or another compatible integration. API access and persistence remain separate from observable state.

## Construction and options

`new Application(options?)` creates a stopped instance. Construction calls `preinitialize(options)`, configures Region, Radio and state access, constructs declared children, calls `initialize(options)`, then binds state events. Neither hook starts the Application. `getState()` is available inside `initialize`.

| Option | Contract |
| --- | --- |
| `region` | Selector string, Region options object, Region constructor, or existing Region instance. Optional for an Application without mounted UI. See [root ownership](#root-view-and-region). |
| `regionClass` | Default Region constructor when building from configuration; defaults to the runtime's Region. An individual Region definition can override it. |
| `childApps` | Map of names to Application constructors, or a function returning that map. Constructors are called without arguments during parent construction. The map is resolved once; constructor/subclass maps replace rather than merge. |
| `state`, `stateEvents` | Borrowed state and declarative observation. Use `createState(options)` for owned state; see [state](shared/state.md). |
| `channelName` | Radio channel name, or function returning one. A falsy name disables declarative Radio setup. |
| `radioEvents`, `radioRequests` | Event/reply handler maps, or functions returning maps. Values are callbacks or Application method names. See [Radio bindings](#radio-bindings). |

Resolver functions run with the Application as `this`. A Region constructor is a class to instantiate; a function supplied as `state` remains the source itself. `options` contains merged class and constructor options. Custom options are read with `getOption(name)` and are not automatically instance fields.

`Application.extend(prototypeProperties?, staticProperties?)` creates a subclass. `preinitialize` and `initialize` default to no-ops. `cid` is generated using the class's `cidPrefix` (`'mna'` by default). Shared option methods and custom constructor invocation are in [class utilities](shared/common.md).

## Lifecycle methods and results

| Method | Behavior |
| --- | --- |
| `start(options?)` → `Promise<boolean>` | Prepares and activates the Application. While stably running, resolves `true` without repeating preparation. |
| `stop(options?)` → `Promise<boolean>` | Stops registered children, destroys prepared/displayed root UI, and leaves the Application reusable. |
| `restart(options?)` → `Promise<boolean>` | Completes a stop phase, then starts again. Retains this Application, its state, and its registered child instances. Root UI is destroyed and must be created again. |
| `destroy(options?)` → `Promise<boolean>` | Stops active work, prepares destruction, destroys registered children and owned resources, and permanently ends this instance's lifetime. |
| `isRunning()` → boolean | Reports whether this Application is active. |
| `isDestroyed()` → boolean | True once terminal destruction commits, before `onDestroy`. Starting destruction does not immediately make this true. |

Activity is false during startup preparation and true before `onStart`. Ordinary stop keeps a running Application active during preparation, then deactivates before root teardown. Destroy deactivates immediately.

`true` means the operation completed or its requested state was already satisfied. `false` means it was superseded before completion, cancelled by child-stop coordination, or activation was blocked by an ending lifetime. A failure in the current operation rejects. Returning `false` from a hook is not a veto: `prepareStart` can successfully return `false` as its result.

Repeated pending starts with a compatible Region share the same Promise and original options. Pending stops/destroys also share their operation; compatible pending restarts share until completion begins. Once destruction is underway, start/restart resolve `false`; repeated destroy shares it. After destruction, stop/destroy resolve `true`.

`start`/`restart` accept `ApplicationStartOptions`, including a destination Region and arbitrary feature options. Stop/destroy accept arbitrary options and pass them to their hooks and child operations. These are operation arguments; they do not merge into constructor `options`. Stop on a stably stopped parent still cleans up roots and stops any registered children, without repeating that parent's stop notifications or `prepareStop`.

## Preparation, cancellation, and failure

| Preparation method | Awaited contract |
| --- | --- |
| `prepareStart(options, { signal })` | Establish readiness for activation. Its result is passed to `onStart` and `start` event subscribers. |
| `prepareStop(options, { signal })` | Finish work required before child stops and root teardown. Runs after `before:stop`. |
| `prepareDestroy(options, { signal })` | Finish work required before terminal disposal. Runs after root cleanup and `before:destroy`, before registered children and owned resources are destroyed. |

All three are optional. Return a Promise when the lifecycle must wait. Notification hooks such as `onStart`, `onStop`, and `onDestroy` run synchronously; returned Promises are ignored. Await necessary work in `prepare*` and handle separately started child-operation Promises explicitly.

A newer lifecycle operation can supersede pending startup preparation. The superseded call resolves `false`, its preparation signal is aborted, and its obsolete result cannot activate the Application. Pass the signal to asynchronous dependencies. Cancellation cannot undo work already performed; check `signal.throwIfAborted()` after an await before additional side effects when a dependency might ignore cancellation.

Pending stop preparation can be reused by a newer start/restart/destroy operation. That phase keeps its original options and signal; supersession does not always abort it. Destruction cannot be superseded. Once preparation completes, its signal is no longer a lifetime signal: a later stop does not abort it. These rules coordinate lifecycle transitions; they do not cancel arbitrary requests started outside `prepare*`.

Failures are not transactional rollback:

- Failed startup preparation leaves an initially stopped Application stopped. Views shown or children explicitly started during preparation may still require cleanup.
- If restart finishes stopping but its next startup preparation fails, the Application remains stopped. A throw in `onStop` rejects after deactivation; during restart it prevents the next start phase.
- A throw in `onStart` or a `start` subscriber rejects after activation; `isRunning()` can already be true.
- Failed stop preparation can leave a running Application active. Children stopped earlier in a sequential traversal are not automatically restarted.
- Failed destruction before terminal completion can be retried; unfinished children remain registered.
- A throw after terminal destruction commits can reject even though `isDestroyed()` is already true.

Handle rejection where the operation is requested. When replacing partial UI with an error View, first await `stop()` successfully, then show the error in the intended Region. Do not infer that a rejected operation restored the prior screen.

## Restart and retained UI

Restart repeats readiness for a new run and tears down the current root, including its child Views. It does not preserve input elements, focus, or a layout's Region children. Restart a feature child when the surrounding parent page should remain alive. Starting the parent again does not automatically reactivate that child.

For refresh that keeps the current layout, use an explicit operation on the active feature and update the appropriate child View or data source. Choose cancellation/obsolete-response handling for that operation; `restart()` is the choice when ending the current run is intended.

## Operations after start

Initial preparation and later feature operations can belong to the same Application. `prepareStart` supplies readiness data; `onStart` connects the ready Views. Later operations update shared observable data, and each View updates its own presentation. The owner supplies the same source to replacement Views, which read its current values and subscribe for changes. Persistence can live in a model or API layer.

Methods such as `refresh` or `save` are application-defined operations. Marionette does not automatically await or cancel their requests. Decide which concurrent results may commit and when ending a run invalidates them. See [preparation and cancellation](#preparation-cancellation-and-failure) for the narrower lifetime of a preparation signal, and [lifetime choices](../architecture.md#choose-what-survives-an-operation) for replacing a panel while keeping its feature active.

## Child Applications

`childApps: { summary: SummaryApplication }` declares a child constructed once with the parent. For per-instance arguments, construct a child explicitly and register it with `addChildApp`.

| Method | Contract |
| --- | --- |
| `addChildApp(name, child)` | Registers and returns that Application instance. Does not start it. |
| `getChildApp(name)` | Returns the registered instance or `undefined`. |
| `hasChildApp(name)` | Reports whether the name is registered. |
| `getChildApps()` | Returns a new name-to-instance map. Changing the map does not change registration. |
| `getName()` | Returns this Application's registered name, or `undefined` when unregistered. |
| `removeChildApp(name, options?)` | Calls the child's `destroy(options)` and resolves to that instance; a missing name resolves to `undefined`. Destruction failure rejects. This is removal with destruction, not detachment. |

Names must be nonempty strings. Children must share the parent's Marionette runtime and have one owner/name. Self/ancestor registration, conflicting names and multiple owners throw `MN0031`. Repeating the same registration is harmless. Adding to a destroying/destroyed parent, or adding a destroying/destroyed child from the same runtime, returns the child without registering it. A child that completes destruction unregisters itself automatically; no extra destroy listener is needed.

Registration owns lifetime, not readiness. Parent start does not start children or await them. Start required children explicitly and decide whether their readiness belongs in the parent's preparation or can proceed after activation. A child started from `onStart` has a separate Promise because notification hooks are not awaited.

Parent stop visits children sequentially in registration order before destroying the parent's root. Child instances remain registered for later reuse. Parent destroy stops children and later destroys them sequentially. A child whose stop is superseded can cancel an ordinary parent stop/restart; terminal parent teardown can force child destruction. Child start/restart is blocked while an ancestor is stopping, restarting its stop phase, or destroying. There are no Application add/remove-child notification events.

## Root View and Region

| API | Contract |
| --- | --- |
| Constructor `region` | Builds an owned Region from a definition, or borrows a supplied Region instance. Selector lookup follows [Region rules](region.md#construction-and-options). |
| `start({ region })` / `restart({ region })` | Selects an existing Region instance from the same runtime. The new destination is borrowed. Active/pending `start` rejects a different destination with `MN0041`; use stop/start or restart to move. |
| `getRegion()` | Returns the current destination Region or `undefined`. |
| `setView(view)` | Selects and owns a prepared root without rendering/mounting it; returns that View. Replacing a prepared root destroys the old prepared root. |
| `getView()` | Returns the prepared root, otherwise the displayed root, or `undefined`. |
| `showView(view?, options?)` | Selects a supplied View, then shows the root through the destination Region with Region `ShowOptions`. Returns the root, or `undefined` if none exists. A destination is required when a root exists. |

`setView` → the root View's `showChildView` → `showView` permits composition before attachment. Selecting a replacement leaves the displayed root in place until the replacement is shown. Showing transfers ownership to the Region; Application tracks which root it displayed. Stop/destroy clean up both a prepared root that was never shown and the displayed root.

Reselecting the Application's own displayed root destroys any pending prepared replacement. Content shown directly through a Region is Region-owned; `setView` and `showView` reject adopting it with `MN0003`.

A selected View must be live and unowned (`MN0007` for destroyed, `MN0003` for another owner). Selecting the same root is harmless. During/after Application destruction, set/show operations do nothing and return the supplied View; they do not adopt it. The caller remains responsible for it.

An Application can own [existing page markup](view.md#existing-elements) with `setView(new PageView({ el, template: false }))` without a destination Region or show call. Stop destroys that View and removes its element; a later run needs markup again. An Application can also have no root UI.

Stop keeps the destination Region reusable. Destroy disposes a Region built from configuration; a borrowed Region survives. If another owner has replaced the displayed content in a borrowed Region, Application stop leaves that replacement alone. An owned Region's current content is cleaned up. Moving to another destination disposes a previously owned Region and leaves a previously borrowed Region alive. If subsequent startup preparation fails, the new destination stays bound.

`showView` can display UI while stopped without activating the Application. If an allowed missing Region selector skips a show, the prepared root remains the Application's cleanup responsibility; see the current [missing-selector limitation](region.md#showing-a-view).

### Destination binding order

Startup binds the requested Region before `before:start` and `prepareStart`, so both can read it through `getRegion()`. Omitting `region` or passing `undefined` keeps the current destination. Restart completes its stop phase before rebinding; a stop-phase failure leaves the current destination bound. A newer start or restart that [reuses pending stop preparation](#preparation-cancellation-and-failure) also waits for that preparation and child stops before rebinding, then passes its own options to startup.

## State and Radio

State can be owned through `createState(options)` or borrowed through `state`; read it with `getState()`. Start/stop/restart retain the source. Declarative `stateEvents` deliver only while `isRunning()` is true; changes while stopped or preparing startup are not replayed. Ordinary `listenTo` subscriptions have their normal lifetime. See [state ownership and disposal](shared/state.md).

`Application.setStateApi(api)` overlays the receiving class's provider and returns that class. `State` is the provider, not the state source. Configure it before constructing instances; the shared [StateApi reference](shared/state.md#configure-the-stateapi) defines this boundary.

### Radio bindings

`channelName`, `radioEvents`, `radioRequests`, `getChannel()` and `Radio` follow the shared [declarative Radio contract](shared/common.md#declarative-radio-bindings). These bindings remain active while stopped as well as running. Destruction releases this Application's bindings while preserving the shared channel.

## Lifecycle hooks and events

Each event dispatches its hook first, then subscribers, using [triggerMethod](shared/events.md). Hook arguments and subscriber arguments match.

| Event | Hook | Arguments and timing |
| --- | --- | --- |
| `before:start` | `onBeforeStart` | `(app, options)` before `prepareStart`, while inactive. |
| `start` | `onStart` | `(app, options, result)` after preparation and activation. |
| `before:stop` | `onBeforeStop` | `(app, options)` before `prepareStop` and child stops. For ordinary stop of a running app, it is still active here; destroy has already deactivated it. |
| `stop` | `onStop` | `(app, options)` after children stop and roots are destroyed, while inactive. |
| `before:destroy` | `onBeforeDestroy` | `(app, options)` after stop/root cleanup, before `prepareDestroy` and child destruction. |
| `destroy` | `onDestroy` | `(app, options)` after terminal state, child/owned-Region disposal, parent unregistration, and Radio/state cleanup. Subscriptions are cleared afterward. |

Restart has no separate restart event: it uses stop/start phases. A stopped instance can skip its own stop notification phase while still cleaning up children and roots. `preinitialize` and `initialize` are constructor hooks, not lifecycle events.

Inherited APIs are documented once in [common methods](shared/common.md), [events](shared/events.md), and [state](shared/state.md). Their methods remain available on Application; unlike View/Region, Application destruction is asynchronous.

### Restart from start completion

Compatible `restart()` calls share a Promise during stop and startup preparation; sharing ends before `onStart` and `start` subscribers run. Calling `restart(nextOptions)` from `onStart` or a `start` subscriber begins a separate stop/start cycle with its own options and Promise, which the caller must handle. The completed outer restart resolves `true` even if that new cycle later fails or is superseded: its result describes the run it completed.

## TypeScript

Import `ApplicationOptions`, `ApplicationStartOptions`, `LifecycleContext`, `ApplicationInstance`, and `ApplicationConstructor` from `marionette`. `LifecycleContext` contains the preparation `AbortSignal`. Constructor options and per-start options are separate types. `ApplicationInstance<Options, State, StartResult>` describes the constructor options, state source and successful preparation result. `extend` carries the awaited return type of `prepareStart` into the instance's lifecycle result contract. Annotate overridden hook parameters as in the example; inference of the instance contract does not remove that need.

Region definitions use `RegionDefinition`/`RegionClass`; start destinations use `RegionInstance`. Root methods preserve the supplied View's type when one is passed. Child lookup/removal returns the common Application interface; narrow it when using child-specific methods. Shared structural types are listed beside their [state](shared/state.md) and [event](shared/events.md) contracts.
