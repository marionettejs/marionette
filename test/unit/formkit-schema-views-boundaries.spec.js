import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { View, Region } from 'marionette';
import { FieldView, FormView, SchemaView, createViewComponents } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const owners = [];
const faults = [];
const recordError = event => faults.push(String(event.error?.message ?? event.message));
const recordRejection = event => faults.push(String(event.reason?.message ?? event.reason));
beforeEach(() => {
  faults.length = 0;
  window.addEventListener('error', recordError);
  window.addEventListener('unhandledrejection', recordRejection);
  vi.spyOn(console, 'error').mockImplementation((...messages) => faults.push(messages.map(String).join(' ')));
});
afterEach(() => {
  owners.splice(0).reverse().forEach(owner => owner.destroy());
  window.removeEventListener('error', recordError);
  window.removeEventListener('unhandledrejection', recordRejection);
  expect(faults, 'runtime and unhandled errors are hard failures').toEqual([]);
  vi.useRealTimers();
  document.body.replaceChildren();
});
async function drain() { for (let count = 0; count < 20; count++) { await Promise.resolve(); } }
function form(values = {}) {
  const view = new FormView({ template: () => '<div data-fields></div>', regions: { fields: '[data-fields]' }, values });
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(owner); owner.show(view);
  return view;
}
function component(factory, props = {}, data = {}) { return factory({ document, props, data }); }
function place(owner, mount) { owner.el.append(mount.element); }

it('BOUND-01 premount schema/data replacement renders only the chosen native field and terminal methods create no late work', async() => {
  const owner = form({ title: 'Initial' });
  const section = new SchemaView({ form: owner, schema: { $formkit: 'text', name: 'discarded' } });
  owners.push(section);
  section.setSchema({ $formkit: 'text', name: 'title', id: 'boundary-premount', label: '$label', preserve: true });
  section.setSchemaData({ label: 'Chosen label' });
  owner.showChildView('fields', section);
  const node = getNode('boundary-premount');
  expect(node.props.label).toBe('Chosen label');
  expect(owner.node.children).toHaveLength(1);
  expect(owner.node.at('discarded')).toBeUndefined();
  expect(section.render()).toBe(section);
  expect(getNode('boundary-premount')).toBe(node);
  section.destroy(); section.destroy();
  expect(section.setSchema({ $formkit: 'text', name: 'late', id: 'boundary-late' })).toBe(section);
  expect(section.setSchemaData({ label: 'Late' })).toBe(section);
  expect(section.render()).toBe(section);
  await drain();
  expect(getNode('boundary-premount')).toBeUndefined();
  expect(getNode('boundary-late')).toBeUndefined();
  expect(owner.getValues()).toEqual({ title: 'Initial' });
});

it('BOUND-02 premount destroy and dead form, foreign, dead or list parent diagnostics use public ownership', () => {
  const owner = form();
  const neverMounted = new SchemaView({ form: owner, schema: [] });
  neverMounted.destroy();
  expect(neverMounted.render()).toBe(neverMounted);
  const other = form();
  const foreign = new SchemaView({ form: owner, parent: other.node, schema: [] }); owners.push(foreign);
  expect(() => foreign.render()).toThrow('Schema parent must be a live group owned by its form.');
  const group = new FieldView({ form: owner, name: 'group', removal: 'preserve', input: { type: 'group' } });
  group.render(); const deadParent = group.node; group.destroy();
  const dead = new SchemaView({ form: owner, parent: deadParent, schema: [] }); owners.push(dead);
  expect(() => dead.render()).toThrow('Schema parent must be a live group owned by its form.');
  const list = new FieldView({ form: owner, name: 'rows', removal: 'preserve', input: { type: 'list', value: [] } });
  list.render();
  const wrongKind = new SchemaView({ form: owner, parent: list.node, schema: [] }); owners.push(wrongKind);
  expect(() => wrongKind.render()).toThrow('Schema parent must be a live group owned by its form.');
  const late = new SchemaView({ form: owner, schema: [] }); owners.push(late);
  owner.destroy();
  expect(() => late.render()).toThrow('The SchemaView owner has been destroyed.');
});

