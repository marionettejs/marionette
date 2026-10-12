import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CollectionView, Region, View } from 'marionette';
import { FieldView, FormView, RowView } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const owners = [];
const faults = [];
const onError = event => faults.push(event.error ?? event.message);
const onRejection = event => faults.push(event.reason);
const onProcessRejection = error => faults.push(error);
const flush = async() => { for (let index = 0; index < 30; index++) { await Promise.resolve(); } };
const tick = async(milliseconds = 90) => { await vi.advanceTimersByTimeAsync(milliseconds); await flush(); };
beforeEach(() => {
  vi.useFakeTimers();
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  process.on('unhandledRejection', onProcessRejection);
});
afterEach(async() => {
  owners.splice(0).reverse().forEach(owner => owner.destroy());
  await tick();
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
  process.off('unhandledRejection', onProcessRejection);
  vi.useRealTimers();
  document.body.replaceChildren();
  expect(faults.splice(0), 'runtime and unhandled failures are hard gates').toEqual([]);
});
const initial = () => ({ groups: [
  { id: 'a', items: [{ id: 'x', name: 'AX', detail: 'AX detail' }, { id: 'y', name: 'AY', detail: 'AY detail' }] },
  { id: 'b', items: [{ id: 'x', name: 'BX', detail: 'BX detail' }, { id: 'y', name: 'BY', detail: 'BY detail' }] }
] });
function item(form, outerKey, innerKey) {
  return form.getValues().groups.find(group => group.id === outerKey).items.find(row => row.id === innerKey);
}
function control(row, name = 'name') { return row.getChildView(name).el.querySelector('input'); }
function edit(row, value, name = 'name') {
  const input = control(row, name);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}
class Widget extends View {
  constructor(options) {
    super({ template: () => '<output>Owned widget</output>', ...options });
    const receive = () => { options.counts.set(options.key, (options.counts.get(options.key) ?? 0) + 1); };
    window.addEventListener('nested-widget', receive);
    this.on('before:destroy', () => window.removeEventListener('nested-widget', receive));
  }
}
class Inner extends RowView {
  constructor(options) {
    super({ template: () => '<fieldset><div data-name></div><div data-detail></div><div data-widget></div></fieldset>',
      regions: { name: '[data-name]', detail: '[data-detail]', widget: '[data-widget]' }, ...options });
  }
  onRender() {
    const { form, outerKey, rowKey, shared } = this.options;
    const key = `${outerKey}/${rowKey}`;
    const remote = shared.remoteKey === key;
    this.showChildView('name', new FieldView({ form, parent: this.node, name: 'name', removal: 'preserve',
      input: { type: 'text', label: `${key} Name`, id: `${form.cid}-${outerKey}-${rowKey}-name`, delay: 40,
        preserveErrors: true, validation: remote ? 'required|remote' : 'required',
        ...(remote ? { validationRules: { remote: shared.remote } } : {}) } }));
    if (!shared.hiddenDetails.has(key)) { this.mountDetail(); }
    this.showChildView('widget', new Widget({ key, counts: shared.widgetCounts }));
  }
  mountDetail() {
    const { form, outerKey, rowKey, shared } = this.options;
    this.showChildView('detail', new FieldView({ form, parent: this.node, name: 'detail',
      removal: shared.clearDetails.has(`${outerKey}/${rowKey}`) ? 'clear' : 'preserve',
      input: { type: 'text', label: `${outerKey}/${rowKey} Detail`, id: `${form.cid}-${outerKey}-${rowKey}-detail`, value: 'Authored detail', delay: 0 } }));
  }
}
class Outer extends RowView {
  constructor(options) {
    super({ template: () => '<section><div data-list></div></section>', regions: { list: '[data-list]' }, ...options });
  }
  onRender() { this.mountItems(); }
  mountItems() {
    const { form } = this.options;
    const list = new FieldView({ form, parent: this.node, name: 'items', removal: 'preserve',
      input: { type: 'list', dynamic: true, itemKey: 'id', slots: { default: () => ({ $el: 'div', attrs: { 'data-items': '' } }) } },
      regions: { items: '[data-items]' } });
    this.showChildView('list', list);
    list.showChildView('items', new CollectionView());
    this.rebuildItems();
  }
  rebuildItems() {
    const list = this.getChildView('list');
    const display = list.getChildView('items');
    for (const value of list.getValue()) {
      if (!display.children.find(view => view.options.rowKey === value.id)) { this.addItem(value.id); }
    }
  }
  addItem(key, removal = 'preserve') {
    const { form, rowKey, shared } = this.options;
    const list = this.getChildView('list');
    const view = new Inner({ form, parent: list.node, rowKey: key, outerKey: rowKey, removal: shared.clearRows.has(`${rowKey}/${key}`) ? 'clear' : removal, shared });
    list.getChildView('items').addChildView(view);
    return view;
  }
  inner(key) { return this.getChildView('list').getChildView('items').children.find(view => view.options.rowKey === key); }
}
async function fixture(options = {}) {
  const shared = { clearDetails: new Set(), clearRows: new Set(), hiddenDetails: new Set(), widgetCounts: new Map(), ...options.shared };
  const form = new FormView({ values: initial(), submit: options.submit, formProps: options.formProps,
    template: () => '<div data-list></div>', regions: { list: '[data-list]' } });
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(owner);
  owner.show(form);
  const list = new FieldView({ form, name: 'groups', removal: 'preserve',
    input: { type: 'list', dynamic: true, itemKey: 'id', slots: { default: () => ({ $el: 'div', attrs: { 'data-groups': '' } }) } },
    regions: { groups: '[data-groups]' } });
  form.showChildView('list', list);
  const display = new CollectionView();
  list.showChildView('groups', display);
  const addOuter = key => {
    const view = new Outer({ form, parent: list.node, rowKey: key, removal: 'preserve', shared });
    display.addChildView(view);
    return view;
  };
  const a = addOuter('a');
  const b = addOuter('b');
  await tick();
  return { form, owner, list, display, addOuter, a, b, shared };
}

