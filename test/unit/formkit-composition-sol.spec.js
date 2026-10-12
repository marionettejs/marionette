import { afterEach, expect, it } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const owners = [];
async function settle(form) {
  await form.node.settled;
  for (let count = 0; count < 8; count++) {await Promise.resolve();}
}
function mount(options = {}) {
  const form = new FormView({ template: () => '<div class="group"></div><div class="leaf"></div>',
    regions: { group: '.group', leaf: '.leaf' }, ...options });
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region);
  region.show(form);
  return form;
}
function show(form, region, name, input, removal = 'preserve', parent) {
  const field = new FieldView({ form, name, input, removal, ...(parent ? { parent } : {}) });
  form.showChildView(region, field);
  return field;
}
function edit(field, value) {
  const input = field.el.querySelector('input, textarea');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}
afterEach(() => {
  owners.splice(0).forEach(owner => owner.destroy());
  document.body.replaceChildren();
});

it('replaces an owned group value without retaining omitted properties and preserves the root partial merge contract', async() => {
  const form = mount({ values: { sibling: 'Retained' } });
  const group = show(form, 'group', 'draft', { type: 'group', value: { keep: 'A', stale: 'B' } });
  await settle(form);
  const events = [];
  group.on('field:change', (value, metadata) => events.push({ value, metadata }));
  group.setValue({ keep: 'C' }, { source: 'actor' });
  await settle(form);
  expect(group.getValue()).toEqual({ keep: 'C' });
  expect(form.getValues()).toEqual({ sibling: 'Retained', draft: { keep: 'C' } });
  expect(events).toEqual([{ value: { keep: 'C' }, metadata: { source: 'actor' } }]);
  form.setValues({ draft: { added: 'D' } }, { notify: false });
  await settle(form);
  expect(group.getValue()).toEqual({ keep: 'C', added: 'D' });
  expect(events).toHaveLength(1);
});

it('notifies field and form setters once and suppresses both for silent snapshots', async() => {
  const form = mount();
  const field = show(form, 'leaf', 'name', { type: 'text', value: 'A' });
  await settle(form);
  const fields = []; const roots = [];
  field.on('field:change', (value, metadata) => fields.push({ value, metadata }));
  form.on('form:change', (values, _state, metadata) => roots.push({ values, metadata }));
  field.setValue('B');
  await settle(form);
  expect(fields).toEqual([{ value: 'B', metadata: { source: 'programmatic' } }]);
  expect(roots).toEqual([{ values: { name: 'B' }, metadata: { source: 'programmatic' } }]);
  field.setValue('Silent', { notify: false });
  form.setValues({ name: 'Also silent' }, { notify: false });
  await settle(form);
  expect(field.getValue()).toBe('Also silent');
  expect(fields).toHaveLength(1);
  expect(roots).toHaveLength(1);
  form.setValues({ name: 'External' }, { source: 'owner' });
  await settle(form);
  expect(fields.at(-1)).toEqual({ value: 'External', metadata: { source: 'owner' } });
  expect(roots.at(-1)).toEqual({ values: { name: 'External' }, metadata: { source: 'owner' } });
  expect(fields).toHaveLength(2);
  expect(roots).toHaveLength(2);
});

it('captures user origin for a leaf and its owned group before a silent owner echo', async() => {
  const form = mount();
  const group = show(form, 'group', 'details', { type: 'group' });
  const leaf = show(form, 'leaf', 'name', { type: 'text', value: 'A' }, 'preserve', group.node);
  await settle(form);
  const groups = []; const leaves = []; const roots = [];
  group.on('field:change', (value, metadata) => groups.push({ value, metadata }));
  leaf.on('field:change', (value, metadata) => leaves.push({ value, metadata }));
  form.on('form:change', (values, _state, metadata) => {
    roots.push({ values, metadata });
    form.setValues(values, { notify: false });
  });
  edit(leaf, 'Native');
  await settle(form);
  expect(form.getValues()).toEqual({ details: { name: 'Native' } });
  expect(leaves).toEqual([{ value: 'Native', metadata: { source: 'user' } }]);
  expect(groups).toEqual([{ value: { name: 'Native' }, metadata: { source: 'user' } }]);
  expect(roots).toEqual([{ values: { details: { name: 'Native' } }, metadata: { source: 'user' } }]);
});

