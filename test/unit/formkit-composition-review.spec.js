import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';
import { createNode, getNode } from '@formkit/core';

const owners = [];
function mount(options = {}) {
  const form = new FormView({
    template: () => '<div class="group"></div><div class="first"></div><div class="second"></div><button type="submit">Save</button>',
    regions: { group: '.group', first: '.first', second: '.second' },
    ...options,
  });
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region);
  region.show(form);
  return form;
}
function field(form, region, options = {}) {
  const view = new FieldView({ form, name: region, removal: 'preserve', input: { type: 'text', label: region }, ...options });
  form.showChildView(region, view);
  return view;
}
async function settle(form) {
  await form.node.settled;
  // Field notifications and native schema painting are documented asynchronous outcomes.
  await vi.waitFor(() => expect(form.node.isSettled).toBe(true));
  await Promise.resolve();
}
function nativeEdit(view, value) {
  const input = view.el.querySelector('input');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}
afterEach(() => {
  owners.splice(0).reverse().forEach(owner => owner.destroy());
  vi.useRealTimers();
  document.body.replaceChildren();
});

it('emits direct FieldView replacements with the requested source and suppresses both APIs for silent writes', async() => {
  const form = mount();
  const view = field(form, 'first');
  await settle(form);
  const fields = []; const roots = [];
  view.on('field:change', (value, metadata) => fields.push({ value, source: metadata.source }));
  form.on('form:change', (values, _state, metadata) => roots.push({ values, source: metadata.source }));
  view.setValue('Actor snapshot', { source: 'actor' });
  await settle(form);
  expect(fields).toEqual([{ value: 'Actor snapshot', source: 'actor' }]);
  expect(roots).toEqual([{ values: { first: 'Actor snapshot' }, source: 'actor' }]);
  view.setValue('Silent snapshot', { notify: false, source: 'silent-actor' });
  await settle(form);
  expect(view.getValue()).toBe('Silent snapshot');
  expect(form.getValues()).toEqual({ first: 'Silent snapshot' });
  await vi.waitFor(() => expect(view.el.querySelector('input').value).toBe('Silent snapshot'));
  expect(fields).toHaveLength(1);
  expect(roots).toHaveLength(1);
  nativeEdit(view, 'User correction');
  await vi.waitFor(() => expect(fields).toHaveLength(2));
  expect(fields[1]).toEqual({ value: 'User correction', source: 'user' });
  expect(roots.at(-1)).toEqual({ values: { first: 'User correction' }, source: 'user' });
});

it('keeps native group and leaf origins user after a silent root snapshot', async() => {
  const form = mount();
  const group = field(form, 'group', { name: 'contact', input: { type: 'group' } });
  const child = field(form, 'first', { name: 'email', parent: group.node });
  await settle(form);
  form.setValues({ contact: { email: 'actor@example.com' } }, { notify: false, source: 'actor' });
  await settle(form);
  const groups = []; const leaves = []; const roots = [];
  group.on('field:change', (value, metadata) => groups.push({ value, source: metadata.source }));
  child.on('field:change', (value, metadata) => leaves.push({ value, source: metadata.source }));
  form.on('form:change', (value, _state, metadata) => roots.push({ value, source: metadata.source }));
  nativeEdit(child, 'user@example.com');
  await vi.waitFor(() => expect(groups).toHaveLength(1));
  expect(groups).toEqual([{ value: { email: 'user@example.com' }, source: 'user' }]);
  expect(leaves).toEqual([{ value: 'user@example.com', source: 'user' }]);
  expect(roots).toEqual([{ value: { contact: { email: 'user@example.com' } }, source: 'user' }]);
});

