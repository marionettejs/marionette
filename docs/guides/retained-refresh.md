# Refresh data while retaining UI

Use an explicit operation when refreshed data should leave the current page and
unfinished input in place. An Application can own both initial readiness and
later requests. Its Views observe the result and keep their own presentation
responsibilities.

This dashboard loads its summary before starting. Refresh updates that summary
without replacing the page or its working-notes editor. The endpoint
`GET /summary.json` returns `{ "openTasks": number }`. API transport is a small
function; `@mnjs/data` supplies observable state, not fetching or persistence.
The example assumes the packages in [setup](../integrations/setup.md) are installed.

## Keep the page and update its source

```js
import { Application, View, setDataApi, setDomApi } from 'marionette';
import { Model, DataApi, StateApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

setDataApi(DataApi);
setDomApi(LitDomApi);

async function loadSummary(signal) {
  const response = await fetch('/summary.json', { signal });
  if (!response.ok) throw new Error('Could not refresh the summary.');
  return response.json();
}

const PageView = View.extend({
  template: () => html`
    <button type="button" class="refresh">Refresh summary</button>
    <section class="summary"></section><section class="notes"></section>`,
  regions: { summary: '.summary', notes: '.notes' },
  triggers: { 'click .refresh': 'refresh' },
});
const SummaryView = View.extend({
  template: ({ openTasks, loading, error }) => html`
    <p>Open tasks: ${openTasks}</p>
    <p role="status">${loading ? 'Refreshing…' : error}</p>`,
  modelEvents: { change: 'render' },
});
const NotesView = View.extend({
  template: () => html`<label>Working notes <textarea></textarea></label>`,
});

const DashboardApplication = Application.extend({
  createState() { return new Model({ openTasks: 0, loading: false, error: '' }); },
  prepareStart(_options, { signal }) { return loadSummary(signal); },
  onStart(_app, _options, summary) {
    const state = this.getState();
    state.set({ openTasks: summary.openTasks, loading: false, error: '' });
    const page = this.setView(new PageView());
    this.listenTo(page, { refresh: this.refresh });
    page.showChildView('summary', new SummaryView({ model: state }));
    page.showChildView('notes', new NotesView());
    this.showView();
  },
  async refresh() {
    if (!this.isRunning()) return false;
    this.refreshRequest?.abort();
    const request = this.refreshRequest = new AbortController();
    const isCurrent = () => this.isRunning() &&
      this.refreshRequest === request && !request.signal.aborted;
    const state = this.getState();
    state.set({ loading: true, error: '' });
    let summary;
    try {
      summary = await loadSummary(request.signal);
    } catch (error) {
      if (!isCurrent()) return false;
      state.set({ loading: false, error: error.message });
      return false;
    }
    if (!isCurrent()) return false;
    state.set({ openTasks: summary.openTasks, loading: false });
    return true;
  },
  onStop() { this.refreshRequest?.abort(); },
}).setStateApi(StateApi);

const mount = document.createElement('main');
document.body.append(mount);
const app = new DashboardApplication({ region: { el: mount } });
await app.start();
```

The Application owns state returned by `createState`; SummaryView borrows that
Model. Summary changes render only SummaryView. PageView, NotesView, and the
textarea retain their identity, so refreshing does not discard unfinished text.
Destroying the Application disposes its state through StateApi. Stop/restart
retain that state; ordinary View destruction does not dispose borrowed Models.

The notes in this example are local DOM input, not a persistence feature. If they
must survive leaving the page, give that draft an appropriate longer-lived owner.

## Decide which response may update the page

This example chooses the most recently requested summary. Starting another
refresh aborts the previous request. The controller's identity also checks which
operation owns the result; its aborted signal prevents an old run from committing
after a later start. The check does not assume every transport honors abort.

A current failure leaves the previous summary visible and displays its error.
An obsolete success or failure leaves newer work alone. `refresh()` resolves
`true` when it applies data and `false` for a handled request failure or discarded
operation. These results are this application's policy, not a Marionette API.
Initial loading uses `prepareStart`: failure rejects `start()`, so the caller
handles that failed activation before showing this dashboard.

`onStop` aborts active refresh work after the stop succeeds. An ordinary pending
`prepareStop` still leaves the Application active; a rejected stop leaves it
running. Starting destruction deactivates earlier, so `isCurrent` prevents a late
result from committing during that teardown as well. Destruction of a running
Application passes through its stop lifecycle.

## Choose refresh or restart

Call `refresh()` to update the retained feature. Use `restart()` when ending the
current run and preparing a new one is intended. Restart destroys the root and
its children before starting again; this example's notes textarea would be
replaced. Re-rendering PageView would also destroy its Region children. Neither
operation is needed to refresh this summary.

[Application lifecycle](../api/application.md) · [State ownership](../api/shared/state.md) · [View rendering](../api/view.md#rendering-and-status)
