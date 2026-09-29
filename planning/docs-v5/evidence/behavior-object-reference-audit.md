# Behavior and MnObject reference contract audit

Audited 2026-09-29 against local v5 source (`5.0.0-rc.2`). Source and tests establish runtime contracts, not ideal application architecture or reader effectiveness. This audit changes no runtime, tests, or public documentation.

## Sources and verification

Primary sources: `src/modules/behavior.ts`, `src/modules/object.ts`, `src/modules/common/chainable-methods.ts`, `src/modules/view.ts`, `src/modules/collection-view.ts`, `src/mixins/{behaviors,common,destroy,radio,state,ui,view,view-events,delegate-entity-events}.ts`, `src/runtime/{state-api,event-delegator}.ts`, and `src/index.ts`.

Command run:

```sh
npx vitest run test/unit/behavior.spec.js test/unit/behavior-lifecycle.spec.js test/unit/behavior-communication-contract.spec.js test/unit/behavior-dependencies-contract.spec.js test/unit/behavior-ui-contract.spec.js test/unit/behavior-dom-delegation-contract.spec.js test/unit/behavior-initialize-cleanup.spec.js test/unit/behavior-composition.spec.js test/unit/mixins/behaviors.spec.js test/unit/mixins/behaviors-composition.spec.js test/unit/object.spec.js test/unit/object-application-composition.spec.js test/unit/mixins/destroy.spec.js test/unit/mixins/radio.spec.js test/unit/state-owner.spec.js test/unit/destroy-listener-cleanup.spec.js test/unit/destroyed-bind-ui-elements.spec.js test/unit/mixins/delegate-entity-events.spec.js
```

Result: **18 files passed; 185 tests passed**, exit 0. These include shared owner and listener cleanup tests also run for prior slices; do not add them to prior counts as unique cases. Some legacy fixtures supply an external data adapter; those verify adapter contracts, not a preferred application design. This is not a full-suite, package, browser, or teaching-effectiveness result.

## Behavior construction and configuration

Normal installation is through a host View or CollectionView's `behaviors` declaration. It accepts an array or object of Behavior constructors or `{ behaviorClass, ...options }` definitions, or a function producing that structure on the host. A constructor entry receives `{}` and the host; an object entry receives the entire definition object and the host. Object keys label declarations; there is no public getBehavior-by-key method. Each construction creates new instances.

Nested `behaviors` declarations are parsed recursively after the declaring Behavior is constructed. Each nested instance belongs to the same host, with its own definition options. Removing a declaring Behavior directly does not remove its nested peers. Nested `behaviors` is a prototype declaration evaluated by the parser; it is not one of Behavior's promoted constructor options. A raw `new Behavior(options, host)` initializes subscriptions but does not register the instance into the host's managed Behavior list; install through the declaration for managed lifecycle.

Construction order: record `view`; combine options/cid; initialize DOM cleanup tracking and `el`; configure state; capture merged Behavior/host UI selectors; subscribe to host `all`; call `initialize(options, host)`; subscribe configured stateEvents; delegate DOM events/triggers unless initialize destroyed the Behavior. No Behavior `preinitialize` call. Host `preinitialize` precedes Behavior construction; host `initialize` follows it. After host initialization and entity binding, the host explicitly sends `initialize(host, hostOptions)` to Behaviors, invoking `onInitialize`.

| Public member/configuration | Disposition and contract |
| --- | --- |
| `options`, `cid`, `cidPrefix` | Shared class/option conventions. Default prefix `mnb`. Host options are not automatically inherited. Custom collaborators remain in options, accessible with getOption; they are not automatically owned/disposed. |
| `view`, readonly `el` | Exact host and host's fixed Element. No separate root, rendering API, Region management, or public `isDestroyed` on Behavior. |
| `events`, `triggers`, `ui`, `modelEvents`, `collectionEvents`, `stateEvents` | Six recognized constructor keys promoted to instance. Passed maps replace inherited maps. Map factories are called with Behavior context; host UI factory uses host context. |
| `state`, `createState`, `getState`, `State` | Shared State ownership contract. Explicit supplied state or prototype state is borrowed; createState result is lazy and owned. State persists for this Behavior's lifetime, not per render. It is not implicitly the host's state. |
| `initialize(options, host)` | Runs before host initialize. Own supplied options and exact host are available. No awaited return. |
| `EventDelegator` | Behavior's provider for its own DOM subscriptions. Host Dom/query provider is used for `$` and UI lookup. Host Data provider is used for entity subscriptions. |