it('nested repeated keys retain lineage, controls, focus and errors through two-level authoritative reorder', async() => {
  const { form, a, b, display } = await fixture();
  const ax = a.inner('x');
  const ay = a.inner('y');
  const bx = b.inner('x');
  const input = control(ax);
  const node = getNode(input.id);
  expect(node.parent).toBe(ax.node);
  expect(ax.node.parent).toBe(a.getChildView('list').node);
  expect(ax.node.parent.parent).toBe(a.node);
  expect(node.root).toBe(form.node);
  expect(bx.node).not.toBe(ax.node);
  node.setErrors(['Review AX']);
  await tick();
  input.focus();
  form.setValues({ groups: form.getValues().groups.map(group => ({ ...group, items: [...group.items].reverse() })).reverse() }, { notify: false });
  await tick();
  expect(form.getValues().groups.map(group => group.id)).toEqual(['b', 'a']);
  expect(a.node.index).toBe(1);
  expect(ax.node.index).toBe(1);
  expect(control(ax)).toBe(input);
  expect(getNode(input.id)).toBe(node);
  expect(document.activeElement).toBe(input);
  expect(node.context.state.errors).toBe(true);
  expect(ax.el.textContent).toContain('Review AX');
  expect(bx.el.textContent).not.toContain('Review AX');
  display.swapChildViews(a, b);
  a.getChildView('list').getChildView('items').swapChildViews(ax, ay);
  edit(ax, 'After reorder');
  await tick();
  expect(item(form, 'a', 'x').name).toBe('After reorder');
  expect(item(form, 'b', 'x').name).toBe('BX');
});

it('inner clear and preserved drafts use the full key through outer reorder and inner list remount', async() => {
  const { form, a, b, shared } = await fixture({ shared: { clearDetails: new Set(['a/x']) } });
  const ax = a.inner('x');
  const ay = a.inner('y');
  edit(ay, 'AY committed', 'detail');
  await tick();
  ax.getRegion('detail').empty();
  ay.getRegion('detail').empty();
  shared.hiddenDetails.add('a/x');
  form.setValues({ groups: [...form.getValues().groups].reverse() }, { notify: false });
  await tick();
  expect(item(form, 'a', 'x')).not.toHaveProperty('detail');
  expect(item(form, 'a', 'y').detail).toBe('AY committed');
  expect(control(b.inner('x'), 'detail').value).toBe('BX detail');
  a.getRegion('list').empty();
  form.setValues({ groups: [...form.getValues().groups].reverse() }, { notify: false });
  a.mountItems();
  await tick();
  expect(item(form, 'a', 'x')).not.toHaveProperty('detail');
  expect(control(a.inner('y'), 'detail').value).toBe('AY committed');
  shared.hiddenDetails.delete('a/x');
  a.inner('x').mountDetail();
  await tick();
  expect(item(form, 'a', 'x').detail).toBe('AX detail');
  expect(item(form, 'b', 'x').detail).toBe('BX detail');
});

