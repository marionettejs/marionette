# Work on this Marionette application

Use `node_modules/marionette/docs/agents.md` for application architecture
and its task links for specific contracts. The compact reference is an optional
overview. `node_modules/marionette/docs-manifest.json` and this application's lockfile identify the
installed version and source; do not substitute mismatched website examples.

For skill setup or remote documentation retrieval, consult the installed
`docs/agent-tools.md` under the package root. Local Markdown is sufficient.

## Existing architecture

- `setup.ts` registers native `@mnjs/data` DataApi and StateApi once on the shared
  runtime, before creating owners. Templates and DOM delegation use native defaults.
- `main.ts` constructs and starts `Workspace` and destroys the Application on page exit and Vite updates. Code edits reset drafts.
- `notes.ts` provides the data client used directly by Application readiness methods.
  Tests mock this client; loaders are not Application options.
- `workspace.ts` defines both Applications with `Application.extend`. `onBeforeStart` shows its loading layout,
  `prepareStart` loads initial records with the lifecycle signal, and `onStart`
  commits the resolved records. The Application owns the collection until destruction.
- The detail child Application uses `prepareStart` for each selected note. Selection
  stops the previous detail and starts the latest one in the layout's detail Region.
  This deliberately replaces detail/loading UI while the list stays mounted.
  A token orders concurrent selections across child stop; Marionette cancels stale
  startup completion, including when the loader ignores abort.
- `workspace-views.ts` owns templates, named Regions, `ui`, DOM interactions, and
  presentation. Row intent travels through `childViewTriggers` to Workspace's
  `listenTo` subscriptions. Rows do not call workspace functions through closures.
- The status View borrows layout-owned state. Rows observe title changes: clean
  inputs adopt external updates; dirty inputs retain drafts until Open commits them.
  Reordering preserves row and input identity. Restart reloads records and resets drafts.
- Parent Application stop/destruction and root View replacement invalidate pending
  detail work. Collection disposal belongs to Workspace's `onDestroy`; no caller
  must remember a separate disposer.
- Services only load data. Add persistence at that service boundary and URL handling
  at the Application's `navigate` boundary. Use `docs/application-composition.md`
  before adding another owner, request controller, or shared state source.

## Setup and checks

Choose commands for the task from this directory; setup is needed only for a new
installation:

- Rename the shipped `gitignore` to `.gitignore` before committing application files.
- First registry setup: `npm install`; subsequent locked installs: `npm ci`.
- Types, consumer lint, unit tests, build: `npm run validate`.
- Browser setup once: `npm run browser:install` (Linux may need Playwright's OS dependencies).
- Browser regressions: `npm run test:browser`; development server: `npm run dev`.

Extend `workspace.test.mjs` for data/loading behavior and
`workspace.browser.spec.mjs` for DOM interaction and cleanup. Use public APIs and
observable behavior; do not inspect private framework fields. Completion means the
requested behavior and its affected ownership/cancellation boundary work, with
actual check results and any untested scope reported. Keep these architecture
notes current as the app grows.
