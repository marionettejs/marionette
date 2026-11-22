import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';
import { createNode } from '@formkit/core';
import { inputs } from '@formkit/inputs';
const owners = [];
function create(fields = [{ name: 'answer', config: { delay: 20 } }]) {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields, values: { answer: 'Start' }, formProps: { actions: false } }); owners.push(api); return api;
}
afterEach(() => { owners.reverse().forEach(api => api.destroy()); owners.length = 0; document.body.replaceChildren(); vi.useRealTimers(); });
it('waits for the actual delay selected by a later public input listener', async() => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); const commits = []; api.observeFieldCommits(f => commits.push(f.value));
  const receipt = api.node.on('input.deep', event => { if (event.origin === node && event.payload === 'Delayed') { node.props.delay = 80; } });
  node.input('Delayed'); node.props.delay = 20; node.input('Immediate', false); expect(node.isSettled).toBe(true);
  let done = false; const wait = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(20); const early = done; await vi.advanceTimersByTimeAsync(60); await wait; node.off(receipt);
  expect(early).toBe(false); expect(commits).toEqual(['Immediate', 'Immediate']);
});
it('does not wait a fresh debounce after synchronous input or long quiet', async() => {
  vi.useFakeTimers(); const api = create(); api.node.at('answer').input('Immediate', false); await vi.advanceTimersByTimeAsync(1000);
  let done = false; const wait = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(0); expect(done).toBe(true); await wait;
});
it('does not latch a sampled invalid delay after a synchronous input', async() => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); node.props.delay = 2147483648; node.input('No timer', false);
  const first = api.whenPendingEditsSettled().then(() => ({ resolved: true }), error => ({ resolved: false, error })); await vi.advanceTimersByTimeAsync(0); expect(await first).toEqual({ resolved: true });
  node.props.delay = 20; node.input('Valid again', false); const next = api.whenPendingEditsSettled().then(() => ({ resolved: true }), error => ({ resolved: false, error })); await vi.advanceTimersByTimeAsync(0); expect(await next).toEqual({ resolved: true });
});

