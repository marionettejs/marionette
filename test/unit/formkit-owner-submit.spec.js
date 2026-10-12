import { afterEach, expect, it, vi } from 'vitest';
import { getNode } from '@formkit/core';
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';

const owners = [];
afterEach(() => {
  owners.splice(0).forEach(owner => owner.destroy());
  vi.useRealTimers();
  document.body.replaceChildren();
});

function mount({ enabled = true, removal = 'clear', input = {}, ...options } = {}) {
  const fields = [];
  const fieldChanges = [];
  const form = new FormView({
    template: () => '<div class="controller"></div><div class="detail"></div><div class="sibling"></div>',
    regions: { controller: '.controller', detail: '.detail', sibling: '.sibling' },
    values: { enabled, detail: 'Original', keep: 'Sibling' },
    ...options,
  });
  form.on('render', () => {
    form.showChildView('controller', new FieldView({ form, name: 'enabled', removal: 'preserve', input: { type: 'checkbox' } }));
    form.showChildView('sibling', new FieldView({ form, name: 'keep', removal: 'preserve', input: { type: 'text' } }));
    if (enabled) { showDetail(); }
  });
  function showDetail() {
    const field = new FieldView({ form, name: 'detail', removal, input: { type: 'text', ...input } });
    field.on('field:change', (value, metadata) => { fieldChanges.push({ value, source: metadata.source }); });
    fields.push(field);
    form.showChildView('detail', field);
  }
  function project(values) {
    const detail = form.getRegion('detail');
    if (values.enabled && !detail.hasView()) { showDetail(); } else if (!values.enabled && detail.hasView()) { detail.empty(); }
    form.setValues(values, { notify: false });
  }
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region);
  region.show(form);
  return { form, region, fields, fieldChanges, project };
}

it('removes a hidden async validator from an awaiting submission and ignores its late result after replacement', async() => {
  const checks = [];
  const submitted = [];
  const { form, fields, project } = mount({
    input: { validation: 'remote' },
    validationRules: { remote: node => new Promise(resolve => { checks.push({ value: node.value, resolve }); }) },
    submit: values => { submitted.push(values); },
  });
  await vi.waitFor(() => expect(checks).toHaveLength(1));
  const first = fields[0];
  const oldId = first.node.props.id;
  const pending = form.submit();
  project({ enabled: false });
  await vi.waitFor(() => expect(submitted).toHaveLength(1));
  expect(await pending).toBe('success');
  expect(submitted[0]).toEqual({ enabled: false, keep: 'Sibling' });
  expect(first.isDestroyed()).toBe(true);
  expect(getNode(oldId)).toBeUndefined();

  project({ enabled: true, detail: 'Fresh' });
  await vi.waitFor(() => expect(checks.some(check => check.value === 'Fresh')).toBe(true));
  expect(fields).toHaveLength(2);
  expect(fields[1]).not.toBe(first);
  checks[0].resolve(false);
  const fresh = checks.find(check => check.value === 'Fresh');
  fresh.resolve(true);
  expect(await form.submit()).toBe('success');
  expect(submitted.at(-1)).toEqual({ enabled: true, detail: 'Fresh', keep: 'Sibling' });
  expect(form.getState().errors).toEqual([]);
  expect(form.el.querySelector('[aria-invalid="true"]')).toBeNull();
});

it('cancels a delayed native draft on owner Region removal and remounts only the preserved committed value', async() => {
  vi.useFakeTimers();
  const { form, fields, fieldChanges, project } = mount({ removal: 'preserve', input: { config: { delay: 50 } } });
  await vi.advanceTimersByTimeAsync(0);
  const changes = [];
  form.on('form:change', values => { changes.push(values); });
  const old = fields[0];
  const oldInput = old.el.querySelector('input');
  const oldId = oldInput.id;
  oldInput.value = 'Uncommitted';
  oldInput.dispatchEvent(new Event('input', { bubbles: true }));
  expect(old.node.isSettled).toBe(false);
  project({ enabled: false });
  expect(old.isDestroyed()).toBe(true);
  expect(getNode(oldId)).toBeUndefined();
  project({ enabled: true });
  expect(fields).toHaveLength(2);
  expect(fields[1].el.querySelector('input')).not.toBe(oldInput);
  expect(fields[1].getValue()).toBe('Original');
  oldInput.value = 'Retained DOM edit';
  oldInput.dispatchEvent(new Event('input', { bubbles: true }));
  await vi.advanceTimersByTimeAsync(100);
  expect(form.getValues()).toEqual({ enabled: true, detail: 'Original', keep: 'Sibling' });
  expect(fieldChanges).toEqual([]);
  expect(changes).toEqual([]);
});

