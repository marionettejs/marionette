import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, defaultConfig } from '@mnjs/formkit';
import { createNode } from '@formkit/core';
const owners = [], extra = [];
function create(delay = 20) {
  const host = document.createElement('main'); document.body.append(host); let node;
  const api = mount({ host, fields: [{ name: 'ignored', ignore: true, config: { delay }, onNode: value => { node = value; } }], formProps: { actions: false } });
  owners.push(api); return { api, node };
}
afterEach(() => { extra.splice(0).reverse().forEach(dispose => dispose()); owners.splice(0).reverse().forEach(api => api.destroy()); document.body.replaceChildren(); vi.useRealTimers(); });
describe('owner completion includes detached input producers without aggregate facts', () => {
  it('waits for an ignored adapter field even though its Core parent is null and root is settled', async() => {
    vi.useFakeTimers(); const { api, node } = create(); const facts = []; api.observeFieldCommits(fact => facts.push(fact));
    expect(node.parent).toBeNull(); node.input('pending'); expect(api.node.isSettled).toBe(true); expect(node.isSettled).toBe(false);
    let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0); const early = done;
    await vi.advanceTimersByTimeAsync(20); await fence;
    expect(early).toBe(false); expect(node.value).toBe('pending'); expect(facts).toEqual([]); expect(api.getValues()).toEqual({});
  });
  it('keeps detached transforming commit replay pending after an unequal immediate write', async() => {
    vi.useFakeTimers(); const { api, node } = create();
    node.hook.commit((value, next) => next(`${ value }!`));
    node.input('delayed'); node.input('immediate', false); expect(node.isSettled).toBe(true); expect(node.value).toBe('immediate!');
    let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0); const early = done;
    await vi.advanceTimersByTimeAsync(20); await fence;
    expect(early).toBe(false); expect(node.value).toBe('immediate!!');
  });
  it('includes a fresh library-created ignored input inheriting this owner plugin before features run', async() => {
    vi.useFakeTimers(); const { api } = create();
    const node = createNode({ name: 'library-child', value: 'start', props: { type: 'number', ignore: true }, plugins: api.form.plugins, config: { delay: 20 } });
    extra.push(() => node.destroy()); expect(node.parent).toBeNull(); node.input('37');
    let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0); const early = done;
    await vi.advanceTimersByTimeAsync(20); await fence; expect(early).toBe(false); expect(node.value).toBe('37');
  });
});

