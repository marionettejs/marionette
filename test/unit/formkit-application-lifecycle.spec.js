import { afterEach, expect, it, vi } from 'vitest';
import { CollectionView, Region, View } from 'marionette';
import { FieldView, FormView, RowView } from '@mnjs/formkit';
import { getNode } from '@formkit/core';
import { getValidationMessages } from '@formkit/validation';

// Synthetic application wiring: persistence, external errors and business effects
// belong to the owner. These tests exercise real adapter nodes and native controls.
const owners = [];
const original = {
  title: 'Original', selected: false,
  items: [{ id: 'a', label: 'Alpha', amount: '1' }, { id: 'b', label: 'Beta', amount: '2' }],
  context: { revision: 'server', untouched: true },
};
const settle = async form => { await form.node.settled; await Promise.resolve(); await Promise.resolve(); };
function native(field, value) {
  const input = field.el.querySelector('input');
  if (input.type === 'checkbox') { input.checked = value; } else { input.value = value; }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}
class ItemRow extends RowView {
  constructor(options) {
    super({ ...options, template: () => '<fieldset><div data-label></div><div data-amount></div></fieldset>',
      regions: { label: '[data-label]', amount: '[data-amount]' } });
  }
  onRender() {
    for (const name of ['label', 'amount']) {
      this.showChildView(name, new FieldView({ form: this.options.form, parent: this.node, name,
        removal: 'preserve', input: { type: 'text', label: name, config: { delay: this.options.inputDelay ?? 0 } } }));
    }
  }
}
async function application({ values = original, saveDraft = vi.fn(), submit = vi.fn(), inputDelay = 0 } = {}) {
  const owner = new View({ template: () => '<div data-form></div><div role="alert" aria-live="polite" data-errors></div>',
    regions: { form: '[data-form]' } });
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(region);
  region.show(owner);
  const state = { errors: [], manualOverride: false };
  const changes = [];
  let timer;
  const form = new FormView({ values, template: () => '<div data-title></div><div data-selected></div><div data-items></div>',
    regions: { title: '[data-title]', selected: '[data-selected]', items: '[data-items]' },
    submit: async(snapshot, context) => {
      state.errors = [];
      paintErrors();
      return submit(snapshot, context);
    },
    formProps: { onSubmitInvalid(node) {
      state.errors = [...getValidationMessages(node).values()].flat().map(message => String(message.value));
      paintErrors();
    } } });
  owner.showChildView('form', form);
  const title = new FieldView({ form, name: 'title', removal: 'preserve',
    input: { type: 'text', label: 'Title', validation: 'required', config: { delay: inputDelay } } });
  const selected = new FieldView({ form, name: 'selected', removal: 'preserve', input: { type: 'checkbox', label: 'Selected' } });
  const list = new FieldView({ form, name: 'items', removal: 'preserve',
    input: { type: 'list', dynamic: true, itemKey: 'id', slots: { default: () => ({ $el: 'div', attrs: { 'data-rows': '' } }) } },
    regions: { rows: '[data-rows]' } });
  form.showChildView('title', title);
  form.showChildView('selected', selected);
  form.showChildView('items', list);
  const display = new CollectionView();
  list.showChildView('rows', display);
  const rows = new Map();
  for (const item of [...values.items].reverse()) {
    const row = new ItemRow({ form, parent: list.node, rowKey: item.id, removal: 'preserve', inputDelay });
    display.addChildView(row);
    rows.set(item.id, row);
  }
  await settle(form);
  function paintErrors() {
    owner.el.querySelector('[data-errors]').textContent = form.getFormState().valid ? '' : state.errors.join('\n');
  }
  owner.listenTo(form, 'form:state', paintErrors);
  owner.listenTo(form, 'form:change', (snapshot, _formState, metadata) => {
    changes.push({ snapshot, source: metadata.source });
    // A derived projection bypasses this one manual-override effect. It still
    // notifies the owner and participates in the ordinary draft-save debounce.
    if (metadata.source !== 'derived' && snapshot.selected !== selectedValue) { state.manualOverride = true; }
    selectedValue = snapshot.selected;
    clearTimeout(timer);
    timer = setTimeout(() => { saveDraft(snapshot); }, 2000);
  });
  let selectedValue = form.getValues().selected;
  owner.on('before:destroy', () => { clearTimeout(timer); });
  paintErrors();
  return { owner, region, form, title, selected, list, display, rows, changes, state,
    receiveErrors(errors) { state.errors = [...errors]; paintErrors(); } };
}
afterEach(() => {
  owners.splice(0).forEach(owner => owner.destroy());
  vi.useRealTimers();
  document.body.replaceChildren();
});

