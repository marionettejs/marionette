import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView, RowView, SubmissionError } from '@mnjs/formkit';

const owners = [];
const drain = async() => { for (let index = 0; index < 12; index++) { await Promise.resolve(); } };
function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function mount(options) {
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(owner);
  const form = new FormView(options); owner.show(form);
  return { form, owner };
}
function textForm(submit, extra = {}) {
  return mount({ fields: [{ name: 'title', type: 'text', label: 'Title' }], values: { title: 'Before' }, submit, ...extra });
}
afterEach(() => { owners.splice(0).forEach(owner => owner.destroy()); document.body.replaceChildren(); });

it.each(['resolve', 'reject'])('cancels obsolete callback %s after a semantic value write and allows explicit retry', async outcome => {
  const response = deferred(); const started = deferred(); const success = vi.fn(); const error = vi.fn();
  let signal;
  const callback = vi.fn((values, context) => {
    signal = context.signal; started.resolve(); return response.promise;
  });
  const { form } = textForm(callback);
  form.on('submit:success', success); form.on('submit:error', error);
  const attempt = form.submit(); await started.promise;
  expect(callback.mock.calls[0][0]).toEqual({ title: 'Before' });
  expect(await form.submit()).toBe('busy');
  form.setValues({ title: 'After' }, { notify: false });
  expect(await attempt).toBe('cancelled'); expect(signal.aborted).toBe(true);
  if (outcome === 'resolve') { response.resolve('old accepted'); } else {
    response.reject(new SubmissionError('Old rejected', { title: ['Old field error'] }));
  }
  await drain();
  expect(success).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  expect(form.getState().errors).toEqual([]);
  callback.mockImplementation(() => 'fresh accepted');
  expect(await form.submit()).toBe('success');
  expect(callback.mock.calls[1][0]).toEqual({ title: 'After' });
});

it('cancels an ABA value change rather than accepting the restored old snapshot', async() => {
  const response = deferred(); const started = deferred();
  const { form } = textForm(() => { started.resolve(); return response.promise; });
  const attempt = form.submit(); await started.promise;
  form.setValues({ title: 'Changed' }); form.setValues({ title: 'Before' });
  response.resolve(); expect(await attempt).toBe('cancelled');
});

it('does not cancel unchanged writes or placement-only detach and reattach', async() => {
  const response = deferred(); const started = deferred(); let signal;
  const { form, owner } = textForm((values, context) => { signal = context.signal; started.resolve(); return response.promise; });
  const attempt = form.submit(); await started.promise;
  form.setValues({ title: 'Before' });
  const detached = owner.detachView(); expect(detached).toBe(form); owner.show(form);
  response.resolve('accepted'); expect(await attempt).toBe('success'); expect(signal.aborted).toBe(false);
});

it('settles values changed by raw-submit handlers before invoking the callback exactly once', async() => {
  const saved = vi.fn(); let form;
  ({ form } = textForm(saved, { formProps: { onSubmitRaw: () => form.setValues({ title: 'Raw edit' }) } }));
  expect(await form.submit()).toBe('success'); expect(saved).toHaveBeenCalledTimes(1);
  expect(saved.mock.calls[0][0]).toEqual({ title: 'Raw edit' });
});

it('rechecks validation added by a raw-submit handler before exposing a snapshot', async() => {
  const saved = vi.fn(); let form;
  ({ form } = textForm(saved, { values: { title: '' }, formProps: { onSubmitRaw: () => {
    form.node.at('title').props.validation = 'required';
  } } }));
  expect(await form.submit()).toBe('invalid'); expect(saved).not.toHaveBeenCalled();
  expect(form.el.querySelector('[aria-invalid="true"]')).not.toBeNull();
});

it('waits for an unchanged asynchronous group write from the raw-submit handler', async() => {
  const saved = vi.fn();
  let form;
  let completed = false;
  ({ form } = textForm(saved, { config: { delay: 20 }, formProps: { onSubmitRaw: () => {
    void form.node.input(form.getValues()).then(() => { completed = true; });
  } } }));
  expect(await form.submit()).toBe('success'); expect(completed).toBe(true); expect(saved).toHaveBeenCalledTimes(1);
});

it('cancels a raw-submit reset before invoking an external callback', async() => {
  const saved = vi.fn();
  let form;
  ({ form } = textForm(saved, { formProps: { onSubmitRaw: () => form.resetForm() } }));
  expect(await form.submit()).toBe('cancelled'); expect(saved).not.toHaveBeenCalled();
});

it('keeps ignored control values and validation outside the canonical callback snapshot', async() => {
  const response = deferred();
  const started = deferred();
  const { form } = textForm(() => { started.resolve(); return response.promise; });
  const ignored = new FieldView({ form, name: 'scratch', removal: 'preserve',
    input: { type: 'text', ignore: true, value: 'Initial', validation: 'required' } });
  ignored.render();
  const attempt = form.submit(); await started.promise;
  void ignored.node.input('Scratch edit', false);
  response.resolve(); expect(await attempt).toBe('success');
  expect(form.getValues()).toEqual({ title: 'Before' });
  form.destroy(); expect(ignored.isDestroyed()).toBe(true);
});

