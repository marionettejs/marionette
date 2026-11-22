import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';
const owners = [];
function create() {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields: [{ name: 'answer' }], formProps: { actions: false } });
  owners.push(api); return api;
}
afterEach(() => { for (const api of owners.splice(0).reverse()) { api.destroy(); } document.body.replaceChildren(); });
const turn = () => new Promise(resolve => setImmediate(resolve));
it('owns fire-and-forget cancellation after explicit disposal with an error reporter', async() => {
  const api = create(), report = vi.fn(), read = vi.fn(() => ({ answer: 'Never' }));
  const projection = api.createValueProjection({ read, onError: report });
  projection.dispose(); void projection.request(); await turn();
  await expect(projection.flush()).rejects.toMatchObject({ name: 'AbortError' });
  expect(read).not.toHaveBeenCalled(); expect(report).not.toHaveBeenCalled();
});
it('owns fire-and-forget cancellation after owner destruction with an error reporter', async() => {
  const api = create(), report = vi.fn(); api.destroy();
  const projection = api.createValueProjection({ read: () => ({ answer: 'Never' }), onError: report });
  void projection.request(); await turn();
  await expect(projection.flush()).rejects.toMatchObject({ name: 'AbortError' }); expect(report).not.toHaveBeenCalled();
});
it('keeps cancellation observable to callers without an error reporter', async() => {
  const api = create(); const projection = api.createValueProjection({ read: () => ({ answer: 'Never' }) });
  projection.dispose(); await expect(projection.request()).rejects.toMatchObject({ name: 'AbortError' });
});