it('deleting an ancestor while its inner list is absent retires added defaults and exclusions before key reuse', async() => {
  const { form, addOuter, shared } = await fixture({ shared: { clearDetails: new Set(['c/x']) } });
  form.setValues({ groups: [...form.getValues().groups, { id: 'c', items: [{ id: 'x', name: 'First C', detail: 'First default' }] }] });
  const c = addOuter('c');
  await tick();
  c.inner('x').getRegion('detail').empty();
  c.getRegion('list').empty();
  form.setValues({ groups: form.getValues().groups.filter(group => group.id !== 'c') });
  await tick();
  expect(c.isDestroyed()).toBe(true);
  form.setValues({ groups: [...form.getValues().groups, { id: 'c', items: [{ id: 'x', name: 'Fresh C', detail: 'Fresh default' }] }] });
  const fresh = addOuter('c');
  await tick();
  expect(control(fresh.inner('x'), 'detail').value).toBe('Fresh default');
  expect(item(form, 'a', 'x').detail).toBe('AX detail');
  fresh.inner('x').getRegion('detail').empty();
  fresh.inner('x').mountDetail();
  await tick();
  expect(item(form, 'c', 'x').detail).toBe('Fresh default');
  expect(shared.clearDetails.has('c/x')).toBe(true);
});

it('ancestor deletion ends detached inner widgets, delayed native drafts and retained control listeners', async() => {
  const { form, a, b, shared } = await fixture();
  const ax = a.inner('x');
  const input = edit(ax, 'Pending draft');
  expect(ax.getChildView('name').node.isSettled).toBe(false);
  const ids = [a.node.props.id, ax.node.props.id, input.id];
  a.getChildView('list').getChildView('items').detachChildView(ax);
  expect(ax.isDestroyed()).toBe(false);
  form.setValues({ groups: form.getValues().groups.filter(group => group.id !== 'a') });
  await tick(150);
  expect(ax.isDestroyed()).toBe(true);
  expect(a.isDestroyed()).toBe(true);
  ids.forEach(id => expect(getNode(id)).toBeUndefined());
  const previous = shared.widgetCounts.get('a/x') ?? 0;
  window.dispatchEvent(new Event('nested-widget'));
  expect(shared.widgetCounts.get('a/x') ?? 0).toBe(previous);
  expect(shared.widgetCounts.get('b/x')).toBe(1);
  input.value = 'Late edit';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await tick(150);
  expect(form.getValues().groups).toEqual([{ id: 'b', items: [{ id: 'x', name: 'BX', detail: 'BX detail' }, { id: 'y', name: 'BY', detail: 'BY detail' }] }]);
  expect(b.isDestroyed()).toBe(false);
});

it('same-membership construction reset retains keyed inner controls after both ancestor and child reorder', async() => {
  const { form, a, b } = await fixture();
  const ax = a.inner('x');
  const bx = b.inner('x');
  const input = control(ax);
  const node = ax.node;
  form.setValues({ groups: form.getValues().groups.map(group => ({ ...group, items: group.items.map(row => ({ ...row, name: `Changed ${group.id}/${row.id}` })).reverse() })).reverse() });
  await tick();
  edit(ax, 'Pending after reorder');
  expect(ax.getChildView('name').node.isSettled).toBe(false);
  form.resetForm();
  await tick(150);
  expect(form.getValues()).toEqual(initial());
  expect(ax.node).toBe(node);
  expect(control(ax)).toBe(input);
  expect(control(ax).value).toBe('AX');
  expect(control(bx).value).toBe('BX');
  expect(a.node.index).toBe(0);
  expect(ax.node.index).toBe(0);
});

