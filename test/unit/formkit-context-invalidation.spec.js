import { afterEach, expect, it } from 'vitest';
import { Region } from 'marionette';
import { FormView } from '@mnjs/formkit';
import { inputs } from '@formkit/inputs';
import { createMessage } from '@formkit/core';

const regions = [];
function mount(options = {}) {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  regions.push(region);
  const form = new FormView({ formProps: { actions: false }, ...options });
  region.show(form);
  return form;
}
async function settle(form) {
  await form.node.settled;
  await form.node.ledger.settled('validating');
  await new Promise(resolve => setTimeout(resolve, 0));
}
afterEach(() => { regions.splice(0).forEach(region => region.destroy()); document.body.replaceChildren(); });

it('refreshes lexical and opaque slots when the receiving input has not changed', async() => {
  let caption = 'First';
  const form = mount({ schemaData: { suffix: 'before' }, schema: [
    { $formkit: 'text', name: 'title', children: { help: { $el: 'output', children: '$suffix' } } },
    { $formkit: 'text', name: 'opaque', slots: { help: () => ({ $el: 'b', children: caption }) } },
    { $formkit: 'text', name: 'other' }
  ] });
  await settle(form);
  const input = form.el.querySelector('input');
  form.setSchemaData({ suffix: 'after' });
  expect(form.el.querySelector('output').textContent).toBe('after');
  caption = 'Second';
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(form.el.querySelector('b').textContent).toBe('Second');
  expect(form.el.querySelector('input')).toBe(input);
  expect(form.node.at('title').value).toBeUndefined();
});

it('retains a pending local render alongside unrelated ancestor work and live validation', async() => {
  const form = mount({ schema: [
    { $formkit: 'text', name: 'title', label: 'Title', validation: 'required', validationVisibility: 'live' },
    { $formkit: 'text', name: 'other' }
  ] });
  await settle(form);
  const title = form.node.at('title');
  const input = form.el.querySelector('input');
  expect(form.node.ledger.value('blocking')).toBe(1);
  input.focus();
  void title.input('Kept', false);
  void form.node.at('other').input('Sibling', false);
  await settle(form);
  expect(input.value).toBe('Kept');
  expect(form.el.querySelector('.formkit-message')).toBeNull();
  expect(form.node.ledger.value('blocking')).toBe(0);
  expect(document.activeElement).toBe(input);
  form.resetForm();
  await settle(form);
  expect(input.value).toBe('');
  expect(form.node.ledger.value('blocking')).toBe(1);
  expect(form.el.querySelector('.formkit-message').textContent).toContain('required');
});