it('isolates pending ignored inputs between owners', async() => {
  vi.useFakeTimers(); const a = create(80), b = create(20);
  a.node.input('A'); b.node.input('B'); let first = false, second = false;
  const one = a.api.whenPendingEditsSettled().then(() => { first = true; });
  const two = b.api.whenPendingEditsSettled().then(() => { second = true; });
  await vi.advanceTimersByTimeAsync(20); expect(second).toBe(true); expect(first).toBe(false);
  await vi.advanceTimersByTimeAsync(60); await Promise.all([one, two]);
});
it('releases a removed ignored field without waiting for its canceled timer', async() => {
  vi.useFakeTimers(); const { api, node } = create(80); node.input('retiring'); let done = false;
  const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  api.setFields([]); await vi.advanceTimersByTimeAsync(0); await fence; expect(done).toBe(true);
  await vi.advanceTimersByTimeAsync(80); expect(api.getValues()).toEqual({});
});
it('observes a newly created inherited producer during an already requested fence', async() => {
  vi.useFakeTimers(); const { api } = create(); let done = false;
  const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  const node = createNode({ name: 'late', value: '', props: { type: 'text', ignore: true }, plugins: api.form.plugins, config: { delay: 20 } });
  extra.push(() => node.destroy()); node.input('late pending');
  await vi.advanceTimersByTimeAsync(0); expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(20); await fence; expect(node.value).toBe('late pending');
});
it('retires an old ignored generation and waits only for the current replacement', async() => {
  vi.useFakeTimers(); const { api, node } = create(80); node.input('old'); let replacement;
  api.setFields([{ name: 'ignored', key: 'new', ignore: true, config: { delay: 5 }, onNode: next => { replacement = next; } }]);
  expect(replacement).not.toBe(node); replacement.input('new'); let done = false;
  const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(5); await fence; expect(done).toBe(true); expect(replacement.value).toBe('new');
  await vi.advanceTimersByTimeAsync(80); expect(replacement.value).toBe('new');
});
it('propagates completion ownership through a Schema owner and Provider scope', async() => {
  vi.useFakeTimers(); const host = document.createElement('main'); document.body.append(host); let node;
  const api = mount({ host, schema: [{ $cmp: 'FormKitProvider', props: { config: defaultConfig() }, children: [{ $cmp: 'FormKitSchema', props: { schema: [{ $formkit: 'text', name: 'nested', ignore: true, config: { delay: 20 }, onNode: next => { node = next; } }] } }] }], formProps: { actions: false } }); owners.push(api);
  expect(node.parent).toBeNull(); node.input('scoped'); let done = false;
  const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(0); expect(done).toBe(false); await vi.advanceTimersByTimeAsync(20); await fence; expect(node.value).toBe('scoped');
});
it('keeps ignored fields outside aggregate field facts while contributing siblings stay ordered', async() => {
  const { api, node } = create(); const facts = []; api.observeFieldCommits(fact => facts.push(fact));
  api.setFields([{ name: 'ignored', ignore: true, onNode: () => {} }, { name: 'answer' }]);
  await api.whenPendingEditsSettled(); facts.length = 0;
  node.input('ignored', false); api.node.at('answer').input('one', false); api.node.at('answer').input('two', false);
  await api.whenPendingEditsSettled(); expect(facts.map(fact => [fact.path, fact.value])).toEqual([[['answer'], 'one'], [['answer'], 'two']]);
});
it('rejects a fresh inherited explicit definition installed too late for feature caching', async() => {
  const { api } = create(); let cached;
  const node = createNode({ name: 'unsupported', props: { definition: { type: 'input', schema: [], features: [value => { cached = value.input; }] } }, plugins: api.form.plugins });
  extra.push(() => node.destroy()); expect(typeof cached).toBe('function');
  await expect(api.whenPendingEditsSettled()).rejects.toThrow('before library features');
  node.destroy(); extra.pop(); await api.whenPendingEditsSettled();
});
it('preserves replacement guards for an ignored producer', async() => {
  const { api, node } = create(); const original = node.input;
  node.extend('input', { get: () => original, set: () => false });
  await expect(api.whenPendingEditsSettled()).rejects.toThrow('replaced Core');
});
it('aborts pending ignored work on owner destruction with once-only child teardown', async() => {
  vi.useFakeTimers(); const { api, node } = create(); let destroyed = 0;
  node.on('destroyed', () => destroyed++); node.input('pending');
  const fence = api.whenPendingEditsSettled().catch(error => error);
  api.destroy(); expect((await fence).name).toBe('AbortError'); expect(destroyed).toBe(1);
  await vi.advanceTimersByTimeAsync(20); expect(destroyed).toBe(1);
});

it('captures inherited library input methods before definition features cache them', async() => {
  vi.useFakeTimers(); const { api } = create(); let write;
  const library = () => {}; library.library = node => {
    if (node.props.type === 'cached') { node.define({ type: 'input', schema: [], features: [current => { write = current.input; }] }); }
  };
  const node = createNode({ name: 'cached', value: '', props: { type: 'cached', ignore: true }, plugins: [...api.form.plugins, library], config: { delay: 20 } });
  extra.push(() => node.destroy()); expect(typeof write).toBe('function');
  write('delayed'); write('immediate', false); let done = false;
  const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(0); expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(20); await fence; expect(node.value).toBe('immediate');
});
it('waits for a native real-timer transforming replay on an ignored field', async() => {
  const { api, node } = create(); const raw = [];
  node.hook.commit((value, next) => next(`${ value }!`)); node.on('commitRaw', event => raw.push(event.payload));
  node.input('delayed'); node.input('immediate', false); let done = false;
  const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  // A real event-loop checkpoint witnesses early completion; it is not a
  // guessed debounce used by production or the readiness assertion.
  await new Promise(resolve => setTimeout(resolve, 0)); expect(done).toBe(false);
  await fence; expect(raw).toEqual(['immediate!', 'immediate!!']); expect(node.value).toBe('immediate!!');
});
