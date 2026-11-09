import { Application, View } from 'marionette';

// Example-local feature data and controller; none of these names are router APIs.
export function mountCatalog({ frame, router, region, loadItem }) {
  const owner = frame.addChildApp('catalog', new Application({ region: { el: region } }));
  const routes = {
    catalog: { path: '/catalog{/:id}?', handler: 'routeTo', meta: { area: 'catalog' } },
  };
  const controller = {
    async routeTo(match, { signal }) {
      const text = match.params.id === undefined ? 'Catalog' : await loadItem(match.params.id, { signal });
      signal.throwIfAborted();
      if (!await owner.start()) { return; }
      signal.throwIfAborted();
      const heading = document.createElement('h1');
      heading.textContent = text;
      owner.showView(new View({ el: heading }));
    },
  };
  router.mount(routes, { owner, controller });
  return { owner, routes, controller };
}