it('membership-changing construction reset removes added outer and inner rows and allows explicit presentation rebuild', async() => {
  const { form, a, b, addOuter } = await fixture();
  const x = a.inner('x');
  const oldId = control(x).id;
  form.setValues({ groups: form.getValues().groups.map(group => group.id === 'a' ? { ...group, items: [group.items[1], { id: 'z', name: 'Added Z', detail: 'Z default' }] } : group).concat({ id: 'c', items: [{ id: 'x', name: 'Added C', detail: 'C default' }] }) });
  const z = a.addItem('z');
  const c = addOuter('c');
  await tick();
  expect(x.isDestroyed()).toBe(true);
  const ids = [z.node.props.id, control(z).id, c.node.props.id, control(c.inner('x')).id];
  form.resetForm();
  await tick();
  expect(form.getValues()).toEqual(initial());
  expect(z.isDestroyed()).toBe(true);
  expect(c.isDestroyed()).toBe(true);
  ids.forEach(id => expect(getNode(id)).toBeUndefined());
  expect(getNode(oldId)).toBeUndefined();
  expect(a.isDestroyed()).toBe(true);
  expect(b.isDestroyed()).toBe(true);
  const restoredA = addOuter('a');
  const restoredB = addOuter('b');
  await tick();
  expect(control(restoredA.inner('x')).value).toBe('AX');
  expect(control(restoredA.inner('y')).value).toBe('AY');
  expect(control(restoredB.inner('x')).value).toBe('BX');
  expect(getNode(control(restoredA.inner('x')).id).root).toBe(form.node);
});

it('submit resettles a delayed nested edit and pending validation after sibling removal before callback capture', async() => {
  const requests = [];
  const callbacks = [];
  const remote = node => new Promise(resolve => requests.push({ value: node.value, resolve }));
  const { form, a } = await fixture({ formProps: { submitBehavior: 'live' }, shared: { remoteKey: 'a/x', remote, clearRows: new Set(['a/y']) }, submit: values => callbacks.push(values) });
  expect(requests.some(request => request.value === 'AX')).toBe(true);
  const ax = a.inner('x');
  const ay = a.inner('y');
  const pending = form.submit();
  await flush();
  expect(control(ax).disabled).toBe(false);
  edit(ax, 'Latest AX');
  expect(ax.getChildView('name').node.isSettled).toBe(false);
  a.getChildView('list').getChildView('items').removeChildView(ay);
  requests.filter(request => request.value === 'AX').forEach(request => request.resolve(false));
  await tick();
  const latest = requests.filter(request => request.value === 'Latest AX');
  expect(latest.length).toBeGreaterThan(0);
  latest.forEach(request => request.resolve(true));
  await tick();
  expect(await pending).toBe('success');
  expect(callbacks).toHaveLength(1);
  expect(callbacks[0].groups.find(group => group.id === 'a').items).toEqual([{ id: 'x', name: 'Latest AX', detail: 'AX detail' }]);
  expect(ay.isDestroyed()).toBe(true);
});

it('nested removal after callback capture aborts the external attempt and terminal destroy ignores late work', async() => {
  let finish;
  let signal;
  const completed = [];
  const { form, owner, a, b } = await fixture({ submit(_values, context) {
    signal = context.signal;
    return new Promise(resolve => { finish = resolve; });
  } });
  form.on('submit:success', () => completed.push('success'));
  const pending = form.submit();
  await tick();
  expect(signal.aborted).toBe(false);
  const ids = [form.node.props.id, control(a.inner('x')).id, control(b.inner('x')).id];
  a.getChildView('list').setValue(a.getChildView('list').getValue().filter(row => row.id !== 'x'), { notify: false });
  await tick();
  expect(signal.aborted).toBe(true);
  owner.destroy();
  // Normal destruction removes existing listeners. Observe the retained form
  // after terminal teardown so a forbidden late event would still be detected.
  form.on('submit:success', () => completed.push('late success'));
  finish('Late success');
  await tick();
  expect(await pending).toBe('cancelled');
  expect(completed).toEqual([]);
  ids.forEach(id => expect(getNode(id)).toBeUndefined());
});
