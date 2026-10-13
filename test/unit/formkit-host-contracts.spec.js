import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView, SchemaView, createViewComponents } from '@mnjs/formkit';

const owners = [];
afterEach(() => {
  owners.splice(0).reverse().forEach(owner => owner.destroy());
  document.body.replaceChildren();
});
function place(view) {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region);
  region.show(view);
  return region;
}
async function settle(form) {
  await form.node.settled;
  await form.node.ledger.settled('validating');
  await Promise.resolve();
  await Promise.resolve();
}
function createForm(options = {}) {
  const view = new FormView({ template: () => '<div data-field></div>', regions: { field: '[data-field]' },
    values: { name: 'Initial' }, config: { delay: 0 }, ...options });
  place(view);
  return view;
}

it('keeps borrowed Marionette state separate from form status, including empty state bindings', () => {
  const state = { saved: true };
  const view = new FormView({ fields: [], state, stateEvents: {} });
  owners.push(view);
  expect(view.getState()).toBe(state);
  view.render();
  expect(view.getState()).toBe(state);
  expect(view.getFormState()).toEqual({ submitted: false, submitting: false, valid: true, errors: [] });
});

it('binds the inherited state during construction and releases only borrowed subscriptions', () => {
  const state = { listeners: new Set() };
  const changed = vi.fn(); const disposed = vi.fn();
  let initializedState;
  class StatefulForm extends FormView {
    initialize() { initializedState = this.getState(); }
  }
  StatefulForm.setStateApi({
    subscribe(source, _name, callback, context) {
      const listener = value => callback.call(context, value);
      source.listeners.add(listener);
      return () => source.listeners.delete(listener);
    },
    disposeOwned: disposed
  });
  const view = new StatefulForm({ fields: [], state, stateEvents: { changed } });
  owners.push(view);
  expect(initializedState).toBe(state);
  state.listeners.forEach(listener => listener('before render'));
  view.render();
  state.listeners.forEach(listener => listener('after render'));
  expect(changed.mock.calls).toEqual([['before render'], ['after render']]);
  expect(changed.mock.contexts).toEqual([view, view]);
  view.destroy();
  expect(state.listeners.size).toBe(0);
  expect(disposed).not.toHaveBeenCalled();
});

it('creates inherited owned state lazily once and disposes it once without changing form events', () => {
  const state = { saved: true }; const create = vi.fn(() => state); const disposed = vi.fn();
  class StatefulForm extends FormView {
    createState() { return create(); }
  }
  StatefulForm.setStateApi({ disposeOwned: disposed });
  const view = new StatefulForm({ fields: [] });
  owners.push(view);
  const statuses = [];
  view.on('form:state', status => statuses.push(status));
  view.render();
  expect(create).not.toHaveBeenCalled();
  expect(view.getState()).toBe(state);
  expect(view.getState()).toBe(state);
  expect(create).toHaveBeenCalledOnce();
  view.setErrors(['Server failure']);
  expect(statuses.at(-1)).toEqual(view.getFormState());
  expect(view.getFormState().errors).toEqual(['Server failure']);
  expect(view.getState()).toBe(state);
  view.destroy();
  view.destroy();
  expect(disposed).toHaveBeenCalledExactlyOnceWith(state);
});

it.each(['field', 'schema'].flatMap(kind => ['inside', 'external', 'detached'].map(placement => [kind, placement])))(
  'keeps native origins and root error clearing for a %s in an %s placement', async(kind, placement) => {
    const owner = createForm();
    const input = { type: 'text', label: 'Name' };
    const section = kind === 'field' ? new FieldView({ form: owner, name: 'name', removal: 'preserve', input }) :
      new SchemaView({ form: owner, schema: { $formkit: 'text', name: 'name', preserve: true, label: 'Name' } });
    const region = placement === 'inside' ? owner.getRegion('field') : place(section);
    if (placement === 'inside') { region.show(section); }
    if (placement === 'detached') { region.detachView(); }
    await settle(owner);
    const changes = []; const fieldChanges = []; const statuses = [];
    owner.on('form:change', (values, _state, metadata) => changes.push({ values, source: metadata.source }));
    owner.on('form:state', state => statuses.push(state));
    section.on('field:change', (value, metadata) => fieldChanges.push({ value, source: metadata.source }));
    owner.setErrors(['Server failure']);
    const control = section.el.querySelector('input');
    control.value = 'Edited';
    control.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(owner);
    expect(owner.getValues()).toEqual({ name: 'Edited' });
    expect(changes).toEqual([{ values: { name: 'Edited' }, source: 'user' }]);
    expect(statuses.at(-1).errors).toEqual([]);
    if (kind === 'field') { expect(fieldChanges).toEqual([{ value: 'Edited', source: 'user' }]); }
    if (placement === 'detached') { region.show(section); }
    owner.setValues({ name: 'Owner snapshot' }, { source: 'actor', notify: false });
    await settle(owner);
    expect(control.value).toBe('Owner snapshot');
    expect(changes).toHaveLength(1);
    owner.destroy();
    expect(section.isDestroyed()).toBe(true);
  }
);