Statics: `extend`, `setEventDelegator`, `setStateApi`; callable-constructor `call`/`apply`/`prototype` and shared `__super__`. No Behavior `setDomApi`, `setDataApi`, `setRenderer`, or Radio composition. The State setter merges provider methods into a new prototype provider and returns the constructor; EventDelegator setter replaces the provider and returns the constructor.

## Behavior methods and communication

| Public method | Contract |
| --- | --- |
| `$(selector)` | Proxies host.$, preserving its configured query result. |
| `getUI(name)` | Bound query result or undefined for an absent key; requires UI to have been bound (`MN0023`). |
| `bindUIElements()`, `unbindUIElements()` | Bind/restore this Behavior's captured UI selectors; return Behavior. Bind is a no-op when host is destroying/destroyed. |
| `normalizeUIString(value, bindings?)`, `normalizeUIKeys(hash, bindings?)`, `normalizeUIValues(hash, property?, bindings?)` | Shared UI utilities. String/key expansion validates own UI keys (`MN0018`); key helper creates a new map, value helper mutates/returns supplied map. |
| `delegateEntityEvents()`, `undelegateEntityEvents()` | Subscribe/unsubscribe Behavior's modelEvents and collectionEvents against current host.model/collection via host.Data. Return Behavior; delegation is a no-op when host destroying/destroyed. Undelegate before source/map changes and redelegation; delegate does not first clear old bindings. |
| `destroy()` | Synchronous cleanup, returns Behavior; no separate before:destroy/destroy notifications, no host DOM removal. See lifecycle below. |
| Shared options, event and binding methods | getOption, mergeOptions, normalizeMethods, bindEvents, unbindEvents, bindRequests, unbindRequests; on, off, once, trigger, triggerMethod, listenTo, listenToOnce, stopListening. Canonical details remain in common/events references. |

DOM `events` callbacks run on the Behavior, receiving the DOM event. DOM `triggers` invoke the host's triggerMethod and pass `(host, domEvent, ...args)`; preventDefault and stopPropagation default true. Host event forwarding invokes Behavior triggerMethod with the host event's original arguments and Behavior context. A Behavior's own triggerMethod remains local; explicitly calling view.triggerMethod broadcasts through the host, including back to the sender. Child event handlers only run on the host unless the host emits an event; childViewTriggers and configured event prefix generate events that Behaviors receive.

Host.delegateEvents undelegates and reinstalls both host and Behavior handlers; no public Behavior.delegateEvents/undelegateEvents pair exists. `_delegateViewEvents` and `_undelegateViewEvents` appear in structural types but are internal composition plumbing, not promoted public APIs.

## Behavior UI, state, and lifecycle boundaries

UI selectors merge once during Behavior construction with host keys winning. They are captured before Behavior.initialize; changing an external UI factory result later does not refresh this captured map. Rendering a host template binds Behavior UI before forwarded render notifications. Re-render refreshes query collections against replacement elements. A template-less CollectionView does not automatically bind Behavior UI while rendering its children; explicit bindUIElements is available. An adopted pre-rendered View binds its own UI before constructing Behaviors; do not promise Behavior.getUI works during initialize, or treat already-bound host queries as new selector strings.

Model/collection subscription setup occurs after host initialize through host.delegateEntityEvents. StateEvents setup occurs after Behavior.initialize, before host initialize. StateEvents require a matching State provider; the default unconfigured provider throws MN0037. They are delivered for the Behavior's live lifetime, with no Application-style activation gate.