it.each(['preserve', 'clear'])('honors explicit %s removal beneath a preserved group through reset and remount', async removal => {
  const form = mount({ values: { contact: { email: 'Root baseline' } } });
  const group = field(form, 'group', { name: 'contact', input: { type: 'group' } });
  let child = field(form, 'first', { name: 'email', parent: group.node, removal,
    input: { type: 'text', value: 'Input fallback' } });
  await settle(form);
  expect(child.getValue()).toBe('Root baseline');
  child.setValue('Draft');
  await settle(form);
  form.getRegion('first').empty();
  await settle(form);
  expect(form.getValues()).toEqual({ contact: removal === 'preserve' ? { email: 'Draft' } : {} });
  expect(group.node.at('email')).toBeUndefined();
  form.resetForm();
  await settle(form);
  expect(form.getValues()).toEqual({ contact: removal === 'preserve' ? { email: 'Root baseline' } : {} });
  child = field(form, 'first', { name: 'email', parent: group.node, removal,
    input: { type: 'text', value: 'Different fallback' } });
  await settle(form);
  expect(child.getValue()).toBe('Root baseline');
  await vi.waitFor(() => expect(child.el.querySelector('input').value).toBe('Root baseline'));
});

it.each(['group', 'form'])('destroying the %s owner ends a detached descendant FieldView', async owner => {
  const form = mount();
  const group = field(form, 'group', { name: 'contact', input: { type: 'group' } });
  const child = field(form, 'first', { name: 'email', parent: group.node });
  await settle(form);
  const input = child.el.querySelector('input');
  const id = child.node.props.id;
  const detached = form.getRegion('first').detachView();
  const changes = [];
  child.on('field:change', value => changes.push(value));
  if (owner === 'group') {form.getRegion('group').empty();} else {form.destroy();}
  expect(detached.isDestroyed()).toBe(true);
  expect(getNode(id)).toBeUndefined();
  input.value = 'Late detached edit';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await Promise.resolve();
  expect(changes).toEqual([]);
});

it('applies pre-render input patches and preserves the control, ID, focus and selection on later patches', async() => {
  const form = mount();
  const view = new FieldView({ form, name: 'email', removal: 'preserve',
    input: { type: 'text', label: 'Old label', value: 'Baseline' } });
  view.setInput({ label: 'Email', help: 'Work address', attrs: { placeholder: 'you@example.com' } });
  form.showChildView('first', view);
  await settle(form);
  const input = view.el.querySelector('input');
  const id = input.id;
  expect(view.el.querySelector(`label[for="${id}"]`).textContent).toBe('Email');
  expect(input.placeholder).toBe('you@example.com');
  expect(input.hasAttribute('attrs')).toBe(false);
  input.focus(); input.setSelectionRange(1, 4);
  view.setInput({ label: 'Work email', help: 'Updated help' });
  await vi.waitFor(() => expect(view.el.textContent).toContain('Updated help'));
  expect(view.el.querySelector('input')).toBe(input);
  expect(input.id).toBe(id);
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
  const detached = form.getRegion('first').detachView();
  form.getRegion('second').show(detached);
  expect(view.el.querySelector('input')).toBe(input);
  expect(input.id).toBe(id);
  form.getRegion('second').empty();
  const replacement = field(form, 'first', { name: 'email' });
  await settle(form);
  expect(replacement.node.props.id).not.toBe(id);
  expect(getNode(id)).toBeUndefined();
  expect(document.querySelectorAll(`#${replacement.node.props.id}`)).toHaveLength(1);
});

it('rejects invalid names and foreign, dead or list parents before mounting an input', () => {
  const form = mount();
  const other = mount();
  const first = field(form, 'first', { name: 'email' });
  const dead = createNode({ type: 'group', name: 'dead', props: { type: 'group' }, parent: form.node });
  dead.destroy();
  const list = createNode({ type: 'list', name: 'rows', props: { type: 'list' }, parent: form.node, value: [] });
  for (const options of [{ name: '' }, { name: 'contact.email' }, { name: 'email' },
    { parent: other.node }, { parent: dead }, { parent: list }]) {
    const invalid = new FieldView({ form, name: 'candidate', removal: 'clear', input: { type: 'text' }, ...options });
    owners.push(invalid);
    expect(() => invalid.render()).toThrow(/Field names|Field parent/);
  }
  expect(getNode(first.node.props.id)).toBe(first.node);
});

