# Building features with Marionette v5

Marionette organizes UI around ownership: who prepares a feature, who presents its data, and who removes it. This guide explains those choices for **5.0.1**. Start with the [quick start](quick-start.md) for renderer setup; use the [API reference](api.md) for exact method contracts.

## Choose a responsibility

| Responsibility | Use |
| --- | --- |
| Present data and handle local interaction | A [View](api/view.md). A disclosure or form control can keep its own local state. |
| Place, replace, or remove a child View | A named [Region](api/region.md), usually declared on the containing View. |
| Present a collection as managed child Views | A [CollectionView](api/collection-view.md), with a child View for each record. |
| Prepare and coordinate a feature with a start/stop lifetime | An [Application](api/application.md), owning its UI, shared decisions, and service effects. |
| Reuse interaction behavior across Views | A [Behavior](api/behavior.md), whose lifetime follows its host View. |
| Own nonvisual state or communication | An [MnObject](api/mnobject.md), with events, state access, and explicit destruction. |

Choose an Application to coordinate readiness before UI activation, own a start/stop lifetime, repeat readiness with restart, cancel obsolete startup, or orchestrate work across Views. For example, prepare required records before displaying a list/detail feature, then own that feature’s readiness, restart and start/stop lifetime. A View with Regions is enough for visual composition; a host router plus a Region can own simple destination replacement. A single request or URL does not by itself require Application. A parent Application can own the page and start child features even when the parent has no asynchronous preparation. Registering a child establishes ownership; starting it is an explicit decision.

