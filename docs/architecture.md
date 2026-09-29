# Building features with Marionette v5

Marionette organizes UI around ownership: who prepares a feature, who presents its data, and who removes it. This guide explains those choices for **5.0.0-rc.2**. Start with the [quick start](quick-start.md) for renderer setup; use the [API reference](api.md) for exact method contracts.

## Choose a responsibility

| Responsibility | Use |
| --- | --- |
| Present data and handle local interaction | A [View](api/view.md). A disclosure or form control can keep its own local state. |
| Place, replace, or remove a child View | A named [Region](api/region.md), usually declared on the containing View. |
| Present a collection as managed child Views | A [CollectionView](api/collection-view.md), with a child View for each record. |
| Prepare and coordinate a feature with a start/stop lifetime | An [Application](api/application.md), owning its UI, shared decisions, and service effects. |
| Reuse interaction behavior across Views | A [Behavior](api/behavior.md), whose lifetime follows its host View. |
| Own nonvisual state or communication | An [MnObject](api/mnobject.md), with events, state access, and explicit destruction. |

A View with Regions is enough for visual composition. Add an Application when a feature needs readiness, coordinated effects, or an independently managed lifetime. A parent Application can own the page and start child features even when the parent has no asynchronous preparation. Registering a child establishes ownership; starting it is an explicit decision.

A View can save an edit to its own model when the chosen data layer provides that operation. An asynchronous call alone does not require an Application. The [View reference](api/view.md#local-interaction-and-feature-coordination) explains this boundary; the model or API layer owns persistence, while an Application coordinates feature readiness and shared workflow decisions.

## Prepare a feature, then activate its UI

When a feature needs asynchronous readiness, use an Application and put the required service call in `prepareStart(options, { signal })`. Return the prepared data, then consume it in `onStart(app, options, result)` to create and connect the ready UI. The [Application example](api/application.md#prepare-before-showing-ui) demonstrates this sequence.

For these feature requests, the Application calls a service/API module; Views receive data and emit user intent. This keeps request decisions at the feature lifetime while individual panels can be replaced. For a composed layout, use the Application's `setView`, populate the layout's Regions with `showChildView`, then mount it with the Application's `showView`.

Show loading or error presentation through Views and Regions. The caller of `start()` handles rejection. When recovery replaces partial UI with an error View, await successful `stop()` before showing it in the intended Region.

Notification hooks such as `onStart` do not await returned Promises. If a child must be ready before the parent activates, include that work in parent preparation and handle cleanup if preparation fails. If the page can be ready while its child loads, start the child from the active parent and handle its failure there. See [child Application ownership](api/application.md#child-applications).

Pass the preparation signal to the service where supported. Marionette prevents a cancelled preparation result from activating the Application. Additional side effects after an `await` must also respect cancellation. Once preparation finishes, that signal is no longer a feature-lifetime signal; later requests need their own policy.

## Choose what survives an operation

| Operation | Lifetime decision |
| --- | --- |
| Replace a panel | Show another View in its Region. The Region destroys the previous View; keep shared data outside that disposable View. |
| Refresh data while keeping the current UI | Keep the feature active and update its data through an explicit operation. |
| Restart a feature | `restart()` stops the current run and prepares another. Its root UI is destroyed; the Application instance and its state survive. Registered children stop and need explicit activation again. |
| End a feature permanently | `destroy()` ends its lifetime and destroys owned UI and children. The configured state provider handles owned-state disposal when supported. |

For refreshes, decide which result may update state, how failure affects displayed data, and how completions lose authority when their owner ends.

Retain state at the lifetime that needs it. A local control's state can live in that View. Drafts or pending work that must survive panel replacement belong to a surviving owner. Closing a panel can empty its Region while the feature Application stays active; completions update retained data, and a replacement panel reads that data. Application stop/restart removes its root UI while retaining Application state. See [operations after start](api/application.md#operations-after-start) for how ongoing requests use that shared data.

## Share data and communicate intent

Keep one authority for each shared decision. For example, a feature Application can own selection while list and detail Views receive the data they need. A View emits a selection event; the Application listens, changes selection, and chooses which detail View its Region shows. [Child event forwarding](api/view-runtime.md#child-events) and `listenTo(view, { ... })` connect these boundaries without sibling Views reaching into each other's markup.

Observable data lets several Views respond to the same change. Configure compatible [DataApi and StateApi providers](setup.md#configure-once); use model/collection bindings or `stateEvents` for the relevant source. Initialize a new View from current data as well as observing subsequent changes. Application `stateEvents` deliver while active and do not replay changes made while stopped.

Plain data is sufficient when observation is unnecessary. The introductory data solution, `@mnjs/data`, provides observable Models and Collections but is incomplete as an application data layer. It may sit alongside an API layer or be replaced by another solution through the [provider contracts](api/data-providers.md). Keep transport and persistence decisions explicit.

State supplied to another object is borrowed. State created through `createState` belongs to its owner; destruction calls the configured provider's disposal method when provided. A View's `model`, `collection`, and state are separate inputs; state is not automatically template data. See [state ownership](api/state.md#ownership-and-disposal).

## Let Views and Regions manage presentation

Use templates for presentation, CollectionView for repeated children, and Regions for child placement and teardown.

Choose updates at the boundary that changed. Rendering a containing View can destroy child Views, so preserve an active editor when updating an independent status or panel. Bounded changes to a View's own controls, such as a button's disabled state, are appropriate. Keep those updates inside the owning View. The [View rendering contract](api/view.md) explains child cleanup; the [CollectionView reference](api/collection-view.md) explains record and child identity.

## Clean up at the ownership boundary

Regions destroy replaced Views. CollectionView destroys removed children. Destroying a Marionette object releases its event subscriptions and incoming callbacks; a retained listener needs no per-View `destroy` handler to call `stopListening(view)`.

Application `stop()` retains the Application, its state, and subscriptions to surviving sources. Explicitly end subscriptions whose purpose lasts only for that run. Release external resources such as timers, service requests, or widget handles at the lifetime that owns them; attaching a resource to an arbitrary property does not make it framework-owned. See [event cleanup](api/events.md#cleanup).

For a runnable feature using preparation, selection, child Applications, and retry, continue with the [records lesson](records.md).