it('does not emit a queued delayed field edit after its view is destroyed', async() => {
  vi.useFakeTimers();
  const form = mount();
  const view = field(form, 'first', { input: { type: 'text', config: { delay: 50 } } });
  await vi.advanceTimersByTimeAsync(0);
  const fields = []; const roots = [];
  view.on('field:change', value => fields.push(value));
  form.on('form:change', values => roots.push(values));
  nativeEdit(view, 'Delayed draft');
  form.getRegion('first').empty();
  await vi.advanceTimersByTimeAsync(0);
  const afterRemoval = structuredClone(form.getValues());
  const notificationsAfterRemoval = structuredClone(roots);
  await vi.advanceTimersByTimeAsync(100);
  expect(fields).toEqual([]);
  expect(roots).toEqual(notificationsAfterRemoval);
  expect(form.getValues()).toEqual(afterRemoval);
});

it.each(['schema', 'composed'])('runs an editable native custom control through shared validation and cleanup in %s mode', async mode => {
  const disposed = [];
  const nativeInput = ({ document: doc, props }) => {
    const label = doc.createElement('label');
    const input = doc.createElement('input');
    label.append(input);
    let context = props.context;
    const change = event => { void context.node.input(event.target.value); };
    input.addEventListener('input', change);
    return {
      element: label,
      update(next) {
        context = next.context;
        label.setAttribute('aria-label', context.label);
        input.setAttribute('aria-label', context.label);
        input.id = context.id;
        input.value = context.value ?? '';
        input.disabled = !!context.disabled;
        if (context.state.invalid || context.state.errors) {input.setAttribute('aria-invalid', 'true');} else {input.removeAttribute('aria-invalid');}
      },
      destroy() { input.removeEventListener('input', change); disposed.push(input.id); },
    };
  };
  const options = { inputs: { nativeSearch: { type: 'input', component: 'NativeSearch' } },
    components: { NativeSearch: nativeInput } };
  const definition = { type: 'nativeSearch', label: 'Search', validation: 'required' };
  const form = mode === 'schema' ?
    mount({ ...options, template: undefined, schema: [{ $formkit: 'nativeSearch', name: 'search', ...definition }] }) :
    mount(options);
  const view = mode === 'composed' ? field(form, 'first', { name: 'search', input: definition }) : form;
  await settle(form);
  expect(await form.submit()).toBe('invalid');
  const input = form.el.querySelector('input');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  const events = [];
  form.on('form:change', (values, _state, metadata) => events.push({ values, source: metadata.source }));
  nativeEdit(view, 'Native correction');
  await vi.waitFor(() => expect(form.getValues()).toEqual({ search: 'Native correction' }));
  expect(events.at(-1)).toEqual({ values: { search: 'Native correction' }, source: 'user' });
  expect(await form.submit()).toBe('success');
  expect(input.hasAttribute('aria-invalid')).toBe(false);
  const id = input.id;
  form.destroy();
  expect(disposed).toEqual([id]);
  expect(getNode(id)).toBeUndefined();
  input.value = 'After disposal'; input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(events.at(-1).values).toEqual({ search: 'Native correction' });
});


it('replaces array-valued official input values without retaining removed choices', async() => {
  const form = mount({ values: { services: ['Pharmacy', 'Home Health'] } });
  const view = field(form, 'first', { name: 'services', input: {
    type: 'checkbox', label: 'Services', options: ['Pharmacy', 'Home Health', 'Other'],
  } });
  await settle(form);
  const changes = [];
  view.on('field:change', (value, metadata) => changes.push({ value, source: metadata.source }));
  view.setValue(['Other'], { source: 'actor' });
  await vi.waitFor(() => expect(changes).toHaveLength(1));
  expect(changes[0]).toEqual({ value: ['Other'], source: 'actor' });
  expect(form.getValues()).toEqual({ services: ['Other'] });
  await vi.waitFor(() => expect([...view.el.querySelectorAll('input')].map(input => input.checked)).toEqual([false, false, true]));
  view.setValue([], { notify: false });
  await settle(form);
  expect(view.getValue()).toEqual([]);
  expect(form.getValues()).toEqual({ services: [] });
  expect(changes).toHaveLength(1);
  await vi.waitFor(() => expect([...view.el.querySelectorAll('input')].every(input => !input.checked)).toBe(true));
});

