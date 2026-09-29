# Decisions for the records lesson

Revision 2 replaces the rejected initial architecture. Scope: initial loading, selection, retry, close/reopen, and cleanup. Search and retained-data refresh remain later work.

## Page owner and feature owner

MainApplication owns PageView, registers RecordsApplication as a child, connects page controls, and handles startup rejection. Its onStart attaches PageView to existing index.html markup and starts the child in the content Region. main.js only starts the root Application. This gives the page and child a common lifecycle owner; parent preparation is not required to justify that boundary. RecordsApplication prepares records, owns the collection and selectedId, and coordinates list/detail UI.

## Existing page markup

The page markup lives in index.html. PageView has template: false and receives the existing #app element; the parent uses setView to own it without rendering or remounting. The page lifetime is the document lifetime. Stopping the parent removes that owned element; recreating the whole parent would need new markup. Records stop/restart preserves the page. No clone, retained template, or second rendering mode is added.

## Startup

- onBeforeStart resets selectedId and shows LoadingView.
- prepareStart awaits recordsApi.list({ signal }), checks cancellation, and returns a newly prepared Collection. The service returns DTOs; a service that already returns the chosen collection would not need that adaptation.
- onStart uses that Collection directly and composes with setView, showChildView, then showView. No empty retained collection or reset is needed.

Readiness includes the required initial records. The previous onStart fetch, loadRecords operation, run object, active flag, and request controller were removed. The service returns data without mutating shared state; Marionette admits only a current preparation result to onStart. Tests close/reopen while a service ignores cancellation and completes or fails late.

MainApplication catches child errors, logs them, stops partial UI/data, then asks the child to show ErrorView in the content Region. The child tracks this displayed error even while stopped, so Close releases it and Open/Retry replaces it without a separate clearing operation. Retry uses restart; Open uses start. A restart rebuilds the target feature layout, while the outer page stays mounted. An in-place refresh must preserve the feature layout through a separate operation. The Application chooses EmptyDetailView or DetailView from the selection state; each View has one template. UI state is expressed through Views and Regions.

## Data and state

Use @mnjs/data Model, Collection, StateApi, and DataApi as a workable, incomplete observable layer. RecordsApplication imports a small recordsApi module directly; it returns records across an explicit API boundary. No constructor service option is needed. Other transport or observable data solutions remain possible through matching contracts.

selectedId is the single selection authority. Rows emit intent; the Application updates state and shows detail. Selection keeps the page, list, and rows mounted. A new start resets selection.

Native View destruction now removes the Application's subscriptions to that list automatically. The example needs no destroy-event cleanup handler; Application stop still retains subscriptions to surviving sources. The Application keeps the prepared Collection for selection lookup and supplies it to the layout and list. A successful new start replaces that reference; no deletion-only onStop hook is needed. The local collection and plain Models have no independent resources or external owners, so they need no explicit destroy calls. The Application and selection Model survive for reopening; final destruction releases owned state. A future shared cache needs a different ownership decision.

## Scope and checks

Initial loading is preparation. Preserving an already-running feature during refresh is a different contract, not a reason to introduce a request framework into this lesson.

For later refresh: decide which selection/filter state and row identity must survive before implementing it. @mnjs/data Collection.reset rebuilds rows; it has no Collection.set merge operation.

Use Lit HTML 3.3.3, its public DOM adapter, and Vite 8.3.0 with locked dependencies. Consumer tests cover startup behavior and selected disposal contracts; they do not establish overall architecture quality or teaching effectiveness. The example links local builds. The candidate package probe verifies installed documentation discovery; its evidence has been regenerated for the automatic destruction cleanup change. Registry publication remains outside this work.
