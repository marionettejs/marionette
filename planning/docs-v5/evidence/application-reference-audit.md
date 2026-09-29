# Application reference contract audit

Audited 2026-09-29 against local v5 source (`5.0.0-rc.2`). Source and tests establish runtime contracts, not ideal application architecture or reader effectiveness. No runtime, tests, or public documentation were changed by this audit.

## Sources and verification

Primary sources: `src/modules/application.ts`, `src/modules/common/build-region.ts`, `src/mixins/common.ts`, `src/mixins/state.ts`, `src/mixins/radio.ts`, `src/mixins/destroy.ts`, `src/index.ts`, and `test/types/application.mts` / `.cts`. The Application overrides the synchronous DestroyMixin method with its asynchronous lifecycle implementation.

Command run:

```sh
npx vitest run test/unit/application.spec.js test/unit/application-lifecycle.spec.js test/unit/application-preparation.spec.js test/unit/application-restart-completion.spec.js test/unit/application-child-declarations.spec.js test/unit/application-child-lifecycle.spec.js test/unit/application-ownership.spec.js test/unit/application-root-view.spec.js test/unit/application-prepared-view.spec.js test/unit/application-start-region.spec.js test/unit/application-state.spec.js test/unit/application-state-events.spec.js test/unit/model-based/application.spec.js test/unit/object-application-composition.spec.js test/unit/destroy-listener-cleanup.spec.js
```

Result: **15 files passed; 276 tests passed**, exit 0. This includes generated lifecycle sequences as individual model-based tests; it is not a full-suite, package, browser, or reader-effectiveness result. Existing type fixtures were inspected, not separately compiled in this audit.

Supplemental shared Radio command:

```sh
npx vitest run test/unit/radio-composition.spec.js test/unit/mixins/radio.spec.js
```

Result: **2 files passed; 13 tests passed**, exit 0. These verify singleton composition and the shared Radio mixin through MnObject. The main run separately includes Application asynchronous Radio teardown coverage; the supplemental count must not be described as additional Application-specific cases.

## Construction and configuration inventory

Construction order is options merge/cid, `preinitialize`, Region, Radio, state configuration, child declarations, `initialize`, then configured state-event subscription. `createState` is lazy until needed by `getState` or state-event setup. Both constructor hooks receive constructor arguments; their return values are not readiness gates.

| Public member/configuration | Disposition and contract |
| --- | --- |
| `options`, `cid`, `cidPrefix` | Common class configuration/identity. Prefix defaults to `mna`; options remain construction options, not current start options. |
| `preinitialize(options?)`, `initialize(options?)` | Supported constructor hooks. `preinitialize` configures before Region/Radio/state/children; `initialize` can access constructed children. |
| `region`, `regionClass` | Constructor-copied configuration. Definition accepts Region instance, selector, Region class, or Region options with optional class; default class Region. Definitions create an owned Region; supplied instance is borrowed. Same runtime required (`MN0030`). |
| `childApps` | Class/getter/constructor-option map of zero-argument Application constructors, or function returning that map on parent receiver. Resolved once before initialize. Fresh child instances; parent options are not forwarded. Option/inherited map replaces, not merges. It is read with getOption, not copied by ClassOptions. |
| `channelName`, `radioEvents`, `radioRequests` | Constructor-copied values or zero-argument functions. A truthy name initializes the channel and bindings during construction. Maps use shared bindEvents/bindRequests conventions. |
| `state`, `stateEvents`, `createState`, `getState`, `State` | State mixin contract; state supplied by option/property is borrowed, createState result owned. stateEvents copied and subscribed after initialize, delivered only while isRunning. State survives stop/restart, owned state disposed at final destroy. |
| `Radio`, `getChannel()` | Radio provider and optional initialized Channel. Radio subscriptions/replies are not activation-gated; final destroy removes application-context channel replies and listening. |
| `isRunning()`, `isDestroyed()` | Activation and terminal completion queries, not detailed phase enum. `isRunning` becomes true before start notification. Normal stop permission keeps activation until deactivation/root teardown; destroy begins inactive immediately. `isDestroyed` becomes true before final destroy notification. |