it('reuses an explicitly named input ID after removal without retaining the old control or registry entry', async() => {
  const form = mount();
  const options = { name: 'email', input: { type: 'text', id: 'composition-review-email' } };
  const first = field(form, 'first', options);
  await settle(form);
  const oldControl = first.el.querySelector('input');
  first.setValue('Retained');
  await settle(form);
  form.getRegion('first').empty();
  expect(getNode('composition-review-email')).toBeUndefined();
  const second = field(form, 'second', options);
  await settle(form);
  expect(getNode('composition-review-email')).toBe(second.node);
  expect(document.querySelectorAll('#composition-review-email')).toHaveLength(1);
  expect(second.el.querySelector('input')).not.toBe(oldControl);
  expect(second.getValue()).toBe('Retained');
  oldControl.value = 'Obsolete control';
  oldControl.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(form);
  expect(second.getValue()).toBe('Retained');
  nativeEdit(second, 'Current control');
  await vi.waitFor(() => expect(form.getValues()).toEqual({ email: 'Current control' }));
});

it('requires mounting before node or value access without losing the intended initial value', async() => {
  const form = mount();
  const view = new FieldView({ form, name: 'email', removal: 'preserve',
    input: { type: 'text', value: 'Initial address' } });
  owners.push(view);
  expect(() => view.node).toThrow(/Render the FieldView/);
  expect(() => view.getValue()).toThrow(/Render the FieldView/);
  expect(() => view.setValue('Premature replacement')).toThrow(/Render the FieldView/);
  expect(form.node.at('email')).toBeUndefined();
  form.showChildView('first', view);
  await settle(form);
  expect(view.getValue()).toBe('Initial address');
  expect(form.getValues()).toEqual({ email: 'Initial address' });
});

it('can discard an unmounted field without later callbacks creating a node or editing its owner', async() => {
  const form = mount({ values: { retained: 'Owner data' } });
  const view = new FieldView({ form, name: 'email', removal: 'clear',
    input: { type: 'text', id: 'never-mounted-review-field' } });
  view.destroy();
  expect(view.isDestroyed()).toBe(true);
  expect(view.render()).toBe(view);
  view.destroy();
  expect(view.setValue('Late data')).toBe(view);
  expect(view.setInput({ label: 'Late label' })).toBe(view);
  await settle(form);
  expect(form.getValues()).toEqual({ retained: 'Owner data' });
  expect(form.node.at('email')).toBeUndefined();
  expect(getNode('never-mounted-review-field')).toBeUndefined();
  expect(view.el.querySelector('input')).toBeNull();
});

it('repeated render and unchanged actor values preserve control identity, focus and quiet change streams', async() => {
  const form = mount();
  const view = field(form, 'first', { input: { type: 'text', value: 'Draft value' } });
  await settle(form);
  const control = view.el.querySelector('input');
  const node = view.node;
  control.focus(); control.setSelectionRange(2, 7);
  const fieldChanges = [];
  const formChanges = [];
  view.on('field:change', value => fieldChanges.push(value));
  form.on('form:change', values => formChanges.push(values));
  expect(view.render()).toBe(view);
  expect(view.render()).toBe(view);
  expect(view.setValue('Draft value', { source: 'actor' })).toBe(view);
  await settle(form);
  expect(view.node).toBe(node);
  expect(view.el.querySelector('input')).toBe(control);
  expect(document.activeElement).toBe(control);
  expect([control.selectionStart, control.selectionEnd]).toEqual([2, 7]);
  expect(fieldChanges).toEqual([]);
  expect(formChanges).toEqual([]);
  expect(view.getValue()).toBe('Draft value');
});

