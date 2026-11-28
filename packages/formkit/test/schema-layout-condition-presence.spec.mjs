import { diagnostics, metricsOf } from './diagnostics.mjs';
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';

const owners = [];
afterEach(() => {
  for (const api of owners.splice(0).reverse()) { api.destroy(); }
  document.body.replaceChildren();
});
function create(kind, condition) {
  const host = document.createElement('main');
  document.body.append(host);
  const wrapper = kind === 'element' ? { $el: 'section' } : { $cmp: 'Card' };
  if (condition !== 'omitted') { wrapper.if = condition; }
  wrapper.children = [{ $formkit: 'text', name: 'requiredField', label: 'Required field', validation: 'required' }];
  const submitted = vi.fn(), invalid = vi.fn();
  const api = mount({
    host, schema: [wrapper], [diagnostics]: true, formProps: { actions: false },
    onSubmit: submitted, onSubmitInvalid: invalid,
    components: {
      Card({ host: target, renderChildren }) {
        const section = document.createElement('section');
        target.append(section);
        const dispose = renderChildren(section);
        return { destroy(remove = true) {
          dispose(remove);
          if (remove) { section.remove(); }
        } };
      }
    }
  });
  owners.push(api);
  return { api, host, submitted, invalid };
}
it.each(['element', 'component'])('does not create a required Core child below a literal-false %s wrapper', async kind => {
  const { api, host } = create(kind, false);
  await api.whenPendingEditsSettled();
  expect({
    hasWrapper: host.querySelector('section') !== null,
    hasInput: host.querySelector('input') !== null,
    hasCoreNode: api.node.at('requiredField') !== undefined,
    values: api.getValues()
  }).toEqual({ hasWrapper: false, hasInput: false, hasCoreNode: false, values: {} });
  await vi.waitFor(() => expect(api.getFormState().valid).toBe(true));
  api.destroy();
  expect(metricsOf(api).coreNodesCreated).toBe(metricsOf(api).coreNodesDestroyed);
});
it.each(['element', 'component'])('does not let an invisible required child block submit under a literal-false %s wrapper', async kind => {
  const { api, submitted, invalid } = create(kind, false);
  await api.whenPendingEditsSettled();
  await api.submit();
  await vi.waitFor(() => expect(submitted.mock.calls.length + invalid.mock.calls.length).toBe(1));
  expect({ submitted: submitted.mock.calls.length, invalid: invalid.mock.calls.length }).toEqual({ submitted: 1, invalid: 0 });
  expect(submitted.mock.calls[0][0]).toEqual({});
});
it.each([
  ['element', true], ['element', 'omitted'],
  ['component', true], ['component', 'omitted']
])('retains required validation and normal DOM correction for a %s wrapper with condition %s', async(kind, condition) => {
  const { api, host, submitted, invalid } = create(kind, condition);
  await api.whenPendingEditsSettled();
  const node = api.node.at('requiredField');
  const input = host.querySelector('section input');
  expect(node).toBeDefined();
  expect(input).not.toBeNull();
  await vi.waitFor(() => expect(api.getFormState().valid).toBe(false));
  await api.submit();
  await vi.waitFor(() => expect(invalid).toHaveBeenCalledTimes(1));
  expect(submitted).not.toHaveBeenCalled();
  input.value = 'Synthetic complete';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await api.whenPendingEditsSettled();
  await vi.waitFor(() => expect(api.getFormState().valid).toBe(true));
  expect(api.node.at('requiredField')).toBe(node);
  expect(host.querySelector('section input')).toBe(input);
  await api.submit();
  await vi.waitFor(() => expect(submitted).toHaveBeenCalledTimes(1));
  expect(submitted.mock.calls[0][0]).toEqual({ requiredField: 'Synthetic complete' });
  expect(invalid).toHaveBeenCalledTimes(1);
});
