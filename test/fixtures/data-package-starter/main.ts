import { Workspace } from './workspace.ts';

const mount = document.querySelector('main');
if (!mount) throw new Error('The starter requires a main element');

let workspace = new Workspace({ region: { el: mount } });
await workspace.start();

function dispose() {
  window.removeEventListener('pagehide', dispose);
  void workspace.destroy().catch(console.error);
}
window.addEventListener('pagehide', dispose);
if (import.meta.hot) {
  // A code edit replaces the Application; ordinary data updates preserve its Views.
  import.meta.hot.accept('./workspace.ts', async module => {
    if (!module) return;
    const options = workspace.options;
    await workspace.destroy();
    workspace = new module.Workspace(options);
    await workspace.start();
  });
  import.meta.hot.accept();
  import.meta.hot.dispose(dispose);
}