it.each([
  ['initialized host', original],
  ['stored draft', { ...original, title: 'Draft', selected: true,
    items: [{ id: 'b', label: 'Draft beta', amount: '7' }, { id: 'a', label: 'Draft alpha', amount: '8' }],
    context: { revision: 'draft', untouched: true } }],
])('mounts a complete %s snapshot without replacing application data with input defaults', async(_kind, values) => {
  const { form, title, selected, rows, changes } = await application({ values });
  expect(form.getValues()).toEqual(values);
  expect(title.el.querySelector('input').value).toBe(values.title);
  expect(selected.el.querySelector('input').checked).toBe(values.selected);
  for (const item of values.items) { expect(rows.get(item.id).node.value).toEqual(item); }
  expect(changes).toEqual([]);
  form.setValues({ title: 'Authoritative projection' }, { notify: false, source: 'load' });
  await settle(form);
  expect(form.getValues()).toEqual({ ...values, title: 'Authoritative projection' });
  expect(changes).toEqual([]);
});

it('debounces the latest committed draft and keeps silent projections from echoing to persistence', async() => {
  const saveDraft = vi.fn();
  const { form, title, changes } = await application({ saveDraft });
  vi.useFakeTimers();
  native(title, 'First edit');
  await vi.advanceTimersByTimeAsync(0);
  await settle(form);
  await vi.advanceTimersByTimeAsync(1000);
  native(title, 'Latest edit');
  await vi.advanceTimersByTimeAsync(0);
  await settle(form);
  await vi.advanceTimersByTimeAsync(1999);
  expect(saveDraft).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(saveDraft).toHaveBeenCalledExactlyOnceWith({ ...original, title: 'Latest edit' });
  expect(changes.map(change => change.source)).toEqual(['user', 'user']);
  form.setValues({ title: 'Accepted snapshot' }, { notify: false, source: 'load' });
  await vi.advanceTimersByTimeAsync(2500);
  expect(saveDraft).toHaveBeenCalledTimes(1);
  expect(title.el.querySelector('input').value).toBe('Accepted snapshot');
});

it('retains external errors through edits, hides their summary when valid, and clears them at valid submission', async() => {
  const submit = vi.fn();
  const { owner, form, title, state, receiveErrors } = await application({ values: { ...original, title: '' }, submit });
  const summary = owner.el.querySelector('[data-errors]');
  receiveErrors(['External rejection']);
  expect(summary.textContent).toBe('External rejection');
  const input = native(title, 'Corrected');
  input.focus();
  await settle(form);
  await vi.waitFor(() => expect(form.getFormState().valid).toBe(true));
  expect(summary.textContent).toBe('');
  expect(state.errors).toEqual(['External rejection']);
  expect(title.el.querySelector('input')).toBe(input);
  expect(document.activeElement).toBe(input);
  native(title, '');
  await settle(form);
  await vi.waitFor(() => expect(summary.textContent).toBe('External rejection'));
  expect(await form.submit()).toBe('invalid');
  expect(submit).not.toHaveBeenCalled();
  expect(state.errors).toEqual(['Title is required.']);
  expect(summary.textContent).toBe('Title is required.');
  expect(document.activeElement).toBe(input);
  native(title, 'Valid retry');
  expect(await form.submit()).toBe('success');
  expect(state.errors).toEqual([]);
  expect(summary.textContent).toBe('');
  expect(submit.mock.calls[0][0].title).toBe('Valid retry');
});

