# @mnjs/router

Private development package for named nested routes with the Navigation API and
URLPattern. The core is render-agnostic and depends on `@mnjs/utils` Events.
[Design and integration](DESIGN.md) explains ownership, readiness and open decisions;
[provenance](PROVENANCE.md) records the pinned source and publication limits.

```js
import { Router, memoryDriver } from '@mnjs/router';

const router = new Router({
  routes: [{ name: 'item', path: '/items/:id' }],
  driver: memoryDriver({ url: 'http://localhost/items/1' }),
  handler: async(match, { signal }) => {
    await showItem(match.params.id, signal);
    signal.throwIfAborted();
  },
});
await router.start();
await router.navigate('item', { id: '2' }).finished;
router.stop();
```

Omit `driver` in an active browser document to use `window.navigation`.
`navigate()` returns `{ committed, finished }` immediately; await `.finished` for
handler/redirect readiness. Cancellation yields false, failure rejects. `route`,
`route:ready` and `route:error` support ordinary `listenTo` subscriptions.

`@mnjs/router/outlet` optionally selects one registered child Application. It alone
requires `marionette`. Ordinary Applications retain preparation and child ownership;
Views/Regions retain rendering and focus. The selector is replaceable and imposes no
Application base class or required child activation method. The current outlet's
`restart: true` reconstructs with stop/start; it is different from retained
`Application.restart()` and its naming is awaiting a maintainer decision.

The native driver requires Navigation API, URLPattern and AbortSignal.any support.
The outlet also uses Marionette's Promise.withResolvers-based Application readiness.
This is a narrower feature floor than Marionette core. Node **24.15+** provides
URLPattern for memory-driver use. No polyfill or History API driver ships here.

From the repository root:

```sh
npm test -- test/unit/router
npm run build
npm run test:router-package
```

The tests exercise public package imports under Vitest. Build produces ESM/CJS and
checks both declaration-consumer modes. The package fixture checks core import
without Marionette and outlet import/ownership with it. These are local Node checks;
there is no fresh native-browser, Safari, app UI/focus or Cypress certification.