it('BOUND-03 native parent expressions reject a foreign or dead group, and nested forms reject before placement', () => {
  const owner = form(); const other = form();
  const foreign = new SchemaView({ form: owner, schema: { $formkit: 'text', name: 'title', parent: '$target' }, schemaData: { target: other.node } }); owners.push(foreign);
  expect(() => foreign.render()).toThrow('Schema inputs require a live parent belonging to the same form.');
  const group = new FieldView({ form: owner, name: 'details', removal: 'preserve', input: { type: 'group' } }); group.render(); const deadParent = group.node; group.destroy();
  const dead = new SchemaView({ form: owner, schema: { $formkit: 'text', name: 'title', parent: '$target' }, schemaData: { target: deadParent } }); owners.push(dead);
  expect(() => dead.render()).toThrow('Schema inputs require a live parent belonging to the same form.');
  const nested = new SchemaView({ form: owner, schema: { $formkit: 'form', name: 'nested' } }); owners.push(nested);
  expect(() => nested.render()).toThrow('Composed inputs cannot create a nested form.');
});

it('BOUND-04 unnamed native schema field participates once and resets its construction value', async() => {
  const owner = form();
  const section = new SchemaView({ form: owner, schema: { $formkit: 'text', id: 'boundary-unnamed', value: 'Automatic', preserve: true } });
  owner.showChildView('fields', section);
  const node = getNode('boundary-unnamed');
  expect(owner.node.children).toHaveLength(1);
  expect(node.parent).toBe(owner.node);
  expect(owner.getValues()[node.name]).toBe('Automatic');
  await node.input('Edited', false);
  owner.resetForm(); await drain();
  expect(node.value).toBe('Automatic');
  expect(section.el.querySelector('input').value).toBe('Automatic');
});

it('BOUND-05 public named factory updates mutable omissions and explicit values on one FieldView, then disposes idempotently', async() => {
  const owner = form({ title: 'Initial' }); let field;
  const factories = createViewComponents({ getForm: () => owner, registrations: { Text: { kind: 'field', create(options) { field = new FieldView(options); return field; } } } });
  const props = { name: 'title', input: { type: 'text', id: 'boundary-direct-title', label: 'Old', disabled: true, value: 'Initial' } };
  const mounted = component(factories.Text, props); place(owner, mounted); await drain();
  const node = field.node; const input = owner.el.querySelector('#boundary-direct-title');
  expect(field.isAttached()).toBe(true); expect(input.disabled).toBe(true);
  mounted.update({ name: 'title', input: { type: 'text', id: 'boundary-direct-title', value: 'Explicit' } }, {});
  await drain();
  expect(getNode(input.id)).toBe(node); expect(input.disabled).toBe(false); expect(node.props.label).toBeUndefined(); expect(input.value).toBe('Explicit');
  expect(owner.getValues()).toEqual({ title: 'Explicit' });
  mounted.update({ name: 'title', input: { type: 'text', id: 'boundary-direct-title', value: 'Explicit' } }, {});
  expect(getNode(input.id)).toBe(node);
  mounted.destroy(); mounted.destroy();
  mounted.update(props, {}); await drain();
  expect(field.isDestroyed()).toBe(true); expect(getNode(input.id)).toBeUndefined(); expect(Object.keys(owner.getRegions())).toEqual(['fields']);
  expect(owner.getValues()).toEqual({ title: 'Explicit' });
});

