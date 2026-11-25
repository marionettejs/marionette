import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';

const owners = [];
afterEach(() => {
  try { for (const api of owners.splice(0).reverse()) { api.destroy(); } }
  finally { document.body.replaceChildren(); vi.useRealTimers(); }
});
function create(candidate, options = {}) {
  const host = document.createElement('main'); document.body.append(host);
  let current;
  const submitted = [];
  const api = mount({
    host, instrument: true, formProps: { actions: false }, data: { candidate },
    schema: [
      { $formkit: 'text', name: '$candidate', key: 'renamed', id: 'dynamic-name-input',
        label: 'Dynamic name', config: { delay: 80 }, onNode: node => { current = node; } },
      { $formkit: 'text', name: 'sibling', id: 'dynamic-name-sibling' }
    ],
    onSubmit: values => submitted.push(structuredClone(values)),
    ...options
  });
  owners.push(api);
  return { api, host, submitted, current: () => current };
}
function type(input, value) {
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
}
async function settle(api) {
  const fence = api.whenPendingEditsSettled();
  await vi.runAllTimersAsync();
  await fence;
}
it.each([undefined, null, ''])('renders an anonymous input when the name expression resolves to %s', async candidate => {
  const { api, host, current } = create(candidate);
  await api.whenPendingEditsSettled();
  const node = current(), input = host.querySelector('#dynamic-name-input');
  expect(node).toBeDefined(); expect(input).not.toBeNull();
  expect(typeof node.name).toBe('string'); expect(node.name.length).toBeGreaterThan(0);
  expect(input.name).toBe(node.name);
  expect(api.node.at(node.name)).toBe(node);
  expect(host.querySelectorAll('input')).toHaveLength(2);
  api.destroy(); expect(api.metrics.coreNodesCreated).toBe(api.metrics.coreNodesDestroyed);
});
it('keeps a numeric zero expression a named field', async() => {
  const { api, host, current } = create(0);
  await api.whenPendingEditsSettled();
  expect(current().name).toBe('0');
  expect(api.node.at('0')).toBe(current());
  expect(host.querySelector('#dynamic-name-input').name).toBe('0');
});
it('does not evaluate dollar-prefixed names passed through direct native fields', async() => {
  const { api, host } = create('Unused', { schema: undefined, fields: [{ name: '$candidate', id: 'literal-native-name' }] });
  await api.whenPendingEditsSettled();
  expect(api.node.at('$candidate')).toBeDefined();
  expect(host.querySelector('#literal-native-name').name).toBe('$candidate');
});
it.each([null, ''])('retains the existing rejection of literal schema name %s', literal => {
  expect(() => create('Unused', { schema: [{ $formkit: 'text', name: literal }] })).toThrow(TypeError);
});
it.each([false, { bad: 'name' }])('retains rejection of an unrelated invalid expression result %s', candidate => {
  expect(() => create(candidate)).toThrow(TypeError);
});
it('preserves a raw dollar-prefixed schema name without evaluating it', async() => {
  const { api } = create('Ignored', { schema: [{ $formkit: 'text', __raw__name: '$candidate' }] });
  await api.whenPendingEditsSettled();
  expect(api.node.at('$candidate')).toBeDefined();
});
it('retains one anonymous owner and pending edit across empty, undefined and null expression results', async() => {
  vi.useFakeTimers();
  const { api, host, current } = create('');
  const facts = []; api.observeFieldCommits(fact => facts.push(fact));
  await settle(api);
  const node = current(), input = host.querySelector('#dynamic-name-input');
  type(input, 'Anonymous first'); await settle(api);
  const generation = facts.find(fact => fact.node === node && fact.value === 'Anonymous first').generation;
  type(input, 'Anonymous pending');
  expect(node.isSettled).toBe(false);
  const pending = api.whenPendingEditsSettled();
  api.updateData({ candidate: undefined });
  expect(current()).toBe(node); expect(host.querySelector('#dynamic-name-input')).toBe(input);
  await vi.advanceTimersByTimeAsync(80); await pending;
  expect(node.value).toBe('Anonymous pending');
  api.updateData({ candidate: null }); await settle(api);
  expect(current()).toBe(node); expect(host.querySelector('#dynamic-name-input')).toBe(input);
  type(input, 'Anonymous next'); await settle(api);
  expect(facts.filter(fact => fact.node === node && fact.source === 'unknown').map(fact => [fact.value, fact.generation])).toEqual([
    ['Anonymous first', generation], ['Anonymous pending', generation], ['Anonymous next', generation]
  ]);
  expect(api.getValues()[node.name]).toBe('Anonymous next');
  api.destroy(); expect(api.metrics.coreNodesCreated).toBe(api.metrics.coreNodesDestroyed);
});
it.each([['', 'after'], [undefined, 'before'], [null, 'before']])('retires fixed-key generations through %s and returns to name %s without stale submit values', async(anonymousName, returnName) => {
  vi.useFakeTimers();
  const { api, host, current, submitted } = create('before');
  const facts = []; api.observeFieldCommits(fact => facts.push(fact));
  await settle(api);
  const before = current(), beforeInput = host.querySelector('#dynamic-name-input');
  const sibling = api.node.at('sibling'), siblingInput = host.querySelector('#dynamic-name-sibling');
  type(beforeInput, 'Before committed'); type(siblingInput, 'Sibling retained'); await settle(api);
  const beforeGeneration = facts.find(fact => fact.node === before && fact.value === 'Before committed').generation;
  type(beforeInput, 'Retired named pending');
  expect(before.isSettled).toBe(false);
  const firstFence = api.whenPendingEditsSettled().then(() => true, error => error);
  api.updateData({ candidate: anonymousName });
  await vi.advanceTimersByTimeAsync(0); expect(await firstFence).toBe(true);
  const anonymous = current(), anonymousInput = host.querySelector('#dynamic-name-input');
  expect(anonymous).not.toBe(before); expect(anonymousInput).not.toBe(beforeInput);
  expect(api.node.at('before')).toBeUndefined();
  expect(Object.hasOwn(api.getValues(), 'before')).toBe(false);
  expect(api.node.at('sibling')).toBe(sibling); expect(host.querySelector('#dynamic-name-sibling')).toBe(siblingInput);
  type(anonymousInput, 'Anonymous committed'); await settle(api);
  const anonymousGeneration = facts.find(fact => fact.node === anonymous && fact.value === 'Anonymous committed').generation;
  expect(anonymousGeneration).not.toBe(beforeGeneration);
  type(anonymousInput, 'Retired anonymous pending');
  expect(anonymous.isSettled).toBe(false);
  const secondFence = api.whenPendingEditsSettled().then(() => true, error => error);
  api.updateData({ candidate: returnName });
  await vi.advanceTimersByTimeAsync(0); expect(await secondFence).toBe(true);
  const after = current(), afterInput = host.querySelector('#dynamic-name-input');
  expect(after).not.toBe(anonymous); expect(after).not.toBe(before);
  expect(afterInput).not.toBe(anonymousInput);
  expect(Object.hasOwn(api.getValues(), String(anonymous.name))).toBe(false);
  const freshValues = structuredClone(api.getValues());
  expect(Object.values(freshValues)).not.toContain('Retired named pending');
  expect(Object.values(freshValues)).not.toContain('Retired anonymous pending');
  await vi.advanceTimersByTimeAsync(100);
  expect(api.getValues()).toEqual(freshValues);
  expect(facts.some(fact => ['Retired named pending', 'Retired anonymous pending'].includes(fact.value))).toBe(false);
  type(afterInput, 'Current named value'); type(siblingInput, 'Sibling next'); await settle(api);
  const latest = facts.find(fact => fact.node === after && fact.value === 'Current named value');
  expect(latest.generation).not.toBe(beforeGeneration); expect(latest.generation).not.toBe(anonymousGeneration);
  expect(api.node.at('sibling')).toBe(sibling); expect(host.querySelector('#dynamic-name-sibling')).toBe(siblingInput);
  const submit = api.submit(); await vi.runAllTimersAsync(); await submit;
  expect(submitted).toEqual([{ [returnName]: 'Current named value', sibling: 'Sibling next' }]);
  expect(api.getValues()).toEqual(submitted[0]);
  api.destroy(); expect(api.metrics.coreNodesCreated).toBe(api.metrics.coreNodesDestroyed);
});
