// Preserved strict failing dependency probe. Do not count as an accepted correction.
import { afterEach, expect, it } from 'vitest';
import { FormView, FieldView, createViewComponents } from '@mnjs/formkit';

const owned = [];
const flush = async() => { for (let count = 0; count < 20; count++) { await Promise.resolve(); } };
afterEach(() => { owned.splice(0).reverse().forEach(item => item.destroy()); document.body.replaceChildren(); });

it('updates named FieldView callback and opaque file values by identity', async() => {
  let form;
  const files = [new File(['a'], 'same.txt', { lastModified: 1 }), new File(['b'], 'same.txt', { lastModified: 1 })];
  const calls = [];
  const components = createViewComponents({ getForm: () => form, registrations: { Upload: {
    kind: 'field', create: options => new FieldView(options)
  } } });
  form = new FormView({ components, schemaData: { input: { type: 'file', value: [{ name: 'same.txt', file: files[0] }], attrs: { onBlur: () => calls.push('first') } } },
    schema: { $cmp: 'Upload', props: { name: 'upload', input: '$input' } } });
  owned.push(form);
  form.render();
  await flush();
  const input = form.el.querySelector('input');
  input.dispatchEvent(new Event('blur'));
  expect(calls).toEqual(['first']);
  form.setSchemaData({ input: { type: 'file', value: [{ name: 'same.txt', file: files[1] }], attrs: { onBlur: () => calls.push('second') } } });
  await flush();
  expect(form.node.at('upload').value[0].file).toBe(files[1]);
  expect(form.el.querySelector('input')).toBe(input);
  input.dispatchEvent(new Event('blur'));
  expect(calls).toEqual(['first', 'second']);
});

