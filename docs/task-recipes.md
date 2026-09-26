# Task recipes

Start with the resource that must survive or be cleaned up. These recipes use
Marionette ownership to keep application behavior predictable. Preserve an
existing compatible integration; each task identifies when another one is needed.

Use the [task table](./agents.md#read-for-the-task) to choose the first guide.
This page covers [DOM-owning widgets](#wrap-a-dom-owning-widget),
[independent editor panes](#replace-an-editor-without-resetting-a-sibling-pane),
[editable row identity](#preserve-an-edited-row-during-collection-changes), and
[retryable deletion](#keep-a-delete-screen-open-for-retry).

## Wrap a DOM-owning widget

Use this seam for a chart, editor, map, or other widget that renders inside a
Marionette-owned host. The widget factory receives a DOM element and returns a
synchronous `destroy()` handle. Its own library decides rendering and data updates.
Do not let Marionette and the widget both own the same descendants.

<!-- executable-example: widget-owned-lifecycle -->
```javascript
import { View } from 'marionette';

export const WidgetView = View.extend({
  template: () => '<div data-widget-host></div>',
  ui: { host: '[data-widget-host]' },
  initialize({ createWidget }) {
    this.createWidget = createWidget;
    this.widget = null;
  },
  onDomRefresh() {
    if (!this.widget) {
      this.widget = this.createWidget(this.getUI('host')[0]);
    }
  },
  releaseWidget() {
    const widget = this.widget;
    this.widget = null;
    widget?.destroy();
  },
  onDomRemove() {
    this.releaseWidget();
  },
  onBeforeDestroy() {
    this.releaseWidget();
  }
});
```

Here is a complete factory for trying the ownership contract without installing
another library. The button simulates an external widget; ordinary application
buttons belong in a View with declarative events. A real widget adapter supplies
the same handle. This handle adapts that library's API, not a Marionette feature.

```javascript
import { Region } from 'marionette';
import { WidgetView } from './widget-view.js';

const mount = document.createElement('main');
document.body.append(mount);
const region = new Region({ el: mount });
region.show(new WidgetView({
  createWidget(host) {
    const button = document.createElement('button');
    button.type = 'button';
    let count = 0;
    button.textContent = 'Count: 0';
    const increment = () => { button.textContent = `Count: ${++count}`; };
    button.addEventListener('click', increment);
    host.append(button);
    return {
      destroy() {
        button.removeEventListener('click', increment);
        button.remove();
      }
    };
  }
}));
// When leaving: region.destroy(); mount.remove();
```

With default lifecycle monitoring, `dom:refresh` runs after attached rendering
and attachment of rendered content. `dom:remove` runs before that content is
rerendered or detached. Thus a rerender destroys the previous widget before a new
host appears. Detaching destroys the widget but retains the View; showing that
View again creates a fresh widget. Destruction releases any remaining handle.

Keep `monitorViewEvents` enabled for this pattern and use Marionette-managed
attachment. Direct `append()`/`remove()` calls outside the lifecycle do not become
Marionette attachment events. If the widget must retain expensive state across
navigation, persist that state outside its disposable DOM handle or deliberately
choose a different attachment policy.

The factory must clean up partially acquired resources if initialization throws.
An asynchronous widget loader also needs a cancellation/generation check before
it attaches; follow the [navigation cancellation pattern](./routing.md). A View
lifecycle callback does not automatically await arbitrary third-party promises.

The [executable fixture](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-application-guides/validate.mjs)
checks one widget per attachment, teardown before rerender, detach/reshow, and
final destruction. See [lifecycle](./view.lifecycle.md) for event ordering.

### Replace an editor without resetting a sibling pane

Use separate regions when one pane changes while another keeps an unfinished draft.
This workspace reuses `WidgetView` above (save that module as `widget-view.js`), so
its editor handle is released before detach, rerender, replacement, and destruction.
`mountEditor(host, onDraft)` is your synchronous editor adapter: it reports draft
strings and returns a non-throwing `{ destroy() }` handle.

<!-- executable-example: widget-owned-workspace -->
```javascript
import { View } from 'marionette';
import { WidgetView } from './widget-view.js';

const EditorView = WidgetView.extend({
  template: () => '<span data-label></span><div data-widget-host></div>' +
    '<button type="button" data-save>Save</button>',
  ui: { host: '[data-widget-host]', label: '[data-label]', save: '[data-save]' },
  draft: '',
  onRender() { this.getUI('label')[0].textContent = this.getOption('label'); },
  triggers: { 'click @ui.save': 'save:requested' },
  onSaveRequested() { this.triggerMethod('save', this.getOption('id'), this.draft); }
});

export const EditorWorkspace = View.extend({
  template: () => '<div data-editor-region></div><div data-notes-region></div>',
  regions: {
    editor: { el: '[data-editor-region]', replaceElement: true },
    notes: '[data-notes-region]'
  },
  childViewTriggers: { save: 'save' },
  onRender() {
    this.showChildView('notes', new View({ template: () => '<textarea aria-label="Notes"></textarea>' }));
  },
  openEditor(id, label) {
    const mountEditor = this.getOption('mountEditor');
    const editor = new EditorView({
      id, label,
      createWidget(host) {
        let active = true;
        const handle = mountEditor(host, draft => {
          if (active) editor.draft = draft;
        });
        return {
          destroy() {
            active = false;
            handle.destroy();
          }
        };
      }
    });
    this.showChildView('editor', editor);
    return editor;
  },
  closeEditor() { this.getRegion('editor').empty(); }
});
```

Construct `new EditorWorkspace({ mountEditor })` and show it through its owning
Region. The coordinating owner uses `listenTo(workspace, 'save', onSave)`. `openEditor(id, label)` destroys the previous editor; `closeEditor()`
releases it without disturbing the notes View, its DOM, draft, or focus. Open another
editor later, and let the owning Region destroy the workspace when leaving. Update drafts through
the adapter callback, not by rerendering the workspace. Persist editor content outside
the disposable widget if it must survive detach or rerender.

The save handler receives exactly the emitted `id, draft` arguments; Marionette does
not prepend the child View. Region-owned event forwarding stops for a replaced or
removed child. Each widget handle also has its own `active` flag, cleared **before**
its teardown: a late callback from that handle cannot overwrite a newer draft, even
if the same View was detached and shown again. See [child events](./events.md#child-view-events)
and [region ownership](./marionette.region.md#lifecycle-transition-contract).

## Preserve an edited row during collection changes

A stable model object and a stable child View are different from matching IDs in a
new array. For an observable collection, perform the provider's supported
incremental operations. Then verify the unaffected child View and its input node
are the same objects. Avoid calling `collectionView.render()` after every provider
notification: that explicitly rebuilds children.

If data arrives as an immutable replacement, use a provider/reconciliation policy
that defines how source identity changes are handled. Do not assume `trackBy` or
ID matching preserves the existing View's `model` object under every adapter.
The [integration guide](./choosing-integrations.md) identifies supported contracts;
[testing](./testing.md) explains the input identity and stale-subscription assertions
that catch this failure.

## Keep a delete screen open for retry

This recipe confirms deletion of an already-loaded record. The Application owns
submission; its View emits intent and keeps the same button mounted after failure.
The parent supplies the record to `start({ record })`, owns navigation after the
`deleted` event, and stops or destroys the Application when leaving. Initial data
loading and record selection belong to the [feature owner](./application-composition.md).

Save this as `delete-screen.js`. Supply `remove(id)`, the deletion operation for
this reusable confirmation screen. A failed request enables retry. The operation
must reject with an Error; presentation and event handlers follow the
[synchronous failure contract](./view.lifecycle.md#synchronous-failures).

<!-- executable-example: retryable-delete-screen -->
```javascript
import { Application, View } from 'marionette';

const Screen = View.extend({
  template: () => '<span class="label"></span><button type="button">Delete</button><p role="alert"></p>',
  ui: { label: '.label', confirm: 'button', error: '[role="alert"]' },
  triggers: { 'click @ui.confirm': 'confirm' },
  showRecord(record) { this.getUI('label')[0].textContent = record.label; },
  showStatus(enabled, error = '') {
    this.getUI('confirm')[0].disabled = !enabled;
    this.getUI('error')[0].textContent = error;
  }
});

export const DeleteApplication = Application.extend({
  onStart(app, { record }) {
    this.record = record;
    this.status = 'ready';
    const view = new Screen();
    this.listenTo(view, 'confirm', () => { void this.confirm().catch(console.error); });
    this.listenTo(view, 'before:destroy', () => {
      this.stopListening(view);
      void this.stop().catch(console.error);
    });
    this.showView(view);
    view.showRecord(record);
  },
  async confirm() {
    const view = this.getView();
    if (!this.isRunning() || this.status !== 'ready' || !view || view.isDestroyed()) return false;
    const record = this.record;
    this.status = 'deleting';
    view.showStatus(false);
    try { await this.getOption('remove')(record.id); }
    catch (error) {
      if (view === this.getView() && !view.isDestroyed()) {
        this.status = 'ready';
        view.showStatus(true, error.message);
      }
      return false;
    }
    if (!this.isRunning() || view !== this.getView() || view.isDestroyed()) return false;
    this.status = 'complete';
    this.triggerMethod('deleted', record);
    return true;
  }
});
```

For example, with in-memory data:

```javascript
import { DeleteApplication } from './delete-screen.js';

const records = new Map([['a', { id: 'a', label: 'Draft' }]]);
const screen = new DeleteApplication({
  region: { el: document.querySelector('main') },
  async remove(id) { records.delete(id); }
});
screen.on('deleted', record => console.log('Deleted', record.id));
await screen.start({ record: records.get('a') });
// Click Delete, or await screen.confirm().
// Await screen.destroy() when leaving this workflow.
```

`confirm()` accepts one submission at a time and emits `deleted` once on success.
A failed deletion displays text and enables the same button for retry. Unexpected
presentation or `deleted` handler failures reject the awaited call; the click
handler reports them. Stopping, replacing the root View, or destroying the
Application prevents late results from updating UI or emitting `deleted`. This
does not undo a deletion already accepted by the server.

The [executable checks](../test/fixtures/docs-region-lifecycle/retry-delete.mjs)
cover duplicate clicks, retry without replacing the button, completion events,
and late results after parent stop, host replacement, and destruction.
