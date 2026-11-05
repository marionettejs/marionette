import { afterEach, expect, it } from 'vitest';
import { Region } from 'marionette';
import { FormView } from '@mnjs/formkit';
import { createMessage } from '@formkit/core';

const regions = [];
async function settle(form) {
  await form.node.settled;
  await form.node.ledger.settled('validating');
  await new Promise(resolve => setTimeout(resolve, 0));
}
function mount(schema, options = {}) {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  regions.push(region);
  const form = new FormView({ formProps: { actions: false }, schema, ...options });
  region.show(form);
  return form;
}
afterEach(() => { regions.splice(0).forEach(region => region.destroy()); document.body.replaceChildren(); });

it('refreshes raw root counts and child-dependent conditions without a zero crossing', async() => {
  const form = mount([
    { $el: 'output', attrs: { 'data-count': true }, children: '$node.ledger.value("blocking")' },
    { $el: 'b', if: '$node.at("one").context.state.valid', children: 'One is valid' },
    ...['one', 'two', 'three'].map(name => ({ $formkit: 'text', name, validation: 'required', validationVisibility: 'live' }))
  ]);
  await settle(form);
  expect(form.el.querySelector('output').textContent).toBe('3');
  expect(form.el.querySelector('b')).toBeNull();
  form.node.at('one').props.validation = '';
  await settle(form);
  expect(form.node.ledger.value('blocking')).toBe(2);
  expect(form.el.querySelector('output').textContent).toBe('2');
  expect(form.el.querySelector('b').textContent).toBe('One is valid');
  expect(form.el.querySelectorAll('.formkit-message')).toHaveLength(2);
});

it('refreshes root context expressions when only a descendant context changes', async() => {
  const form = mount([
    { $el: 'output', children: '$node.at("one").context.note' },
    { $formkit: 'text', name: 'one' }
  ]);
  await settle(form);
  form.node.at('one').context.note = 'Changed';
  await settle(form);
  expect(form.el.querySelector('output').textContent).toBe('Changed');
});

it('keeps registry-based root expressions current across local changes and replacement', async() => {
  const form = mount([
    { $el: 'output', children: '$get("root-observed-field").state.valid' },
    { $formkit: 'text', name: 'one', id: 'root-observed-field', validation: 'required' }
  ]);
  await settle(form);
  expect(form.el.querySelector('output').textContent).toBe('false');
  form.node.at('one').props.validation = '';
  await settle(form);
  expect(form.el.querySelector('output').textContent).toBe('true');
  form.setSchema([
    { $el: 'output', children: '$get("root-observed-field").state.valid' },
    { $formkit: 'text', name: 'replacement', id: 'root-observed-field', validation: 'required' }
  ]);
  await settle(form);
  expect(form.el.querySelector('output').textContent).toBe('false');
});

it('reconciles edits to the retained schema synchronously when explicitly supplied', async() => {
  const schema = [{ $formkit: 'text', name: 'one', label: 'Before' }];
  const form = mount(schema);
  await settle(form);
  schema[0].label = 'After';
  form.setSchema(schema);
  expect(form.el.querySelector('label').textContent).toBe('After');
  schema.push({ $formkit: 'text', name: 'two' });
  form.setSchema(schema);
  expect(form.el.querySelectorAll('input')).toHaveLength(2);
  expect(form.node.at('two')).toBeDefined();
});

it('reevaluates root class callbacks after descendant-only updates', async() => {
  let enabled = false;
  const form = mount([{ $formkit: 'text', name: 'one' }], {
    formProps: { actions: false, formClass: () => ({ active: enabled }) }
  });
  await settle(form);
  expect(form.el.classList.contains('active')).toBe(false);
  enabled = true;
  form.node.at('one').context.note = 'Refresh root class';
  await settle(form);
  expect(form.el.classList.contains('active')).toBe(true);
});