it('delivers derived origins without applying a manual edit effect or losing draft notification', async() => {
  const saveDraft = vi.fn();
  const { form, selected, state, changes } = await application({ saveDraft });
  vi.useFakeTimers();
  const input = selected.el.querySelector('input');
  input.focus();
  form.setValues({ selected: true }, { source: 'derived' });
  await vi.advanceTimersByTimeAsync(0);
  await settle(form);
  expect(input.checked).toBe(true);
  expect(selected.el.querySelector('input')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(state.manualOverride).toBe(false);
  expect(changes.map(change => change.source)).toEqual(['derived']);
  await vi.advanceTimersByTimeAsync(2000);
  expect(saveDraft).toHaveBeenCalledExactlyOnceWith({ ...original, selected: true });
  native(selected, false);
  await vi.advanceTimersByTimeAsync(0);
  await settle(form);
  expect(state.manualOverride).toBe(true);
  expect(changes.map(change => change.source)).toEqual(['derived', 'user']);
});

it('keeps business row writes bound to IDs and applies authoritative deletion over pending drafts', async() => {
  const { form, list, rows } = await application({ inputDelay: 50 });
  const a = rows.get('a');
  const b = rows.get('b');
  const amount = b.getChildView('amount');
  const input = amount.el.querySelector('input');
  input.focus();
  form.setValues({ items: [...form.getValues().items].reverse() }, { notify: false });
  await settle(form);
  expect(b.node.index).toBe(0);
  expect(amount.el.querySelector('input')).toBe(input);
  expect(document.activeElement).toBe(input);
  const capturedId = 'a';
  list.setValue(form.getValues().items.map(item => item.id === capturedId ? { ...item, amount: '9' } : item), { notify: false });
  await settle(form);
  expect(a.getChildView('amount').getValue()).toBe('9');
  expect(amount.getValue()).toBe('2');
  native(amount, 'Pending beta');
  expect(amount.node.isSettled).toBe(false);
  // Remove the other row using its current ID, while this row's native draft is pending.
  form.setValues({ items: form.getValues().items.filter(item => item.id !== 'a') }, { notify: false });
  await settle(form);
  expect(a.isDestroyed()).toBe(true);
  // An authoritative whole-list snapshot intentionally supersedes pending values.
  expect(form.getValues().items).toEqual([{ id: 'b', label: 'Beta', amount: '2' }]);
  await new Promise(resolve => setTimeout(resolve, 60));
  expect(form.getValues().items).toEqual([{ id: 'b', label: 'Beta', amount: '2' }]);
  expect(amount.el.querySelector('input')).toBe(input);
  expect(document.activeElement).toBe(input);
});

it('discards by destroying the owner and remounting authoritative values, cancelling drafts and late submission', async() => {
  const saveDraft = vi.fn();
  let resolveSubmission;
  let signal;
  const first = await application({ saveDraft, submit: (_values, context) => {
    signal = context.signal;
    return new Promise(resolve => { resolveSubmission = resolve; });
  } });
  vi.useFakeTimers();
  const oldInput = native(first.title, 'Discarded edit');
  await vi.advanceTimersByTimeAsync(0);
  await settle(first.form);
  const oldIds = [first.form.node.props.id, first.list.node.props.id,
    ...[...first.rows.values()].map(row => row.node.props.id),
    ...[...first.form.el.querySelectorAll('input')].map(input => input.id)];
  const success = vi.fn();
  const pending = first.form.submit();
  await vi.advanceTimersByTimeAsync(0);
  await vi.waitFor(() => expect(resolveSubmission).toBeTypeOf('function'));
  first.region.destroy();
  expect(await pending).toBe('cancelled');
  expect(signal.aborted).toBe(true);
  expect(first.owner.isDestroyed()).toBe(true);
  expect(first.form.isDestroyed()).toBe(true);
  expect(first.form.node.context).toBeNull();
  oldIds.forEach(id => { expect(getNode(id)).toBeUndefined(); });
  expect([...first.rows.values()].every(row => row.isDestroyed())).toBe(true);
  // View destruction releases its old event subscribers. Observe the retained
  // object afterwards so a forbidden late event cannot be hidden by that cleanup.
  first.form.on('submit:success', success);
  const mounting = application({ values: original, saveDraft });
  await vi.advanceTimersByTimeAsync(0);
  const next = await mounting;
  expect(next.form.getValues()).toEqual(original);
  expect(next.title.el.querySelector('input')).not.toBe(oldInput);
  oldInput.value = 'Retained obsolete control';
  oldInput.dispatchEvent(new Event('input', { bubbles: true }));
  resolveSubmission('Late response');
  await vi.advanceTimersByTimeAsync(20000);
  expect(success).not.toHaveBeenCalled();
  expect(saveDraft).not.toHaveBeenCalled();
  expect(next.form.getValues()).toEqual(original);
  expect(next.changes).toEqual([]);
});
