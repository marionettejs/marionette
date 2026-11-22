import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';
import { createNode } from '@formkit/core';
const owners = [];
function create() {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields: [{ name: 'answer', config: { delay: 20 } }], values: { answer: 'Start' }, formProps: { actions: false } });
  owners.push(api); return api;
}
afterEach(() => { owners.splice(0).reverse().forEach(api => api.destroy()); document.body.replaceChildren(); vi.useRealTimers(); });

describe('declared pending edit windows', () => {
  it('accounts for a timer scheduled before observation and before its delay changes', async() => {
    vi.useFakeTimers(); const api = create(); const node = api.node.at('answer');
    node.input('delayed'); node.input('immediate', false); node.config.delay = 0;
    const commits = []; const receipt = node.on('commitRaw', event => commits.push(event.payload));
    let done = false; const waiting = api.whenPendingEditsSettled().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20); await waiting; expect(commits).toEqual(['immediate']); node.off(receipt);
  });

  it('restarts the window when input occurs while a fence is pending', async() => {
    vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); node.input('one');
    let done = false; const waiting = api.whenPendingEditsSettled().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(10); node.input('two'); node.input('immediate', false);
    await vi.advanceTimersByTimeAsync(10); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(10); await waiting; expect(api.getValues()).toEqual({ answer: 'immediate' });
    const timers = vi.getTimerCount(); await api.whenPendingEditsSettled(); expect(vi.getTimerCount()).toBe(timers);
  });

  it('does not acknowledge unfinished work when its first fence is aborted', async() => {
    vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); node.input('one'); node.input('two', false);
    const controller = new AbortController(); const pending = api.whenPendingEditsSettled({ signal: controller.signal }).then(() => false, error => error);
    const reason = new Error('abort'); controller.abort(reason); expect(await pending).toBe(reason);
    let done = false; const next = api.whenPendingEditsSettled().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20); await next; expect(api.getValues()).toEqual({ answer: 'two' });
  });
});

describe('Core-only two-leaf settlement controls', () => {
  it.each([{ remove: false, stagger: false }, { remove: false, stagger: true }, { remove: true, stagger: false }, { remove: true, stagger: true }])('records exact promises and first-removal state %j', async({ remove, stagger }) => {
    vi.useFakeTimers();
    const group = createNode({ type: 'group', value: { a: '0', b: '0' } });
    const a = createNode({ name: 'a', parent: group, config: { delay: stagger ? 10 : 20 } });
    const b = createNode({ name: 'b', parent: group, config: { delay: 20 } });
    try {
      const state = { a: false, b: false, group: false };
      const first = a.input('A').then(() => { state.a = true; });
      const second = b.input('B').then(() => { state.b = true; });
      const exact = group.settled.then(() => { state.group = true; });
      await Promise.resolve(); expect(state).toEqual({ a: false, b: false, group: false });
      if (remove) {
        a.destroy(); await Promise.resolve(); expect(state.group).toBe(false); expect(b.isSettled).toBe(false);
        b.destroy(); group.destroy();
      } else if (stagger) {
        await vi.advanceTimersByTimeAsync(10); expect(state).toEqual({ a: true, b: false, group: false });
      }
      await vi.advanceTimersByTimeAsync(remove || !stagger ? 20 : 10);
      await Promise.all([first, second, exact]); expect(state).toEqual({ a: true, b: true, group: true });
      if (!remove) { expect(group.value).toEqual({ a: 'A', b: 'B' }); }
    } finally { a.destroy(); b.destroy(); group.destroy(); }
  });
});