it('refreshes root state replaced by an application-owned object', async() => {
  const form = mount([{ $formkit: 'text', name: 'one' }]);
  const state = { loading: false };
  form.node.context.state = state;
  await settle(form);
  expect(form.el.hasAttribute('data-loading')).toBe(false);
  state.loading = true;
  form.node.at('one').context.note = 'Refresh root state';
  await settle(form);
  expect(form.el.getAttribute('data-loading')).toBe('true');
});

it.each(['own', 'inherited'])('refreshes a %s root-state getter after descendant changes', async placement => {
  let loading = false;
  const form = mount([{ $formkit: 'text', name: 'one' }]);
  const state = form.node.context.state;
  if (placement === 'own') {
    Object.defineProperty(state, 'loading', { configurable: true, enumerable: true, get: () => loading });
  } else { Object.setPrototypeOf(state, { get loading() { return loading; } }); }
  await settle(form);
  expect(form.el.hasAttribute('data-loading')).toBe(false);
  loading = true;
  form.node.at('one').context.note = 'Refresh state getter';
  await settle(form);
  expect(form.el.getAttribute('data-loading')).toBe('true');
});

it('refreshes inherited root context attributes after descendant changes', async() => {
  let value = 'Before';
  const form = mount([{ $formkit: 'text', name: 'one' }]);
  delete form.node.context.attrs;
  Object.setPrototypeOf(form.node.context, { get attrs() { return { 'data-inherited': value }; } });
  await settle(form);
  expect(form.el.getAttribute('data-inherited')).toBe('Before');
  value = 'After';
  form.node.at('one').context.note = 'Refresh inherited attrs';
  await settle(form);
  expect(form.el.getAttribute('data-inherited')).toBe('After');
});

it('keeps an inherited configuration class getter live', async() => {
  let selected = false;
  const form = mount([{ $formkit: 'text', name: 'one' }]);
  Object.setPrototypeOf(form.node.config, { get formClass() { return { selected }; } });
  await settle(form);
  selected = true;
  form.node.at('one').context.note = 'Refresh inherited config';
  await settle(form);
  expect(form.el.classList.contains('selected')).toBe(true);
});

it('refreshes root messages when an application replaces a native helper', async() => {
  let shown = false;
  const form = mount([{ $formkit: 'text', name: 'one' }]);
  form.setErrors(['Root problem']);
  form.node.context.fns.length = () => shown ? 1 : 0;
  await settle(form);
  expect(form.el.textContent).not.toContain('Root problem');
  shown = true;
  form.node.at('one').context.note = 'Refresh root helper';
  await settle(form);
  expect(form.el.textContent).toContain('Root problem');
});

it('keeps object-valued root attributes current', async() => {
  const form = mount([{ $formkit: 'text', name: 'one' }], { formProps: { actions: false, attrs: { style: { color: 'red' } } } });
  await settle(form);
  expect(form.el.style.color).toBe('red');
  form.node.context.attrs.style.color = 'blue';
  form.node.at('one').context.note = 'Refresh root style';
  await settle(form);
  expect(form.el.style.color).toBe('blue');
});

it('applies input errors supplied by a plugin before creation completes', async() => {
  const form = mount([{ $formkit: 'text', name: 'one' }], { plugins: [node => {
    if (node.props.type === 'form') { node.props.inputErrors = { one: ['Supplied during creation'] }; }
  }] });
  await settle(form);
  expect(form.el.querySelector('.formkit-message').textContent).toBe('Supplied during creation');
  expect(form.node.at('one').ledger.value('errors')).toBe(1);
});

it('services a public context update without an intervening native context mutation', async() => {
  const form = mount([{ $formkit: 'text', name: 'one', value: 'Canonical' }]);
  await settle(form);
  const input = form.el.querySelector('input');
  input.value = 'Uncommitted';
  form.node.at('one').emit('context-update', form.node.at('one'));
  await settle(form);
  expect(input.value).toBe('Canonical');
  expect(form.getValues()).toEqual({ one: 'Canonical' });
});

