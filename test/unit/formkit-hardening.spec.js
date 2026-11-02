import { afterEach, expect, it, vi } from 'vitest';
import { Region, View } from 'marionette';
import { FieldView, FormView, SchemaView, SubmissionError, createViewComponents } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const owners = [];
const flush = async() => { for (let i = 0; i < 20; i++) { await Promise.resolve(); } };
function show(view) {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region); region.show(view); return region;
}
function mount(options) { const form = new FormView(options); show(form); return form; }
afterEach(() => { owners.splice(0).reverse().forEach(owner => owner.destroy()); document.body.replaceChildren(); });

it.each([['field', false], ['view', false], ['field', true], ['view', true]])('mounts a named %s registration (factory rendered: %s) after Region placement', async(kind, rendered) => {
  let form;
  const mounted = [];
  class Section extends View {
    onRender() {
      this.showChildView('field', new FieldView({ form, name: 'registered', removal: 'preserve',
        input: { type: 'text', id: 'registered-input' } }));
    }
  }
  const prepare = view => rendered ? view.render() : view;
  const components = createViewComponents({ getForm: () => form, registrations: {
    Registered: kind === 'field' ? { kind, create: options => prepare(new FieldView(options)) } :
      { kind, create: () => prepare(new Section({ template: () => '<div class="field"></div>', regions: { field: '.field' } })) }
  } });
  form = new FormView({ components, schemaData: { visible: true }, schema: [{ $cmp: 'Registered', if: '$visible',
    props: { name: 'registered', input: { type: 'text', id: 'registered-input' } } }],
  plugins: [node => node.on('mounted', () => {
    if (node.props.id === 'registered-input') {
      const element = document.getElementById(node.props.id);
      mounted.push({ found: !!element, connected: !!element?.isConnected });
    }
  })] });
  show(form); await flush();
  expect(mounted).toEqual([{ found: true, connected: true }]);
  form.render(); await flush(); expect(mounted).toHaveLength(1);
  form.setSchemaData({ visible: false }); form.setSchemaData({ visible: true }); form.destroy(); await flush();
  expect(mounted).toHaveLength(1);
  expect(getNode('registered-input')).toBeUndefined();
});

it.each(['region', 'adopted'])('emits mounted after insertion into an attached %s host, once per live node', async placement => {
  const mounts = [];
  const el = placement === 'adopted' ? document.body.appendChild(document.createElement('form')) : undefined;
  const form = new FormView({ el, schema: [{ $formkit: 'text', name: 'title', id: 'mounted-title' }],
    plugins: [node => node.on('mounted', () => {
      const control = document.getElementById(node.props.id);
      mounts.push({ node, found: !!control, connected: !!control?.isConnected });
    })] });
  show(form);
  await flush();
  expect(mounts.filter(item => item.node === form.node.at('title')).map(({ found, connected }) => ({ found, connected })))
    .toEqual([{ found: true, connected: true }]);
  expect(mounts.filter(item => item.node === form.node).map(({ found, connected }) => ({ found, connected })))
    .toEqual([{ found: true, connected: true }]);
  const before = mounts.length;
  form.render(); form.setValues({ title: 'Changed' }); await flush();
  expect(mounts).toHaveLength(before);
});

it('mounts into a detached owner before later attachment without repeating mounted', async() => {
  const observations = [];
  const form = new FormView({ schema: [{ $formkit: 'text', name: 'title', id: 'detached-title' }],
    plugins: [node => node.on('mounted', () => {
      if (node.props.id === 'detached-title') {
        observations.push({ present: !!form.el.querySelector('#detached-title'), connected: form.el.isConnected });
      }
    })] });
  owners.push(form); form.render(); await flush();
  expect(observations).toEqual([{ present: true, connected: false }]);
  show(form); await flush();
  expect(observations).toHaveLength(1);
  expect(document.getElementById('detached-title')).not.toBeNull();
});

it('mounts external FieldView and SchemaView controls after their Region placement', async() => {
  const mounts = [];
  const form = mount({ template: () => '', plugins: [node => node.on('mounted', () => {
    const element = document.getElementById(node.props.id);
    mounts.push({ id: node.props.id, connected: !!element?.isConnected });
  })] });
  const field = new FieldView({ form, name: 'field', removal: 'preserve', input: { type: 'text', id: 'external-field' } });
  const schema = new SchemaView({ form, schema: [{ $formkit: 'text', name: 'schema', id: 'external-schema' }] });
  const region = show(field); show(schema); await flush();
  expect(mounts.filter(item => item.id.startsWith('external-'))).toEqual([
    { id: 'external-field', connected: true }, { id: 'external-schema', connected: true }
  ]);
  region.detachView(); show(field); field.render(); schema.render(); await flush();
  expect(mounts.filter(item => item.id.startsWith('external-'))).toHaveLength(2);
});

it('suppresses mounted for removed nodes and emits once for conditional replacements', async() => {
  const mounts = [];
  const form = mount({ schemaData: { visible: true, type: 'text' },
    schema: [{ $formkit: '$type', if: '$visible', name: 'title', id: 'conditional-title' }],
    plugins: [node => node.on('mounted', () => {
      if (node.props.id === 'conditional-title') { mounts.push({ node, element: document.getElementById(node.props.id) }); }
    })] });
  form.setSchemaData({ visible: true, type: 'textarea' }); await flush();
  expect(mounts).toHaveLength(1);
  expect(mounts[0].node).toBe(form.node.at('title'));
  expect(mounts[0].element).toBe(form.el.querySelector('textarea'));
  form.setSchemaData({ visible: false, type: 'text' }); await flush();
  form.setSchemaData({ visible: true, type: 'text' }); await flush();
  expect(mounts).toHaveLength(2);
  expect(mounts[1].element).toBe(form.el.querySelector('input'));
  form.setSchemaData({ visible: true, type: 'textarea' }); form.destroy(); await flush();
  expect(mounts).toHaveLength(2);
  expect(getNode('conditional-title')).toBeUndefined();
});

