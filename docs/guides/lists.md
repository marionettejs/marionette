# Show, sort, and filter a list

Use CollectionView for repeated children that share one placement rule. A surrounding View can own the list's local controls and Region. Add an Application when the feature needs API readiness or broader coordination; sorting a displayed list does not require one.

This catalog uses the optional `@mnjs/data` Collection for observable membership. Install the rendering and data packages from [setup](../integrations/setup.md).

## Own the controls and repeated rows

```js
import { CollectionView, Region, View } from 'marionette';
import { Collection, DataApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const ItemView = View.extend({
  tagName: 'li',
  template: ({ label }) => html`
    <strong>${label}</strong>
    <label>Notes for ${label} <input></label>`,
  modelEvents: { change: 'render' },
}).setDataApi(DataApi).setDomApi(LitDomApi);
const EmptyView = View.extend({
  tagName: 'li',
  template: () => html`No matching items.`,
}).setDomApi(LitDomApi);
const ItemList = CollectionView.extend({
  tagName: 'ul',
  childView: ItemView,
  emptyView: EmptyView,
  viewComparator: 'label',
}).setDataApi(DataApi);
const CatalogView = View.extend({
  template: () => html`
    <label><input type="checkbox" class="available"> Available only</label>
    <button type="button" class="reverse">Reverse order</button>
    <section class="items" aria-label="Catalog"></section>`,
  regions: { items: '.items' },
  ui: { available: '.available' },
  events: { 'change @ui.available': 'filterItems', 'click .reverse': 'reverseItems' },
  onRender() {
    this.descending = false;
    this.getUI('available')[0].checked = false;
    this.list = new ItemList({ collection: this.options.items });
    this.showChildView('items', this.list);
  },
  filterItems() {
    this.list.setFilter(this.getUI('available')[0].checked ? { available: true } : null);
  },
  reverseItems() {
    this.descending = !this.descending;
    this.list.setComparator(this.descending ?
      (left, right) => right.model.get('label').localeCompare(left.model.get('label')) : 'label');
  },
}).setDomApi(LitDomApi);

const items = new Collection([
  { id: 'a', label: 'Apricot', available: true },
  { id: 'b', label: 'Blueberry', available: false },
]);
const catalog = new CatalogView({ items });
const mount = document.createElement('section');
document.body.append(mount);
const region = new Region({ el: mount });
region.show(catalog);
```

The outer Region owns CatalogView; its named Region owns ItemList; the list owns rows and its empty View. The collection is borrowed. Destroy the outer Region when this feature ends, then dispose data according to the lifetime of the code that created it.

The notes fields are temporary DOM input. Sorting moves the existing rows; filtering detaches excluded rows and retains their Views and input values. Returning a row preserves its nodes, but leaving the document can lose focus. When a filter hides the focused row, choose a focus destination such as the filter control. See [accessibility and rendering](accessibility-rendering.md).

## Update without rebuilding everything

| Change | Operation | Effect |
| --- | --- | --- |
| Add or remove a member | `items.add(...)` / `items.remove(...)` | Creates/destroys affected rows and retains surviving rows. Removing membership does not destroy the Model. |
| Change a displayed attribute | `model.set(...)` | This example's `modelEvents` renders that row. |
| Change an attribute used by sorting/filtering | Then call `catalog.list.sort()` / `filter()` | Recomputes presentation; an `@mnjs/data` Model change does not automatically rerun the parent criteria. |
| Show all rows | `catalog.list.removeFilter()` | Restores retained hidden rows. |
| Replace the membership snapshot | `items.reset(...)` | Destroys and rebuilds rows, including rows for retained Models. |

For a group of additions or removals, use `items.add([...])` or `items.remove([...])` rather than calling the method in a loop. When membership changes, the `@mnjs/data` Collection emits one aggregate update per call, so CollectionView reconciles once per call instead of once per item while retaining surviving rows. Use `reset` for a whole replacement snapshot; its row destruction makes it unsuitable for preserving input or focus.

Avoid full `list.render()` to apply a filter or sort: it rebuilds managed rows. Rendering CatalogView again also destroys its Region children; this example deliberately resets its local controls when rebuilding the list. If notes must survive those operations or navigation, put the draft in an appropriately owned data source.

An empty presentation can mean all rows are filtered out even when the collection has members. `emptyView` describes that presentation, rather than storing an empty record in the collection. Give it a root valid for the container, such as `li` inside `ul`.

## Identity and scale

The configured DataApi determines keys and collection observation. With `@mnjs/data`, the key is Model `cid`; reusing a server `id` in a new Model does not reuse the old row. Other providers must supply stable unique keys, but a replacement model object still replaces its View.

`list.children` describes the currently presented rows, excluding hidden rows and the empty View. Save a row reference before hiding it when checking identity. CollectionView is not a virtualized viewport: hidden rows remain alive. For large datasets, choose paging or a measured windowing solution based on the application's needs.

## Check the behavior

Enter notes, sort, hide and restore that row, and check the same input and value return. Add/remove members and verify surviving row identity and outgoing destruction. With Available only selected, call `items.at(0).set('available', false)` and `catalog.list.filter()` to filter every row out; verify empty presentation without changing collection length. Finish by destroying the Region and checking that no borrowed data was destroyed or continues rendering the old list. [CollectionView reference](../api/collection-view.md) defines the full contract; [consumer testing](testing.md) gives a test setup.
