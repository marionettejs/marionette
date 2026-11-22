import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';
import { getValidationMessages } from '@formkit/validation';
const owners = [];
afterEach(() => { for (const api of owners.splice(0).reverse()) { api.destroy(); } document.body.replaceChildren(); vi.useRealTimers(); });
function create() {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields: [
    { name: 'feature', type: 'group', children: [{ name: 'name' }, { name: 'npi', validation: 'required', config: { delay: 20 } }] },
    { name: 'outside' },
  ], values: { feature: { name: 'Name', npi: '123', retired: 'Old metadata' }, outside: 'Untouched' }, formProps: { actions: false } });
  owners.push(api); return api;
}
it('retains existing deep-merge behavior by default', () => {
  const api = create(); api.setValues({ feature: { name: 'Next' } }, { notify: false });
  expect(api.getValues()).toEqual({ feature: { name: 'Next', npi: '123', retired: 'Old metadata' }, outside: 'Untouched' });
});
it('replaces provided branches and clears omitted owned inputs without clearing unrelated branches', async() => {
  const api = create(), child = api.node.at('feature.npi'), element = document.getElementById(child.props.id);
  const patch = { feature: { name: 'Next' } }, before = structuredClone(patch);
  api.setValues(patch, { merge: false, notify: false }); await api.whenPendingEditsSettled();
  expect(api.getValues()).toEqual({ feature: { name: 'Next', npi: undefined }, outside: 'Untouched' });
  expect(child.value).toBeUndefined(); expect(element.value).toBe(''); expect(api.node.at('feature.npi')).toBe(child);
  expect(document.getElementById(child.props.id)).toBe(element); expect(patch).toEqual(before);
});
it('keeps no-echo provenance and unchanged focus/selection during replacement', async() => {
  const api = create(), facts = [], changes = []; api.observeFieldCommits(fact => facts.push(fact));
  api.form.on('form:change', (...args) => changes.push(args));
  const outside = document.getElementById(api.node.at('outside').props.id); outside.focus(); outside.setSelectionRange(1, 4);
  api.setValues({ feature: { name: 'Next' } }, { merge: false, notify: false }); await api.whenPendingEditsSettled();
  expect(facts.length).toBeGreaterThan(0); expect(facts.every(fact => fact.source === 'programmatic')).toBe(true);
  expect(changes).toEqual([]); expect(document.activeElement).toBe(outside);
  expect([outside.selectionStart, outside.selectionEnd]).toEqual([1, 4]);
});
it('replaces nested list-row fields while retaining explicitly declared Core owners', async() => {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, schema: [{ $formkit: 'list', name: 'rows', sync: false, children: [
    { $formkit: 'group', key: 'a', index: 0, children: [{ $formkit: 'text', name: 'optional' }] },
  ] }], values: { rows: [{ optional: 'Old', retired: true }] }, formProps: { actions: false } }); owners.push(api);
  const child = api.node.at('rows.0.optional'); api.setValues({ rows: [{}] }, { merge: false, notify: false });
  await api.whenPendingEditsSettled(); expect(api.getValues()).toEqual({ rows: [{ optional: undefined }] });
  expect(api.node.at('rows.0.optional')).toBe(child);
});
it('supports the same replacement policy through the fenced projection controller', async() => {
  vi.useFakeTimers(); const api = create(), facts = []; api.observeFieldCommits(fact => facts.push(fact));
  api.node.at('feature.npi').input('Pending');
  const projection = api.createValueProjection({ read: () => ({ feature: { name: 'Canonical' } }), merge: false });
  const operation = projection.request(); await vi.advanceTimersByTimeAsync(20); await operation;
  expect(api.getValues()).toEqual({ feature: { name: 'Canonical', npi: undefined }, outside: 'Untouched' });
  expect(facts.filter(fact => fact.source === 'unknown').map(fact => fact.value)).toEqual(['Pending']);
});
it('recomputes required validation and preserves reset defaults after replacement', async() => {
  const api = create(); api.setValues({ feature: { name: 'Next' } }, { merge: false, notify: false });
  const npi = api.node.at('feature.npi');
  await vi.waitFor(() => expect(getValidationMessages(api.node).get(npi)?.some(message => message.key === 'rule_required')).toBe(true));
  expect(api.getFormState().valid).toBe(false);
  api.reset(); await api.whenPendingEditsSettled(); expect(api.node.at('feature.npi').value).toBe('123');
});
it('preserves the original public middleware error without inventing rollback', () => {
  const api = create(), marker = new Error('input middleware');
  api.node.at('feature.name').hook.input.unshift(() => { throw marker; });
  expect(() => api.setValues({ feature: { name: 'Next' } }, { merge: false, notify: false })).toThrow(marker);
});

it('does not repeat writes or change notifications for an equivalent completed replacement', async() => {
  const api = create(), changes = []; api.form.on('form:change', values => changes.push(values));
  api.setValues({ feature: { name: 'Next' } }, { merge: false }); await api.whenPendingEditsSettled();
  expect(changes).toHaveLength(1);
  api.setValues({ feature: { name: 'Next' } }, { merge: false }); await api.whenPendingEditsSettled();
  expect(changes).toHaveLength(1);
});
