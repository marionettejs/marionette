import { afterEach, expect, it } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView, RowView } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const owners = [];
const flush = async() => { for (let index = 0; index < 24; index++) { await Promise.resolve(); } };
afterEach(() => { owners.splice(0).forEach(owner => owner.destroy()); document.body.replaceChildren(); });
class ContactRow extends RowView {
  constructor(options) { super({ ...options, template: () => '<div data-note></div>', regions: { note: '[data-note]' } }); }
  onRender() {
    this.showChildView('note', new FieldView({ form: this.options.form, parent: this.node, name: 'note',
      removal: this.options.noteRemoval ?? 'preserve', input: { type: 'text', label: 'Note', value: 'Authored note', validation: 'required' } }));
  }
}
function fixture(values = { details: { contacts: [{ id: 'a', note: 'A note' }] } }) {
  const form = new FormView({ template: () => '<div data-details></div><div data-row></div>',
    regions: { details: '[data-details]', row: '[data-row]' }, values });
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) }); owners.push(owner); owner.show(form);
  const details = new FieldView({ form, name: 'details', removal: 'preserve', input: { type: 'group',
    slots: { default: () => ({ $el: 'div', attrs: { 'data-list': '' } }) } }, regions: { list: '[data-list]' } });
  form.showChildView('details', details);
  function mountList() {
    const list = new FieldView({ form, parent: details.node, name: 'contacts', removal: 'preserve',
      input: { type: 'list', dynamic: true, itemKey: 'id' } });
    details.showChildView('list', list); return list;
  }
  function mountRow(list, options = {}) {
    const row = new ContactRow({ form, parent: list.node, rowKey: 'a', removal: 'preserve', ...options });
    form.showChildView('row', row); return row;
  }
  return { form, owner, details, mountList, mountRow };
}
it('rejects a foreign form after its parent list has cached row ownership', () => {
  const values = { details: { contacts: [{ id: 'a', note: 'A note' }, { id: 'b', note: 'B note' }] } };
  const first = fixture(values);
  const list = first.mountList();
  first.mountRow(list);
  const second = fixture();
  const foreign = new RowView({ form: second.form, parent: list.node, rowKey: 'b', removal: 'preserve', template: false });
  expect(() => foreign.render()).toThrow(/live list owned by its form/);
  foreign.destroy();
  expect(first.form.getValues()).toEqual(values);
  expect(second.form.getValues()).toEqual({ details: { contacts: [{ id: 'a', note: 'A note' }] } });
});
it('rerenders one existing RowView with its retained group and exactly one replacement field', async() => {
  const { form, owner, mountList, mountRow } = fixture(); const list = mountList(); const row = mountRow(list); await flush();
  const group = row.node; const oldField = row.getChildView('note'); const oldId = oldField.node.props.id; const oldInput = oldField.el.querySelector('input');
  oldField.setValue('Edited note'); await oldField.node.settled; await flush();
  row.render(); await flush();
  const field = row.getChildView('note'); const input = field.el.querySelector('input');
  expect(row.node).toBe(group); expect(oldField.isDestroyed()).toBe(true); expect(getNode(oldId)).toBeUndefined();
  expect(input).not.toBe(oldInput); expect(input.value).toBe('Edited note');
  expect(list.node.children).toHaveLength(1); expect(group.children).toHaveLength(1); expect(row.el.querySelectorAll('input')).toHaveLength(1);
  expect(await form.submit()).toBe('success'); expect(form.getValues()).toEqual({ details: { contacts: [{ id: 'a', note: 'Edited note' }] } });
  const id = field.node.props.id; owner.destroy(); expect(row.isDestroyed()).toBe(true); expect(getNode(id)).toBeUndefined();
});
it('replacing an ancestor without an absent list retires its old keyed clear state before recreation', async() => {
  const { form, details, mountList, mountRow } = fixture(); const list = mountList(); const row = mountRow(list, { noteRemoval: 'clear' }); await flush();
  row.getRegion('note').empty(); list.destroy(); await flush(); expect(row.isDestroyed()).toBe(true);
  details.setValue({}); await flush(); expect(form.getValues()).toEqual({ details: {} });
  details.setValue({ contacts: [{ id: 'a', note: 'Fresh note' }] });
  const replacement = mountList(); const remount = mountRow(replacement, { noteRemoval: 'clear' }); await flush();
  expect(remount.getChildView('note').getValue()).toBe('Fresh note');
  expect(remount.el.querySelector('input').value).toBe('Fresh note');
  expect(form.getValues()).toEqual({ details: { contacts: [{ id: 'a', note: 'Fresh note' }] } });
});
it('a list mounted after initial empty membership does not add rows to the reset baseline', async() => {
  const { form, details, mountList, mountRow } = fixture({ details: { contacts: [] } });
  details.setValue({ contacts: [{ id: 'a', note: 'Added note' }] }); const list = mountList(); const row = mountRow(list); await flush();
  expect(row.getChildView('note').getValue()).toBe('Added note');
  form.resetForm(); await flush();
  expect(form.getValues()).toEqual({ details: { contacts: [] } }); expect(row.isDestroyed()).toBe(true);
  expect(list.node.children).toHaveLength(0); expect(form.el.querySelector('input')).toBeNull();
});
it('a first-mounted list captures its authored construction defaults without sharing their object', async() => {
  const { form, mountList, mountRow } = fixture({ details: {} });
  const list = mountList(); const authored = [{ id: 'a', note: 'Added note' }];
  list.setValue(authored); const row = mountRow(list); await flush();
  row.getChildView('note').setValue('Edited note'); await flush(); expect(authored).toEqual([{ id: 'a', note: 'Added note' }]);
  form.resetForm(); await flush();
  expect(form.getValues()).toEqual({ details: { contacts: [] } }); expect(row.isDestroyed()).toBe(true);
});
it('removing two data siblings also releases a clear row placed inside the other row View', async() => {
  const { form, mountList } = fixture({ details: { contacts: [{ id: 'a', note: 'A note' }, { id: 'b', note: 'B note' }] } });
  const list = mountList();
  const a = new RowView({ form, parent: list.node, rowKey: 'a', removal: 'preserve',
    template: () => '<div data-nested-placement></div>', regions: { nested: '[data-nested-placement]' } });
  form.showChildView('row', a);
  const b = new ContactRow({ form, parent: list.node, rowKey: 'b', removal: 'clear' });
  a.showChildView('nested', b); await flush();
  const ids = [a.node.props.id, b.node.props.id, b.getChildView('note').node.props.id];
  expect(a.node.parent).toBe(list.node); expect(b.node.parent).toBe(list.node);
  expect(a.el.contains(b.el)).toBe(true);
  form.setValues({ details: { contacts: [] } }); await flush();
  expect(a.isDestroyed()).toBe(true); expect(b.isDestroyed()).toBe(true);
  expect(form.getValues()).toEqual({ details: { contacts: [] } }); expect(list.node.children).toHaveLength(0);
  ids.forEach(id => expect(getNode(id)).toBeUndefined());
});
it('retiring an added outer row preserves another lineage\'s inner defaults and exclusions', async() => {
  const { form, mountList } = fixture({ details: { contacts: [] } });
  const list = mountList();
  list.setValue([
    { id: 'c', items: [{ id: 'x', note: 'C default' }] },
    { id: 'd', items: [{ id: 'x', note: 'D default' }] }
  ]);
  function mountOuter(key, region, removal = 'preserve') {
    const outer = new RowView({ form, parent: list.node, rowKey: key, removal,
      template: () => '<div data-list></div><div data-inner></div>', regions: { list: '[data-list]', inner: '[data-inner]' } });
    form.showChildView(region, outer);
    const innerList = new FieldView({ form, parent: outer.node, name: 'items', removal: 'preserve',
      input: { type: 'list', dynamic: true, itemKey: 'id' } });
    outer.showChildView('list', innerList);
    const inner = new ContactRow({ form, parent: innerList.node, rowKey: 'x', removal: 'preserve', noteRemoval: 'clear' });
    outer.showChildView('inner', inner);
    return { outer, inner };
  }
  form.addRegion('other', { el: form.el.appendChild(document.createElement('div')) });
  const c = mountOuter('c', 'row', 'clear');
  const d = mountOuter('d', 'other'); await flush();
  d.inner.getChildView('note').setValue('D edited'); await flush();
  d.inner.getRegion('note').empty();
  expect(form.getValues().details.contacts[1].items).toEqual([{ id: 'x' }]);
  c.outer.destroy(); await flush();
  expect(c.outer.isDestroyed()).toBe(true); expect(d.outer.isDestroyed()).toBe(false);
  expect(list.getValue().map(row => row.id)).toEqual(['d']);
  // The other lineage's exclusion remains, even through an authoritative write.
  list.setValue([{ id: 'd', items: [{ id: 'x', note: 'Hidden supplied value' }] }]); await flush();
  expect(form.getValues().details.contacts).toEqual([{ id: 'd', items: [{ id: 'x' }] }]);
  d.inner.render(); await flush();
  expect(d.inner.getChildView('note').getValue()).toBe('D default');
  expect(d.inner.el.querySelector('input').value).toBe('D default');
  list.setValue([...form.getValues().details.contacts, { id: 'c', items: [{ id: 'x', note: 'Fresh C' }] }]);
  const fresh = mountOuter('c', 'row'); await flush();
  expect(fresh.inner.getChildView('note').getValue()).toBe('Fresh C');
  expect(d.inner.getChildView('note').getValue()).toBe('D default');
  form.resetForm(); await flush();
  expect(form.getValues()).toEqual({ details: { contacts: [] } });
  expect(d.outer.isDestroyed()).toBe(true); expect(fresh.outer.isDestroyed()).toBe(true);
});