A View can save an edit to its own model when the chosen data layer provides that operation. Keep [local interaction](api/view.md#local-interaction-and-feature-coordination) in its View and shared workflow decisions with their feature owner.

## Read the ownership tree

```text
Feature Application
├── root View
│   ├── named Region → detail View
│   └── named Region → CollectionView → row Views
└── registered child Application → its own UI
```

Each owner cleans up its children. For an embedded feature, its **host** is the surrounding UI or owner receiving it; the Application's **destination** is the specific Region used by `showView()`. A Behavior's **host** is the View or CollectionView it augments. A destination supplied as an existing Region is borrowed. Owning a root or registering a child Application does not itself show or start it. Models supplied to Views are borrowed data, not branches of this UI ownership tree.

## Prepare a feature, then activate its UI

When a feature needs asynchronous readiness, use an Application and put the required service call in `prepareStart(options, { signal })`. Return the prepared data, then consume it in `onStart(app, options, result)` to create and connect the ready UI. The [Application example](api/application.md#prepare-before-showing-ui) demonstrates this sequence.

For these feature requests, the Application calls a service/API module; Views receive data and emit user intent. This keeps request decisions at the feature lifetime while individual panels can be replaced. For a composed layout, use the Application's `setView`, populate the layout's Regions with `showChildView`, then mount it with the Application's `showView`.

Show loading or error presentation through Views and Regions. The caller of `start()` handles rejection. When abandoning a failed initial start, call synchronous `stop()` before showing an error View. A failed active restart can show feedback alongside its retained UI.

Notification hooks such as `onStart` do not await returned Promises. If a child must be ready before the parent activates, include that work in parent preparation and handle cleanup if preparation fails. If the page can be ready while its child loads, start the child from the active parent and handle its failure there. See [child Application ownership](api/application.md#child-applications).

Pass the preparation signal to the service where supported. Marionette prevents a cancelled preparation result from activating the Application. Additional side effects after an `await` must also respect cancellation. Cancellation prevents obsolete preparation from activating UI; transport abort still depends on the service honoring the signal. Once preparation finishes, that signal is no longer a feature-lifetime signal; later requests need their own [concurrency and retry policy](guides/async-requests.md).

## Choose what survives an operation

| Operation | Lifetime decision |
| --- | --- |
| Replace a panel | Show another View in its Region. The Region destroys the previous View; keep shared data outside that disposable View. |
| Reconstruct a feature | Call `stop()`, then await `start(options)`. The root and child Views are destroyed and startup creates the intended replacement. |
| Restart a feature | `restart()` repeats preparation while retaining the active root, child Applications and state. Successful completion code selects what to update. |
| End a feature permanently | `destroy()` ends its lifetime and destroys owned UI and children. The configured state provider handles owned-state disposal when supported. |

Use `restart()` to repeat feature readiness while retaining its active UI, children, and state event delivery. Apply prepared data in `onStart`, creating the shell only when absent. Current failure leaves the active feature in place; superseded preparation cannot commit. Use stop/start for reconstruction. Independent domain operations, such as saving, still need their own concurrency and cancellation policy.

Retain state at the lifetime that needs it. A local control's state can live in that View. Drafts or pending work that must survive panel replacement belong to a surviving owner. Closing a panel can empty its Region while the feature Application stays active; completions update retained data, and a replacement panel reads that data. Application stop removes its root UI and retains state; restart retains both. See [readiness and ongoing effects](api/application.md#readiness-and-ongoing-effects) for how ongoing requests use that shared data.

## Share data and communicate intent

Keep one authority for each shared decision. For example, a feature Application can own selection while list and detail Views receive the data they need. A View emits a selection event; the Application listens, changes selection, and chooses which detail View its Region shows. [Child event forwarding](api/shared/view-bindings.md#child-events) and `listenTo(view, { ... })` connect these boundaries without sibling Views reaching into each other's markup.

Observable data lets several Views respond to the same change. Configure compatible [DataApi and StateApi providers](integrations/setup.md#configure-once); use model/collection bindings or `stateEvents` for the relevant source. Initialize a new View from current data as well as observing subsequent changes. Application `stateEvents` deliver while active and do not replay changes made while stopped.

Plain data is sufficient when observation is unnecessary. Use [observable data and API access](integrations/setup.md#observable-data-and-api-access) to choose a data solution and its provider.

State supplied to another object is borrowed. State created through `createState` belongs to its owner; destruction calls the configured provider's disposal method when provided. A View's `model`, `collection`, and state are separate inputs; state is not automatically template data. See [state ownership](api/shared/state.md#ownership-and-disposal).

## Let Views and Regions manage presentation

For data-driven lists, default to CollectionView with child Views for record identity
and managed child lifetime. This is a design recommendation, not a core API
requirement. Simple/static repetition may stay in one owning View's template.
See [lists](guides/lists.md) for managed rows.

Hand-assembling application HTML and inserting it with `innerHTML`, `outerHTML` or
`insertAdjacentHTML` does not create child Views. With the native delegator, a
parent View's registered events can still handle matching inserted descendants;
separate child Views supply per-child bindings, lifecycle and cleanup. Parent
delegation alone does not supply those child lifetimes.

HTML strings are supported renderer output: the default DOM provider inserts
renderer output as HTML. A template function returning HTML through that pipeline
is not the same as writing behind existing managed children. Keep managed View and
child View replacement under the configured renderer, Regions and child lifecycle;
update the smallest appropriate data/View owner or show a child in a Region,
preserving retained children. See [templates and data](api/shared/view-bindings.md#templates-and-data).

Prefer View `events`/`triggers` and named `ui` bindings for normal View interactions;
they connect selectors and handlers to View lifetime. DOM reads are different from
writes: `document.querySelector` is a lookup and can locate a mount point. It does
not itself replace HTML or bypass child cleanup.

Choose updates at the boundary that changed. Rerendering an already-rendered View resets its Regions and destroys their children, so preserve an active editor when updating an independent status or panel. With `template: false`, `render()` is a no-op and does not reset Regions or emit render events; compose existing markup explicitly. Bounded changes to a View's own controls, such as a button's disabled state, are appropriate. Keep those updates inside the owning View. The [View rendering contract](api/view.md) explains child cleanup; the [CollectionView reference](api/collection-view.md) explains record and child identity.

Direct DOM integration also fits [imperative widgets](guides/widgets.md),
[existing markup](guides/existing-html.md), and [prerendered DOM](api/view.md#existing-elements).
Scope reads and writes to the owning View or widget boundary and respect child
Region ownership. Manual listeners, including `addEventListener`, can serve external
targets or widget integrations; release them and widget resources at the owning
lifetime's teardown. These integrations do not require changing the rest of the renderer.

## Clean up at the ownership boundary

Regions destroy replaced Views. CollectionView destroys removed children. Destroying a Marionette object releases its event subscriptions and incoming callbacks; a retained listener needs no per-View `destroy` handler to call `stopListening(view)`.

A View's `onBeforeDestroy` can release View-owned resources and invalidate pending completions before child teardown. Work that must survive that View needs a surviving owner instead.

Application `stop()` retains the Application, its state, and subscriptions to surviving sources. Use `onStop` to end active-run effects such as Window listeners or timers. `restart()` calls `onStart` again without `onStop`, so guard effect installation against duplicates. Ongoing service work still needs its own concurrency and cancellation policy. Release external resources at the lifetime that owns them; attaching a resource to an arbitrary property does not make it framework-owned. See [readiness and ongoing effects](api/application.md#readiness-and-ongoing-effects) and [event cleanup](api/shared/events.md#cleanup).

For a runnable feature using preparation, selection, child Applications, and retry, continue with the [records lesson](records.md).
