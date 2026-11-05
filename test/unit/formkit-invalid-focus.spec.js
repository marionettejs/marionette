import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FormView } from '@mnjs/formkit';
import { rovingInput } from '../formkit/roving-input.js';

const owners = [];
afterEach(() => { owners.splice(0).reverse().forEach(owner => owner.destroy()); document.body.replaceChildren(); });
function mount(value = 0, validation = 'min:1', options = {}) {
  const selected = [], submit = vi.fn();
  const form = new FormView({ inputs: { choice: rovingInput(selected) }, values: { score: value }, submit,
    schema: [{ $formkit: 'choice', name: 'score', id: 'score', label: 'Score', help: 'Use the arrow key to choose a score.', validation }], ...options });
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
  expect(document.getElementById('standalone').tabIndex).toBe(-1);
  form.el.tabIndex = 0;
  const layout = document.createElement('section'); layout.tabIndex = 0;
  form.el.prepend(layout); layout.append(document.getElementById('standalone'));
  expect(await form.submit()).toBe('invalid');
  expect(document.activeElement).toBe(document.getElementById('standalone'));
});

it('does not treat a mixed-widget layout or the form itself as a radio entry point', async() => {
  const { form } = mount(0, 'min:1', { schema: [
    { $el: 'section', attrs: { tabindex: 0, id: 'layout' }, children: [
      { $formkit: 'radio', name: 'option', id: 'standalone-radio', label: 'Option', validation: 'required',
        options: ['A', 'B'], sectionsSchema: { input: { attrs: { tabindex: -1 } } } },
      { $formkit: 'text', name: 'other', label: 'Other', validation: 'required' }
    ] }
  ] });
  expect(form.el.querySelector('input[type="radio"]').tabIndex).toBe(-1);
  form.el.tabIndex = 0;
  expect(await form.submit()).toBe('invalid');
  expect(document.activeElement).toBe(form.el.querySelector('input[type="radio"]'));
  document.getElementById('layout').removeAttribute('tabindex');
  document.activeElement.blur();
  expect(await form.submit()).toBe('invalid');
  expect(document.activeElement).toBe(form.el.querySelector('input[type="radio"]'));
});
