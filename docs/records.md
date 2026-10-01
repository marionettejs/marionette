# Build a records feature

The [runnable example](../examples/records/README.md) loads records, selects one to display its detail, reloads while retaining the layout, retries failures, and closes/reopens the feature.

## Run it

The source is included with these docs; the commands here use the repository checkout. For an application using installed packages, follow the [quick start](quick-start.md) and [setup reference](integrations/setup.md).

Requires Node 24 or newer. From the repository root:

```sh
npm ci --ignore-scripts
npm --prefix examples/records ci --ignore-scripts
npm --prefix examples/records run dev
```

Open <http://127.0.0.1:5193>. Select a record, close the feature, then open it again. Each new start loads records and clears selection. The page's Open/Close controls remain mounted.

## Attach to the page

[index.html](../examples/records/index.html) contains the page heading, controls, and empty content container. MainApplication's onStart attaches PageView to `#app` with `setView(new PageView({ el }))`. PageView uses `template: false`: its existing markup supplies the DOM, so no render or show call is needed. Its Regions and event triggers work normally.

The parent owns that View and the registered Records child. The page lasts for the document's lifetime; child stop/restart leaves it mounted. Stopping the parent destroys PageView and removes its element. Starting this parent again, or starting another parent, requires supplying the page markup again.

## Prepare, then display

[RecordsApplication](../examples/records/src/records-application.js) follows three lifecycle steps:

1. `onBeforeStart` marks loading. Initial startup resets selection and shows LoadingView; an active restart retains the current layout and selection.
2. `prepareStart(options, { signal })` awaits the API, and returns a Collection built from the response.
3. `onStart(app, options, collection)` uses that Collection directly. It creates RecordsLayout and its status View only when needed, then calls `showList` and `showDetail` to apply the prepared content. `showList` wires the new list’s intent listeners. `showView` mounts an initially prepared layout; showing the existing layout again leaves it intact.

`start()` remains pending until preparation completes. Closing during preparation cancels that start. Marionette prevents its obsolete result from reaching `onStart`, even when a service ignores cancellation. A superseded start resolves false rather than entering the error path. The Application needs no separate run flag or request controller for this initial load.

`start()` opens the feature and is idempotent while running. Reload and Retry call `restart()` to repeat preparation. The page and ready records layout remain mounted during an active restart. Success replaces the list and detail Regions with the prepared records; it does not render the whole layout. Selection follows the same record ID; an absent record shows empty detail. The [retained-restart guide](guides/retained-restart.md) demonstrates updating an observable source while retaining child View and input identity too.

## Follow one selection

A row emits `select`; RecordsList forwards `select:record`. The Application changes its selectedId state. Rows observe that state to display selection, and the Application's `stateEvents` handler shows a DetailView through the detail Region.

The Application chooses DetailView for a selected record or EmptyDetailView when selection is empty. Each View renders one presentation. The list never reaches into the detail markup. Selection keeps the page, list, and rows mounted.

## Keep the boundaries small

| Source | Responsibility |
| --- | --- |
| [main-application.js](../examples/records/src/main-application.js) | Own the page and registered Records child; connect controls through `viewEvents` and handle loading failures. |
| [records-application.js](../examples/records/src/records-application.js) | Prepare records, own their collection and selection, coordinate the ready UI. |
| [records-views.js](../examples/records/src/records-views.js) | Render loading, error, list, and detail content. Emit intent. Regions and CollectionView manage their child Views. |
| [records-api.js](../examples/records/src/records-api.js) | Implement `list({ signal })`, returning `{ id, title, description }` objects. |
| [page.js](../examples/records/src/page.js) | Define the page Regions and Open/Close controls; forward Retry intent from the displayed error View. |
| [main.js](../examples/records/src/main.js) | Start MainApplication at the root element. |
| [setup.js](../examples/records/src/setup.js) | Configure the data/state integration and Lit renderer once. |

MainApplication owns the page and registers RecordsApplication as a child. Its `viewEvents` connects page intent. `onStart` attaches the page once and starts the child in its content Region. Parent restart retains both without installing listeners or starting the child again. The parent is ready when its page is available; the child has its own data readiness. Stopping or destroying the parent also stops or destroys the registered child.

`@mnjs/data` provides observable Models and Collections. It is a workable, incomplete data solution: applications commonly need an API layer alongside it, or another data implementation. RecordsApplication imports recordsApi directly. There is no configurable service constructor option. The API module returns plain JSON records, and preparation adapts them to the feature-owned Collection. A service that already supplies the chosen observable collection can return it directly. Real transport and backend policies belong behind that boundary. Replacing the observable implementation also requires matching Marionette's DataApi/StateApi contracts.

## Failure and cleanup

MainApplication catches a rejected child start or restart and logs the original error. A failed initial start is stopped before ErrorView replaces LoadingView. A failed active restart keeps the records layout and data, with the error shown by its status View. Retry repeats preparation; cancelled calls resolve `false` without showing an error. LoadingView, initial ErrorView, and the ready layout share the page's content Region. Status View reload/retry intent travels through the layout and PageView to MainApplication, which calls the child's `restart()` once.

Close calls synchronous `stop()` and empties the child's UI. The page controls remain available. Open after Close loads a new Collection, resets selection, and creates a new records layout.

Stop destroys the feature's Views; Marionette automatically removes the Application's listeners to the destroyed list. The Application keeps the prepared collection for selection lookup and passes it to the list. A successful start or restart replaces that reference. These local records have no independent resources requiring a stop hook. The Application and selection Model survive so the feature can reopen; final destruction disposes the owned state.

Lit interpolation renders record strings as text; no example-specific escaping helper is needed.

## Check changes

Stop the preview server first; these checks start their own server from this checkout. From the repository root:

```sh
npx playwright install chromium firefox webkit
npx playwright test --config examples/records/playwright.config.js --workers=3
npm --prefix examples/records run build
```

The browser checks cover readiness, selection, retained restart and failure, retry, cancellation, close/reopen, and disposal. Review ownership as well as behavior. These checks use linked local package builds; installed candidate-package checks are recorded separately from these linked-source checks.
