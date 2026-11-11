import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const owners = [];
const turn = () => new Promise(resolve => setTimeout(resolve, 0));
const inherited = source => source === 'formProps' ? { formProps: { actions: false, disabled: true } } :
  { formProps: { actions: false }, config: { disabled: true } };
function mount(options) {
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(owner);
  const form = new FormView(options);
  owner.show(form);
  return form;
}
async function settle(form) { await form.node.settled; await turn(); }
function disable(form, source, value) { form.node[source === 'config' ? 'config' : 'props'].disabled = value; }
function controls(form) { return [...form.el.querySelectorAll('input, textarea, select, button')]; }
afterEach(() => { owners.splice(0).reverse().forEach(owner => owner.destroy()); document.body.replaceChildren(); });

it.each(['formProps', 'config'].flatMap(source => ['text', 'textarea', 'select', 'checkbox', 'radio', 'file'].map(type => [source, type])))(
  'renders initial %s disabled inheritance on %s and follows later changes', async(source, type) => {
    const form = mount({ ...inherited(source), schema: [{ $formkit: type, name: 'title',
      ...(['select', 'radio'].includes(type) ? { options: ['A', 'B'] } : {}) }] });
    const node = form.node.at('title');
    const elements = controls(form);
    expect(elements.length).toBeGreaterThan(0);
    // Initial rendering must be correct before a prop event or a timer repairs it.
    expect(node.props.disabled).toBe(true);
    expect(node.context.disabled).toBe(true);
    expect(elements.every(input => input.disabled)).toBe(true);
    await settle(form);
    expect(elements.every(input => input.disabled)).toBe(true);
    disable(form, source, false); await settle(form);
    expect(Boolean(node.props.disabled)).toBe(false);
    expect(Boolean(node.context.disabled)).toBe(false);
    expect(elements.every(input => !input.disabled)).toBe(true);
    disable(form, source, true); await settle(form);
    expect(node.context.disabled).toBe(true);
    expect(elements.every(input => input.disabled)).toBe(true);
    expect(controls(form)).toEqual(elements);
    const id = node.props.id;
    form.destroy();
    expect(node.context).toBeNull();
    expect(getNode(id)).toBeUndefined();
  }
);

it.each(['formProps', 'config'])('preserves own values and nested Core inheritance under %s', async source => {
  const form = mount({ ...inherited(source), schema: [{ $formkit: 'group', name: 'section', disabled: false, children: [
    { $formkit: 'text', name: 'inherited' }, { $formkit: 'text', name: 'enabled', disabled: false },
    { $formkit: 'text', name: 'disabled', disabled: true }, { $formkit: 'text', name: 'unset', disabled: undefined }
  ] }] });
  const nodes = ['section.inherited', 'section.enabled', 'section.disabled', 'section.unset'].map(name => form.node.at(name));
  const states = () => nodes.map(node => Boolean(node.context.disabled));
  const domStates = () => nodes.map(node => form.el.querySelector(`[id="${node.props.id}"]`).disabled);
  // Core's own-false group does not cancel its ancestor's config for descendants.
  expect(Boolean(form.node.at('section').props.disabled)).toBe(false);
  expect(states()).toEqual([true, false, true, true]);
  expect(domStates()).toEqual([true, false, true, true]);
  disable(form, source, false); await settle(form);
  expect(states()).toEqual([false, false, true, false]);
  expect(domStates()).toEqual([false, false, true, false]);
  disable(form, source, true); await settle(form);
  expect(states()).toEqual([true, false, true, true]);
  expect(domStates()).toEqual([true, false, true, true]);
});

it.each(['formProps', 'config'])('initializes newly acquired conditional controls from %s', async source => {
  const form = mount({ ...inherited(source), schemaData: { show: false },
    schema: [{ $formkit: 'text', name: 'title', if: '$show' }] });
  expect(form.node.at('title')).toBeUndefined();
  form.setSchemaData({ show: true });
  const first = form.node.at('title');
  expect(first.context.disabled).toBe(true);
  expect(controls(form)[0].disabled).toBe(true);
  form.setSchemaData({ show: false });
  expect(first.context).toBeNull();
  form.setSchemaData({ show: true });
  const second = form.node.at('title');
  expect(second).not.toBe(first);
  expect(second.context.disabled).toBe(true);
  expect(controls(form)[0].disabled).toBe(true);
  await settle(form);
});

it.each(['formProps', 'config'])('initializes a later FieldView from %s and preserves an own false override', async source => {
  const form = mount({ ...inherited(source), template: () => '<div class="field"></div>', regions: { field: '.field' } });
  const field = new FieldView({ form, name: 'title', input: { type: 'text' } });
  form.showChildView('field', field);
  const node = field.node;
  const input = field.el.querySelector('input');
  expect(node.context.disabled).toBe(true);
  expect(input.disabled).toBe(true);
  field.setInput({ disabled: true });
  field.setInput({ disabled: false });
  await settle(form);
  expect(Boolean(node.props.disabled)).toBe(false);
  expect(Boolean(node.context.disabled)).toBe(false);
  expect(input.disabled).toBe(false);
  field.setInput({ disabled: true });
  field.setInput({ disabled: undefined });
  await settle(form);
  expect(Object.hasOwn(node.props, 'disabled')).toBe(true);
  expect(node.props.disabled).toBeUndefined();
  expect(node.context.disabled).toBeUndefined();
  expect(input.disabled).toBe(false);
  disable(form, source, false); disable(form, source, true); await settle(form);
  expect(input.disabled).toBe(false);
  expect(field.el.querySelector('input')).toBe(input);
  const changed = vi.fn();
  form.on('form:change', changed);
  field.destroy(); form.destroy();
  expect(node.context).toBeNull();
  expect(getNode(node.props.id)).toBeUndefined();
  input.value = 'Late'; input.dispatchEvent(new Event('input', { bubbles: true }));
  await turn(); expect(changed).not.toHaveBeenCalled();
});

it.each(['formProps', 'config'])('preserves %s disabled ownership through explicit submit and reset', async source => {
  let finish;
  const submit = vi.fn().mockResolvedValueOnce('Initial').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const options = inherited(source);
  const form = mount({ ...options, formProps: { ...options.formProps, actions: true }, values: { title: 'Initial' },
    schema: [{ $formkit: 'text', name: 'title' }], submit });
  expect(controls(form).every(input => input.disabled)).toBe(true);
  expect(await form.submit()).toBe('success');
  expect(submit.mock.calls[0][0]).toEqual({ title: 'Initial' });
  await settle(form);
  expect(controls(form).every(input => input.disabled)).toBe(true);
  // Submission restores an own root prop; subsequent owner writes target it.
  form.node.props.disabled = false; await settle(form);
  expect(controls(form).every(input => !input.disabled)).toBe(true);
  const pending = form.submit();
  await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(controls(form).every(input => input.disabled)).toBe(true);
  finish('Saved'); expect(await pending).toBe('success'); await settle(form);
  expect(controls(form).every(input => !input.disabled)).toBe(true);
  form.node.props.disabled = true;
  form.setValues({ title: 'Changed' }, { notify: false });
  form.resetForm(); await settle(form);
  expect(form.getValues()).toEqual({ title: 'Initial' });
  expect(controls(form).every(input => input.disabled)).toBe(true);
});