| Host phase | Behavior observation/cleanup |
| --- | --- |
| Host before:render/render, before:attach/attach, before:detach/detach | Forwarded with original arguments, after the host's same-named hook. Same Behavior instance survives these transitions. |
| Host before:destroy | Forwarded while host reports not destroyed; before host UI/DOM teardown. This is a host notification, not a call to Behavior.destroy. |
| Host teardown | Host unbinds UI, removes DOM/children, marks itself destroyed, then calls each managed Behavior.destroy. This releases DOM/entity subscriptions, owned State, outgoing listeners, and registration. |
| Host destroy | After host cleanup and host destroy notification, host explicitly forwards destroy(host, options) to its remaining managed Behaviors. Their owned State is already disposed; UI is unbound. Host finally releases their incoming listeners. |
| Direct Behavior.destroy | Removes only this Behavior's participation and incoming listeners; does not call onBeforeDestroy or onDestroy. Host/nested peers remain alive. |

No independent destroy lifecycle should be invented to describe Behavior.destroy. Override destroy and delegate to the parent method if cleanup must run on both direct removal and host teardown; use forwarded onDestroy for observing host completion. Direct destroy has no explicit idempotence guard, so do not promise an overridden destroy method runs once under repeated manual calls. Host teardown itself is guarded and ordinarily releases managed instances once. Manual request replies are not removed merely by stopListening; use unbindRequests when owning such replies.

## MnObject construction, configuration and surface

Construction combines options/cid; initializes Radio; configures state; invokes initialize with constructor arguments; then installs stateEvents. There is no preinitialize hook. Default cidPrefix is `mno`. A custom initialize can use getChannel immediately; createState is evaluated only when state is first needed. Constructor/initialize return values are not asynchronous readiness gates.

| Public member/configuration | Disposition and contract |
| --- | --- |
| `options`, `cid`, `cidPrefix`, `initialize(options?)` | Shared options/identity/initialization contract. Custom options are not automatically copied to instance fields. |
| `channelName`, `radioEvents`, `radioRequests`, `stateEvents` | Four recognized constructor keys promoted to instance; each Radio declaration may be a value/map or zero-argument factory evaluated on the owner. |
| `state`, `createState(options?)`, `getState()`, `State` | Shared lazy State and owned/borrowed lifetime. Supplied state is not disposed; created state is disposed at destroy through configured State.disposeOwned. No activation gating for stateEvents. |
| `Radio`, `getChannel()` | Radio provider and optional initialized channel; no channel if channelName is falsy. No native MnObject.request method; use the channel/Radio API. |
| `isDestroyed()` | False before final teardown transition; true before destroy notification. |
| `destroy(options?)` | Synchronous return of same receiver. Idempotent/reentrant guard, before:destroy and destroy notifications, state/Radio/listener cleanup. |
| Shared options, event and binding methods | getOption, mergeOptions, normalizeMethods, bindEvents, unbindEvents, bindRequests, unbindRequests; on, off, once, trigger, triggerMethod, listenTo, listenToOnce, stopListening. |

Statics: `extend`, `setStateApi`, callable-constructor `call`/`apply`/`prototype`, and shared `__super__`. No MnObject setRadioApi static, DOM/Data/render/lifecycle-start APIs, or implicit arbitrary collaborator destruction. Use an Application for managed activation/readiness/children/root presentation.

### Radio and synchronous destruction

Truthy channelName resolves a channel first, then radioEvents, then radioRequests, before initialize. Declarative handlers use the owner's context and shared function/method-name binding rules. A falsy channelName skips both declaration factories. Binding factory errors propagate from construction. Channel configuration is resolved once; mutating channelName later does not rebind it.

Normal destroy sequence: mark destroying; triggerMethod('before:destroy', object, options); mark destroyed; remove replies on the configured channel with this owner context and outgoing listening to that channel; release State; triggerMethod('destroy', object, options); finally stopListening and off. Shared channel/unrelated handlers remain. Removing replies is owner-context cleanup on the configured channel, not merely removal of the original radioRequests map. Requests registered on other channels require explicit unbindRequests.

Both hooks/events are synchronous notifications; returned Promises and false values are not awaited/vetoes. Errors propagate. Cleanup in the final try/finally ensures outgoing/incoming listeners are released if Radio/State/final destroy notification throws; an exception from before:destroy occurs before that finally and prevents normal completion. Avoid a blanket claim that every failing destroy completes all resource cleanup. Native incoming listener cleanup is automatic; observing code needs no destroy-to-stopListening boilerplate.