it.each(['manual', 'native'])('retains a reentrant %s root update during a nonzero ledger notification', async kind => {
  const form = mount([{ $formkit: 'text', name: 'one', validation: 'required', validationVisibility: 'live' }]);
  await settle(form);
  form.el.setAttribute('data-loading', 'Uncommitted');
  let nested = false;
  const receipt = form.node.on('context-update', () => {
    if (nested) { return; }
    nested = true;
    if (kind === 'manual') { form.node.emit('context-update', form.node); } else { form.node.context.note = 'Nested update'; }
  }, 'unshift');
  form.node.at('one').store.set(createMessage({ key: 'extra', type: 'validation', blocking: true, visible: false, value: 'Extra' }));
  await settle(form);
  expect(nested).toBe(true);
  expect(form.node.ledger.value('blocking')).toBe(2);
  expect(form.el.hasAttribute('data-loading')).toBe(false);
  form.node.off(receipt);
});

it('refreshes application-projected root attrs after descendant changes', async() => {
  let value = 'Before';
  const attrs = new Proxy({ 'data-projected': 'Before' }, {
    get(target, key, receiver) { return key === 'data-projected' ? value : Reflect.get(target, key, receiver); }
  });
  const form = mount([{ $formkit: 'text', name: 'one' }], { plugins: [node => {
    if (node.props.type !== 'form') { return; }
    node.hook.prop((payload, next) => next(payload.prop === 'attrs' ? { ...payload, value: attrs } : payload));
    node.addProps(['projection']);
  }] });
  await settle(form);
  expect(form.el.getAttribute('data-projected')).toBe('Before');
  value = 'After';
  form.node.at('one').context.note = 'Refresh attrs';
  await settle(form);
  expect(form.el.getAttribute('data-projected')).toBe('After');
});

it('refreshes a root message map supplied by the application', async() => {
  const form = mount([{ $formkit: 'text', name: 'one' }]);
  const messages = { server: { key: 'server', type: 'error', value: 'Before' } };
  Object.defineProperty(form.node.context, 'messages', { configurable: true, enumerable: true, value: messages });
  await settle(form);
  expect(form.el.textContent).toContain('Before');
  messages.server.value = 'After';
  form.node.at('one').context.note = 'Refresh message';
  await settle(form);
  expect(form.el.textContent).toContain('After');
  expect(form.el.textContent).not.toContain('Before');
});

it('preserves root attrs transformed by a public property event', async() => {
  let value = 'Before';
  const attrs = new Proxy({ 'data-projected': 'Before' }, {
    get(target, key, receiver) { return key === 'data-projected' ? value : Reflect.get(target, key, receiver); }
  });
  const form = mount([{ $formkit: 'text', name: 'one' }], { plugins: [node => {
    if (node.props.type !== 'form') { return; }
    node.on('prop:attrs', ({ payload }) => { if (payload !== attrs) { node.props.attrs = attrs; } });
    node.addProps(['projection']);
  }] });
  await settle(form);
  expect(form.el.getAttribute('data-projected')).toBe('Before');
  value = 'After';
  form.node.at('one').context.note = 'Refresh projected attrs';
  await settle(form);
  expect(form.el.getAttribute('data-projected')).toBe('After');
});

it('does not read an application root accessor solely to inspect reuse eligibility', () => {
  let reads = 0;
  let title;
  const form = mount([{ $formkit: 'text', name: 'one' }], { plugins: [node => {
    if (node.props.type !== 'form') { return; }
    Object.defineProperty(node.context, 'attrs', { configurable: true, enumerable: true, get() {
      title = `Projection ${++reads}`;
      return { title };
    } });
  }] });
  // The existing renderer reads the form binding and projects the context into
  // its default slot. Eligibility inspection must not add another getter call.
  expect(reads).toBe(2);
  expect(form.el.title).toBe('Projection 1');
});