it('BOUND-06 explicit parent resolver identity changes reject; disposal permits a same-name replacement', async() => {
  const owner = form({ left: { title: 'Left' }, right: { title: 'Right' } });
  const left = new FieldView({ form: owner, name: 'left', removal: 'preserve', input: { type: 'group' } }); left.render();
  const right = new FieldView({ form: owner, name: 'right', removal: 'preserve', input: { type: 'group' } }); right.render();
  const fields = [];
  const factories = createViewComponents({ getForm: () => owner, getParent: (_props, data) => data.group, registrations: { Text: { kind: 'field', create(options) { const view = new FieldView(options); fields.push(view); return view; } } } });
  const props = { name: 'title', removal: 'preserve', input: { type: 'text', id: 'boundary-parent-title' } };
  const first = component(factories.Text, props, { group: left.node }); place(owner, first); await drain();
  expect(fields[0].node.parent).toBe(left.node);
  expect(() => first.update(props, { group: right.node })).toThrow('Change the schema key to replace FieldView identity');
  expect(() => first.update({ ...props, input: { type: 'email', id: 'boundary-parent-title' } }, { group: left.node })).toThrow('Change the schema key to replace FieldView identity');
  first.destroy();
  const second = component(factories.Text, props, { group: left.node }); place(owner, second); await drain();
  expect(fields[1]).not.toBe(fields[0]); expect(fields[1].node.parent).toBe(left.node); expect(fields[1].getValue()).toBe('Left');
  second.destroy();
});

it('BOUND-07 owner destruction before placement cancels direct ordinary View factory and terminal update', async() => {
  const owner = form(); let child;
  const factories = createViewComponents({ getForm: () => owner, registrations: { Plain: { kind: 'view', create() { child = new View({ template: () => '<p>Pending</p>' }); return child; } } } });
  const mounted = component(factories.Plain); place(owner, mounted);
  expect(child.isAttached()).toBe(false); owner.destroy();
  mounted.update({}, {}); mounted.destroy(); await drain();
  expect(child.isDestroyed()).toBe(true); expect(mounted.element.isConnected).toBe(false);
});

it('BOUND-08 named factory diagnoses unavailable form or ordinary owner', () => {
  const owner = form(); const dead = form(); dead.destroy();
  const make = options => createViewComponents({ ...options, registrations: { Plain: { kind: 'view', create: () => new View({ template: () => '' }) } } }).Plain;
  expect(() => component(make({ getForm: () => undefined }))).toThrow('A live form and ordinary Region owner are required.');
  expect(() => component(make({ getForm: () => dead }))).toThrow('A live form and ordinary Region owner are required.');
  expect(() => component(make({ getForm: () => owner, getOwner: () => undefined }))).toThrow('A live form and ordinary Region owner are required.');
  const deadLayout = new View({ template: () => '' }); deadLayout.destroy();
  expect(() => component(make({ getForm: () => owner, getOwner: () => deadLayout }))).toThrow('A live form and ordinary Region owner are required.');
});

it('BOUND-09 named registration rejects nested forms and mismatched actual View/FieldView kinds', () => {
  const owner = form();
  const factories = createViewComponents({ getForm: () => owner, registrations: {
    Nested: { kind: 'field', create: options => new FieldView(options) },
    WrongField: { kind: 'field', create: () => new View({ template: () => '' }) },
    WrongView: { kind: 'view', create: () => new FieldView({ form: owner, name: 'wrong', removal: 'preserve', input: { type: 'text' } }) },
    NestedView: { kind: 'view', create: () => new FormView({ fields: [] }) },
    Missing: { kind: 'view', create: () => undefined }
  } });
  expect(() => component(factories.Nested, { name: 'nested', input: { type: 'form' } })).toThrow('Nested form inputs are excluded');
  expect(() => component(factories.WrongField)).toThrow('Field registration must return an actual FieldView.');
  expect(() => component(factories.WrongView)).toThrow('FieldView requires an explicit field registration.');
  expect(() => component(factories.NestedView)).toThrow('never FormView.');
  expect(() => component(factories.Missing)).toThrow('The registry must return an ordinary Marionette View');
});

