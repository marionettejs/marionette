# Restart readiness while retaining UI

Use `Application.restart()` to load readiness again while keeping the feature active. Pending preparation retains the root, child Applications, subscriptions, and state event delivery. Successful `onStart` code decides what changes on screen.

This dashboard reloads a summary while preserving its page and unfinished notes. `GET /summary.json` returns `{ "openTasks": number }`. API transport is separate from the optional `@mnjs/data` observable state. Install the packages in [setup](../integrations/setup.md).

## Construct the shell once

```js
import { Application, View, setDataApi, setDomApi } from 'marionette';
import { Model, DataApi, StateApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

setDataApi(DataApi);
setDomApi(LitDomApi);

async function loadSummary(signal) {
  const response = await fetch('/summary.json', { signal });
  if (!response.ok) throw new Error('Could not load the summary.');
  return response.json();
}

const PageView = View.extend({
  template: () => html`
    <button type="button" class="reload">Reload summary</button>
    <section class="summary"></section><section class="notes"></section>`,
  regions: { summary: '.summary', notes: '.notes' },
  triggers: { 'click .reload': 'reload' },
});
const SummaryView = View.extend({
  template: ({ openTasks, loading, error }) => html`
    <p>Open tasks: ${openTasks}</p>
    <p role="status">${loading ? 'Loading…' : error}</p>`,
  modelEvents: { change: 'render' },
});
const NotesView = View.extend({
  template: () => html`<label>Working notes <textarea></textarea></label>`,
});

const DashboardApplication = Application.extend({
  createState() { return new Model({ openTasks: 0, loading: false, error: '' }); },
  viewEvents: { reload: 'reloadSummary' },
  onBeforeStart() { this.getState().set({ loading: true, error: '' }); },
  prepareStart(_options, { signal }) { return loadSummary(signal); },
  onStart(_app, _options, summary) {
    const state = this.getState();
    state.set({ openTasks: summary.openTasks, loading: false, error: '' });
    if (this.getView()) return;
    const page = this.setView(new PageView());
    page.showChildView('summary', new SummaryView({ model: state }));
    page.showChildView('notes', new NotesView());
    this.showView();
  },
  reloadSummary() {
    return this.restart().catch(error => {
      this.getState().set({ loading: false, error: error.message });
    });
  },
}).setStateApi(StateApi);

const mount = document.createElement('main');
document.body.append(mount);
const app = new DashboardApplication({ region: { el: mount } });
await app.start();
```

Application owns the Model created by `createState`; SummaryView borrows it. Each successful result updates that Model. Only SummaryView renders again. PageView, NotesView, and the textarea retain their identity and unfinished input. `viewEvents` connects the page's intent once; restart does not install another listener.

`reloadSummary` is the button's error boundary around `restart()`. It adds no request controller or concurrency layer. Initial `start()` failure rejects to its caller before the page exists. A failed reload leaves the running page and previous summary available and shows the error in its status area.

## Let preparation discard obsolete results

Each restart supersedes pending preparation, aborts its signal, and resolves the previous call `false`. Only the current successful result reaches `onStart`, even when a transport ignores abort. Applying data there prevents obsolete requests from changing the summary. The current failure rejects; the button's handler reports it. A cancelled call never reaches that catch handler.

Pass the preparation signal to the transport. After preparation completes, that signal is no longer a lifetime signal. Independent operations such as saving a draft need their own cancellation policy; they do not belong in readiness merely to acquire one.

## End the run deliberately

`stop()` synchronously cancels preparation and destroys the page and its child Views. A later `start()` loads again and builds a new page. `destroy()` also disposes registered children and owned state. An [external host](existing-ui.md) must stop or destroy its feature when removing its mount; removing DOM alone does not end Application authority.

Restart itself does not render or replace Views. Calling `setView(new PageView())` unconditionally in `onStart`, or rendering the existing PageView again, would replace its child UI and lose the notes. Preserve the shell and update the source or Region that changed. Use `app.stop(); await app.start(options)` when full reconstruction or a new host is intended.

The notes here are local input. If they must survive stopping or leaving the page, give the draft a longer-lived owner.

[Application lifecycle](../api/application.md) · [State ownership](../api/shared/state.md) · [View rendering](../api/view.md#rendering-and-status)