it('disables the default submit while pending, rejects repeat attempts, and restores it after resolution', async() => {
  let finish;
  const submit = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const form = mount({ schema: [{ $formkit: 'text', name: 'title', value: 'Ready' }], submit });
  await flush();
  const button = form.el.querySelector('button[type=submit]');
  const pending = form.submit();
  await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  form.el.requestSubmit();
  expect(await form.submit()).toBe('busy');
  await flush();
  expect(button.disabled).toBe(true);
  expect(submit).toHaveBeenCalledTimes(1);
  finish(); expect(await pending).toBe('success'); await flush();
  expect(button.disabled).toBe(false);
});

it('restores actions and displays associated errors after a genuinely rejected submit callback', async() => {
  let reject;
  const form = mount({ schema: [{ $formkit: 'email', name: 'email', value: 'person@example.test' }],
    submit: () => new Promise((resolve, fail) => { reject = fail; }) });
  const failed = vi.fn(); form.on('submit:error', failed);
  const pending = form.submit();
  await vi.waitFor(() => expect(reject).toBeTypeOf('function'));
  reject(new SubmissionError('Save failed', { email: 'Email unavailable' }));
  expect(await pending).toBe('error'); await flush();
  expect(failed).toHaveBeenCalledTimes(1);
  expect(form.el.querySelector('button[type=submit]').disabled).toBe(false);
  const input = form.el.querySelector('input');
  expect(input.getAttribute('aria-describedby').split(' ').some(id => document.getElementById(id)?.textContent === 'Email unavailable')).toBe(true);
  expect(form.el.textContent).toContain('Save failed');
});

it('keeps the latest owner disabled write made while submission is pending', async() => {
  let finish;
  const form = mount({ schema: [{ $formkit: 'text', name: 'title', value: 'Ready' }],
    submit: () => new Promise(resolve => { finish = resolve; }) });
  const pending = form.submit();
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  form.node.props.disabled = true;
  finish(); expect(await pending).toBe('success'); await flush();
  expect(form.node.props.disabled).toBe(true);
  expect(form.el.querySelector('input').disabled).toBe(true);
});

it('focuses a connected enabled invalid FieldView in an external Region', async() => {
  const form = mount({ template: () => '' });
  const field = new FieldView({ form, name: 'email', removal: 'preserve', input: { type: 'email', validation: 'required' } });
  show(field); await flush();
  expect(await form.submit()).toBe('invalid');
  expect(document.activeElement).toBe(field.el.querySelector('input'));
});

it('honors the supplied form id in the DOM and public registry', async() => {
  const form = mount({ formProps: { id: 'checkout' }, schema: [] }); await flush();
  expect(form.el.id).toBe('checkout');
  expect(getNode('checkout')).toBe(form.node);
  form.destroy(); expect(getNode('checkout')).toBeUndefined();
});

it('mounts a template root once and supports Core node.submit through its DOM id', async() => {
  const submit = vi.fn(); const mounted = vi.fn();
  const form = mount({ template: () => '', formProps: { id: 'template-checkout' }, submit,
    plugins: [node => { if (node.props.type === 'form') { node.on('mounted', () => mounted(document.getElementById(node.props.id))); } }] });
  await flush();
  expect(form.el.id).toBe('template-checkout');
  expect(mounted).toHaveBeenCalledExactlyOnceWith(form.el);
  form.node.submit();
  await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  form.render(); await flush();
  expect(mounted).toHaveBeenCalledTimes(1);
});

it('updates dynamic schema config on the existing node and control', async() => {
  const form = mount({ schemaData: { cfg: { disabled: false, classes: { input: 'first' } } },
    schema: [{ $formkit: 'text', name: 'x', config: '$cfg' }] }); await flush();
  const node = form.node.at('x'); const input = form.el.querySelector('input');
  form.setSchemaData({ cfg: { disabled: true, classes: { input: 'second' } } }); await flush();
  expect(form.node.at('x')).toBe(node);
  expect(form.el.querySelector('input')).toBe(input);
  expect(input.disabled).toBe(true);
  expect(input.classList.contains('second')).toBe(true);
  expect(input.classList.contains('first')).toBe(false);
});

it('binds submitAttrs as live input props including help, classes, disabled and raw attributes', async() => {
  const form = mount({ schema: [], formProps: { submitAttrs: { inputClass: 'pay-button', help: 'Review before paying', 'data-purpose': 'pay' } } });
  await flush();
  const button = form.el.querySelector('button[type=submit]');
  expect(button.classList.contains('pay-button')).toBe(true);
  expect(form.el.textContent).toContain('Review before paying');
  expect(button.dataset.purpose).toBe('pay');
  form.node.props.submitAttrs = { inputClass: 'confirm-button', help: 'Confirm payment', disabled: true, 'data-purpose': 'confirm' };
  await flush();
  expect(form.el.querySelector('button[type=submit]')).toBe(button);
  expect(button.classList.contains('confirm-button')).toBe(true);
  expect(button.classList.contains('pay-button')).toBe(false);
  expect(form.el.textContent).toContain('Confirm payment');
  expect(form.el.textContent).not.toContain('Review before paying');
  expect(button.disabled).toBe(true);
  expect(button.dataset.purpose).toBe('confirm');
});
