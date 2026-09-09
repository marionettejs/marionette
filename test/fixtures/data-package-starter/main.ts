import { createWorkspace } from './workspace.ts';

const mount = document.querySelector('main');
if (!mount) { throw new Error('The starter requires a main element'); }

function start(factory: typeof createWorkspace) {
  return factory({
    el: mount!,
    async loadNote(id, { signal }) {
      // Local demonstration only. Replace with your application's data client.
      await new Promise(resolve => setTimeout(resolve, id === 'first' ? 600 : 50));
      signal.throwIfAborted();
      return { title: `Selected: ${id}`, body: 'Your draft titles stay in the list while notes load.' };
    }
  });
}
let workspace = start(createWorkspace);
function dispose() {
  window.removeEventListener('pagehide', dispose);
  workspace.destroy();
}
window.addEventListener('pagehide', dispose);
if (import.meta.hot) {
  // An edit restarts this feature. Drafts survive data updates, not code updates.
  import.meta.hot.accept('./workspace.ts', module => {
    if (module) {
      workspace.destroy();
      workspace = start(module.createWorkspace);
    }
  });
  import.meta.hot.accept();
  import.meta.hot.dispose(dispose);
}
