import { afterEach, expect, it, vi } from 'vitest';
import { FormView, createSchemaRenderer } from '@mnjs/formkit';
import { closingInput } from '../formkit/closing-input.js';

const owned = [];
afterEach(() => { owned.splice(0).reverse().forEach(owner => owner.destroy()); document.body.replaceChildren(); });

it.each(['condition', 'schema', 'destroy'])('preserves detached descendant relationships while releasing resources on %s', mode => {
  const clicked = vi.fn(); const imperative = vi.fn(); const destroyed = vi.fn();
  const container = document.body.appendChild(document.createElement('div'));
  const renderer = createSchemaRenderer(container, { data: { open: true, clicked },
    schema: { $el: 'section', if: '$open', children: [
      { $el: 'div', attrs: { 'data-palette': 'colors' }, children: {
        $el: 'button', attrs: { onClick: '$clicked' }, children: 'Green'
      } }, { $cmp: 'Child' }
    ] }, components: { Child: ({ document: doc }) => {
      const element = doc.createElement('span');
      return { element, update() {}, destroy() { element.remove(); destroyed(); } };
    } } }); owned.push(renderer);
  const panel = container.firstElementChild;
  const button = panel.querySelector('button'); const palette = button.parentElement;
  button.addEventListener('click', imperative);
  button.click(); expect(clicked).toHaveBeenCalledTimes(1); expect(imperative).toHaveBeenCalledTimes(1);
  if (mode === 'condition') { renderer.update({ open: false, clicked }); }
  else if (mode === 'schema') { renderer.setSchema([]); }
  else { renderer.destroy(); }
  expect(container.childNodes).toHaveLength(0); expect(panel.parentNode).toBeNull();
  expect(button.parentElement).toBe(palette); expect(palette.parentElement).toBe(panel);
  expect(button.parentElement.dataset.palette).toBe('colors'); expect(button.isConnected).toBe(false);
  expect(destroyed).toHaveBeenCalledTimes(1);
  button.click(); expect(clicked).toHaveBeenCalledTimes(1); expect(imperative).toHaveBeenCalledTimes(1);
  renderer.destroy(); expect(destroyed).toHaveBeenCalledTimes(1);
});

it('preserves outgoing generated subtrees when trusted HTML replaces their ownership', () => {
  const clicked = vi.fn(); const container = document.body.appendChild(document.createElement('div'));
  const renderer = createSchemaRenderer(container, { allowHTML: true, data: { attrs: {}, clicked },
    schema: { $el: 'section', bind: '$attrs', children: { $el: 'div', children: {
      $el: 'button', attrs: { onClick: '$clicked' }, children: 'Old'
    } } } }); owned.push(renderer);
  const section = container.firstElementChild;
  const panel = section.firstElementChild; const button = panel.firstElementChild;
  renderer.update({ attrs: { innerHTML: '<p>Replacement</p>' }, clicked });
  expect(section.textContent).toBe('Replacement'); expect(panel.parentNode).toBeNull();
  expect(button.parentElement).toBe(panel); button.click(); expect(clicked).not.toHaveBeenCalled();
  renderer.update({ attrs: {}, clicked });
  expect(section.querySelector('button')).not.toBe(button);
});

it('lets a native input finish delayed DOM work after selecting and closing its panel', async() => {
  const state = { completed: [] };
  const form = new FormView({ inputs: { choice: closingInput(state) }, values: { color: '' },
    formProps: { actions: false }, schema: { $formkit: 'choice', name: 'color' } });
  owned.push(form); document.body.append(form.el); form.render();
  const palette = form.el.querySelector('[data-palette]');
  palette.querySelector('button').click();
  await expect(state.completion).resolves.toBeUndefined();
  expect(state.completed).toEqual([{ palette: 'colors', value: '#00FF00', connected: false }]);
  expect(form.getValues()).toEqual({ color: '#00FF00' });
  expect(form.el.querySelector('[data-palette]')).toBeNull();
  expect(state.choice.parentElement).toBe(palette);
  state.choice.click(); expect(state.completed).toHaveLength(1);
  form.resetForm(); expect(form.getValues()).toEqual({ color: '' });
});
