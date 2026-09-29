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

## Check the behavior

Type into the input and verify the preview updates without losing focus. Update the Model externally and verify both elements change. Empty the Region, change the Model again, and verify the removed editor no longer reacts. See [tooling](../tooling.md) for package checks and debugging.
