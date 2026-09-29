# Add behavior to existing HTML

A View can adopt server-rendered or static markup. Set `el` to the existing root and `template: false` to retain its contents. No renderer or data package is needed for this example.

Start with this HTML:

```html
<section id="details">
  <button type="button" aria-expanded="false" aria-controls="details-body">Details</button>
  <div id="details-body" hidden>Delivery takes two business days.</div>
</section>
```

Run this module after the markup is available, for example through a module script at the end of the body:

```js
import { View } from 'marionette';

const DetailsView = View.extend({
  template: false,
  ui: { toggle: 'button', body: '#details-body' },
  events: { 'click @ui.toggle': 'toggleDetails' },
  toggleDetails() {
    const body = this.getUI('body')[0];
    body.hidden = !body.hidden;
    this.getUI('toggle')[0].setAttribute('aria-expanded', String(!body.hidden));
  }
});

const details = new DetailsView({ el: document.querySelector('#details') });
```

`el` takes the actual DOM element. Construction binds the existing controls without replacing them. Because this root already has content and is in the document, `details.isRendered()` and `details.isAttached()` are true immediately. Construction does not emit render or attach events: perform any initial enhancement directly in `initialize`, rather than waiting for `onRender` or `onAttach`.

There is no `render()` call here. With `template: false`, calling it later also preserves the markup and emits no render event. The View can still own [named Regions](../api/view.md#named-regions) and display managed children inside them without rendering the parent.

## Own the adopted element

Adoption gives the View responsibility for its root. `details.destroy()` removes the adopted section, cleans up its event bindings, and destroys any managed child Views. It does not leave the original markup behind. Use a root whose lifetime matches that responsibility.

This small example creates the View directly, so the code managing the page must destroy it when that page ends. For a larger feature, assign it to the appropriate Region or Application owner. An already attached View does not receive a new attach notification simply because a Region adopts it. See [Region ownership](../api/region.md#showing-a-view) when moving existing Views between owners.

## Check the behavior

Verify the button is the same DOM node before and after construction, and that clicking toggles both visibility and `aria-expanded`. Calling `render()` should preserve those nodes and their current state. Destroying the View should remove the section and end its interaction handlers.
