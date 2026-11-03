import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';

const owners = [];
const flush = async() => { for (let index = 0; index < 12; index++) { await Promise.resolve(); } };
function mount(options = {}) {
  const form = new FormView({ template: () => '<div class="field"></div>', regions: { field: '.field' }, ...options });
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(owner);
  owner.show(form);
  return form;
}
function field(form, input) {
  const view = new FieldView({ form, name: 'local', removal: 'preserve', input });
  form.showChildView('field', view);
  return view;
}
afterEach(() => {
  owners.splice(0).reverse().forEach(owner => owner.destroy());
  document.body.replaceChildren();
  vi.useRealTimers();
});

it('writes an ignored FieldView independently with requested, silent and native change origins', async() => {
  const form = mount({ values: { title: 'Canonical' } });
  const view = field(form, { type: 'text', ignore: true, value: 'Local', config: { delay: 0 } });
  await flush();
  const control = view.el.querySelector('input');
  const changes = [];
  const roots = [];
  view.on('field:change', (value, metadata) => changes.push({ value, source: metadata.source }));
  form.on('form:change', values => roots.push(values));
  view.setValue('Changed', { source: 'actor' });
  await flush();
  expect(view.getValue()).toBe('Changed');
  expect(control.value).toBe('Changed');
  expect(changes).toEqual([{ value: 'Changed', source: 'actor' }]);
  view.setValue('Silent', { notify: false, source: 'echo' });
  await flush();
  expect(control.value).toBe('Silent');
  expect(changes).toHaveLength(1);
  control.value = 'Native';
  control.dispatchEvent(new Event('input', { bubbles: true }));
  await view.node.settled; await flush();
  expect(changes.at(-1)).toEqual({ value: 'Native', source: 'user' });
  view.setValue('Programmatic');
  await flush();
  expect(changes.at(-1)).toEqual({ value: 'Programmatic', source: 'programmatic' });
  view.setValue('Programmatic');
  await flush();
  expect(changes).toHaveLength(3);
  expect(view.el.querySelector('input')).toBe(control);
  expect(form.getValues()).toEqual({ title: 'Canonical' });
  expect(roots).toEqual([]);
});

it('replaces an ignored custom object value without merging or sharing the caller snapshot', async() => {
  const form = mount({ values: { title: 'Canonical' }, inputs: { localObject: { type: 'input', schema: { $el: 'output', children: '$value.title' } } } });
  const view = field(form, { type: 'localObject', ignore: true, value: { title: 'Local', obsolete: true } });
  const next = { title: 'Changed', details: { revision: 2 } };
  view.setValue(next);
  next.details.revision = 3;
  await flush();
  expect(view.getValue()).toEqual({ title: 'Changed', details: { revision: 2 } });
  expect(view.el.querySelector('output').textContent).toBe('Changed');
  expect(form.getValues()).toEqual({ title: 'Canonical' });
});

it('supersedes an ignored control pending native edit with a silent authoritative value', async() => {
  vi.useFakeTimers();
  const form = mount({ values: { title: 'Canonical' } });
  const view = field(form, { type: 'text', ignore: true, value: 'Local', config: { delay: 50 } });
  await flush();
  const changes = [];
  view.on('field:change', value => changes.push(value));
  const control = view.el.querySelector('input');
  control.value = 'Pending';
  control.dispatchEvent(new Event('input', { bubbles: true }));
  expect(view.node.isSettled).toBe(false);
  view.setValue('Authoritative', { notify: false });
  await vi.advanceTimersByTimeAsync(100); await flush();
  expect(view.getValue()).toBe('Authoritative');
  expect(control.value).toBe('Authoritative');
  expect(changes).toEqual([]);
  expect(form.getValues()).toEqual({ title: 'Canonical' });
});

it('updates FieldView local classes without erasing inherited or section classes', async() => {
  const form = mount({ config: { classes: { input: 'inherited-input', outer: 'inherited-outer' } } });
  const view = field(form, { type: 'text', value: 'Selection', classes: { input: 'local-first' }, inputClass: 'section-input' });
  await flush();
  const control = view.el.querySelector('input');
  expect(control.className).toBe('formkit-input inherited-input local-first section-input');
  expect(view.el.querySelector('.inherited-outer')).not.toBeNull();
  control.focus(); control.setSelectionRange(1, 4);
  view.setInput({ classes: { input: 'local-second' } });
  await flush();
  expect(control.className).toBe('formkit-input inherited-input local-second section-input');
  form.node.config.classes = { input: 'inherited-updated', outer: 'inherited-outer' };
  await flush();
  expect(control.className).toBe('formkit-input inherited-updated local-second section-input');
  view.setInput({ classes: {} });
  await flush();
  expect(control.className).toBe('formkit-input inherited-updated section-input');
  expect(view.el.querySelector('input')).toBe(control);
  expect(document.activeElement).toBe(control);
  expect([control.selectionStart, control.selectionEnd]).toEqual([1, 4]);
});

it('updates and removes schema classes on the same control', async() => {
  const form = mount({ template: undefined, schemaData: { localClasses: { input: 'schema-first' } },
    schema: [{ $formkit: 'text', name: 'title', classes: '$localClasses' }] });
  await flush();
  const control = form.el.querySelector('input');
  expect(control.className).toBe('formkit-input schema-first');
  form.setSchemaData({ localClasses: { input: 'schema-second', outer: 'schema-outer' } });
  await flush();
  expect(control.className).toBe('formkit-input schema-second');
  expect(form.el.querySelector('.schema-outer')).not.toBeNull();
  form.setSchema([{ $formkit: 'text', name: 'title' }]);
  await flush();
  expect(control.className).toBe('formkit-input');
  expect(form.el.querySelector('.schema-outer')).toBeNull();
  expect(form.el.querySelector('input')).toBe(control);
});

it('applies class disabling and reset at the local layer before explicit section classes', async() => {
  const form = mount({ config: { classes: { input: 'inherited keep' } } });
  const view = field(form, { type: 'text', classes: { input: { inherited: false, local: true } }, inputClass: 'section' });
  await flush();
  const control = view.el.querySelector('input');
  expect(control.className).toBe('formkit-input keep local section');
  view.setInput({ classes: { input: '$reset replacement' } });
  await flush();
  expect(control.className).toBe('replacement section');
  view.setInput({ classes: undefined });
  await flush();
  expect(control.className).toBe('formkit-input inherited keep section');
});