it('cancels a synchronous field destruction inside the callback', async() => {
  let field; const success = vi.fn();
  const { form } = mount({ template: () => '<div data-title></div>', regions: { title: '[data-title]' },
    values: { title: 'Before' }, submit: () => { field.destroy(); return 'saved'; } });
  field = new FieldView({ form, name: 'title', removal: 'preserve', input: { type: 'text' } });
  form.showChildView('title', field); form.on('submit:success', success);
  expect(await form.submit()).toBe('cancelled'); expect(success).not.toHaveBeenCalled();
  expect(form.getValues()).toEqual({ title: 'Before' });
});

it('does not invoke the external callback when a submit hook changes actual values', async() => {
  const saved = vi.fn();
  const { form } = textForm(saved, { plugins: [node => {
    if (node.props.type === 'form') {
      node.hook.submit((values, next) => {
        void node.input({ title: 'Changed in hook' }, false); return next(values);
      });
    }
  }] });
  expect(await form.submit()).toBe('cancelled'); expect(saved).not.toHaveBeenCalled();
});

it('cancels changed validation constraints after callback capture', async() => {
  const response = deferred(); const started = deferred();
  const { form } = textForm(() => { started.resolve(); return response.promise; });
  const attempt = form.submit(); await started.promise;
  form.node.at('title').props.validation = 'required'; response.resolve();
  expect(await attempt).toBe('cancelled');
});

it.each([1, 30])('cancels an observed custom constraint change to %s even when it remains valid', async limit => {
  const response = deferred();
  const started = deferred();
  const { form } = mount({ template: () => '<div data-title></div>', regions: { title: '[data-title]' },
    values: { title: 'Before' }, validationRules: { within: node => String(node.value).length < Number(node.props.limit) },
    submit: () => { started.resolve(); return response.promise; } });
  const field = new FieldView({ form, name: 'title', removal: 'preserve',
    input: { type: 'text', validation: 'within', limit: 20 } });
  form.showChildView('title', field);
  const attempt = form.submit(); await started.promise;
  field.setInput({ limit }); response.resolve();
  expect(await attempt).toBe('cancelled');
  await field.node.ledger.settled('validating');
  expect(form.getState().valid).toBe(limit === 30);
});

it('keeps presentation updates and ignored action churn outside callback cancellation', async() => {
  const response = deferred();
  const started = deferred();
  const { form } = textForm(() => { started.resolve(); return response.promise; });
  const attempt = form.submit(); await started.promise;
  const title = form.node.at('title'); title.props.label = 'Updated title'; title.props.help = 'Updated help';
  const action = new FieldView({ form, name: 'action', removal: 'preserve', input: { type: 'submit', label: 'Extra action' } });
  action.render(); action.setInput({ label: 'Updated action' }); action.destroy();
  response.resolve(); expect(await attempt).toBe('success');
});

it('cannot deliver old numeric errors to a replacement business row', async() => {
  const response = deferred(); const started = deferred();
  const { form } = mount({ template: () => '<div data-list></div><div data-row></div>',
    regions: { list: '[data-list]', row: '[data-row]' }, values: { rows: [{ id: 'a', name: 'Alpha' }] },
    submit: () => { started.resolve(); return response.promise; } });
  const list = new FieldView({ form, name: 'rows', removal: 'preserve', input: { type: 'list', dynamic: true, itemKey: 'id' } });
  form.showChildView('list', list);
  const row = key => {
    const placement = new RowView({ form, parent: list.node, rowKey: key, removal: 'preserve',
      template: () => '<div data-name></div>', regions: { name: '[data-name]' } });
    form.showChildView('row', placement);
    const field = new FieldView({ form, parent: placement.node, name: 'name', removal: 'preserve', input: { type: 'text' } });
    placement.showChildView('name', field); return { placement, field };
  };
  const first = row('a'); const attempt = form.submit(); await started.promise;
  form.setValues({ rows: [{ id: 'b', name: 'Beta' }] }); const second = row('b');
  expect(first.placement.isDestroyed()).toBe(true);
  response.reject(new SubmissionError('A rejected', { 'rows.0.name': ['A name rejected'] }));
  expect(await attempt).toBe('cancelled'); await drain();
  expect(form.getState().errors).toEqual([]); expect(second.field.node.context.messages).toEqual({});
});

it.each(['reset', 'destroy'])('ends a captured callback on %s and suppresses later failures', async lifetime => {
  const response = deferred(); const started = deferred(); const error = vi.fn();
  const { form } = textForm(() => { started.resolve(); return response.promise; }); form.on('submit:error', error);
  const attempt = form.submit(); await started.promise;
  if (lifetime === 'reset') { form.resetForm(); } else { form.destroy(); }
  expect(await attempt).toBe('cancelled'); response.reject(new Error('obsolete')); await drain();
  expect(error).not.toHaveBeenCalled();
});
