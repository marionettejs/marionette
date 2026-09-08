import { createWorkspace } from './workspace.mjs';

const workspace = createWorkspace({
  el: document.querySelector('main'),
  async loadNote(id, { signal }) {
    // Local demonstration only. Replace this with your application's data client.
    await new Promise(resolve => setTimeout(resolve, id === 'first' ? 600 : 50));
    if (signal.aborted) { throw new DOMException('Canceled', 'AbortError'); }
    return { title: `Selected: ${id}`, body: 'Your draft titles stay in the list while notes load.' };
  }
});

function dispose() {
  window.removeEventListener('pagehide', dispose);
  workspace.destroy();
}
window.addEventListener('pagehide', dispose);
if (import.meta.hot) { import.meta.hot.dispose(dispose); }
