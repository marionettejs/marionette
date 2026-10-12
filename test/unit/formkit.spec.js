import { afterEach, describe, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FormView, SubmissionError } from '@mnjs/formkit';
import { getNode } from '@formkit/core';

const views = [];
const regions = [];
function mount(options = {}) {
  const view = new FormView({ fields: [
    { name: 'email', type: 'email', label: 'Email', validation: 'required|email', help: 'Use a work email.' },
    { name: 'profile', type: 'group', label: 'Profile', children: [
      { name: 'name', type: 'text', label: 'Name', value: 'Paul', validation: 'required' },
      { name: 'newsletter', type: 'checkbox', label: 'Newsletter' }
    ] }
  ], ...options });
  const target = document.body.appendChild(document.createElement('div'));
  const region = new Region({ el: target });
  views.push(view);
  regions.push(region);
  region.show(view);
  return view;
}
function edit(view, name, value, type = 'input') {
  const input = view.el.elements.namedItem(name);
  if (input.type === 'checkbox') { input.checked = value; } else { input.value = value; }
  input.dispatchEvent(new Event(type, { bubbles: true }));
  return input;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
afterEach(() => {
  regions.splice(0).forEach(region => region.destroy());
  views.splice(0).forEach(view => view.destroy());
  document.body.replaceChildren();
});

describe('@mnjs/formkit native forms', () => {
  it('owns a semantic form and grouped values, labels, help and stable focus', async() => {
    const view = mount();
    expect(view.el.tagName).toBe('FORM');
    expect(view.el.noValidate).toBe(true);
    expect(view.el.querySelector('legend').textContent).toBe('Profile');
    const input = view.el.elements.namedItem('profile.name');
    expect(view.el.querySelector(`label[for="${input.id}"]`).textContent).toBe('Name');
    input.focus();
    input.setSelectionRange(1, 2);
    view.render();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    edit(view, 'profile.name', 'Ada');
    edit(view, 'profile.newsletter', true, 'input');
    await tick();
    expect(view.getValues()).toEqual({ email: '', profile: { name: 'Ada', newsletter: true } });
    expect(document.activeElement).toBe(input);
    const snapshot = view.getValues();
    snapshot.profile.name = 'Changed';
    expect(view.getValues().profile.name).toBe('Ada');
  });

  it('reveals validation on blur and submit, focuses invalid fields, then submits settled values', async() => {
    const submit = vi.fn();
    const view = mount({ submit });
    const email = view.el.elements.namedItem('email');
    expect(email.getAttribute('aria-invalid')).toBeNull();
    expect(email.getAttribute('aria-required')).toBe('true');
    email.dispatchEvent(new Event('blur'));
    await tick();
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby').split(' ').map(id => document.getElementById(id)?.textContent)).toEqual(['Use a work email.', 'Email is required.']);
    expect(await view.submit()).toBe('invalid');
    expect(document.activeElement).toBe(email);
    expect(submit).not.toHaveBeenCalled();
    edit(view, 'email', 'paul@example.com');
    expect(await view.submit()).toBe('success');
    expect(submit.mock.calls[0][0].email).toBe('paul@example.com');
    expect(email.getAttribute('aria-invalid')).toBeNull();
    expect(email.getAttribute('aria-describedby')).toBe(`help-${email.id}`);
  });

  it('handles native submit/reset events, reset values and visibility without replacing controls', async() => {
    const submit = vi.fn();
    const view = mount({ submit, values: { email: 'paul@example.com' } });
    const name = edit(view, 'profile.name', 'Other');
    const event = new Event('submit', { cancelable: true });
    view.el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await tick();
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    view.setErrors(['Server error'], { 'profile.name': ['Name unavailable'] });
    const reset = new Event('reset', { cancelable: true });
    view.el.dispatchEvent(reset);
    expect(reset.defaultPrevented).toBe(true);
    expect(name.value).toBe('Paul');
    expect(view.getValues().email).toBe('paul@example.com');
    expect(view.getState().submitted).toBe(false);
    expect(view.getState().errors).toEqual([]);
    expect(view.el.elements.namedItem('profile.name')).toBe(name);
  });

  it('shows submission and field errors as text and permits correction and retry', async() => {
    const submit = vi.fn().mockRejectedValueOnce(new SubmissionError('<b>Rejected</b>', {
      'profile.name': ['<img src=x onerror=alert(1)>']
    })).mockResolvedValueOnce('saved');
    const view = mount({ submit, values: { email: 'paul@example.com' } });
    expect(await view.submit()).toBe('error');
    expect(view.getState().errors).toEqual(['<b>Rejected</b>']);
    expect(view.el.querySelector('b, img')).toBeNull();
    expect(view.el.elements.namedItem('profile.name').getAttribute('aria-invalid')).toBe('true');
    edit(view, 'profile.name', 'New name');
    expect(view.getState().errors).toEqual([]);
    expect(await view.submit()).toBe('success');
  });

  it('guards async submission, disables controls, snapshots values and restores state', async() => {
    let finish;
    const submit = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const view = mount({ submit, values: { email: 'paul@example.com' }, submitLabel: 'Save', resetLabel: 'Undo' });
    const promise = view.submit();
    await tick();
    expect(view.getState().submitting).toBe(true);
    expect(view.el.getAttribute('aria-busy')).toBe('true');
    expect(view.el.querySelector('button').textContent).toBe('Save');
    expect(view.el.querySelector('input').disabled).toBe(true);
    expect(await view.submit()).toBe('busy');
    edit(view, 'email', 'ignored@example.com');
    expect(view.getValues().email).toBe('paul@example.com');
    finish('ok');
    expect(await promise).toBe('success');
    expect(view.getState().submitting).toBe(false);
    expect(view.el.querySelector('input').disabled).toBe(false);
  });

  it('cancels an in-flight submit on reset and ignores late success/error', async() => {
    let reject;
    let signal;
    const success = vi.fn();
    const error = vi.fn();
    const view = mount({ values: { email: 'paul@example.com' }, submit(values, context) {
      signal = context.signal;
      return new Promise((resolve, rejectPromise) => { reject = rejectPromise; });
    } });
    view.on('submit:success', success);
    view.on('submit:error', error);
    const promise = view.submit();
    await tick();
    view.resetForm();
    expect(signal.aborted).toBe(true);
    expect(await promise).toBe('cancelled');
    reject(new Error('Late failure'));
    await tick();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(view.getState().errors).toEqual([]);
  });

  it('awaits async validation independently from input settlement', async() => {
    let validate;
    const view = mount({ fields: [{ name: 'code', type: 'text', label: 'Code', value: 'ready', validation: 'remote' }],
      validationRules: { remote: () => new Promise(resolve => { validate = resolve; }) } });
    const promise = view.submit();
    await tick();
    expect(view.getState().submitting).toBe(true);
    validate(false);
    expect(await promise).toBe('invalid');
  });

  it('cancels while validation is pending and on terminal destroy, even with an uncooperative request', async() => {
    const view = mount({ fields: [{ name: 'code', type: 'text', label: 'Code', value: 'ready', validation: 'remote' }],
      validationRules: { remote: () => new Promise(() => {}) } });
    const promise = view.submit();
    view.destroy();
    expect(await promise).toBe('cancelled');
    expect(await view.submit()).toBe('cancelled');
    expect(view.resetForm()).toBe(view);
    expect(view.render()).toBe(view);
  });

  it('releases each node, subscriptions, and DOM listeners across repeated mount/destroy', async() => {
    let active = 0;
    let destroyed = 0;
    const plugin = node => {
      active++;
      node.on('destroyed', () => { active--; destroyed++; });
    };
    for (let index = 0; index < 6; index++) {
      const view = mount({ plugins: [plugin] });
      const node = view.node.at('profile.name');
      expect(getNode(node.props.id)).toBe(node);
      const form = view.el;
      const input = form.elements.namedItem('email');
      const changes = vi.fn();
      view.on('form:change', changes);
      view.destroy();
      view.destroy();
      expect(getNode(node.props.id)).toBeUndefined();
      input.value = 'after@example.com';
      input.dispatchEvent(new Event('input'));
      const submit = new Event('submit', { cancelable: true });
      form.dispatchEvent(submit);
      expect(submit.defaultPrevented).toBe(false);
      expect(changes).not.toHaveBeenCalled();
      expect(active).toBe(0);
    }
    await tick();
    expect(destroyed).toBe(36);
  });

  it('supports native controls, attributes and safe literal labels/options', async() => {
    const view = mount({ fields: [
      { name: 'notes', type: 'textarea', label: '<b>Notes</b>', attrs: { rows: 3, readonly: true } },
      { name: 'size', type: 'number', label: 'Size', value: 2, attrs: { min: 0, max: 10, step: 1 } },
      { name: 'choice', type: 'select', label: 'Choice', options: [
        { value: '', label: 'Choose' }, { value: 'a', label: '<b>A</b>', disabled: true }, { value: 'b', label: 'B' }
      ] },
      { name: 'fixed', type: 'text', label: 'Fixed', attrs: { disabled: true, readonly: false } }
    ] });
    expect(view.el.querySelector('textarea').rows).toBe(3);
    expect(view.el.querySelector('textarea').readOnly).toBe(true);
    edit(view, 'notes', 'Long note');
    edit(view, 'choice', 'b', 'input');
    edit(view, 'size', '5');
    await tick();
    expect(view.getValues()).toEqual({ notes: 'Long note', size: 5, choice: 'b', fixed: '' });
    edit(view, 'size', '');
    await tick();
    expect(view.getValues().size).toBeUndefined();
    expect(view.el.querySelector('b')).toBeNull();
    expect(view.el.querySelector('option[value="a"]').disabled).toBe(true);
    expect(view.el.elements.namedItem('fixed').disabled).toBe(true);
    expect(await view.submit()).toBe('success');
    expect(view.el.elements.namedItem('fixed').disabled).toBe(true);
  });

  it('reports ordinary thrown errors and unknown thrown values', async() => {
    const view = mount({ fields: [], submit() { throw 'failure'; } });
    expect(await view.submit()).toBe('error');
    expect(view.getState().errors).toEqual(['Unable to submit.']);
    view.setErrors();
    expect(view.getState().errors).toEqual([]);
  });

  it('rejects ambiguous field paths and allows same names in separate groups', () => {
    for (const name of ['', 'a.b']) {
      expect(() => mount({ fields: [{ type: 'text', label: 'Name', name }] })).toThrow(/Field names/);
    }
    expect(() => mount({ fields: [
      { type: 'text', label: 'Name', name: 'name' }, { type: 'text', label: 'Name', name: 'name' }
    ] })).toThrow(/Field names/);
    const view = mount({ fields: [
      { type: 'group', label: 'One', name: 'one', children: [{ type: 'text', label: 'Name', name: 'name' }] },
      { type: 'group', label: 'Two', name: 'two', children: [{ type: 'text', label: 'Name', name: 'name' }] }
    ] });
    expect(view.getValues()).toEqual({ one: { name: '' }, two: { name: '' } });
  });
});

it('retains node identity and interaction state while accepting external snapshots with feedback suppression', async() => {
  const view = mount();
  const name = view.el.elements.namedItem('profile.name');
  const node = view.node.at('profile.name');
  const changed = vi.fn();
  view.on('form:change', changed);
  name.focus();
  name.setSelectionRange(1, 2);
  const source = { actor: 'borrowed' };
  view.setValues({ email: 'external@example.com' }, { source });
  expect(view.node.at('profile.name')).toBe(node);
  expect(document.activeElement).toBe(name);
  expect(name.selectionStart).toBe(1);
  expect(view.getValues().profile.name).toBe('Paul');
  expect(changed.mock.lastCall[2].source).toBe(source);
  changed.mockClear();
  view.setValues({ email: 'other@example.com' }, { notify: false });
  await tick();
  expect(changed).not.toHaveBeenCalled();
  expect(view.el.elements.namedItem('email').value).toBe('other@example.com');
  view.setValues({ email: 'other@example.com' });
  expect(changed).not.toHaveBeenCalled();
  edit(view, 'profile.name', 'Edited');
  await tick();
  expect(changed.mock.lastCall[2].source).toBe('user');
  view.resetForm();
  expect(changed.mock.lastCall[2].source).toBe('reset');
  view.destroy();
  expect(view.setValues({})).toBe(view);
});

it('supports programmatic core input before mounting and while a commit is unsettled', async() => {
  const form = new FormView({ fields: [{ type: 'select', name: 'choice', label: 'Choice' },
    { name: 'text', type: 'text', label: 'Text' }] });
  views.push(form);
  form.setValues({ text: 'Before mount' });
  form.setErrors(['Before mount']);
  form.render();
  expect(form.el.elements.namedItem('text').value).toBe('Before mount');
  const input = form.node.at('text').input('After mount');
  form.render();
  await input;
  expect(form.el.elements.namedItem('text').value).toBe('After mount');
  form.destroy();
  expect(() => form.setErrors(['After destroy'])).not.toThrow();
});

it('cancels after validation wait and ignores late successful request completion', async() => {
  let validate;
  const view = mount({ fields: [{ name: 'code', type: 'text', label: 'Code', value: 'ready', validation: 'remote' }],
    validationRules: { remote: () => new Promise(resolve => { validate = resolve; }) } });
  const validation = view.submit();
  await tick();
  view.resetForm();
  validate(true);
  expect(await validation).toBe('cancelled');
  await tick();
  let finish;
  const submitted = vi.fn();
  const request = mount({ values: { email: 'paul@example.com' }, submit: () => new Promise(resolve => { finish = resolve; }) });
  request.on('submit:success', submitted);
  const pending = request.submit();
  await tick();
  request.resetForm();
  finish('Late success');
  expect(await pending).toBe('cancelled');
  await tick();
  expect(submitted).not.toHaveBeenCalled();
});

it('preserves selection through external edits and removes stale validation attributes', async() => {
  const view = mount({ fields: [{ name: 'text', type: 'text', label: 'Text', value: 'Original', validation: 'required' },
    { name: 'email', type: 'email', label: 'Email' }, { name: 'count', type: 'number', label: 'Count', value: 2 }] });
  const text = view.el.elements.namedItem('text');
  text.focus();
  text.setSelectionRange(1, 3, 'backward');
  view.setValues({ text: 'Replacement', count: undefined });
  expect(document.activeElement).toBe(text);
  expect([text.selectionStart, text.selectionEnd, text.selectionDirection]).toEqual([1, 3, 'backward']);
  expect(view.getValues().count).toBeUndefined();
  const email = view.el.elements.namedItem('email');
  email.focus();
  view.setValues({ email: 'outside@example.com' });
  expect(document.activeElement).toBe(email);
  expect(email.value).toBe('outside@example.com');
  view.node.at('text').props.validation = '';
  await tick();
  expect(text.hasAttribute('aria-required')).toBe(false);
});

it('uses native color/range and empty numeric defaults that agree with displayed controls', () => {
  const view = mount({ fields: [
    { name: 'color', type: 'color', label: 'Color' },
    { name: 'range', type: 'range', label: 'Range' },
    { name: 'limited', type: 'range', label: 'Limited', attrs: { min: 0, max: 10, readonly: false, disabled: true } },
    { name: 'number', type: 'number', label: 'Number' }
  ] });
  expect(view.getValues().color).toBe(view.el.elements.namedItem('color').value);
  expect(view.getValues().range).toBe(view.el.elements.namedItem('range').valueAsNumber);
  expect(view.getValues().limited).toBe(view.el.elements.namedItem('limited').valueAsNumber);
  expect(view.getValues().number).toBeUndefined();
});

it('restores keyboard focus after submission unless the user moved to another control', async() => {
  document.body.tabIndex = -1;
  const view = mount({ values: { email: 'paul@example.com' }, submit() { document.body.focus(); } });
  const email = view.el.elements.namedItem('email');
  email.focus();
  expect(await view.submit()).toBe('success');
  expect(document.activeElement).toBe(email);
  const outside = document.body.appendChild(document.createElement('input'));
  const moved = mount({ fields: [], submit() { outside.focus(); } });
  moved.el.querySelector('button').focus();
  expect(await moved.submit()).toBe('success');
  expect(document.activeElement).toBe(outside);
  document.body.removeAttribute('tabindex');
});
