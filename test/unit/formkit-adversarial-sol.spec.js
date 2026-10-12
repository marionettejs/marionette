import { afterEach, expect, it } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';

const owners = [];
async function settle(form, field) {
  if (field) { await field.node.settled; }
  await form.node.settled;
  for (let count = 0; count < 8; count++) { await Promise.resolve(); }
}
function mount() {
  const form = new FormView({ template: () => '<div class="outer"></div><div class="leaf"></div><div class="sibling"></div>',
    regions: { outer: '.outer', leaf: '.leaf', sibling: '.sibling' } });
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region);
  region.show(form);
  const group = new FieldView({ form, name: 'details', removal: 'preserve', input: { type: 'group' } });
  form.showChildView('outer', group);
  const leaf = new FieldView({ form, parent: group.node, name: 'name', removal: 'preserve',
    input: { type: 'text', value: 'Initial', config: { delay: 60 } } });
  form.showChildView('leaf', leaf);
  return { form, group, leaf };
}
function edit(field, value) {
  const control = field.el.querySelector('input');
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  return control;
}
function mountRows() {
  const form = new FormView({ values: { rows: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }], other: 'Before' },
    schema: [{ $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
      { $formkit: 'group', for: ['row', 'index', '$items'], key: '$row', index: '$index', children: [
        { $formkit: 'hidden', name: 'id' },
        { $formkit: 'text', name: 'name', config: { delay: 60 } },
      ] },
    ] }, { $formkit: 'text', name: 'other' }] });
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region);
  region.show(form);
  return form;
}
afterEach(() => {
  owners.splice(0).forEach(owner => owner.destroy());
  document.body.replaceChildren();
});

it.each(['form', 'group'])('keeps an explicit %s snapshot authoritative over an older delayed native edit', async owner => {
  const { form, group, leaf } = mount();
  await settle(form, leaf);
  const changes = [];
  leaf.on('field:change', (value, metadata) => changes.push({ value, metadata }));
  const control = edit(leaf, 'Older pending edit');
  expect(leaf.node.isSettled).toBe(false);
  if (owner === 'form') { form.setValues({ details: { name: 'New owner snapshot' } }, { notify: false }); } else { group.setValue({ name: 'New owner snapshot' }, { notify: false }); }
  await settle(form, leaf);
  expect(form.getValues()).toEqual({ details: { name: 'New owner snapshot' } });
  expect(leaf.getValue()).toBe('New owner snapshot');
  expect(control.value).toBe('New owner snapshot');
  expect(changes).toEqual([]);
  await leaf.node.input('Next programmatic', false);
  await settle(form, leaf);
  expect(changes).toEqual([{ value: 'Next programmatic', metadata: { source: 'programmatic' } }]);
});

it('lets a field setter restore the committed value while an older native edit is pending', async() => {
  const { form, leaf } = mount();
  await settle(form, leaf);
  const changes = [];
  leaf.on('field:change', value => changes.push(value));
  const control = edit(leaf, 'Older pending edit');
  expect(leaf.node.isSettled).toBe(false);
  leaf.setValue('Initial', { notify: false });
  await settle(form, leaf);
  expect(form.getValues()).toEqual({ details: { name: 'Initial' } });
  expect(leaf.getValue()).toBe('Initial');
  expect(control.value).toBe('Initial');
  expect(changes).toEqual([]);
});

it.each(['form', 'group'])('lets an explicit %s snapshot restore a committed value over an older pending edit', async owner => {
  const { form, group, leaf } = mount();
  await settle(form, leaf);
  const changes = [];
  leaf.on('field:change', value => changes.push(value));
  const control = edit(leaf, 'Older pending edit');
  expect(leaf.node.isSettled).toBe(false);
  if (owner === 'form') { form.setValues({ details: { name: 'Initial' } }, { notify: false }); } else {
    group.setValue({ name: 'Initial' }, { notify: false });
  }
  await settle(form, leaf);
  expect(form.getValues()).toEqual({ details: { name: 'Initial' } });
  expect(control.value).toBe('Initial');
  expect(changes).toEqual([]);
});

it('honors a same-committed owner restore after an unrelated snapshot while a child is still pending', async() => {
  const { form, leaf } = mount();
  const sibling = new FieldView({ form, name: 'other', removal: 'preserve', input: { type: 'text', value: 'Before' } });
  form.showChildView('sibling', sibling);
  await settle(form, leaf);
  const changes = [];
  leaf.on('field:change', value => changes.push(value));
  const control = edit(leaf, 'Older pending edit');
  form.setValues({ other: 'Independent snapshot' }, { notify: false });
  expect(leaf.node.isSettled).toBe(false);
  form.setValues({ details: { name: 'Initial' } }, { notify: false });
  await settle(form, leaf);
  expect(form.getValues()).toEqual({ details: { name: 'Initial' }, other: 'Independent snapshot' });
  expect(control.value).toBe('Initial');
  expect(changes).toEqual([]);
});

