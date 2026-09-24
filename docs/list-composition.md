# Interactive lists and bounded rendering

Use a `CollectionView` with a child `View` for repeated interactive rows. It owns
row creation, event delegation, removal, and destruction. A parent `View` can own
the surrounding controls and show the list through a Region. Replacing a list's
HTML on every selection or scroll discards row identity, input state, and the
framework's child ownership.

For a large dataset, keep only a bounded window in the rendered collection.
Marionette does not provide a virtual scroller: the application owns window
calculation, dimensions, scroll position, accessibility, and offscreen state.

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

Call `mountList(document.querySelector('#list'), records)` with an empty connected
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

## A fixed-height viewport for a large list

Save this second module as `bounded-list.js` beside `interactive-list.js`.
Supply immutable records with unique ids, a positive fixed row height, and a
positive viewport height. It keeps at most the visible rows plus two overscan
bands and one partial row. The source array may contain 100,000 records without
creating 100,000 models or Views.

<!-- executable-example: bounded-managed-list -->
```javascript
import { Collection } from '@mnjs/data';
import { List, runtime } from './interactive-list.js';

export function mountWindow(host, records, {
  rowHeight = 40, height = 400, overscan = 2, observeRow
} = {}) {
  const capacity = Math.ceil(height / rowHeight) + 2 * overscan + 1;
  const visible = new Collection();
  const list = new List({ collection: visible, childViewOptions: { observeRow } });
  const Viewport = runtime.View.extend({
    template: () => '<div class="spacer"><div class="rows"></div></div>',
    regions: { rows: '.rows' },
    onRender() {
      Object.assign(this.el.style, { height: `${height}px`, overflowY: 'auto' });
      const spacer = this.el.querySelector('.spacer');
      Object.assign(spacer.style, { height: `${records.length * rowHeight}px`, position: 'relative' });
      Object.assign(list.el.style, { position: 'absolute', margin: '0', padding: '0', width: '100%' });
      this.showChildView('rows', list);
      this.el.addEventListener('scroll', update);
    },
    onBeforeDestroy() { this.el.removeEventListener('scroll', update); }
  });
  const viewport = new Viewport();
  function update() {
    const start = Math.min(Math.max(0, records.length - capacity),
      Math.max(0, Math.floor(viewport.el.scrollTop / rowHeight) - overscan));
    const next = records.slice(start, start + capacity);
    const ids = new Set(next.map(record => record.id));
    // Remove departing rows first to keep the live row count bounded.
    visible.remove(visible.models.filter(model => !ids.has(model.id)));
    for (const [index, record] of next.entries()) {
      const model = visible.get(record.id) || visible.add(record);
      visible.move(model, index);
      const row = list.children.findByModel(model);
      Object.assign(row.el.style, { height: `${rowHeight}px`, boxSizing: 'border-box', overflow: 'hidden' });
    }
    list.el.style.top = `${start * rowHeight}px`;
  }
  const region = new runtime.Region({ el: host });
  region.show(viewport);
  update();
  return {
    viewport, list, visible, capacity,
    destroy() {
      region.destroy();
      visible.destroy();
    }
  };
}
```

Scrolling reconciles only the bounded collection. Rows shared by consecutive
windows keep their View and DOM identity. Departing rows are destroyed and release
their application subscriptions; returning rows are new instances. The viewport's
Region owns the list and the outer Region owns the viewport. Teardown removes
the scroll listener, destroys the managed rows, and releases collection observers.

This is a fixed-height composition recipe, not a complete accessible virtualizer
or a measured performance result. It does not handle variable heights, dynamic
source replacement, keyboard navigation across windows, or persistent selection
and drafts. In particular, a focused row leaving the window is destroyed. An
application must decide whether to pin that row, move focus, or persist its edits;
use an established virtualizer when those requirements are substantial. Avoid
rerendering the viewport after mounting; that would replace its owned list.

The executable fixture checks selection, surviving row/input identity, bounded
construction, row disposal, and teardown using these exact snippets. Its DOM
environment does not establish browser scroll geometry or focus retention.
See [CollectionView](./marionette.collectionview.md),
[observable sources](./data.api.md#optional-mnjsdata-sources), and
[resource cleanup](./resource-cleanup.md) for the underlying contracts.
