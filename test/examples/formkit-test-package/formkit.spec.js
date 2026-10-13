import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { within, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { Application } from 'marionette';
import { FieldView, FormView, SubmissionError } from '@mnjs/formkit';
import { getNode } from '@formkit/core';
import { createTestScope, mountApplication, mountView } from '@mnjs/test';

let scope;
beforeEach(() => { scope = createTestScope(); });
afterEach(async() => { await scope.cleanup(); vi.restoreAllMocks(); });

const profile = { name: 'Ada', email: 'ada@example.test' };
function createForm(options = {}) {
  return new FormView({
    fields: [
      { type: 'text', name: 'name', label: 'Name', validation: 'required' },
      { type: 'email', name: 'email', label: 'Email', validation: 'required|email' }
    ],
    values: profile, config: { delay: 0 }, ...options
  });
}
async function settle(form) {
  await form.node.settled;
  await form.node.ledger.settled('validating');
}
function registryIds(form) {
  const ids = [form.node.props.id, ...[...form.el.querySelectorAll('[id]')].map(el => el.id)]
    .filter(id => id && getNode(id));
  expect(ids.length).toBeGreaterThanOrEqual(3);
  return [...new Set(ids)];
}

describe('actual @mnjs/formkit through @mnjs/test', () => {
  it('renders native controls, commits input and validates before submitting', async() => {
    const submit = vi.fn();
    const form = createForm({ values: { name: '', email: '' }, submit });
    const mounted = scope.own(mountView(form));
    const query = within(mounted.container);
    const user = userEvent.setup({ document: mounted.container.ownerDocument });
    expect(mounted.view).toBeInstanceOf(FormView);
    expect(mounted.region.currentView).toBe(form);
    expect(mounted.el.tagName).toBe('FORM');
    expect(form.isAttached()).toBe(true);
    await expect(form.submit()).resolves.toBe('invalid');
    expect(submit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(query.getByRole('textbox', { name: 'Name' }));
    expect(form.getFormState().valid).toBe(false);
    await user.type(query.getByRole('textbox', { name: 'Name' }), 'Grace');
    await user.type(query.getByRole('textbox', { name: 'Email' }), 'grace@example.test');
    await expect(form.submit()).resolves.toBe('success');
    expect(form.getValues()).toEqual({ name: 'Grace', email: 'grace@example.test' });
    expect(submit).toHaveBeenCalledExactlyOnceWith(form.getValues(), expect.objectContaining({ node: form.node }));
  });

  it('retains the actual input, draft and focus across public rerender', async() => {
    const mounted = scope.own(mountView(createForm()));
    const query = within(mounted.container);
    const input = query.getByRole('textbox', { name: 'Name' });
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'Grace');
    await settle(mounted.view);
    input.focus();
    mounted.view.render();
    expect(query.getByRole('textbox', { name: 'Name' })).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Grace');
    expect(mounted.view.getValues().name).toBe('Grace');
  });

  it('reacts to native checkbox changes through an official schema condition', async() => {
    const form = new FormView({
      config: { delay: 0 }, values: { enabled: false },
      schema: [
        { $formkit: 'checkbox', name: 'enabled', label: 'Add details', id: 'mnjs-dogfood-enabled' },
        { $formkit: 'text', name: 'note', label: 'Details', preserve: true,
          if: '$get("mnjs-dogfood-enabled").value' }
      ]
    });
    const mounted = scope.own(mountView(form));
    const query = within(mounted.container);
    const user = userEvent.setup();
    expect(query.queryByRole('textbox', { name: 'Details' })).toBeNull();
    await user.click(query.getByRole('checkbox', { name: 'Add details' }));
    await waitFor(() => expect(query.getByRole('textbox', { name: 'Details' })).toBeDefined());
    await user.type(query.getByRole('textbox', { name: 'Details' }), 'Retained draft');
    await settle(form);
    expect(form.getValues()).toMatchObject({ enabled: true, note: 'Retained draft' });
    await user.click(query.getByRole('checkbox', { name: 'Add details' }));
    await waitFor(() => expect(query.queryByRole('textbox', { name: 'Details' })).toBeNull());
    expect(form.getValues().note).toBe('Retained draft');
    await user.click(query.getByRole('checkbox', { name: 'Add details' }));
    await waitFor(() => expect(query.getByRole('textbox', { name: 'Details' }).value).toBe('Retained draft'));
  });

  it('preserves actionable submission errors and supports explicit retry', async() => {
    const error = new SubmissionError('Unable to save.', { email: ['Use another email.'] });
    let attempts = 0;
    const form = createForm({ submit() { if (++attempts === 1) { throw error; } return 'saved'; } });
    const failures = [];
    form.on('submit:error', failure => failures.push(failure));
    const mounted = scope.own(mountView(form));
    await expect(form.submit()).resolves.toBe('error');
    expect(failures).toEqual([error]);
    expect(failures[0]).toBe(error);
    expect(form.getFormState().errors).toEqual(['Unable to save.']);
    expect(within(mounted.container).getByText('Use another email.')).toBeDefined();
    expect(form.getValues()).toEqual(profile);
    await expect(form.submit()).resolves.toBe('success');
    expect(attempts).toBe(2);
    expect(form.getFormState().errors).toEqual([]);
  });

  it('reset cancels pending submission and restores the construction snapshot', async() => {
    const entered = Promise.withResolvers();
    const pending = Promise.withResolvers();
    let signal;
    const form = createForm({ submit(values, context) { signal = context.signal; entered.resolve(values); return pending.promise; } });
    const mounted = scope.own(mountView(form));
    const resets = [];
    const successes = [];
    form.on('form:reset', values => resets.push(values));
    form.on('submit:success', values => successes.push(values));
    form.setValues({ name: 'Edited' });
    const submitting = form.submit();
    await expect(entered.promise).resolves.toEqual({ ...profile, name: 'Edited' });
    expect(form.getFormState().submitting).toBe(true);
    form.resetForm();
    expect(signal.aborted).toBe(true);
    await expect(submitting).resolves.toBe('cancelled');
    expect(form.getValues()).toEqual(profile);
    expect(form.getFormState()).toMatchObject({ submitting: false, submitted: false, errors: [] });
    expect(within(mounted.container).getByRole('textbox', { name: 'Name' }).value).toBe('Ada');
    expect(resets).toEqual([profile]);
    pending.resolve('obsolete');
    await pending.promise;
    expect(successes).toEqual([]);
  });

  it('a live native edit cancels a submitted snapshot without repeating the callback', async() => {
    const entered = Promise.withResolvers();
    const pending = Promise.withResolvers();
    let signal;
    const submit = vi.fn((values, context) => { signal = context.signal; entered.resolve(); return pending.promise; });
    const form = createForm({ formProps: { submitBehavior: 'live' }, submit });
    const mounted = scope.own(mountView(form));
    const submitting = form.submit();
    await entered.promise;
    const user = userEvent.setup();
    await user.type(within(mounted.container).getByRole('textbox', { name: 'Name' }), '!');
    await expect(submitting).resolves.toBe('cancelled');
    expect(signal.aborted).toBe(true);
    expect(form.getValues().name).toBe('Ada!');
    expect(submit).toHaveBeenCalledOnce();
    pending.resolve('obsolete');
    await pending.promise;
  });

  it('Application cleanup destroys the actual form and suppresses a late submission result', async() => {
    const entered = Promise.withResolvers();
    const pending = Promise.withResolvers();
    let signal;
    const Feature = Application.extend({
      prepareStart() { return profile; },
      onStart(app, options, values) {
        this.showView(createForm({ values, submit(snapshot, context) {
          signal = context.signal; entered.resolve(snapshot); return pending.promise;
        } }));
      }
    });
    const mounted = scope.own(mountApplication(() => new Feature()));
    await expect(mounted.ready).resolves.toBe(true);
    const form = mounted.app.getView();
    const ids = registryIds(form);
    const submitting = form.submit();
    await expect(entered.promise).resolves.toEqual(profile);
    await mounted.cleanup();
    expect(signal.aborted).toBe(true);
    await expect(submitting).resolves.toBe('cancelled');
    expect(form.isDestroyed()).toBe(true);
    expect(mounted.app.isDestroyed()).toBe(true);
    expect(mounted.region.isDestroyed()).toBe(true);
    expect(mounted.el).toBeUndefined();
    expect(mounted.container.isConnected).toBe(false);
    for (const id of ids) { expect(getNode(id)).toBeUndefined(); }
    const notifications = vi.spyOn(form, 'triggerMethod');
    pending.resolve('obsolete');
    await pending.promise;
    expect(notifications).not.toHaveBeenCalled();
    const next = scope.own(mountView(createForm({ values: { name: 'New', email: 'new@example.test' } })));
    expect(next.view.getValues().name).toBe('New');
  });

  it('ordinary nested Region ownership ends group and child fields', async() => {
    class NestedForm extends FormView {
      onRender() {
        const group = new FieldView({ form: this, name: 'profile', removal: 'preserve',
          input: { type: 'group', slots: { default: () => ({ $el: 'div', attrs: { 'data-name-slot': '' } }) } },
          regions: { name: '[data-name-slot]' } });
        this.showChildView('profile', group);
        group.showChildView('name', new FieldView({ form: this, parent: group.node, name: 'name', removal: 'preserve',
          input: { type: 'text', label: 'Nested name', config: { delay: 0 } } }));
      }
    }
    const form = new NestedForm({ template: () => '<fieldset><legend>Profile</legend><div data-profile></div></fieldset>',
      regions: { profile: '[data-profile]' }, values: { profile: { name: 'Ada' } } });
    const mounted = scope.own(mountView(form));
    const group = form.getChildView('profile');
    const child = group.getChildView('name');
    const ids = [form.node.props.id, group.node.props.id, child.node.props.id];
    expect(child.node.parent).toBe(group.node);
    expect(group.node.root).toBe(form.node);
    await userEvent.setup().type(within(mounted.container).getByRole('textbox', { name: 'Nested name' }), '!');
    await settle(form);
    expect(form.getValues()).toEqual({ profile: { name: 'Ada!' } });
    await mounted.cleanup();
    expect(group.isDestroyed()).toBe(true);
    expect(child.isDestroyed()).toBe(true);
    for (const id of ids) { expect(getNode(id)).toBeUndefined(); }
  });

  it('preserves a borrowed host while ending retained native-control handlers', async() => {
    const host = document.body.appendChild(document.createElement('section'));
    const sibling = host.appendChild(document.createElement('button'));
    const click = vi.fn();
    sibling.addEventListener('click', click);
    scope.defer(() => host.remove());
    const mounted = scope.own(mountView(createForm(), { container: host }));
    const input = within(host).getByRole('textbox', { name: 'Name' });
    const ids = registryIds(mounted.view);
    await mounted.cleanup();
    expect(host.isConnected).toBe(true);
    expect([...host.children]).toEqual([sibling]);
    expect(host.firstElementChild).toBe(sibling);
    host.firstElementChild.click();
    expect(click).toHaveBeenCalledOnce();
    const notifications = vi.spyOn(mounted.view, 'triggerMethod');
    input.value = 'Obsolete';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    expect(notifications).not.toHaveBeenCalled();
    for (const id of ids) { expect(getNode(id)).toBeUndefined(); }
  });
});
