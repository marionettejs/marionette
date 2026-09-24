# Interactive lists

Use a `CollectionView` when repeated rows need independent View identity, state,
or cleanup. It owns row creation, event delegation, removal, and destruction.
A parent View can show the list through a Region. Simple repeated markup can
remain in a View template when a full snapshot update meets the task; delegated
DOM events alone do not require one View per row.

## An ordinary interactive list

Save this module as `interactive-list.js`. It uses the optional `@mnjs/data`
package for observable structural updates. The isolated runtime keeps this
example's adapter configuration local; an application can configure its shared
runtime once instead.

<!-- executable-example: interactive-managed-list -->
```javascript
import { createMarionette } from 'marionette';
import { Collection, DataApi } from '@mnjs/data';

export const runtime = createMarionette();
runtime.setDataApi(DataApi);

const Row = runtime.View.extend({
  tagName: 'li',
  template: () => '<button type="button" aria-pressed="false"></button><input aria-label="Draft">',
  ui: { select: 'button', draft: 'input' },
  events: { 'click @ui.select': 'select' },
  modelEvents: { 'change:title': 'updateTitle' },
  initialize({ observeRow = () => () => {} }) {
    // Optional application subscription: every row owns its disposer.
    this.stopObserving = observeRow(this.model);
  },
  onRender() { this.updateTitle(); },
  updateTitle() {
    if (this.isRendered()) this.getUI('select')[0].textContent = this.model.get('title');
  },
  select() { this.triggerMethod('select', this, this.model.id); },
  setSelected(selected) {
    this.getUI('select')[0].setAttribute('aria-pressed', String(selected));
  },
  onBeforeDestroy() { this.stopObserving(); }
});

export const List = runtime.CollectionView.extend({
  tagName: 'ul',
  childView: Row,
  childViewEvents: {
    select(row, id) {
      this.children.each(child => child.setSelected(child === row));
      this.triggerMethod('selection', id);
    }
  }
});

export function mountList(host, records, observeRow) {
  const collection = new Collection(records);
  const list = new List({ collection, childViewOptions: { observeRow } });
  const region = new runtime.Region({ el: host });
  region.show(list);
  return {
    list,
    collection,
    destroy() {
      region.destroy();
      collection.destroy();
    }
  };
}
```

Call `const feature = mountList(document.querySelector('#list'), records)` with an empty connected
host and records such as `[{ id: 1, title: 'First post' }]`. Listen to
`feature.list.on('selection', id => ...)` for application selection updates.
Call `feature.collection.add(record)`, `remove(id)`, or `move(id, index)` to
change membership or order. Surviving child Views and their input elements keep
their identity. Selection updates only button attributes; it does not render the
list or replace the input. Destroy the feature when its host is removed.

This example deliberately leaves draft edits in the input. Persist edits to
application state when they must survive row removal. The targeted `modelEvents`
handler updates the title when `model.set('title', value)` is called, preserving
the draft input. Calling `list.render()` or resetting its collection
recreates children. With a plain array, explicit `render()` is how changed
membership becomes visible, so use an observable source when preserving rows
across structural updates matters.

## Large datasets

Measure the application's rendering and interaction costs before changing its
list architecture. Consider filtering or pagination when they fit the workflow.
If the interface needs continuous scrolling and rendering the whole dataset is
costly, consider a virtualizer appropriate to that interface. Marionette does
not supply one. Keep DOM ownership explicit at that integration boundary and
decide how selection, drafts, focus, and subscriptions behave when a row leaves
the rendered set.

The executable fixture checks selection, targeted updates, surviving row/input
identity, and cleanup using the exact example above. See
[CollectionView](./marionette.collectionview.md),
[observable sources](./data.api.md#optional-mnjsdata-sources), and
[resource cleanup](./resource-cleanup.md) for the underlying contracts.
