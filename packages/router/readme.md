# @mnjs/router prototype

An optional, framework-neutral URL dispatcher. This feature branch packages an
assessment prototype; it is **private**, ESM-only, and outside Marionette's release
pipeline. It is not a production release or an application migration.

The package has no runtime dependencies and does not import Marionette, Backbone,
renderers, or development helpers. Importing it installs no global listener. A
router subscribes only when started. Use one history owner for an application.

```js
import { createRoutes, createRouter, createBrowserHistory } from '@mnjs/router';

const routes = createRoutes({
  feed: '/:workspace/patient/:patientId/interactions',
  interaction: '/:workspace/patient/:patientId/interactions/:interactionId',
});
const router = createRouter({
  routes,
  history: createBrowserHistory(window),
  dispatch(context) {
    // Application code selects/reuses a feature and passes it this context.
    // A route signal must not stop a shared patient Application.
    return showFeature(context);
  },
  onError(error) { showNavigationError(error); },
});
await router.start();
await router.navigate({
  name: 'interaction',
  params: { workspace: 'alpha', patientId: 'p1', interactionId: 'i9' },
}, { info: { entryTarget: 'comments' } });

// After the feature has cleared its target and started its own date operation:
await router.reflect({
  name: 'feed', params: { workspace: 'alpha', patientId: 'p1' },
});
router.dispose();
```

`showFeature` and `showNavigationError` above are application-owned functions.
The executable ownership fixture is in `test/router/owner.mjs`, with public
Marionette lifecycle tests in `test/unit/router/ownership.spec.mjs`.

## Contract

- `createRoutes(definitions)` matches/builds named paths, aliases, query and hash.
  Parameters infer from literal paths. Matching does not rewrite aliases.
- `createRouter({ routes, history, dispatch, onError?, signal? })` owns navigation
  authority, not feature loading, reuse, Regions, caches, or presentation.
- `navigate(target, { history?, state?, info? })` writes before synchronously
  calling `dispatch`. `history` is `push` or `replace`; push is the default.
- Equal-URL navigation dispatches `repeat` without a duplicate entry. Transient
  `info` can change even when the URL does not. Supplied state replaces entry data.
- `refresh({ info? })` dispatches without writing history; the feature chooses
  what refresh means. `reflect(target)` defaults to replace with no dispatch.
- Replace/reflection preserve omitted state; explicit null clears it. Push starts
  with undefined state. `info` is never persisted in history.
- `context.signal`, `isCurrent()`, and synchronous `runIfCurrent(effect)` fence
  publication after awaits. A newer navigation, reflection or disposal invalidates
  old authority. This is not transactional rollback or feature lifetime ownership.
- The promise outcome is `handled`, `failed`, `superseded`, `reflected`, `unchanged`
  or `disposed`. `handled` means the dispatcher fulfilled, not that content is
  loaded, attached, focused or scrolled. Late rejections are observed.
- `location` is current; `lastDispatch` may be historical after reflection.
  `start()` is idempotent, `dispose()` terminal. Both release only owned resources.

The driver protocol supplies `read`, `write`, `subscribe`, and `go`. Memory history
is deterministic. Native history exclusively owns same-document writes, adopts
the initial entry using replaceState, preserves foreign plain-object state fields,
and leaves unowned traversal entries with a null key. A borrowed transport must
write before notifying app code; nested accepted intent suppresses old dispatch,
without rolling back native writes. Synchronous setup/cleanup failures abort the
operation; no general registration rollback is promised.

## Limits and coexistence

The path grammar supports exact literals and named segments, first match wins.
It does not provide optional/splat paths, ranking, route-tree loaders, blockers,
server fallback, authentication, scroll restoration, click interception, or a
Navigation API driver. History POP arrives after the browser has moved.

The experimental Backbone bridge lives only in `test/router/backbone-history.mjs`.
It demonstrates one URL owner during migration, including silent legacy writes
and reentrant host dispatch. **Backbone suppresses equal-fragment traversal**:
the bridge cannot promise distinct entry identity/restoration. It reports `host`,
has null keys, and rejects entry state and hash destinations. Migrate a family's
inbound and outbound wiring together, then remove the bridge at global cutover.

## Verify this branch

Use the repository's pinned Node/npm toolchain, install dependencies, then:

```sh
npm run build
npm --prefix packages/router run build
npm --prefix packages/router test -- --coverage
npm --prefix packages/router run test:types
npm --prefix packages/router run test:browser
```

The router suite has its own 100% per-file coverage thresholds. No existing gate
or threshold is lowered. Its opt-in `.spec.mjs` files do not join the established
core `.spec.js` suite while this package remains an experiment. Browser checks
use headless, temporary Playwright contexts and local response fixtures; install
the repository's Playwright engines first if unavailable. Results go to
`coverage/router` and `test/tmp/router-*.json`.

See [design notes](design.md) and [verification record](verification.md) for the
alternatives, integration boundaries, executed checks and remaining product gates.