Class statics: `extend`, `setStateApi`, and ordinary callable-constructor `call`/`apply`/`prototype`. No Application `setRenderer`, `setDomApi`, `setDataApi`, or `setRadioApi` static. Configure isolated providers through the runtime factory where applicable.

## Lifecycle contract

All four methods return `Promise<boolean>`. True means this operation reached completion or the requested stable state already holds. False means superseded/blocked work, or a child stop traversal could not complete. Rejection means a current preparation, synchronous hook/event callback, or teardown failed. Returning false from a preparation is not a veto: `prepareStart(false)` is a successful result passed to start completion. Throw/reject to fail preparation.

| Method | Stable-state behavior |
| --- | --- |
| `start(options?)` | Stopped: bind optional existing Region, before:start, await prepareStart, commit running, start. Running: true with no repeated startup. Destroying/destroyed or teardown-blocked descendant: false. |
| `stop(options?)` | Running/starting: before:stop, await prepareStop, stop children sequentially, deactivate, empty selected root, stop. Already stopped: silently drain children/roots without owner stop hooks. Destroyed: true. |
| `restart(options?)` | Stop/deactivate and remove old root, then fresh start preparation/activation. Already stopped skips owner stop notifications but cleans descendants and roots. Retains child Application instances and state; child starts remain explicit. Destroying/destroyed or teardown-blocked descendant: false. |
| `destroy(options?)` | Stop if needed, clear root, before:destroy, await prepareDestroy, destroy children sequentially, destroy owned Region, release host, mark destroyed/remove child ownership, release Radio/state, destroy, stopListening/off. Already destroyed: true. |

`start` is local readiness: it neither automatically starts children nor waits for arbitrary child work launched by a notification. Await required child starts in prepareStart and handle their boolean outcomes explicitly. Start failure does not automatically stop children already explicitly started. A successful stop removes the root, including its owned View tree. Restart is a full run boundary, not a request refresh or retained-layout rerender.

### Preparation and notifications

| Preparation | Awaited value |
| --- | --- |
| `prepareStart(options, {signal})` | Sync value/PromiseLike result forwarded as third start argument. Absent hook yields undefined. |
| `prepareStop(options, {signal})` | Completion awaited; result ignored. |
| `prepareDestroy(options, {signal})` | Completion awaited; result ignored. |

Notifications are `before:start` / `onBeforeStart`, `start` / `onStart`, `before:stop` / `onBeforeStop`, `stop` / `onStop`, `before:destroy` / `onBeforeDestroy`, `destroy` / `onDestroy`. They receive `(application, options)`, except start receives `(application, options, preparationResult)`. They use shared triggerMethod ordering. Returned Promises are ignored; synchronous throws reject the current operation. There are no separate restart notifications, error events, or automatic Promise-based event gates.

Each preparation context contains an AbortSignal. Superseding obsolete preparation aborts that signal and suppresses stale lifecycle completion; it does not itself cancel arbitrary side effects. Pass the signal to operations that support cancellation or guard custom work. Completed readiness is not a lifetime signal: later stop does not abort a signal whose start preparation already completed.

### Overlap, failure and retry

