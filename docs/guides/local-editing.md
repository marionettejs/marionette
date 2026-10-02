# Edit a View's own model

Keep an interaction local when it changes the data displayed by that View and needs no broader workflow. This example edits a title as the user types and also reflects changes made elsewhere to the same Model.

Start with the [renderer and data setup](../integrations/setup.md). `@mnjs/data` is optional and supplies observable attributes here; it is incomplete as an application data solution and does not provide fetching or persistence.

Add a mount to your page:

```html
<section id="editor"></section>
```

In the entry module:

```js
import { Region, View, setDataApi, setDomApi } from 'marionette';
import { DataApi, Model } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';

setDataApi(DataApi);
setDomApi(LitDomApi);

const TitleEditor = View.extend({
  template: ({ title }) => html`
    <label>Title <input class="title" .value=${live(title)}></label>
    <p class="preview">${title}</p>
  `,
  ui: { title: '.title', preview: '.preview' },
  events: { 'input @ui.title': 'editTitle' },
  modelEvents: { 'change:title': 'render' },
  editTitle() {
    this.model.set('title', this.getUI('title')[0].value);
  }
});

const model = new Model({ title: 'Untitled' });
const region = new Region({ el: '#editor' });
const editor = new TitleEditor({ model });
region.show(editor);
```

The input event changes the Model, whose observable change renders the View with Lit. Lit updates the existing nodes. Its `live` binding compares against the input's current DOM value, so typing keeps focus and selection while an external Model update changes the same input. Lit owns both the input binding and preview content; do not replace its interpolated content manually.

This is immediate local editing, with no separate draft or Save operation. If the selected data solution supplies a persistence method, a View can save its own model as part of a local interaction. `@mnjs/data` has no `save()` method; integrate an API layer or choose another data solution for persistence. Coordinate shared decisions, navigation, or readiness in an owner with the corresponding lifetime; see [architecture](../architecture.md).

When the panel closes, `region.empty()` destroys the editor and removes its model subscriptions. The supplied Model remains alive: the code that created or shared it decides when it should be destroyed. Destroy the Region when its owner finishes.

## Keep a draft until Save succeeds

For an explicit Save interaction, keep input in View-owned state and update the supplied Model only after the API accepts it. The draft belongs to this editor's lifetime, so the View can own the request too. This independent example assumes `PATCH /api/titles/:id` accepts JSON `{ title }` and returns JSON `{ title }` containing the accepted value. The API function supplies persistence; optional `@mnjs/data` supplies observable attributes and has no `save()` method.

```js
import { Region, View, setDataApi, setDomApi, setStateApi } from 'marionette';
import { DataApi, Model, StateApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';

setDataApi(DataApi);
setDomApi(LitDomApi);
setStateApi(StateApi);

async function saveTitle(id, title, signal) {
  const response = await fetch(`/api/titles/${encodeURIComponent(id)}`, {
    method: 'PATCH', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  if (!response.ok) throw new Error('Save failed');
  return (await response.json()).title;
}

const DraftEditor = View.extend({
  createState() {
    return new Model({
      draftTitle: this.model.get('title'), saving: false, status: '', error: ''
    });
  },
  stateEvents: { change: 'render' },
  templateContext() { return this.getState().toObject(); },
  template: ({ draftTitle, saving, status, error }) => html`
    <form>
      <label>Title <input class="title" .value=${live(draftTitle)} ?readonly=${saving}></label>
      <button type="submit" aria-disabled=${saving ? 'true' : 'false'}>Save</button>
      <p role="status">${status}</p>
      <p role="alert">${error}</p>
    </form>
  `,
  ui: { title: '.title' },
  events: { 'input @ui.title': 'editDraft', 'submit form': 'save' },
  editDraft() {
    const state = this.getState();
    if (state.get('saving')) return;
    state.set({ draftTitle: this.getUI('title')[0].value, status: '' });
  },
  async save(event) {
    event?.preventDefault();
    const state = this.getState();
    if (this.isDestroyed() || state.get('saving')) return false;
    const request = new AbortController();
    this.saveRequest = request;
    state.set({ saving: true, status: 'Saving…', error: '' });
    let title;
    try {
      title = await saveTitle(this.model.get('id'), state.get('draftTitle'), request.signal);
    } catch {
      if (this.saveRequest !== request || this.isDestroyed()) return false;
      this.saveRequest = undefined;
      state.set({ saving: false, status: '', error: 'Could not save. Your draft is still here; try again.' });
      return false;
    }
    if (this.saveRequest !== request || this.isDestroyed()) return false;
    this.saveRequest = undefined;
    this.model.set('title', title);
    state.set({ draftTitle: title, saving: false, status: 'Saved.' });
    return true;
  },
  onBeforeDestroy() {
    const request = this.saveRequest;
    this.saveRequest = undefined;
    request?.abort();
  }
});

const mount = document.createElement('section');
document.body.append(mount);
const savedTitle = new Model({ id: 1, title: 'Original' });
const draftRegion = new Region({ el: mount });
const draftEditor = new DraftEditor({ model: savedTitle });
draftRegion.show(draftEditor);
```

Typing changes only the draft. During Save the input is read-only, and repeated submissions are ignored. The button stays focusable, with `aria-disabled` announcing its pending state. Failure preserves the draft, input nodes, and supplied Model so the user can retry. Success commits the API's accepted title and displays it in the input. External Model changes do not overwrite an open draft; this example starts a new draft when a new editor is created.

`draftRegion.empty()` destroys the editor and its owned state while leaving `savedTitle` alive. Every asynchronous completion checks that it still belongs to the live editor, including transports that ignore abort. Cancellation prevents a late result from changing local state; it does not guarantee that the server undoes a save. Destroy the Region and remove the mount when their owner finishes.

## Check the behavior

Type into the input and verify the preview updates without losing focus. Update the Model externally and verify both elements change. Empty the Region, change the Model again, and verify the removed editor no longer reacts. See [tooling](../tooling.md) for package checks and debugging.

For the draft example, type and verify `savedTitle` stays unchanged until Save succeeds. Fail a request, then retry the same draft. Close the editor during Save and verify a late response cannot update the supplied Model or detached input.
