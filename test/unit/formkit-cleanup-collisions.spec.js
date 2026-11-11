import { afterEach, expect, it } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const owners = [];
const nodes = [];
afterEach(() => {
  owners.splice(0).forEach(owner => owner.destroy());
  nodes.splice(0).forEach(node => { if (node.context !== null) { node.destroy(); } });
  document.body.replaceChildren();
});

it('keeps FormView cleanup independent of a consumer dispose helper', () => {
  const calls = [];
  class ContactForm extends FormView {
    dispose() { calls.push('application'); }
  }
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(owner);
  const form = new ContactForm({ schema: [{ $formkit: 'text', name: 'name', id: 'consumer-dispose' }] });
  nodes.push(form.node);
  owner.show(form);
  const input = form.el.querySelector('input');
  form.dispose();
  expect(calls).toEqual(['application']);
  expect(getNode('consumer-dispose')).toBe(form.node.at('name'));
  owner.destroy();
  expect(calls).toEqual(['application']);
  expect(form.node.context).toBeNull();
  expect(getNode('consumer-dispose')).toBeUndefined();
  input.value = 'After destruction';
  expect(() => input.dispatchEvent(new Event('input', { bubbles: true }))).not.toThrow();
});

it('keeps FieldView cleanup independent of a consumer release helper', () => {
  const calls = [];
  class ContactField extends FieldView {
    release() { calls.push('application'); }
  }
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(owner);
  const form = new FormView({ template: () => '<div class="field"></div>', regions: { field: '.field' } });
  nodes.push(form.node);
  owner.show(form);
  const field = new ContactField({ form, name: 'name', input: { type: 'text', id: 'consumer-release' } });
  form.showChildView('field', field);
  const node = field.node;
  const input = field.el.querySelector('input');
  field.release();
  expect(calls).toEqual(['application']);
  expect(getNode('consumer-release')).toBe(node);
  field.destroy();
  expect(calls).toEqual(['application']);
  expect(node.context).toBeNull();
  expect(getNode('consumer-release')).toBeUndefined();
  input.value = 'After destruction';
  expect(() => input.dispatchEvent(new Event('input', { bubbles: true }))).not.toThrow();
});