it('keeps an unrelated partial snapshot from cancelling a delayed native edit', async() => {
  const { form, group, leaf } = mount();
  const sibling = new FieldView({ form, name: 'other', removal: 'preserve', input: { type: 'text', value: 'Before' } });
  form.showChildView('sibling', sibling);
  await settle(form, leaf);
  const changes = [];
  const groups = [];
  const roots = [];
  leaf.on('field:change', (value, metadata) => changes.push({ value, metadata }));
  group.on('field:change', (value, metadata) => groups.push({ value, metadata }));
  form.on('form:change', (values, _state, metadata) => roots.push({ values, metadata }));
  const control = edit(leaf, 'Pending user draft');
  form.setValues({ other: 'Independent snapshot' }, { notify: false });
  await settle(form, leaf);
  expect(form.getValues()).toEqual({ details: { name: 'Pending user draft' }, other: 'Independent snapshot' });
  expect(control.value).toBe('Pending user draft');
  expect(changes).toEqual([{ value: 'Pending user draft', metadata: { source: 'user' } }]);
  expect(groups).toEqual([{ value: { name: 'Pending user draft' }, metadata: { source: 'user' } }]);
  expect(roots).toEqual([{ values: { details: { name: 'Pending user draft' }, other: 'Independent snapshot' }, metadata: { source: 'user' } }]);
});

it('focuses an editable invalid control when a preceding invalid field is disabled', async() => {
  const { form, leaf } = mount();
  leaf.setValue('', { notify: false });
  leaf.setInput({ label: 'Unavailable', disabled: true, validation: 'required' });
  const email = new FieldView({ form, name: 'email', removal: 'preserve',
    input: { type: 'email', label: 'Email', help: 'Work address', validation: 'required|email' } });
  form.showChildView('sibling', email);
  await settle(form, leaf);
  const disabled = leaf.el.querySelector('input');
  const editable = email.el.querySelector('input');
  expect(await form.submit()).toBe('invalid');
  expect(disabled.disabled).toBe(true);
  expect(disabled.getAttribute('aria-invalid')).toBe('true');
  expect(editable.disabled).toBe(false);
  expect(editable.getAttribute('aria-invalid')).toBe('true');
  expect(editable.getAttribute('aria-describedby').split(' ').map(id => document.getElementById(id)?.textContent))
    .toEqual(['Work address', 'Email is required.']);
  expect(document.activeElement).toBe(editable);
});

it.each(['same order', 'reorder'])('supersedes a keyed schema row draft with an explicit snapshot in %s', async order => {
  const form = mountRows();
  await settle(form);
  const [alpha, beta] = form.el.querySelectorAll('input[type="text"]');
  const pending = form.node.at('rows.0.name');
  const changes = [];
  form.on('form:change', (values, _state, metadata) => changes.push({ values, metadata }));
  alpha.focus();
  alpha.value = 'Older pending row draft';
  alpha.dispatchEvent(new Event('input', { bubbles: true }));
  expect(pending.isSettled).toBe(false);
  const rows = order === 'same order' ? [{ id: 'a', name: 'Actor alpha' }, { id: 'b', name: 'Beta' }] :
    [{ id: 'b', name: 'Beta' }, { id: 'a', name: 'Actor alpha' }];
  form.setValues({ rows }, { notify: false });
  await pending.settled;
  await settle(form);
  expect(form.getValues()).toEqual({ rows, other: 'Before' });
  expect(alpha.value).toBe('Actor alpha');
  expect([...form.el.querySelectorAll('input[type="text"]')].slice(0, 2)).toEqual(order === 'same order' ? [alpha, beta] : [beta, alpha]);
  expect(document.activeElement).toBe(alpha);
  expect(changes).toEqual([]);
});

it('preserves a keyed schema row draft and its user origin during an unrelated owner snapshot', async() => {
  const form = mountRows();
  await settle(form);
  const alpha = form.el.querySelector('input[type="text"]');
  const pending = form.node.at('rows.0.name');
  const changes = [];
  form.on('form:change', (values, _state, metadata) => changes.push({ values, metadata }));
  alpha.focus();
  alpha.value = 'Pending row draft';
  alpha.dispatchEvent(new Event('input', { bubbles: true }));
  expect(pending.isSettled).toBe(false);
  form.setValues({ other: 'Independent' }, { notify: false });
  await pending.settled;
  await settle(form);
  const values = { rows: [{ id: 'a', name: 'Pending row draft' }, { id: 'b', name: 'Beta' }], other: 'Independent' };
  expect(form.getValues()).toEqual(values);
  expect(form.el.querySelector('input[type="text"]')).toBe(alpha);
  expect(document.activeElement).toBe(alpha);
  expect(changes).toEqual([{ values, metadata: { source: 'user' } }]);
});

it.each([false, true])('copies an owner array snapshot independently of a pending native edit (%s)', async pending => {
  const form = new FormView({ template: () => '<div class="selected"></div>', regions: { selected: '.selected' },
    values: { selected: ['Alpha'] } });
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region);
  region.show(form);
  const field = new FieldView({ form, name: 'selected', removal: 'preserve',
    input: { type: 'checkbox', options: ['Alpha', 'Beta', 'Gamma'], config: { delay: 60 } } });
  form.showChildView('selected', field);
  await settle(form, field);
  const changes = [];
  form.on('form:change', values => changes.push(values));
  field.on('field:change', value => changes.push(value));
  if (pending) {
    const beta = [...field.el.querySelectorAll('input')].find(control => control.value === 'Beta');
    beta.checked = true;
    beta.dispatchEvent(new Event('input', { bubbles: true }));
    expect(field.node.isSettled).toBe(false);
  }
  const incoming = ['Gamma'];
  form.setValues({ selected: incoming }, { notify: false });
  expect(form.getValues()).toEqual({ selected: ['Gamma'] });
  incoming.push('Beta');
  await settle(form, field);
  expect(form.getValues()).toEqual({ selected: ['Gamma'] });
  expect(field.getValue()).toEqual(['Gamma']);
  expect([...field.el.querySelectorAll('input')].filter(control => control.checked).map(control => control.value)).toEqual(['Gamma']);
  expect(changes).toEqual([]);
});