it('cancels an active submission on owner destruction without creating an initially false field', async() => {
  let finish;
  let signal;
  const { form, region, fields } = mount({ enabled: false,
    submit: (_values, context) => {
      signal = context.signal;
      return new Promise(resolve => { finish = resolve; });
    },
  });
  const successes = [];
  form.on('submit:success', values => { successes.push(values); });
  const pending = form.submit();
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  expect(fields).toEqual([]);
  region.destroy();
  expect(await pending).toBe('cancelled');
  expect(signal.aborted).toBe(true);
  form.setValues({ enabled: true });
  finish('Late completion');
  await Promise.resolve();
  await Promise.resolve();
  expect(fields).toEqual([]);
  expect(successes).toEqual([]);
});

it('stops an awaiting submission from waiting on a removed field native input delay', async() => {
  vi.useFakeTimers();
  const submitted = [];
  const { form, fields, project } = mount({ input: { config: { delay: 1000 } },
    submit: values => { submitted.push(values); },
  });
  await vi.advanceTimersByTimeAsync(0);
  const input = fields[0].el.querySelector('input');
  input.value = 'Pending draft';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(fields[0].node.isSettled).toBe(false);
  const pending = form.submit();
  await vi.advanceTimersByTimeAsync(0);
  expect(submitted).toEqual([]);
  project({ enabled: false });
  expect(fields[0].isDestroyed()).toBe(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(submitted).toEqual([{ enabled: false, keep: 'Sibling' }]);
  expect(await pending).toBe('success');
  await vi.advanceTimersByTimeAsync(1000);
  expect(submitted).toHaveLength(1);
  expect(form.getValues()).toEqual({ enabled: false, keep: 'Sibling' });
});

it('cancels the wait for a delayed native input on reset and permits a later submission', async() => {
  vi.useFakeTimers();
  const submitted = [];
  const { form, fields } = mount({ input: { config: { delay: 1000 } },
    submit: values => { submitted.push(values); },
  });
  await vi.advanceTimersByTimeAsync(0);
  const input = fields[0].el.querySelector('input');
  input.value = 'Discarded draft';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(fields[0].node.isSettled).toBe(false);
  const pending = form.submit();
  await vi.advanceTimersByTimeAsync(0);
  expect(submitted).toEqual([]);
  form.resetForm();
  expect(await pending).toBe('cancelled');
  expect(form.getState().submitting).toBe(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(form.getValues()).toEqual({ enabled: true, detail: 'Original', keep: 'Sibling' });
  expect(input.value).toBe('Original');
  expect(submitted).toEqual([]);
  form.setValues({ detail: 'Current owner value' }, { notify: false });
  expect(await form.submit()).toBe('success');
  expect(submitted).toEqual([{ enabled: true, detail: 'Current owner value', keep: 'Sibling' }]);
});

it.each(['preserve', 'clear'])('clears obsolete user origin after owner removal of a pending %s field', async removal => {
  vi.useFakeTimers();
  const { form, fields } = mount({ removal, input: { config: { delay: 50 } } });
  await vi.advanceTimersByTimeAsync(0);
  const old = fields[0];
  const input = old.el.querySelector('input');
  input.value = 'Pending draft';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(old.node.isSettled).toBe(false);
  form.getRegion('detail').empty();
  await vi.advanceTimersByTimeAsync(0);
  const changes = [];
  form.on('form:change', (values, _state, metadata) => changes.push({ values, source: metadata.source }));
  await form.getRegion('sibling').currentView.node.input('Programmatic', false);
  await vi.advanceTimersByTimeAsync(60);
  const values = removal === 'preserve' ?
    { enabled: true, detail: 'Original', keep: 'Programmatic' } :
    { enabled: true, keep: 'Programmatic' };
  expect(form.getValues()).toEqual(values);
  expect(changes).toEqual([{ values, source: 'programmatic' }]);
  expect(old.isDestroyed()).toBe(true);
});

it('suppresses a queued field callback after its owner removes the View', async() => {
  const { form, fields, fieldChanges, project } = mount({ removal: 'preserve' });
  await form.node.settled;
  const old = fields[0];
  void old.node.input('Queued committed value', false);
  form.getRegion('detail').empty();
  project({ enabled: true });
  await form.node.settled;
  await Promise.resolve();
  expect(old.isDestroyed()).toBe(true);
  expect(fields[1].getValue()).toBe('Queued committed value');
  expect(fieldChanges).toEqual([]);
});
