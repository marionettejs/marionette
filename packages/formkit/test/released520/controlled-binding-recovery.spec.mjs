import { diagnostics, metricsOf } from '../diagnostics.mjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';

const owners = [];
function create(fields, values) {
  const host = document.createElement('main');
  document.body.append(host);
  const api = mount({ host, fields, values, [diagnostics]: true, formProps: { actions: false } });
  owners.push(api);
  return { api, host };
}
async function settle(api) {
  await api.node.settled;
  await Promise.resolve();
  await Promise.resolve();
}
async function edit(api, input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(api);
}
afterEach(() => {
  for (const api of owners.splice(0).reverse()) { api.destroy(); }
  document.body.replaceChildren();
});

describe('controlled binding recovery: callback alias and facade boundaries', () => {
  it('forwards a callback-only colon alias like the existing camel control', async() => {
    const camel = vi.fn();
    const colon = vi.fn();
    const control = create([{ name: 'answer', onUpdateModelValue: camel }], { answer: 'Start' });
    const candidate = create([{ name: 'answer', 'onUpdate:modelValue': colon }], { answer: 'Start' });
    await settle(control.api); await settle(candidate.api);
    camel.mockClear(); colon.mockClear();
    await edit(control.api, control.host.querySelector('input'), 'Edited');
    await edit(candidate.api, candidate.host.querySelector('input'), 'Edited');
    expect(camel.mock.calls).toEqual([['Edited']]);
    expect(colon.mock.calls).toEqual(camel.mock.calls);
  });

  it('calls each alias once when both are supplied', async() => {
    const camel = vi.fn(); const colon = vi.fn();
    const { api, host } = create([{ name: 'answer', onUpdateModelValue: camel, 'onUpdate:modelValue': colon }], { answer: 'Start' });
    await settle(api); camel.mockClear(); colon.mockClear();
    await edit(api, host.querySelector('input'), 'Edited');
    expect(camel.mock.calls).toEqual([['Edited']]);
    expect(colon.mock.calls).toEqual([['Edited']]);
  });

  it('preserves the already modeled colon-alias update path', async() => {
    const callback = vi.fn();
    const { api, host } = create([{ name: 'answer', modelValue: 'Start', 'onUpdate:modelValue': callback }], { answer: 'Start' });
    await settle(api); callback.mockClear();
    const node = api.node.at('answer'); const input = host.querySelector('input');
    await edit(api, input, 'Edited');
    api.setFields([{ name: 'answer', modelValue: 'External', 'onUpdate:modelValue': callback }]);
    await settle(api);
    expect(callback.mock.calls).toEqual([['Edited'], ['External']]);
    expect(api.node.at('answer')).toBe(node); expect(host.querySelector('input')).toBe(input);
  });

  it.each(['onUpdateModelValue', 'onUpdate:modelValue'])('keeps %s commit callbacks separate from notify:false form events', async callbackKey => {
    const callback = vi.fn();
    const { api } = create([{ name: 'answer', [callbackKey]: callback }], { answer: 'Start' });
    await settle(api); callback.mockClear();
    const changed = vi.fn(); api.form.on('form:change', changed);
    api.setValues({ answer: 'External' }, { notify: false });
    await settle(api);
    expect(api.getValues()).toEqual({ answer: 'External' });
    expect(callback.mock.calls).toEqual([['External']]);
    expect(changed).not.toHaveBeenCalled();
    api.setValues({ answer: 'External' }, { notify: false });
    await settle(api);
    expect(callback).toHaveBeenCalledTimes(1);
    api.setValues({ answer: 'Notified' }, { source: 'server' });
    await settle(api);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][0]).toEqual({ answer: 'Notified' });
    expect(changed.mock.calls[0][2]).toEqual({ source: 'server' });
  });

  it.each(['group', 'list'])('retains a %s child owner and edited value while its callback-only alias runs', async type => {
    const callback = vi.fn();
    const child = { ...(type === 'group' ? { name: 'answer' } : {}), key: 'stable', 'onUpdate:modelValue': callback };
    const fields = [{ name: 'box', type, children: [child] }];
    const values = { box: type === 'group' ? { answer: 'Start' } : ['Start'] };
    const { api, host } = create(fields, values);
    await settle(api); callback.mockClear();
    const path = type === 'group' ? 'box.answer' : 'box.0';
    const node = api.node.at(path); const input = host.querySelector('input');
    await edit(api, input, 'Edited');
    api.setFields([{ ...fields[0], children: [{ ...child, label: 'Updated' }] }]);
    await settle(api);
    expect(callback.mock.calls).toEqual([['Edited']]);
    expect(api.node.at(path)).toBe(node); expect(host.querySelector('input')).toBe(input);
    expect(api.getValues()).toEqual({ box: type === 'group' ? { answer: 'Edited' } : ['Edited'] });
  });

  it('honors disposal from a callback-only alias and removes the old DOM listener', async() => {
    let api;
    const callback = vi.fn(value => { if (value === 'Edited') { api.destroy(); } });
    const result = create([{ name: 'answer', 'onUpdate:modelValue': callback }], { answer: 'Start' });
    api = result.api; await settle(api); callback.mockClear();
    const input = result.host.querySelector('input');
    await edit(api, input, 'Edited');
    expect(callback.mock.calls).toEqual([['Edited']]);
    expect(api.form.isDestroyed()).toBe(true);
    expect(metricsOf(api).coreNodesCreated).toBe(metricsOf(api).coreNodesDestroyed);
    input.value = 'Late'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