it.each(['field', 'schema'])('releases native attribution on a destroyed external %s', async kind => {
  const owner = createForm();
  const section = kind === 'field' ? new FieldView({ form: owner, name: 'name', removal: 'preserve', input: { type: 'text' } }) :
    new SchemaView({ form: owner, schema: { $formkit: 'text', name: 'name', preserve: true } });
  place(section);
  const changes = [];
  owner.on('form:change', (_values, _state, metadata) => changes.push(metadata.source));
  section.destroy();
  section.el.addEventListener('input', () => owner.setValues({ name: 'After disposal' }));
  section.el.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(owner);
  expect(changes).toEqual(['programmatic']);
});

it.each([false, true])('honors root preserveErrors=%s for external native file change', async preserveErrors => {
  const owner = createForm({ values: {}, formProps: { preserveErrors } });
  const field = new FieldView({ form: owner, name: 'upload', removal: 'preserve', input: { type: 'file' } });
  place(field);
  await settle(owner);
  const changes = []; const statuses = [];
  owner.on('form:change', (_values, _state, metadata) => changes.push(metadata.source));
  owner.on('form:state', state => statuses.push(state));
  owner.setErrors(['Server failure']);
  const input = field.el.querySelector('input'); const file = new File(['fresh'], 'fresh.txt');
  Object.defineProperty(input, 'files', { configurable: true, value: { length: 1, item: index => index === 0 ? file : null } });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle(owner);
  expect(field.getValue()[0].file).toBe(file);
  expect(changes).toEqual(['user']);
  expect(statuses.at(-1).errors).toEqual(preserveErrors ? ['Server failure'] : []);
});

it.each(['non-bubbling', 'stopped'])('attributes an external custom input during %s dispatch only', async mode => {
  const owner = createForm({ inputs: { custom: { type: 'input', schema: { $el: 'input', attrs: { value: '$_value', onInput: '$handlers.DOMInput' } } } } });
  const field = new FieldView({ form: owner, name: 'name', removal: 'preserve', input: { type: 'custom' } });
  place(field);
  const changes = []; const input = field.el.querySelector('input');
  owner.on('form:change', (_values, _state, metadata) => changes.push(metadata.source));
  if (mode === 'stopped') { input.addEventListener('input', event => event.stopPropagation()); }
  input.value = 'User'; input.dispatchEvent(new Event('input', { bubbles: mode !== 'non-bubbling' }));
  await settle(owner);
  field.setValue('Programmatic'); await settle(owner);
  expect(changes).toEqual(['user', 'programmatic']);
});

it('keeps external delayed edits distinct from quiet echoes and unrelated forms', async() => {
  const owner = createForm(); const other = createForm();
  const field = new FieldView({ form: owner, name: 'name', removal: 'preserve', input: { type: 'text', config: { delay: 10 } } });
  place(field);
  const changes = []; const statuses = []; const otherStatuses = [];
  owner.on('form:change', (values, _state, metadata) => {
    changes.push(metadata.source);
    owner.setValues(values, { notify: false });
  });
  owner.on('form:state', state => statuses.push(state));
  other.on('form:state', state => otherStatuses.push(state));
  owner.setErrors(['First']); other.setErrors(['Unrelated']);
  const input = field.el.querySelector('input');
  input.value = 'User'; input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(owner);
  expect(changes).toEqual(['user']);
  expect(statuses.at(-1).errors).toEqual([]);
  expect(otherStatuses.at(-1).errors).toEqual(['Unrelated']);
  field.setValue('Programmatic', { source: 'actor' });
  await settle(owner);
  expect(changes).toEqual(['user', 'actor']);
  field.destroy();
  // A retained former field root must no longer attribute arbitrary callbacks to the form.
  field.el.addEventListener('input', () => owner.setValues({ name: 'After disposal' }));
  field.el.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(owner);
  expect(changes).toEqual(['user', 'actor', 'programmatic']);
});

it.each(['default', 'explicit', 'root-to-group', 'group-to-root'])(
  'rejects a changed %s parent before applying field props or values', async(mode) => {
    const owner = createForm({ values: { left: { title: 'Left' }, right: { title: 'Right' }, title: 'Root' } });
    const left = new FieldView({ form: owner, name: 'left', removal: 'preserve', input: { type: 'group' } });
    const right = new FieldView({ form: owner, name: 'right', removal: 'preserve', input: { type: 'group' } });
    left.render(); right.render();
    let field;
    const components = createViewComponents({ getForm: () => owner,
      ...(mode === 'explicit' ? { getParent: (_props, data) => data.node } : {}),
      registrations: { Text: { kind: 'field', create(options) { field = new FieldView(options); return field; } } }
    });
    const props = { name: 'title', input: { type: 'text', label: 'Original' } };
    const data = mode === 'root-to-group' ? {} : { node: left.node };
    const nextData = mode === 'group-to-root' ? {} : { node: right.node };
    const component = components.Text({ document, props, data });
    owner.el.append(component.element);
    await settle(owner);
    const before = owner.getValues(); const node = field.node; const input = field.el.querySelector('input');
    const nextProps = { ...props, input: { ...props.input, label: 'Changed', value: 'Wrong group' } };
    expect(() => component.update(nextProps, nextData)).toThrow('Change the schema key to replace FieldView identity');
    expect(owner.getValues()).toEqual(before);
    expect(node.props.label).toBe('Original');
    component.update({ ...props, input: { ...props.input, label: 'Compatible', value: 'Same group' } }, data);
    await settle(owner);
    expect(field.node).toBe(node);
    expect(field.el.querySelector('input')).toBe(input);
    expect(input.value).toBe('Same group');
    component.destroy();
  }
);
