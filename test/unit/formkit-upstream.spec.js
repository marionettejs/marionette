import { afterEach, expect, it } from 'vitest';
import { Region } from 'marionette';
import { FormView } from '@mnjs/formkit';
import { describeForm, fillForm } from '@formkit/addons';
import { getNode } from '@formkit/core';

const regions = [];
const turn = () => new Promise(resolve => setTimeout(resolve, 0));
async function settle(form) {
  await form.node.settled;
  await form.node.ledger.settled('validating');
  await turn();
}
function mount(options) {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  regions.push(region);
  const form = new FormView({ formProps: { actions: false }, ...options });
  region.show(form);
  return form;
}
afterEach(() => {
  regions.splice(0).forEach(region => region.destroy());
  document.body.replaceChildren();
});

it.each(['blur dirty', 'dirty blur', 'blur,dirty', 'blur|dirty'])('combines %s validation visibility on native inputs', async validationVisibility => {
  const form = mount({ schema: [{ $formkit: 'email', name: 'email', id: 'combined-email',
    validation: 'required|email', validationVisibility }] });
  await settle(form);
  const node = form.node.at('email');
  const input = form.el.querySelector('input');
  expect(node.context.state.validationVisible).toBe(false);
  input.focus(); input.blur();
  await settle(form);
  expect(node.context.state.validationVisible).toBe(true);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(form.el.querySelector('[data-message-type="validation"]')).not.toBeNull();
  await node.input('ada@example.test', false);
  await settle(form);
  expect(node.context.state.valid).toBe(true);
  expect(form.el.querySelector('[data-message-type="validation"]')).toBeNull();
});

it('honors live mode in a combination and reactive visibility changes', async() => {
  const form = mount({ schema: [{ $formkit: 'text', name: 'name', validation: 'required', validationVisibility: 'live blur' }] });
  await settle(form);
  const node = form.node.at('name');
  expect(node.context.state.validationVisible).toBe(true);
  node.props.validationVisibility = 'submit';
  await settle(form);
  expect(node.context.state.validationVisible).toBe(false);
  node.props.validationVisibility = 'blur dirty';
  await node.input('Ada', false);
  await settle(form);
  expect(node.context.state.validationVisible).toBe(true);
  expect(node.context.state.valid).toBe(true);
});

it('describes native fields without exposing values and fills canonical option values', async() => {
  const form = mount({ schema: [
    { $formkit: 'text', name: 'name', label: 'Name', validation: 'required' },
    { $formkit: 'select', name: 'role', label: 'Role', options: [{ label: 'Editor', value: 'editor' }, { label: 'Reader', value: 'reader' }] },
    { $formkit: 'password', name: 'password', label: 'Password' }
  ], values: { name: '', role: 'reader', password: 'private-value' } });
  await settle(form);
  const description = describeForm(form.node);
  const name = description.children.find(field => field.address === 'name');
  expect(name.label).toBe('Name');
  expect(name.required).toBe(true);
  expect(JSON.stringify(description)).not.toContain('private-value');
  const result = await fillForm(form.node, { name: 'Ada', role: 'Editor' });
  await settle(form);
  expect(result.settled).toBe(true);
  expect(result.valid).toBe(true);
  expect(result.unknown).toEqual([]);
  expect(form.getValues()).toEqual({ name: 'Ada', role: 'editor', password: 'private-value' });
  expect(form.el.querySelector('select').value).toBe('editor');
  expect(JSON.stringify(result)).not.toContain('private-value');
  const withValues = JSON.stringify(describeForm(form.node, { values: true }));
  expect(withValues).toContain('Ada');
  expect(withValues).not.toContain('private-value');
});

it('starts empty groups and forms correctly and hydrates added and removed children', async() => {
  const form = mount({ schema: [] });
  await settle(form);
  expect(form.node.context.state.empty).toBe(true);
  form.setSchema([{ $formkit: 'group', name: 'profile', children: [] }]);
  await settle(form);
  const group = form.node.at('profile');
  expect(group.context.state.empty).toBe(true);
  form.setValues({ profile: { name: 'Ada' } });
  form.setSchema([{ $formkit: 'group', name: 'profile', children: [
    { $formkit: 'text', name: 'name', id: 'hydrated-name' }
  ] }]);
  await settle(form);
  expect(form.el.querySelector('input').value).toBe('Ada');
  expect(group.context.state.empty).toBe(false);
  form.setSchema([{ $formkit: 'group', name: 'profile', children: [] }]);
  await settle(form);
  expect(getNode('hydrated-name')).toBeUndefined();
  expect(form.getValues()).toEqual({ profile: {} });
  expect(group.context.state.empty).toBe(true);
});

it('retains the newer duplicate registry owner when the older form is destroyed', async() => {
  const schema = [{ $formkit: 'text', name: 'title', id: 'upstream-duplicate' }];
  const first = mount({ schema });
  const second = mount({ schema });
  await settle(first); await settle(second);
  const old = first.node.at('title');
  const current = second.node.at('title');
  expect(getNode('upstream-duplicate')).toBe(current);
  first.destroy();
  expect(old.context).toBeNull();
  expect(getNode('upstream-duplicate')).toBe(current);
  await current.input('Survivor', false);
  await settle(second);
  expect(second.el.querySelector('input').value).toBe('Survivor');
  second.destroy();
  expect(getNode('upstream-duplicate')).toBeUndefined();
});
