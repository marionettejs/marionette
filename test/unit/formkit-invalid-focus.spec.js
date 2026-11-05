import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FormView } from '@mnjs/formkit';
import { rovingInput } from '../formkit/roving-input.js';

const owners = [];
afterEach(() => { owners.splice(0).reverse().forEach(owner => owner.destroy()); document.body.replaceChildren(); });
function mount(value = 0, validation = 'min:1', options = {}) {
  const selected = [], submit = vi.fn();
  const form = new FormView({ inputs: { choice: rovingInput(selected) }, values: { score: value }, submit,
    schema: [{ $formkit: 'choice', name: 'score', id: 'score', label: 'Score', validation }], ...options });
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region); region.show(form);
  return { form, selected, submit };
}

it('focuses the empty composite tabstop without answering either invalid submission', async() => {
  const { form, selected, submit } = mount();
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(await form.submit()).toBe('invalid');
    expect(form.getValues()).toEqual({ score: 0 });
    expect(form.getFormState().valid).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('score'));
    expect(selected).toEqual([]);
    expect(submit).not.toHaveBeenCalled();
  }
});

it('focuses the current composite tabstop rather than selecting an earlier inactive option', async() => {
  const { form, selected, submit } = mount(2, 'min:3');
  expect(await form.submit()).toBe('invalid');
  expect(form.getValues()).toEqual({ score: 2 });
  expect(document.activeElement).toBe(document.getElementById('score-2'));
  expect(selected).toEqual([2]);
  expect(submit).not.toHaveBeenCalled();
});

it('retains programmatic focus on standalone negative-tabindex invalid inputs', async() => {
  const { form } = mount(0, 'min:1', { schema: [{ $formkit: 'text', name: 'standalone', id: 'standalone',
    label: 'Standalone', validation: 'required', attrs: { tabindex: -1 } }] });
  expect(await form.submit()).toBe('invalid');
  expect(document.activeElement).toBe(document.getElementById('standalone'));
});