it('tracks Core cancellation and replacement rather than the old maximum delay', async() => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); const raw = []; node.on('commitRaw', event => raw.push(event.payload));
  node.props.delay = 80; node.input('old'); await vi.advanceTimersByTimeAsync(10);
  node.props.delay = 5; node.input('new'); const fence = api.whenPendingEditsSettled(); await vi.advanceTimersByTimeAsync(5); await fence;
  expect(raw).toEqual(['new']); await vi.advanceTimersByTimeAsync(80); expect(raw).toEqual(['new']);
});
it('keeps work scheduled reentrantly from a timer commit pending after outer calm', async() => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); const facts = []; api.observeFieldCommits(fact => facts.push(fact.value));
  node.on('commitRaw', event => { if (event.payload === 'first') { node.props.delay = 80; node.input('second'); } });
  node.input('first'); let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(20); expect(node.isSettled).toBe(true); expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(80); await fence; expect(facts).toEqual(['first', 'second']);
});
it.each(['child', 'add', 'calm'])('does not confuse synchronous %s propagation with a parent timer', async operation => {
  vi.useFakeTimers(); const api = create([{ name: 'box', type: 'group', config: { delay: 80 }, children: [{ name: 'a' }] }]);
  const group = api.node.at('box'); group.input({ a: 'delayed' }); const raw = []; group.on('commitRaw', event => raw.push(event.payload));
  if (operation === 'child') { api.node.at('box.a').input('child', false); }
  if (operation === 'add') { api.setFields([{ name: 'box', type: 'group', config: { delay: 80 }, children: [{ name: 'a' }, { name: 'b', defaultValue: 'B' }] }]); }
  if (operation === 'calm') { group.calm({ name: 'a', value: 'manual' }); }
  group.input({ a: 'immediate', ...(operation === 'add' ? { b: 'B' } : {}) }, false);
  let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(20); expect(done).toBe(false); const before = raw.length;
  await vi.advanceTimersByTimeAsync(60); await fence; expect(raw.length).toBe(before + 1);
});
it('keeps plugin-started work pending across Core initialization', async() => {
  vi.useFakeTimers(); const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields: [{ name: 'answer', config: { delay: 20 }, plugins: [node => { node.on('created', () => node.input('plugin')); }] }], values: { answer: 'Start' }, formProps: { actions: false } }); owners.push(api);
  let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(0); expect(done).toBe(false); await vi.advanceTimersByTimeAsync(20); await fence;
  expect(api.getValues()).toEqual({ answer: 'plugin' });
});
it('preserves input return and synchronous errors without poisoning later timer completion', async() => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); const marker = new Error('input hook');
  const hook = (value, next) => { if (value === 'bad') { throw marker; } return next(value); }; node.hook.input(hook);
  expect(() => node.input('bad')).toThrow(marker); node.hook.input.remove(hook);
  const returned = node.input('healthy'); expect(returned).toBe(node.settled);
  const fence = api.whenPendingEditsSettled(); await vi.advanceTimersByTimeAsync(20); await fence; await returned;
  expect(api.getValues()).toEqual({ answer: 'healthy' });
});
it('rejects an already-created foreign producer rather than guessing about old work', async() => {
  const api = create(); const foreign = createNode({ name: 'foreign', value: 'outside', props: { type: 'text' } }); api.node.add(foreign);
  await expect(api.whenPendingEditsSettled()).rejects.toThrow('created with the FormKit adapter');
  api.node.remove(foreign); foreign.destroy(); await api.whenPendingEditsSettled();
  expect(api.getValues()).toEqual({ answer: 'Start' });
});
it('rejects replaced Core producer methods without changing their behavior', async() => {
  const api = create(); const node = api.node.at('answer'); const original = node.input;
  node.extend('input', { get: () => original, set: () => false }); expect(node.input('custom', false)).toBe(node.settled);
  await expect(api.whenPendingEditsSettled()).rejects.toThrow('replaced Core input/add/calm');
  api.setFields([{ name: 'answer', key: 'new' }]); await api.whenPendingEditsSettled(); expect(api.node.at('answer')).not.toBe(node);
});
it('isolates completion state between forms and ignores retired or synchronous history', async() => {
  vi.useFakeTimers(); const first = create(); const second = create(); const node = first.node.at('answer'); node.props.delay = 80; node.input('pending');
  let one = false, two = false; const a = first.whenPendingEditsSettled().then(() => { one = true; }); const b = second.whenPendingEditsSettled().then(() => { two = true; });
  await vi.advanceTimersByTimeAsync(0); expect(two).toBe(true); expect(one).toBe(false); await b;
  first.setFields([]); await vi.advanceTimersByTimeAsync(0); await a; expect(one).toBe(true);
  node.props.delay = 10000; const next = second.node.at('answer'); next.props.delay = 10000; next.input('synchronous', false);
  const timers = vi.getTimerCount(); await second.whenPendingEditsSettled(); expect(vi.getTimerCount()).toBe(timers);
  await vi.advanceTimersByTimeAsync(80); expect(first.getValues()).toEqual({});
});

it('installs before explicit definition features can cache an input method', async() => {
  vi.useFakeTimers(); let write;
  const definition = { type: 'input', schema: [], features: [node => { write = node.input; }] };
  const api = create([{ name: 'answer', definition, config: { delay: 20 } }]); const node = api.node.at('answer');
  write('delayed'); write('immediate', false); let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(0); expect(done).toBe(false); await vi.advanceTimersByTimeAsync(20); await fence;
  expect(node.value).toBe('immediate');
});

it('preserves edited Core and DOM ownership through a retained explicit-definition update', async() => {
  const definition = { ...inputs.text, features: [...(inputs.text.features ?? [])] };
  const api = create([{ name: 'answer', label: 'Before', definition }]); const node = api.node.at('answer'); const input = api.form.el.querySelector('input');
  input.value = 'Edited'; input.dispatchEvent(new Event('input', { bubbles: true })); await api.whenPendingEditsSettled();
  api.setFields([{ name: 'answer', label: 'After', definition }]); await api.whenPendingEditsSettled();
  expect(api.node.at('answer')).toBe(node); expect(api.form.el.querySelector('input')).toBe(input); expect(input.value).toBe('Edited');
  expect(api.getValues()).toEqual({ answer: 'Edited' }); expect(api.form.el.querySelector('.formkit-label').textContent).toBe('After');
});