## Public types and deliberate exclusions

- Behavior exports: `BehaviorInstance<Options, Host, State, Query>`, `BehaviorConstructor<Props, Args, State, Statics>`, `BehaviorOptions`, `BehaviorHost<Query>`, `BehaviorDefinition`, `BehaviorDefinitions`, `BehaviorOptionsDefinition`.
- Behavior constructor requires its host argument even when initialize names only options. It retains supplied host methods/query type, supplied/factory state inference, options inference, fluent return types, and static extensions. BehaviorHost is a structural integration contract; its `_removeBehavior` and lifecycle flags support composition, not consumer methods to call.
- MnObject exports: `MnObjectInstance<Options, State>` (alias of the instance interface) and `MnObjectConstructor<Props, Args, State, Statics>`. Constructor options, initialize/custom constructor arguments, state, subclass overrides, and static properties are inferred by extend. The root's default State type is object; constructor-supplied state supersedes factory state inference.
- Shared relevant exported types: Bindings, EventsContract, EventSource, EventCallback, EventMap, UIBindings/UISelectors, DOMEvents/DOMTriggers/TriggerDefinition/TriggerOptions, StateApiContract, EventDelegator/DelegateOptions/DelegatedEvent, Channel/RadioApi. Full adapter/Radio references remain separate coverage work.
- Type-only inference machinery in object.ts (`ArgumentsFor`, `Constructed`, `DefaultOptions`, `Merge`, `OptionsFor`, `StateFor`, `SuppliedState`, `Instance`, `MetadataFor`) is not exported from the package index and is excluded from reader-facing class API.
- Underscore initialization/subscription/cache/parser methods are internal. No tests are a basis for documenting those internals as public. `_delegateViewEvents`/`_undelegateViewEvents` type visibility is explicitly accounted for above.

## Focused declaration check

```sh
npx tsc --ignoreConfig --noEmit --strict --skipLibCheck false --target ES2024 --module NodeNext --moduleResolution NodeNext --types node test/types/presentation.mts test/types/presentation.cts test/types/consumer.mts test/types/consumer.cts test/types/lifecycle-mixins.mts test/types/lifecycle-mixins.cts test/types/fixed-root.mts test/types/fixed-root.cts
```

Result: **8 existing fixtures compiled**, exit 0, against the checkout's existing exported declarations. This was not a fresh package build. An initial invocation without `--ignoreConfig` stopped at TypeScript TS5112 before compilation; adding the required explicit config bypass allowed the targeted invocation above to run. Package-installed reference examples and type fixtures are verified separately by the parent workflow.

## Draft reference review

Reviewed `docs/api/behavior.md`, `docs/api/mnobject.md`, the new declarative Radio section in `docs/api/common.md`, and the Application links on 2026-09-29. Public methods, constructor options, hooks, provider slots, statics, and exported class types are covered directly or through shared references. No new runtime defect was identified.

Concrete draft corrections sent to the author:

- Behavior's shared DOM link used `view-runtime.md#dom-events-and-triggers`; the existing heading is `#dom-events`.
- Behavior's CollectionView lifecycle link used `#lifecycle-hooks-and-events`; the existing heading is `#lifecycle-and-extension-points`.
- UI normalization signatures need the optional explicit bindings maps. `normalizeUIValues(map, property?, bindings?)` takes one property name, mutates the supplied map, and returns it; it does not accept a list of properties.
- Shared Radio wording must qualify state-event activation gating as Application-specific. MnObject stateEvents remain active throughout the object's live lifetime.
- Behavior cleanup wording must distinguish incoming subscriber timing: direct destruction releases subscribers immediately; host destruction preserves them until the final forwarded host destroy event and releases them in the host's final cleanup. The direct-destroy and host-destroy cases are covered by `test/unit/destroy-listener-cleanup.spec.js`.

The lifecycle links in Application remain valid after its Radio content moves to common.md. The normal Behavior declaration and MnObject ownership examples use supported APIs. Execution, installed-package discovery, and reader effectiveness remain separate checks.