it('BOUND-10 named preset FieldView constructor supplies its native input while value-only props update the same control', async() => {
  const owner = form({ title: 'Initial' }); let field;
  const factories = createViewComponents({ getForm: () => owner, registrations: { Preset: { kind: 'field', create(options) { field = new FieldView({ ...options, input: { type: 'text', id: 'boundary-preset', label: 'Preset title' } }); return field; } } } });
  const mounted = component(factories.Preset, { name: 'title' }); place(owner, mounted); await drain();
  const input = owner.el.querySelector('#boundary-preset'); const node = field.node;
  expect(node.props.label).toBe('Preset title'); expect(input.value).toBe('Initial');
  mounted.update({ name: 'title', input: { value: 'Explicit' } }, {}); await drain();
  expect(getNode(input.id)).toBe(node); expect(owner.el.querySelector('#boundary-preset')).toBe(input); expect(input.value).toBe('Explicit');
  mounted.update({ name: 'title' }, {}); await drain();
  expect(owner.getValues()).toEqual({ title: 'Explicit' }); expect(node.props.label).toBe('Preset title');
  mounted.destroy();
});

it('BOUND-11 native parent expression shares a real group; destroying that group leaves the borrowed-root layout alive without recreating late inputs', async() => {
  const owner = form({ details: { title: 'Nested' } });
  const group = new FieldView({ form: owner, name: 'details', removal: 'preserve', input: { type: 'group' } });
  group.render();
  const section = new SchemaView({ form: owner, schema: { $formkit: 'text', name: 'title', id: 'boundary-resolved-group', parent: '$target' }, schemaData: { target: group.node } });
  owner.showChildView('fields', section);
  const node = getNode('boundary-resolved-group');
  expect(node.parent === group.node, 'explicit native group parent').toBe(true); expect(section.node === owner.node, 'layout borrowed root').toBe(true);
  group.destroy(); await drain();
  expect(section.isDestroyed()).toBe(false); expect(getNode('boundary-resolved-group') === undefined, 'no native node after target-group destruction').toBe(true);
  owner.setValues({ other: 'Still usable' }); await drain();
  expect(owner.getValues()).toEqual({ details: { title: 'Nested' }, other: 'Still usable' });
  expect(getNode('boundary-resolved-group') === undefined, 'no native node after target-group destruction').toBe(true);
});

it('BOUND-12 conditional native group destruction ends separately placed borrowed SchemaView while its ordinary owner and unrelated sibling survive', async() => {
  const owner = new FormView({ schema: [
    { $formkit: 'group', name: 'details', id: 'boundary-conditional-group', if: '$visible', preserve: true },
    { $formkit: 'text', name: 'other', id: 'boundary-conditional-other', preserve: true }
  ], schemaData: { visible: true }, values: { details: { note: 'Nested' }, other: 'Independent' }, formProps: { actions: false } });
  const outer = new Region({ el: document.body.appendChild(document.createElement('div')) }); owners.push(outer); outer.show(owner);
  const aside = new View({ template: () => '<section data-schema></section>', regions: { schema: '[data-schema]' } });
  owner.addRegion('aside', { el: owner.el.appendChild(document.createElement('aside')) }); owner.showChildView('aside', aside);
  const group = getNode('boundary-conditional-group');
  const section = new SchemaView({ form: owner, parent: group, schema: { $formkit: 'text', name: 'note', id: 'boundary-borrowed-note' } }); aside.showChildView('schema', section);
  const other = getNode('boundary-conditional-other');
  expect(section.node).toBe(group); expect(getNode('boundary-borrowed-note').parent).toBe(group); expect(section.isAttached()).toBe(true);
  owner.setSchemaData({ visible: false }); await drain();
  expect(getNode('boundary-conditional-group')).toBeUndefined(); expect(getNode('boundary-borrowed-note')).toBeUndefined(); expect(section.isDestroyed()).toBe(true);
  expect(aside.isDestroyed()).toBe(false); expect(aside.el.isConnected).toBe(true); expect(owner.isDestroyed()).toBe(false); expect(getNode('boundary-conditional-other')).toBe(other);
  expect(owner.getValues()).toEqual({ details: { note: 'Nested' }, other: 'Independent' });
});
