import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';
const owners = [];
function create() {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields: [{ name: 'answer', config: { delay: 20 } }], values: { answer: 'Initial' }, formProps: { actions: false } });
  owners.push(api); return api;
}
afterEach(() => { owners.splice(0).reverse().forEach(api => api.destroy()); document.body.replaceChildren(); vi.useRealTimers(); });
it('projects the latest store value after pending commits without change or field echoes', async() => {
  vi.useFakeTimers(); const api = create(); let value = 'Older'; const changes = [], facts = [];
  api.form.on('form:change', (...args) => changes.push(args)); api.observeFieldCommits(fact => facts.push(fact));
  const projection = api.createValueProjection({ read: () => ({ answer: value }) });
  api.node.at('answer').input('Local'); const operation = projection.request(); value = 'Current';
  await vi.advanceTimersByTimeAsync(20); await operation;
  expect(api.getValues()).toEqual({ answer: 'Current' });
  expect(changes).toHaveLength(1); expect(facts.filter(fact => fact.source === 'unknown').map(fact => fact.value)).toEqual(['Local']);
  expect(facts.filter(fact => fact.source === 'programmatic').map(fact => fact.value)).toEqual(['Current']);
});
it('coalesces requests without cloning or writing obsolete snapshots', async() => {
  const api = create(); let value = 'One'; const read = vi.fn(() => ({ answer: value })); const projection = api.createValueProjection({ read });
  const first = projection.request(); value = 'Two'; const second = projection.request();
  expect(second).toBe(first); await first; expect(read).toHaveBeenCalledTimes(1); expect(api.getValues()).toEqual({ answer: 'Two' });
});
it('retries after the exact transient fence rejection without a sticky error', async() => {
  const api = create(); const marker = new Error('transient fence');
  const projection = api.createValueProjection({ read: () => ({ answer: 'Recovered' }) });
  const fence = vi.spyOn(api.form, 'whenPendingEditsSettled').mockRejectedValueOnce(marker);
  await expect(projection.request()).rejects.toBe(marker); fence.mockRestore();
  await projection.flush(); expect(api.getValues()).toEqual({ answer: 'Recovered' });
});
it('preserves a read failure and permits a healthy next request', async() => {
  const api = create(); const marker = new Error('read failure'); let fail = true;
  const projection = api.createValueProjection({ read: () => { if (fail) { throw marker; } return { answer: 'Healthy' }; } });
  await expect(projection.request()).rejects.toBe(marker); fail = false;
  await projection.flush(); expect(api.getValues()).toEqual({ answer: 'Healthy' });
});
it('cancels pending work and rejects later requests after explicit disposal', async() => {
  vi.useFakeTimers(); const api = create(); const read = vi.fn(() => ({ answer: 'Wrong' })); const projection = api.createValueProjection({ read });
  api.node.at('answer').input('Pending'); const operation = projection.request().catch(error => error); await Promise.resolve();
  projection.dispose(); const error = await operation; expect(error.name).toBe('AbortError');
  await expect(projection.flush()).rejects.toBe(error); expect(read).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(20); expect(api.getValues()).toEqual({ answer: 'Pending' });
});
it('joins View lifetime and prevents writes when read destroys the owner', async() => {
  const api = create(); const projection = api.createValueProjection({ read: () => { api.destroy(); return { answer: 'Never' }; } });
  await expect(projection.request()).rejects.toMatchObject({ name: 'AbortError' }); expect(projection.disposed).toBe(true);
});
it('handles reentrant requests by rereading before applying a stale value', async() => {
  const api = create(); let projection, reads = 0;
  projection = api.createValueProjection({ read: () => { reads++; if (reads === 1) { projection.request(); return { answer: 'Stale' }; } return { answer: 'Current' }; } });
  await projection.flush(); expect(reads).toBe(2); expect(api.getValues()).toEqual({ answer: 'Current' });
});
it('validates read before installing projection ownership', () => {
  const api = create(); expect(() => api.createValueProjection({})).toThrow('requires read');
});

it('reports one error per coalesced operation and preserves identity if the reporter throws', async() => {
  const api = create(); const marker = new Error('primary'), secondary = new Error('reporter');
  const report = vi.fn(function(error) { expect(this).toBeUndefined(); expect(error).toBe(marker); throw secondary; });
  const projection = api.createValueProjection({ read: () => { throw marker; }, onError: report });
  const one = projection.request(), two = projection.request(); expect(two).toBe(one);
  await expect(one).rejects.toBe(marker); expect(report).toHaveBeenCalledTimes(1);
});
it('is already disposed when created on a destroyed owner', async() => {
  const api = create(); api.destroy(); const read = vi.fn(() => ({ answer: 'Never' }));
  const projection = api.createValueProjection({ read }); expect(projection.disposed).toBe(true);
  await expect(projection.request()).rejects.toMatchObject({ name: 'AbortError' }); expect(read).not.toHaveBeenCalled();
});

it('rejects an invalid error reporter before installing ownership', () => {
  const api = create(); expect(() => api.createValueProjection({ read: () => ({}), onError: 'invalid' })).toThrow('function onError');
});
