import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';
const owners = [];
function create() {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields: [{ name: 'answer', config: { delay: 20 } }], values: { answer: 'Start' }, instrument: true, formProps: { actions: false } });
  owners.push(api); return api;
}
afterEach(() => { owners.splice(0).reverse().forEach(api => api.destroy()); document.body.replaceChildren(); vi.useRealTimers(); });

describe('independent priority probes retained unchanged', () => {
  it('does not publish an observer after initial capture destroys its owner', async() => {
    const api = create(); const node = api.node.at('answer'); const value = {};
    Object.defineProperty(value, 'data', { enumerable: true, get() { api.destroy(); return 1; } });
    node.input(value, false);
    const callback = vi.fn(); const stop = api.observeFieldCommits(callback); await Promise.resolve();
    expect(api.form.isDestroyed()).toBe(true); expect(api.metrics.fieldCommitObservers).toBe(0); expect(api.metrics.fieldCommitReceipts).toBe(0);
    expect(callback).not.toHaveBeenCalled(); stop();
  });

  it('does not enqueue a fact after commit-time capture destroys its owner', async() => {
    const api = create(); const node = api.node.at('answer'); const callback = vi.fn(); api.observeFieldCommits(callback);
    const value = {}; Object.defineProperty(value, 'data', { enumerable: true, get() { api.destroy(); return 1; } });
    expect(() => node.input(value, false)).not.toThrow(); await Promise.resolve();
    expect(api.form.isDestroyed()).toBe(true); expect(api.metrics.fieldCommitObservers).toBe(0); expect(api.metrics.fieldCommitReceipts).toBe(0);
    expect(api.metrics.fieldCommitEvents).toBe(0); expect(callback).not.toHaveBeenCalled();
  });

  it('does not fulfill before the original delayed timer after an unequal immediate input', async() => {
    vi.useFakeTimers(); const api = create(); const facts = []; api.observeFieldCommits(fact => facts.push({ value: fact.value, changed: fact.changed }));
    const node = api.node.at('answer'); node.input('Delayed'); node.input('Immediate', false); expect(node.isSettled).toBe(true);
    let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0); const early = done; const beforeTimer = [...facts];
    await vi.advanceTimersByTimeAsync(20); await fence; const afterTimer = [...facts];
    await vi.advanceTimersByTimeAsync(20);
    expect(early).toBe(false); expect(beforeTimer).toEqual([{ value: 'Immediate', changed: true }]);
    expect(facts).toEqual(afterTimer); expect(afterTimer).toEqual([{ value: 'Immediate', changed: true }, { value: 'Immediate', changed: false }]);
  });

  it('retains a queued fact and generation when parent.add receives an already attached child', async() => {
    const api = create(); const node = api.node.at('answer'); const facts = []; api.observeFieldCommits(fact => facts.push(fact));
    node.input('first', false); await api.whenPendingEditsSettled(); const generation = facts[0].generation;
    node.input('queued', false); api.node.add(node); await api.whenPendingEditsSettled();
    expect(facts.some(fact => fact.value === 'queued' && fact.generation === generation)).toBe(true);
    node.input('next', false); await api.whenPendingEditsSettled(); expect(facts.at(-1).generation).toBe(generation);
  });

  it('preserves repeated built-in references and a shared backing buffer within each snapshot', async() => {
    const api = create(); const facts = []; api.observeFieldCommits(fact => facts.push(fact));
    const date = new Date('2024-01-01T00:00:00Z'); const regexp = /a/gi; const buffer = new ArrayBuffer(8); const bytes = new Uint8Array(buffer, 2, 2); const view = new DataView(buffer, 1, 4);
    api.node.at('answer').input({ date, dateAgain: date, regexp, regexpAgain: regexp, bytes, bytesAgain: bytes, view, buffer, bufferAgain: buffer }, false);
    await api.whenPendingEditsSettled(); const value = facts[0].value;
    expect(value.date).toBe(value.dateAgain); expect(value.regexp).toBe(value.regexpAgain); expect(value.buffer).toBe(value.bufferAgain);
    expect(value.bytes).toBe(value.bytesAgain); expect(value.bytes.buffer).toBe(value.buffer); expect(value.view.buffer).toBe(value.buffer);
    expect(value.bytes.byteOffset).toBe(2); expect(value.view.byteOffset).toBe(1); expect(value.buffer).not.toBe(buffer);
  });
});
