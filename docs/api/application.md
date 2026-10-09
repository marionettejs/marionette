# Application

[API index](../api.md) · [View](view.md) · [Region](region.md)

Application coordinates readiness, composition, and state for a feature lifetime. It can own a root View, registered child Applications, and a destination Region. A local control can remain a View; use an Application when shared workflow or lifetime needs an owner.

## Prepare before showing UI

This standalone TypeScript example loads a summary before showing it. `/summary.json` returns `{ "title": string }`. Application owns the request; View renders the result.

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

`prepareStart` may return a value or Promise. Its current successful result reaches `onStart`; failure rejects the requesting `start()` or `restart()`. The caller handles that rejection. `stop()` cancels pending preparation and tears down owned UI synchronously.

`restart()` repeats preparation while retaining the current presentation and active children. This example explicitly replaces SummaryView in `onStart` after success. To keep a shell, input, and child identity through completion too, see [retained restart](../guides/retained-restart.md).

Plain response data uses the default DataApi. For observable data, configure [native data](../integrations/setup.md#observable-data-and-api-access) or another integration. API access and persistence remain separate.

## Construction and options

`new Application(options?)` creates a stopped instance. Construction calls `preinitialize(options)`, configures Region, Radio and state, constructs declared children, calls `initialize(options)`, then binds state events. Neither hook starts the Application. `getState()` is available inside `initialize`.

| Option | Contract |
| --- | --- |
| `region` | Selector string, Region options object, Region constructor, or existing Region instance. Optional without mounted UI. See [root ownership](#root-view-and-region). |
| `regionClass` | Default constructor when building a Region from configuration; defaults to the runtime's Region. Individual definitions can override it. |
| `childApps` | Map of names to Application constructors, or a function returning that map. Children are constructed once without arguments. Constructor/subclass maps replace rather than merge. |
| `state`, `stateEvents` | Borrowed state and declarative observation. `createState(options)` supplies owned state; see [state](shared/state.md). |
| `viewEvents` | Event-handler map, or function returning one, bound to each selected root View. Values are callbacks or Application method names. See [View events](#view-events). |
| `channelName` | Channel name, or function returning one. A falsy name disables declarative Radio setup. |
| `radioEvents`, `radioRequests` | Event/reply handler maps, or functions returning maps. Values are callbacks or Application method names. See [Radio bindings](#radio-bindings). |

Resolvers run with the Application as `this`. A Region constructor is a class to instantiate; a function supplied as `state` remains the source itself. `options` merges class and constructor options. Custom options are read with `getOption(name)` and are not automatically instance fields.

`Application.extend(prototypeProperties?, staticProperties?)` creates a subclass. `preinitialize` and `initialize` default to no-ops. `cid` uses the class's `cidPrefix` (`'mna'` by default). See [class utilities](shared/common.md) for shared options and custom constructors.

## Lifecycle methods and results

| Method | Behavior |
| --- | --- |
| `start(options?)` → `Promise<boolean>` | Prepares and activates. An active Application resolves `true` without repeating preparation or applying new options. Pending initial starts share the first preparation's Promise and options. |
| `restart(options?)` → `Promise<boolean>` | Repeats preparation without stopping. Retains the root, active children, state, and subscriptions unless application code replaces them. Each call supersedes pending preparation. When stopped, prepares and activates using the retained destination. |
| `stop(options?)` → boolean | Cancels pending preparation, stops registered children, destroys prepared/displayed roots, and returns `true` synchronously. Retains the Application, state, children and destination for reuse. |
| `destroy(options?)` → boolean | Deactivates immediately, cancels preparation, stops descendants and destroys roots, then destroys child Applications and owned resources. Returns `true` synchronously. |
| `isRunning()` → boolean | Reports this Application's activity, independently of its descendants. |
| `isDestroyed()` → boolean | True when terminal destruction commits, before `onDestroy`. |

Initial preparation is inactive. Restart of an active Application stays active, including `stateEvents` delivery. Ordinary stop deactivates after `before:stop` and child stops, before root teardown. Destroy deactivates immediately.

Start/restart resolve `false` when superseded or cancelled, or when a stop/terminal owner prevents activation. Current preparation and startup callback failures reject. A hook returning `false` is not a veto: it may be a successful preparation result.

Stop is synchronous and cannot be superseded during cleanup. Start/restart during stop or destruction resolve `false`. `onStop` runs after successful cleanup and may explicitly start the next run. Calling stop on a stopped owner still cleans roots and stops descendants without repeating that owner's stop notifications. Repeated stop/destroy after successful destruction return `true`.

`ApplicationStartOptions` accepts an existing Region and feature options. `ApplicationRestartOptions` forwards feature options, including any `region`, unchanged to hooks, but restart never changes its destination. Stop/destroy forward arbitrary options to notifications and child operations. None of these arguments merge into constructor `options`.

```text
stopped → start() → prepareStart → active → onStart
stopped → restart() → prepareStart → active → onStart (retained destination)
active  → restart() → prepareStart → onStart → active
                       │
                       └── preparation rejects → existing active UI retained
active  → stop() → stopped (root destroyed; Application/state retained)
live    → destroy() → destroyed (owned UI, children and resources disposed)
```

An active restart retains its UI during preparation; `onStart` chooses what to update. Initial preparation failure leaves the Application stopped. A newer restart, stop or destroy cancels pending preparation, preventing its obsolete result from reaching `onStart`. This diagram describes successful synchronous callbacks; the failure boundary below still applies.

## Preparation, cancellation, and failure

`prepareStart(options, { signal })` is the only awaited lifecycle hook. Its result reaches `onStart(app, options, result)` and `start` subscribers. Notification hooks run synchronously and ignore returned Promises. Await required business work before teardown, for example `await app.saveDraft(); app.stop()`.

A newer restart, stop, or destroy cancels pending preparation: the prior call resolves `false`, its signal is aborted, and its obsolete result cannot reach `onStart`. Pass the signal to dependencies. Cancellation cannot undo completed work; return ready data from preparation and apply it in `onStart`. Check `signal.throwIfAborted()` after an await before additional side effects if a dependency ignores cancellation. A completed preparation signal is not a lifetime signal and is not aborted by a later stop.

A failed initial preparation leaves the Application stopped. A failed restart of an active Application leaves it active with its existing UI and children. Display errors without stopping that retained feature. Children or Views explicitly created during initial preparation may need cleanup when abandoning a failed start. A throw from `onStart` rejects after activation; synchronous callback failures do not roll back completed work.

Synchronous construction or teardown failures throw and abort remaining steps. Marionette promises no rollback, attempt-all cleanup, or retry of a partial instance. See [event cleanup](shared/events.md#cleanup) for the same failure boundary.

## Readiness and ongoing effects

Use preparation for data and prerequisites needed before activation or before applying a restarted result. Use `onStart` to commit that result. When retaining UI, construct and connect the shell once, then update the source or child Region that changed; avoid recreating it unconditionally in every `onStart`.

Long-lived effects such as Window listeners or timers need explicit activation and cleanup. Install them once for the active run and release them in `onStop`; restart calls `onStart` again without calling `onStop`. Persistence and other domain operations have their own concurrency and lifetime policy. Marionette does not automatically cancel work started outside preparation. See [retained restart](../guides/retained-restart.md) and [lifetime choices](../architecture.md#choose-what-survives-an-operation).

## Child Applications

`childApps: { summary: SummaryApplication }` constructs a child once with its parent. For per-instance arguments, construct and register it explicitly.

| Method | Contract |
| --- | --- |
| `addChildApp(name, child)` | Registers and returns the instance without starting it. |
| `getChildApp(name)` | Returns the registered instance or `undefined`. |
| `hasChildApp(name)` | Reports whether the name is registered. |
| `getChildApps()` | Returns a new name-to-instance map; changing it does not change registration. |
| `getName()` | Returns the registered name or `undefined`. |
| `removeChildApp(name, options?)` | Destroys the child synchronously and returns it, or `undefined` for an unknown name. A callback failure throws. |

Names must be nonempty. Children must share the parent's runtime and have one owner/name. Self/ancestor registration, conflicting names and multiple owners throw `MN0031`. Repeating the same registration is harmless. A destroying/destroyed parent or child cannot acquire a new registration. Successful child destruction unregisters it automatically.

Registration owns lifetime, not readiness. Parent start does not start or await children. Start prerequisites explicitly in preparation when their readiness is required; handle the separate Promise when starting a child from a notification. Parent restart leaves children active. To reprepare a child too, call its `restart()` explicitly.

Parent stop traverses children in registration order, including descendants beneath stopped intermediate owners. Child instances remain registered for reuse. Parent destruction stops descendants before `before:destroy`, which can inspect stopped, live children; it then destroys children in registration order. Descendant start/restart is blocked during an ancestor's stop or terminal phase. There are no Application add/remove-child notification events.

### Child operations during lifecycle notifications

These phase rules apply to both method hooks and event listeners: `onBefore…` / `on('before:…', callback)`, and `onStop` / `on('stop', callback)`. Hooks run first; listeners then run synchronously in registration order. A notification is not an awaited coordination step.

| Parent notification | Child operation and consequence |
| --- | --- |
| `before:start` | An explicit child `start()` or `restart()` can begin, but its Promise is not awaited by the parent, even if the callback returns it. An explicit child `stop()` completes synchronously; it does not cancel parent startup. |
| `before:stop` | The parent is already stopping. Descendant `start()` and `restart()` resolve `false`, including from descendant cleanup callbacks. Explicitly stopping a child early is safe; normal parent teardown still stops the remaining descendants. |
| `before:destroy` | Descendants have already been stopped and are about to be destroyed. Inspect or release external resources here; descendant activation resolves `false`. New child registration is ignored and leaves the supplied instance owned by the caller. |
| `stop` after ordinary stop | Cleanup has finished, so an explicitly requested next run can start if no ancestor is still stopping. A child can run while its parent remains stopped; starting the parent does not start children automatically. When an ancestor is stopping this parent, descendant activation still resolves `false` during the parent's `stop` callback. During destruction, terminal ownership still blocks activation. |

When child readiness is required for parent success, await it in `prepareStart`, check the preparation signal after the await, and handle a canceled child result explicitly:

```js
import { Application } from 'marionette';

const Feature = Application.extend({
  childApps: { results: Application },
  async prepareStart(options, { signal }) {
    const started = await this.getChildApp('results').start();
    signal.throwIfAborted();
    if (!started) { throw new Error('Required child did not start'); }
  },
});

const feature = new Feature();
await feature.start();
```

Use the child's `restart()` in preparation only when it should reprepare too; `start()` preserves an already-running child. Parent stop cancels pending child readiness. A rejected parent preparation does not roll back already-started children; explicitly stop or destroy the parent when abandoning that startup.

Calling parent `stop()` from its `before:start` callback is supported cancellation, but it does not cancel the remaining notification listeners. A later listener can still perform side effects or independently start a child after that stop has finished. Keep required child activation in `prepareStart`, which only begins if the parent preparation is still current, instead of distributing dependent lifecycle actions across notification callbacks. Starting an optional child from a notification remains explicit independent work: handle its Promise and rejection yourself.

Do not unconditionally call the same Application's `restart()` from its `before:start` callback: restart emits `before:start` again and supersedes the outer attempt. A conditional redirect must terminate; for ordinary refresh, request restart from the coordinating caller. A repeated `start()` during initial preparation joins that pending preparation instead. These rules do not prohibit synchronous preparation of state or inspection in before hooks.

## Root View and Region

| API | Contract |
| --- | --- |
| Constructor `region` | Builds an owned Region or borrows an existing instance. See [Region construction](region.md#construction-and-options). |
| `start({ region })` | Binds an existing Region from the same runtime before startup preparation. An active or pending start ignores newly supplied options. Use `stop(); await start({ region })` to move hosts. |
| `restart({ region })` | Forwards the option to hooks while retaining the current destination. |
| `getRegion()` | Returns the current destination or `undefined`. |
| `setView(view)` | Owns a prepared root without rendering/mounting it and returns it. Replacing a prepared root destroys that root. |
| `getView()` | Returns this Application's prepared root, otherwise its displayed root, or `undefined`. |
| `showView(view?, options?)` | Selects a supplied root and shows it through the destination with Region `ShowOptions`. Returns the root, or `undefined` if none exists. A destination is required when a root exists. If the root is already displayed, returns it without showing again; supplied options have no effect. |

`setView` → the root's `showChildView` → `showView` allows composition before attachment. A prepared replacement leaves the displayed root in place until shown. Display transfers ownership to Region; Application tracks its displayed root. Stop/destroy clean prepared and displayed roots. Restart does neither automatically. `Region.empty()` clears displayed content and its Application association; it does not stop the Application or destroy a separate prepared root.

A selected View must be live and unowned (`MN0007` for destroyed, `MN0003` for another owner). Selecting the same root is harmless. Reselecting the displayed root destroys any prepared replacement. Content shown directly through a Region is Region-owned and cannot be adopted. During/after Application destruction, set/show methods return their supplied View without adopting it; its caller remains responsible.

An Application can own [existing markup](view.md#existing-elements) with `setView(new PageView({ el, template: false }))`, without rendering or a destination. Stop removes that View's element; a later start needs markup again. Applications can also have no root UI.

Stop retains the destination. Destroy disposes a Region built from configuration; a borrowed Region survives. Stop leaves another owner's replacement in a borrowed Region alone. An owned Region's current content is cleaned. Moving to a new destination disposes the old owned Region; old borrowed Regions survive.

### Destination binding order

Initial startup binds the requested Region before `before:start` and `prepareStart`. Omitting `region` keeps the current host. A failed or cancelled preparation does not roll back host binding already completed. Restart uses the current host, including when its forwarded options contain another Region.

### View events

`viewEvents: { submit: 'saveDraft' }` observes events from roots selected with `setView` or `showView`, including a prepared View before display. A function declaration resolves with the Application as `this`; handlers also receive that context and the View event arguments unchanged.

Bindings are made once per selected View through ordinary `listenTo`. They remain active while stopped, during preparation, and when a live View is detached. They end when the View or Application is destroyed, or when explicitly removed with `stopListening`. Reselecting a View does not duplicate or restore explicitly removed bindings. A live replaced source retains ordinary listener lifetime; bind manually if a narrower scope is needed.

## State and Radio

State comes from owned `createState(options)` or borrowed `state`; read it with `getState()`. Start/stop/restart retain the source. Declarative `stateEvents` deliver while `isRunning()` is true, including an active restart; stopped/initial preparation changes are not replayed. Ordinary `listenTo` subscriptions retain their source lifetime. See [state ownership](shared/state.md).

`Application.setStateApi(api)` overlays the receiving class's provider and returns it. `State` is the provider. Configure it before construction; see [StateApi](shared/state.md#configure-the-stateapi).

### Radio bindings

`channelName`, `radioEvents`, `radioRequests`, `getChannel()` and `Radio` follow [declarative Radio bindings](shared/common.md#declarative-radio-bindings). They are active while stopped or running. Destruction releases this Application's bindings while preserving the shared channel.

## Lifecycle hooks and events

Events dispatch their hook first, then subscribers, through [triggerMethod](shared/events.md). Hook and subscriber arguments match.

| Event | Hook | Arguments and timing |
| --- | --- | --- |
| `before:start` | `onBeforeStart` | `(app, options)` before preparation; inactive for initial start, still active for a running restart. |
| `start` | `onStart` | `(app, options, result)` after current preparation succeeds and activity is true. |
| `before:stop` | `onBeforeStop` | `(app, options)` before child stops and root cleanup. Ordinary stop is still active here; destroy has deactivated. |
| `stop` | `onStop` | `(app, options)` after successful child/root cleanup, while inactive. May start the next run. |
| `before:destroy` | `onBeforeDestroy` | `(app, options)` after stop/root cleanup, before child destruction. |
| `destroy` | `onDestroy` | `(app, options)` after terminal state, child/owned-Region disposal, parent unregistration and Radio/state cleanup. Subscriptions are cleared afterward. |

Restart has no separate event and uses only the startup notifications. `preinitialize` and `initialize` are constructor hooks.

### Restart from start completion

The current preparation is complete before `onStart` and `start` subscribers. A restart requested there starts a new preparation with its own options and Promise. The completed outer call resolves `true`, describing its own successful completion, even if the new preparation fails or is superseded later.

## TypeScript

Import `ApplicationOptions`, `ApplicationStartOptions`, `ApplicationRestartOptions`, `LifecycleContext`, `ApplicationInstance`, and `ApplicationConstructor` from `marionette`. Constructor and per-operation options are separate. `LifecycleContext` contains the preparation signal. `ApplicationInstance<Options, State, StartResult>` describes constructor options, state and the successful result. `extend` carries the awaited return type of `prepareStart` into that contract. Annotate overridden hook parameters as in the example.

Start destinations use `RegionInstance`; constructor definitions use `RegionDefinition`/`RegionClass`. Root methods preserve a supplied View's type. Child lookup/removal returns the common Application interface; narrow it for child-specific methods. Shared types are listed with their [state](shared/state.md) and [event](shared/events.md) contracts.
