import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';
const owners = [];
function create() {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields: [{ name: 'answer', config: { delay: 20 } }], values: { answer: 'Start' }, formProps: { actions: false } }); owners.push(api); return api;
}
afterEach(() => { owners.reverse().forEach(api => api.destroy()); owners.length = 0; document.body.replaceChildren(); vi.useRealTimers(); });
it.each([{ prepend: true, before: true }, { prepend: true, before: false }, { prepend: false, before: true }, { prepend: false, before: false }])('retains work scheduled around normal middleware next %j', async({ prepend, before }) => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); const facts = []; api.observeFieldCommits(fact => facts.push(fact.value)); let once = false;
  const schedule = () => { node.props.delay = 80; node.input('second'); };
  const middleware = (value, next) => {
    if (value !== 'first' || once) { return next(value); } once = true;
    if (before) { schedule(); } const result = next(value); if (!before) { schedule(); } return result;
  };
  if (prepend) { node.hook.commit.unshift(middleware); } else { node.hook.commit(middleware); }
  node.input('first'); let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(20); expect(done).toBe(false); expect(facts).toEqual(['first']);
  await vi.advanceTimersByTimeAsync(80); await fence; expect(facts).toEqual(['first', 'first']);
});
it('keeps only the latest timer generation when earlier middleware replaces work twice', async() => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); const raw = []; node.on('commitRaw', event => raw.push(event.payload)); let once = false;
  node.hook.commit.unshift((value, next) => {
    if (!once) { once = true; node.props.delay = 80; node.input('second'); node.props.delay = 40; node.input('third'); } return next(value);
  });
  node.input('first'); let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(20); expect(done).toBe(false); await vi.advanceTimersByTimeAsync(39); expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1); await fence; expect(raw).toHaveLength(2); await vi.advanceTimersByTimeAsync(80); expect(raw).toHaveLength(2);
});
it('does not invent a new timer for synchronous middleware reentry', async() => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); const raw = []; node.on('commitRaw', event => raw.push(event.payload)); let once = false;
  node.hook.commit.unshift((value, next) => { if (!once) { once = true; node.props.delay = 80; node.input('synchronous', false); } return next(value); });
  node.input('first'); let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(20); expect(done).toBe(true); await fence; expect(raw).toEqual(['synchronous', 'first']);
  await vi.advanceTimersByTimeAsync(80); expect(raw).toHaveLength(2);
});
it('preserves a synchronous middleware error and later healthy scheduling', async() => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); const marker = new Error('commit failure');
  const middleware = (value, next) => { if (value === 'bad') { throw marker; } return next(value); }; node.hook.commit.unshift(middleware);
  node.input('pending'); let received; try { node.input('bad', false); } catch (error) { received = error; } expect(received).toBe(marker);
  node.hook.commit.remove(middleware); node.props.delay = 5; const returned = node.input('healthy'); expect(returned).toBe(node.settled);
  const fence = api.whenPendingEditsSettled(); await vi.advanceTimersByTimeAsync(5); await fence; await returned; expect(api.getValues()).toEqual({ answer: 'healthy' });
});
it('rejects replacing the dispatcher without forbidding normal middleware changes', async() => {
  const api = create(); const node = api.node.at('answer'); const original = node.hook.commit.dispatch;
  node.hook.commit.dispatch = (...args) => Reflect.apply(original, node.hook.commit, args);
  await expect(api.whenPendingEditsSettled()).rejects.toThrow('commit dispatcher');
  node.hook.commit.dispatch = original; const middleware = (value, next) => next(value); node.hook.commit.unshift(middleware); await api.whenPendingEditsSettled();
  node.hook.commit.remove(middleware); await api.whenPendingEditsSettled();
});

it('does not retire an executing generation from nested synchronous dispatch before a successor is scheduled', async() => {
  vi.useFakeTimers(); const api = create(); const node = api.node.at('answer'); const facts = []; api.observeFieldCommits(fact => facts.push(fact.value)); let once = false;
  node.hook.commit.unshift((value, next) => {
    if (!once) { once = true; node.input('synchronous', false); node.props.delay = 80; node.input('successor'); } return next(value);
  });
  node.input('first'); let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(20); expect(done).toBe(false); expect(facts).toEqual(['synchronous', 'first']);
  await vi.advanceTimersByTimeAsync(80); await fence; expect(facts).toEqual(['synchronous', 'first', 'first']);
});