- Pending compatible starts share one Promise and the first options. Running start is idempotent. A supplied different Region while running/starting rejects `MN0041`; omitted region is compatible.
- Pending stops share one Promise. Pending compatible restarts share one Promise/options through stop and start preparation; a completion-triggered restart is a distinct cycle. A newer restart can supersede a pending restart when requesting a different host.
- Destroy cannot be superseded. Repeated destroy shares its Promise; start/restart cannot revive it. A stop during destroy waits for its in-flight stop phase, not necessarily full destroy.
- Superseding pending work normally resolves the old operation false. An operation already in its committed completion notification stays successful if that notification starts another operation.
- A replacement may adopt in-flight stop preparation: original options and signal remain, without repeating prepareStop. A superseding start waits for that preparation and suppresses stale stop notification. Do not simplify overlaps to a FIFO queue or claim every supersession aborts every signal.
- Initial prepareStart failure leaves stopped. Stop permission failure from a running app restores running. A restart whose stop completed but startup fails remains stopped. Completion-hook failure rejects but retains committed state: onStart failure leaves running; onStop failure leaves stopped; onDestroy failure after terminal commit leaves destroyed.
- Teardown is not transactional. Successfully stopped/destroyed children stay that way after a later sibling fails. Failed destroy before terminal commit can be retried; unfinished children remain registered. A newly bound startup Region remains bound after readiness failure.
- Descendant start/restart is blocked while an ancestor stops, deactivates during restart, or destroys, including owner stop callbacks. Explicit child starts are permitted again in restart startup preparation. A stably stopped owner does not globally forbid an independently started child.

Evidence: `application-lifecycle.spec.js`, `application-preparation.spec.js`, `application-restart-completion.spec.js`, `application-child-lifecycle.spec.js`, `application-start-region.spec.js`, and `application-state-events.spec.js` cover these boundaries.

## Child Application inventory

| Method | Return / behavior |
| --- | --- |
| `addChildApp(name, instance)` | Same instance synchronously; ownership registration only. Identical registration is idempotent. Rejects empty name, self/ancestor cycles, duplicate name, another owner/name, cross-runtime child with `MN0031`. Terminal parent or same-runtime terminal child returns untouched without registration. |
| `getChildApp(name)` | Registered child or undefined. |
| `hasChildApp(name)` | Boolean, no allocation. |
| `getChildApps()` | Fresh name-keyed object snapshot; editing it does not alter ownership. Names colliding with Object prototype are supported. |
| `getName()` | Assigned parent name or undefined after removal/direct destroy; root unnamed. |
| `removeChildApp(name, options?)` | Promise of destroyed child; undefined if missing. It destroys, not detaches. Rejection leaves unfinished child registered; direct child destruction unregisters it automatically before onDestroy. |

Parent stop retains child instances and registration; parent destroy destroys them after parent prepareDestroy, sequentially in registration order. Child declarations do not reconstruct removed children or automatically start them after restart. No add/remove child lifecycle events, public parent getter, detach-child Application operation, or automatic child-event forwarding are implemented.

## Region and root View inventory

| Method | Return / behavior |
| --- | --- |
| `getRegion()` | Current Region or undefined. |
| `setView(view)` | Same View synchronously, selects/prepares without showing or rendering. Application owns prepared root; replacing preparation destroys prior prepared root and its children but leaves displayed root until show. Selecting displayed root cancels pending replacement. Rejects destroyed View `MN0007`, already-owned View `MN0003`. Terminal app returns supplied View without adoption. |
| `showView(view?, options?)` | Selected/supplied View or undefined synchronously. Supplied View is first setView; Region.show gets ShowOptions. Successful show transfers ownership to Region and tracks displayed root. Repeated show of current root is idempotent. With selected root, a Region must exist. No selected root is a no-op even without Region. |
| `getView()` | Prepared root if any, otherwise tracked displayed root; not simply region.currentView. Direct/external Region show is not adopted by Application. |

Constructor-created Region is owned/destroyed. Existing constructor or start Region is borrowed/released; stopping only removes that app's currently displayed root there and preserves unrelated external replacement. An owned Region's current View is cleared even if shown directly. Prepared roots are also destroyed on stop, including when already stopped. External empty/destroy releases the displayed association.

`start({region})` and `restart({region})` require an existing same-runtime Region instance, not selector/options/class. Region binding occurs before before:start; absent/undefined retains current host. Changing a host on a stopped app or during restart cleans old associated root and destroys prior owned Region before borrowing new one. Prepared root survives stopped host rebinding. Failed stop does not bind the requested new host.

