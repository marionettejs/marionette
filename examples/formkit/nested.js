import { CollectionView, Region } from 'marionette';
import { FieldView, FormView, RowView } from '@mnjs/formkit';

const initial = { groups: [
  { id: 'a', items: [{ id: 'x', name: 'Alpha X' }, { id: 'y', name: 'Alpha Y' }] },
  { id: 'b', items: [{ id: 'x', name: 'Beta X' }, { id: 'y', name: 'Beta Y' }] }
] };
let nextItem = 1;
function reconcile(display, values, create) {
  for (const child of [...display.children]) {
    if (!values.some(value => value.id === child.options.rowKey)) { display.removeChildView(child); }
  }
  values.forEach((value, index) => {
    let child = display.children.find(view => view.options.rowKey === value.id);
    if (!child) { child = create(value.id); display.addChildView(child); }
    const current = [...display.children][index];
    if (current !== child) { display.swapChildViews(current, child); }
  });
}
class Item extends RowView {
  constructor(options) {
    super({ ...options, attributes: { 'data-item': options.rowKey },
      template: () => '<fieldset><legend></legend><div data-name></div><button type="button" data-remove>Remove item</button></fieldset>',
      regions: { name: '[data-name]' }, events: { 'click [data-remove]': 'removeItem' } });
  }
  onRender() {
    const { form, groupKey, rowKey } = this.options;
    this.el.querySelector('legend').textContent = `Group ${groupKey}, item ${rowKey}`;
    this.showChildView('name', new FieldView({ form, parent: this.node, name: 'name', removal: 'preserve',
      input: { type: 'text', label: `Group ${groupKey}, item ${rowKey} name`, validation: 'required' } }));
  }
  removeItem() {
    const { form, groupKey, rowKey } = this.options;
    form.setValues({ groups: form.getValues().groups.map(group => group.id === groupKey ?
      { ...group, items: group.items.filter(item => item.id !== rowKey) } : group) });
  }
}
class Group extends RowView {
  constructor(options) {
    super({ ...options, attributes: { 'data-group': options.rowKey },
      template: () => '<section><h2></h2><button type="button" data-add>Add item</button><button type="button" data-reverse>Reverse items</button><div data-list></div></section>',
      regions: { list: '[data-list]' }, events: { 'click [data-add]': 'addItem', 'click [data-reverse]': 'reverseItems' } });
  }
  onRender() {
    const { form, rowKey } = this.options;
    this.el.querySelector('h2').textContent = `Group ${rowKey}`;
    const list = new FieldView({ form, parent: this.node, name: 'items', removal: 'preserve',
      input: { type: 'list', dynamic: true, itemKey: 'id', slots: { default: () => ({ $el: 'div', attrs: { 'data-items': '' } }) } },
      regions: { items: '[data-items]' } });
    this.showChildView('list', list);
    list.showChildView('items', new CollectionView());
    this.sync();
  }
  sync() {
    const { form, rowKey } = this.options;
    const list = this.getChildView('list');
    reconcile(list.getChildView('items'), list.getValue(), key => new Item({ form, parent: list.node,
      groupKey: rowKey, rowKey: key, removal: 'preserve' }));
  }
  write(items) { this.getChildView('list').setValue(items); }
  addItem() { this.write([...this.getChildView('list').getValue(), { id: `new-${nextItem++}`, name: '' }]); }
  reverseItems() { this.write([...this.getChildView('list').getValue()].reverse()); }
}
const status = document.getElementById('status');
const values = document.getElementById('values');
const form = new FormView({ values: initial,
  template: () => '<button type="button" data-reverse-groups>Reverse groups</button><div data-groups></div><button type="submit">Save locally</button><button type="reset">Reset</button>',
  regions: { groups: '[data-groups]' },
  events: { 'click [data-reverse-groups]'() { this.setValues({ groups: [...this.getValues().groups].reverse() }); } },
  submit(snapshot) { values.textContent = JSON.stringify(snapshot, null, 2); status.textContent = 'Saved locally.'; }
});
const owner = new Region({ el: document.getElementById('app') });
owner.show(form);
const list = new FieldView({ form, name: 'groups', removal: 'preserve',
  input: { type: 'list', dynamic: true, itemKey: 'id', slots: { default: () => ({ $el: 'div', attrs: { 'data-groups': '' } }) } },
  regions: { groups: '[data-groups]' } });
form.showChildView('groups', list);
const display = new CollectionView();
list.showChildView('groups', display);
function sync() {
  reconcile(display, form.getValues().groups, key => new Group({ form, parent: list.node, rowKey: key, removal: 'preserve' }));
  for (const group of display.children) { group.sync(); }
  values.textContent = JSON.stringify(form.getValues(), null, 2);
}
let queued = false;
form.on('form:change', () => {
  if (queued) { return; }
  queued = true;
  queueMicrotask(() => { queued = false; if (!form.isDestroyed()) { sync(); } });
});
form.on('form:reset', () => { sync(); status.textContent = 'Reset to construction values.'; });
form.on('submit:invalid', () => { status.textContent = 'Correct the indicated name before saving.'; });
sync();
window.nestedDemo = { form, owner, list };