it('does not retain a user origin on an owned group after an unchanged native event', async() => {
  const form = mount();
  const group = show(form, 'group', 'details', { type: 'group' });
  const leaf = show(form, 'leaf', 'name', { type: 'text', value: 'A' }, 'preserve', group.node);
  await settle(form);
  const groups = []; const leaves = [];
  group.on('field:change', (value, metadata) => groups.push({ value, metadata }));
  leaf.on('field:change', (value, metadata) => leaves.push({ value, metadata }));
  edit(leaf, 'A');
  await settle(form);
  expect(groups).toEqual([]);
  expect(leaves).toEqual([]);
  await leaf.node.input('Owner', false);
  await settle(form);
  expect(leaves).toEqual([{ value: 'Owner', metadata: { source: 'programmatic' } }]);
  expect(groups).toEqual([{ value: { name: 'Owner' }, metadata: { source: 'programmatic' } }]);
});

it('clears an explicitly removed child beneath a preserved group while preserving a hidden draft', async() => {
  const form = mount();
  const group = show(form, 'group', 'details', { type: 'group' });
  const notes = show(form, 'leaf', 'notes', { type: 'textarea', value: 'Referral draft' }, 'clear', group.node);
  await settle(form);
  const nodeId = notes.node.props.id;
  form.getRegion('leaf').empty();
  await settle(form);
  expect(form.getValues()).toEqual({ details: {} });
  expect(group.node.at('notes')).toBeUndefined();
  expect(getNode(nodeId)).toBeUndefined();
  form.setValues({ details: { notes: 'Stale owner snapshot' } }, { notify: false });
  expect(form.getValues()).toEqual({ details: {} });
  group.setValue({ notes: 'Stale group snapshot', retained: 'Current' }, { notify: false });
  await settle(form);
  expect(group.getValue()).toEqual({ retained: 'Current' });
  expect(form.getValues()).toEqual({ details: { retained: 'Current' } });
  const draft = show(form, 'leaf', 'draft', { type: 'text', value: 'Initial' }, 'preserve', group.node);
  draft.setValue('Business draft', { notify: false });
  form.getRegion('leaf').empty();
  await settle(form);
  expect(form.getValues()).toEqual({ details: { retained: 'Current', draft: 'Business draft' } });
});

it('restores the original default when a cleared field remounts', async() => {
  const form = mount();
  const field = show(form, 'leaf', 'company', { type: 'text', value: 'Baseline' }, 'clear');
  await settle(form);
  field.setValue('Draft', { notify: false });
  form.getRegion('leaf').empty();
  await settle(form);
  expect(form.getValues()).toEqual({});
  form.setValues({ company: 'Stale' }, { notify: false });
  const remounted = show(form, 'leaf', 'company', { type: 'text', value: 'Baseline' }, 'clear');
  await settle(form);
  expect(remounted.getValue()).toBe('Baseline');
  expect(remounted.el.querySelector('input').value).toBe('Baseline');
  expect(form.getValues()).toEqual({ company: 'Baseline' });
});

it('ends child Views, registry entries and queued changes when an owned group is destroyed', async() => {
  const form = mount();
  const group = show(form, 'group', 'details', { type: 'group' });
  const leaf = show(form, 'leaf', 'name', { type: 'text', value: 'A' }, 'preserve', group.node);
  await settle(form);
  const id = leaf.node.props.id;
  const events = [];
  leaf.on('field:change', value => events.push(value));
  leaf.setValue('Queued');
  form.getRegion('group').empty();
  await settle(form);
  expect(leaf.isDestroyed()).toBe(true);
  expect(form.getRegion('leaf').hasView()).toBe(false);
  expect(getNode(id)).toBeUndefined();
  expect(events).toEqual([]);
});

it('keeps official schema lists available and rejects them as composed field parents', async() => {
  const form = mount({ template: undefined, schema: [{ $formkit: 'list', name: 'rows', children: [] }] });
  await settle(form);
  const parent = form.node.at('rows');
  expect(parent.type).toBe('list');
  const field = new FieldView({ form, parent, name: 'item', removal: 'preserve', input: { type: 'text' } });
  expect(() => field.render()).toThrow(/live group owned by its form/);
  field.destroy();
  expect(form.node.at('rows')).toBe(parent);
});