`setView` then `getView().showChildView(...)` can compose a detached page before `showView`; do not claim setView itself renders. For optional allowed missing mount, prepared ownership remains if Region.show does not mount; Region recovery limitations belong to the Region reference, not a new helper in this page.

## Shared/internals/types dispositions

Inherited public common surface: `getOption`, `mergeOptions`, `normalizeMethods`, `bindEvents`, `unbindEvents`, `bindRequests`, `unbindRequests`; `on`, `off`, `once`, `listenTo`, `listenToOnce`, `stopListening`, `trigger`, `triggerMethod`. Link canonical common/events/state references instead of duplicating them. No View UI helpers or DOM delegate APIs apply to Application.

All underscore lifecycle/ownership/region/readiness state is internal: `_lifecycleState`, `_lifecycleOperation`, `_isRunning`, `_isDestroyed`, `_parentApp`, `_name`, `_childApps`, `_region`, `_ownedRegion`, `_preparedView`, `_displayedView`, mixin initialization/destruction fields and helpers. Local nonexported operation/readiness interfaces, functions, and runtime identity symbol are implementation evidence, not consumer API.

Named root type exports: `ApplicationInstance<Options, State, StartResult>`, `ApplicationConstructor<Props, Args, State, Statics>`, `ApplicationOptions`, `ApplicationStartOptions`, `LifecycleContext`. StartResult is the preparation-result type seen by onStart; all lifecycle operation results remain boolean. Extended constructor inference tracks configured options, supplied/factory state, and awaited prepareStart result. Child getter type remains base ApplicationInstance or undefined; declaration constructors take no arguments. Native classes use a getter for typed childApps customization, because the declared childApps surface is a property.

## Canonical public coverage and draft review

The reference draft was checked against the inventory above. Public member/type names and the central ownership/readiness boundaries have destinations independent of the records example:

| Contract | Public destination |
| --- | --- |
| Constructor hooks, option forms, identity, subclass setup | [Construction and options](../../../docs/api/application.md#construction-and-options) |
| start/stop/restart/destroy, activation/terminal queries, return values | [Lifecycle methods and results](../../../docs/api/application.md#lifecycle-methods-and-results) |
| Async hooks, signals, notification distinction, partial failure | [Preparation, cancellation, and failure](../../../docs/api/application.md#preparation-cancellation-and-failure) |
| New run versus preserving page/input identity | [Restart and retained UI](../../../docs/api/application.md#restart-and-retained-ui) |
| Declarations, dynamic registration/removal/lookup/name, ownership lifetime | [Child Applications](../../../docs/api/application.md#child-applications) |
| setView/getView/showView/getRegion, constructed/borrowed host, operation binding | [Root View and Region](../../../docs/api/application.md#root-view-and-region) |
| State ownership/gating/provider and Radio binding/disposal | [State and Radio](../../../docs/api/application.md#state-and-radio), [Radio bindings](../../../docs/api/application.md#radio-bindings) |
| Six notification hooks/events, arguments/order | [Lifecycle hooks and events](../../../docs/api/application.md#lifecycle-hooks-and-events) |
| Root exported Application types and type inference | [TypeScript](../../../docs/api/application.md#typescript) |

No confirmed API error was found in the initial draft. Two clarification requests were sent to the author: explicitly identify the stopped state after failed restart startup/onStop failure, and distinguish the preparation signal from a lifetime signal that would abort after already completed readiness. A smaller configuration suggestion was to state that child declarations resolve once and replace rather than merge. These are review requests, not evidence of later edits; the final result record should identify their actual disposition.

## Final verification follow-through

The author incorporated all three draft clarification requests in the public page. The installed-package probe subsequently compiled both `test/types/application.mts` and `.cts` against the candidate declarations, along with the standalone Application TypeScript fence; their source hashes are in [the package report](application-package.json). Existing-markup/no-Region stop teardown is also asserted by the installed example harness. The results record distinguishes these fresh checks from the earlier source-only audit.
