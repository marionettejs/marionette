import { afterEach, expect, it } from 'vitest';
import { Region } from 'marionette';
import { FormView } from '@mnjs/formkit';

let owner;
afterEach(() => { owner?.destroy(); document.body.replaceChildren(); });
const flush = async() => { for (let index = 0; index < 30; index++) { await Promise.resolve(); } };

it('delivers distinct opaque value props to one actual native input normalizer while retaining control identity', async() => {
  const first = new File(['old'], 'same.txt', { lastModified: 1 });
  const second = new File(['new'], 'same.txt', { lastModified: 1 });
  const processed = new File(['processed'], 'processed.txt', { lastModified: 1 });
  const proposals = [];
  const submitted = [];
  const normalizer = node => node.hook.input((value, next) => {
    proposals.push(value[0]?.file);
    return next(value[0]?.file === second ? [{ name: processed.name, file: processed }] : value);
  });
  const form = new FormView({ schemaData: { upload: [{ name: first.name, file: first }] },
    schema: { $formkit: 'file', name: 'upload', label: 'Attachment', value: '$upload', plugins: [normalizer] },
    submit: values => submitted.push(values) });
  owner = new Region({ el: document.body.appendChild(document.createElement('div')) }); owner.show(form);
  await flush();
  const input = form.el.querySelector('input'); input.focus();
  form.setSchemaData({ upload: [{ name: second.name, file: second }] });
  await flush();
  expect(proposals.filter(value => value === second)).toHaveLength(1);
  expect(form.node.at('upload').value[0].file).toBe(processed);
  expect(form.getValues().upload[0].file).toBe(processed);
  expect(form.el.querySelector('input')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(await form.submit()).toBe('success');
  expect(submitted[0].upload[0].file).toBe(processed);
});