it.each([
  ['type', 'textarea'], ['id', 'changed-identity'], ['value', 'Changed value'], ['name', 'changedName'],
  ['parent', null], ['preserve', false], ['ignore', true], ['plugins', []], ['config', { delay: 30 }],
])('rejects changing %s through setInput without altering the mounted field', async(key, value) => {
  const form = mount();
  const view = field(form, 'first', { name: 'email', input: { type: 'text', label: 'Email', value: 'Draft' } });
  await settle(form);
  const node = view.node;
  const control = view.el.querySelector('input');
  const id = control.id;
  expect(() => view.setInput({ [key]: value })).toThrow(/Replace the FieldView.*use setValue/);
  await settle(form);
  expect(view.node).toBe(node);
  expect(getNode(id)).toBe(node);
  expect(view.el.querySelector('input')).toBe(control);
  expect(control.id).toBe(id);
  expect(control.value).toBe('Draft');
  expect(view.el.querySelector('label').textContent).toBe('Email');
  expect(form.getValues()).toEqual({ email: 'Draft' });
  view.setValue('Valid edit');
  await settle(form);
  expect(form.getValues()).toEqual({ email: 'Valid edit' });
});

it('ignores a late asynchronous owner callback after the form has ended its field', async() => {
  const form = mount();
  const view = field(form, 'first', { name: 'email', input: { type: 'text', label: 'Email', value: 'Draft' } });
  await settle(form);
  const input = view.el.querySelector('input');
  const id = input.id;
  let deliver;
  const result = new Promise(resolve => { deliver = resolve; });
  const applied = result.then(value => {
    view.setValue(value, { source: 'actor' });
    view.setInput({ label: 'Late options', disabled: true });
  });
  form.destroy();
  const terminalValues = form.getValues();
  deliver('Obsolete server result');
  await applied;
  expect(view.isDestroyed()).toBe(true);
  expect(view.render()).toBe(view);
  view.destroy();
  expect(getNode(id)).toBeUndefined();
  expect(form.getValues()).toEqual(terminalValues);
  expect(input.value).toBe('Draft');
  expect(view.el.textContent).not.toContain('Late options');
});

it('ends a child owned by both its group node and its placement Region exactly once', async() => {
  const form = mount();
  const group = field(form, 'group', { name: 'contact', input: { type: 'group' } });
  const placement = document.createElement('div');
  group.el.appendChild(placement);
  group.addRegion('entry', { el: placement });
  const child = new FieldView({ form, parent: group.node, name: 'email', removal: 'clear',
    input: { type: 'text', value: 'Draft' } });
  group.showChildView('entry', child);
  await settle(form);
  const id = child.node.props.id;
  const order = [];
  child.on('destroy', () => order.push('child'));
  group.on('destroy', () => order.push('group'));
  form.getRegion('group').empty();
  await settle(form);
  expect(order).toEqual(['child', 'group']);
  expect(child.isDestroyed()).toBe(true);
  expect(getNode(id)).toBeUndefined();
  expect(form.getValues()).toEqual({ contact: {} });
  child.destroy(); group.destroy();
  expect(order).toEqual(['child', 'group']);
});

it('rejects delayed first placement after the form owner is destroyed', async() => {
  const form = mount();
  const view = new FieldView({ form, name: 'email', removal: 'preserve',
    input: { type: 'text', id: 'delayed-first-placement' } });
  owners.push(view);
  let deliver;
  const ready = new Promise(resolve => { deliver = resolve; });
  const placement = ready.then(() => view.render());
  form.destroy();
  deliver();
  await expect(placement).rejects.toThrow(/owner has been destroyed/);
  expect(getNode('delayed-first-placement')).toBeUndefined();
  expect(view.el.querySelector('input')).toBeNull();
  view.destroy();
  expect(view.isDestroyed()).toBe(true);
});