it.each(['call', 'unshift'])('preserves late %s class hooks reading external state', async method => {
  let selected = false;
  const form = mount({ schema: [{ $formkit: 'text', name: 'title' }, { $formkit: 'text', name: 'other' }] });
  await settle(form);
  const title = form.node.at('title');
  const hook = (payload, next) => { payload.classes.selected = selected; return next(payload); };
  if (method === 'call') { title.hook.classes(hook); } else { title.hook.classes.unshift(hook); }
  selected = true;
  await form.node.at('other').input('One', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-outer').classList.contains('selected')).toBe(true);
  selected = false;
  await form.node.at('other').input('Two', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-outer').classList.contains('selected')).toBe(false);
  title.hook.classes.remove(hook);
  selected = true;
  await form.node.at('other').input('Three', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-outer').classList.contains('selected')).toBe(false);
});

it('retains hooks installed during input definition features', async() => {
  let selected = false;
  const definition = { ...inputs.text, features: [...inputs.text.features, node => {
    node.hook.classes((payload, next) => { payload.classes.selected = selected; return next(payload); });
  }] };
  const form = mount({ inputs: { featured: definition }, schema: [
    { $formkit: 'featured', name: 'title' }, { $formkit: 'text', name: 'other' }
  ] });
  await settle(form);
  selected = true;
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-outer').classList.contains('selected')).toBe(true);
});

it('retains custom class functions and authoritative schema attributes', async() => {
  let selected = false;
  const form = mount({ schema: [
    { $formkit: 'text', name: 'title' },
    { $formkit: 'text', name: 'custom', outerClass: () => ({ selected }) },
    { $formkit: 'text', name: 'other' }
  ] });
  await settle(form);
  form.node.at('title').props.attrs['data-version'] = 'Changed';
  selected = true;
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(form.el.querySelector('input').dataset.version).toBeUndefined();
  expect(form.el.querySelectorAll('.formkit-outer')[1].classList.contains('selected')).toBe(true);
});

it('keeps replaced context getters live on later unrelated input changes', async() => {
  let label = 'Before';
  const form = mount({ schema: [{ $formkit: 'text', name: 'title', label: 'Initial' }, { $formkit: 'text', name: 'other' }] });
  await settle(form);
  Object.defineProperty(form.node.at('title').context, 'label', { configurable: true, enumerable: true, get: () => label });
  await settle(form);
  expect(form.el.querySelector('label').textContent).toBe('Before');
  label = 'After';
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(form.el.querySelector('label').textContent).toBe('After');
});

it('keeps inherited context getters live', async() => {
  let label = 'Before';
  const form = mount({ schema: [{ $formkit: 'text', name: 'title', label: 'Initial' }, { $formkit: 'text', name: 'other' }] });
  await settle(form);
  const context = form.node.at('title').context;
  delete context.label;
  Object.setPrototypeOf(context, { get label() { return label; } });
  await settle(form);
  expect(form.el.querySelector('label').textContent).toBe('Before');
  label = 'After';
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(form.el.querySelector('label').textContent).toBe('After');
});

it('updates list-derived native names when an existing child moves', async() => {
  const form = mount({ schema: [{ $formkit: 'list', name: 'rows', children: [
    { $formkit: 'text', key: 'first', value: 'First' }, { $formkit: 'text', key: 'second', value: 'Second' }
  ] }] });
  await settle(form);
  const inputsBefore = [...form.el.querySelectorAll('input')];
  const rows = form.node.at('rows');
  rows.children[0].index = 1;
  await settle(form);
  expect([...form.el.querySelectorAll('input')]).toEqual(inputsBefore);
  expect(inputsBefore.map(input => input.name)).toEqual(['1', '0']);
});

it.each(['assignment', 'descriptor'])('retains a class dispatcher replaced by %s and releases input handlers after destruction', async method => {
  const form = mount({ schema: [{ $formkit: 'text', name: 'title' }, { $formkit: 'text', name: 'other' }] });
  await settle(form);
  const title = form.node.at('title');
  const dispatch = title.hook.classes.dispatch;
  const replacement = payload => {
    payload.classes.replaced = true;
    return dispatch(payload);
  };
  if (method === 'assignment') { title.hook.classes.dispatch = replacement; } else {
    Object.defineProperty(title.hook.classes, 'dispatch', { value: replacement });
  }
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-outer').classList.contains('replaced')).toBe(true);
  const input = form.el.querySelector('input');
  form.destroy();
  expect(() => input.dispatchEvent(new Event('input', { bubbles: true }))).not.toThrow();
  expect(form.el.querySelector('input')).toBeNull();
});

it('renders explicit public definitions without depending on library discovery', async() => {
  const form = mount({ formProps: { actions: false, definition: inputs.form },
    schema: [{ $formkit: 'text', definition: inputs.text, name: 'title', label: 'Title', validation: 'required', validationVisibility: 'live' }] });
  await settle(form);
  expect(form.el.querySelector('.formkit-message').textContent).toContain('required');
  form.setValues({ title: 'Changed' });
  await settle(form);
  expect(form.el.querySelector('input').value).toBe('Changed');
  expect(form.el.querySelector('.formkit-message')).toBeNull();
  form.resetForm();
  await settle(form);
  expect(form.el.querySelector('input').value).toBe('');
  expect(form.el.querySelector('.formkit-message').textContent).toContain('required');
});

it('reconciles explicitly updated object-valued attributes', async() => {
  const style = { color: 'red' };
  const schema = [{ $formkit: 'text', name: 'title', attrs: { style } }, { $formkit: 'text', name: 'other' }];
  const form = mount({ schema });
  await settle(form);
  style.color = 'blue';
  form.setSchema(schema);
  await form.node.at('other').input('Refresh', false);
  await settle(form);
  expect(form.el.querySelector('input').getAttribute('style')).toContain('blue');
});


it('keeps custom Core property getters live during unrelated input changes', async() => {
  let visibility = 'live';
  const form = mount({ schema: [
    { $formkit: 'text', name: 'title', validation: 'required' }, { $formkit: 'text', name: 'other' }
  ], plugins: [node => {
    if (node.name === 'title') { node.addProps({ validationVisibility: { getter: () => visibility } }); }
  }] });
  await settle(form);
  expect(form.el.querySelector('.formkit-message')).not.toBeNull();
  visibility = 'blur';
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-message')).toBeNull();
  expect(form.node.ledger.value('blocking')).toBe(1);
});

it('keeps inherited configuration getters live during unrelated input changes', async() => {
  let visibility = 'live';
  const form = mount({ schema: [
    { $formkit: 'text', name: 'title', validation: 'required' }, { $formkit: 'text', name: 'other' }
  ], plugins: [node => {
    if (node.props.type === 'form') {
      Object.defineProperty(node.config, 'validationVisibility', { configurable: true, enumerable: true, get: () => visibility });
    }
  }] });
  await settle(form);
  expect(form.el.querySelector('.formkit-message')).not.toBeNull();
  visibility = 'blur';
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-message')).toBeNull();
  expect(form.node.ledger.value('blocking')).toBe(1);
});

it('does not speculatively invoke dynamic class accessors before rendering', async() => {
  const form = mount({ schema: [{ $formkit: 'text', name: 'title' }, { $formkit: 'text', name: 'other' }] });
  await settle(form);
  let reads = 0;
  Object.defineProperty(form.node.at('title').props, 'outerClass', {
    configurable: true, get: () => ++reads % 2 ? { odd: true } : undefined
  });
  form.setSchemaData({});
  expect(form.el.querySelector('.formkit-outer').classList.contains('odd')).toBe(true);
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(reads).toBeGreaterThan(1);
  expect(form.el.querySelector('.formkit-outer').classList.contains('odd')).toBe(!!(reads % 2));
});

it('preserves pending asynchronous validation and its eventual visible result', async() => {
  let enter;
  let release;
  const entered = new Promise(resolve => { enter = resolve; });
  const result = new Promise(resolve => { release = resolve; });
  const form = mount({ values: { title: 'Initial' }, validationRules: { remote: node => {
    if (node.value === 'Accepted') { return true; }
    enter();
    return result;
  } }, schema: [
    { $formkit: 'text', name: 'title', validation: 'remote', validationVisibility: 'live' },
    { $formkit: 'text', name: 'other' }
  ] });
  await entered;
  const input = form.el.querySelector('input');
  await form.node.at('other').input('Sibling', false);
  expect(form.node.ledger.value('validating')).toBeGreaterThan(0);
  release(false);
  await settle(form);
  expect(input.value).toBe('Initial');
  expect(form.el.querySelector('.formkit-message')).not.toBeNull();
  expect(form.node.ledger.value('validating')).toBe(0);
  await form.node.at('title').input('Accepted', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-message')).toBeNull();
  expect(form.node.ledger.value('blocking')).toBe(0);
});

it('refreshes inherited class configuration after a local class override is removed', async() => {
  let selected = false;
  const form = mount({ schema: [{ $formkit: 'text', name: 'title' }, { $formkit: 'text', name: 'other' }] });
  await settle(form);
  const title = form.node.at('title');
  title.props.outerClass = 'local';
  await settle(form);
  expect(form.el.querySelector('.formkit-outer').classList.contains('local')).toBe(true);
  form.node.config.outerClass = () => ({ inherited: selected });
  delete title.props.outerClass;
  selected = true;
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-outer').classList.contains('local')).toBe(false);
  expect(form.el.querySelector('.formkit-outer').classList.contains('inherited')).toBe(true);
  selected = false;
  await form.node.at('other').input('Again', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-outer').classList.contains('inherited')).toBe(false);
});

it('keeps replacement native helper functions live without treating them as pure', async() => {
  let show = false;
  const form = mount({ schema: [{ $formkit: 'text', name: 'title', validation: 'required', validationVisibility: 'live' }, { $formkit: 'text', name: 'other' }] });
  await settle(form);
  form.node.at('title').context.fns.length = () => show ? 1 : 0;
  await settle(form);
  expect(form.el.querySelector('.formkit-message')).toBeNull();
  show = true;
  await form.node.at('other').input('Refresh', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-message').textContent).toContain('required');
});

it('keeps ignored schema inputs independent across sibling changes and explicit schema updates', async() => {
  const schema = [{ $formkit: 'text', name: 'title' }, { $formkit: 'text', id: 'scratch-value', name: 'scratch', ignore: true, value: 'Independent' }];
  const form = mount({ schema });
  await settle(form);
  await form.node.at('title').input('Canonical', false);
  await settle(form);
  expect(form.el.querySelector('#scratch-value').value).toBe('Independent');
  expect(form.getValues()).toEqual({ title: 'Canonical' });
  form.setSchema(['Caption', ...schema]);
  expect(form.el.textContent).toContain('Caption');
  expect(form.el.querySelector('#scratch-value').value).toBe('Independent');
});

it('refreshes inherited class callbacks for ignored default submit controls', async() => {
  let selected = false;
  const form = mount({ formProps: {}, config: { inputClass: () => ({ selected }) }, schema: [{ $formkit: 'text', name: 'other' }] });
  await settle(form);
  const submit = form.el.querySelector('button[type="submit"]');
  expect(submit.classList.contains('selected')).toBe(false);
  selected = true;
  await form.node.at('other').input('Changed', false);
  await settle(form);
  expect(submit.classList.contains('selected')).toBe(true);
});

it('keeps the mutable message argument live when a hook stores a different object', async() => {
  const form = mount({ schema: [{ $formkit: 'text', name: 'title' }, { $formkit: 'text', name: 'other' }],
    plugins: [node => { if (node.name === 'title') { node.hook.message((message, next) => next({ ...message })); } }] });
  await settle(form);
  const message = createMessage({ key: 'external', type: 'error', value: 'Before' });
  form.node.at('title').store.set(message);
  await settle(form);
  expect(Object.isFrozen(form.node.at('title').store.external)).toBe(true);
  expect(Object.isFrozen(message)).toBe(false);
  expect(form.el.querySelector('.formkit-message').textContent).toBe('Before');
  message.value = 'After';
  await form.node.at('other').input('Refresh', false);
  await settle(form);
  expect(form.el.querySelector('.formkit-message').textContent).toBe('After');
});
