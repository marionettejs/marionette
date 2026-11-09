# Mount feature data on an ordinary Application

Use [catalog.mjs](catalog.mjs) when a feature has a small route table and one local
`routeTo` operation. It exports an example helper, not another router abstraction.
The route table is data; `controller` handles it; an ordinary Application `owner`
owns UI and registration lifetime. Metadata can describe the shell/area an app
chooses to present. It does not activate anything or derive ownership from paths.

```js
import { Application } from 'marionette';
import { Router } from '@mnjs/router';
import { mountCatalog } from './catalog.mjs';

const frame = new Application();
const router = frame.addChildApp('navigation', new Router());
const catalog = mountCatalog({
  frame, router, region: document.querySelector('#content'),
  async loadItem(id, { signal }) {
    const response = await fetch(`/api/items/${encodeURIComponent(id)}`, { signal });
    if (!response.ok) throw new Error(`Item request failed: ${response.status}`);
    return (await response.json()).title;
  },
});
await frame.start();
await router.start();
await router.getInitialDispatch();
await router.navigate('catalog', { id: '42' }).finished;
```

Check the required capabilities before eagerly constructing this Router, as in
the [package bootstrap recipe](../../readme.md#check-capabilities-before-eager-application-imports).
Supply `#content`. Registration does not activate the owner. The local handler
loads data, checks navigation authority after awaits, then presents on its owner.
Its returned work is route readiness; current failures reach `route:error`.

`catalog.owner.stop()` stops its UI but leaves the route registered; navigating or
refreshing that route may start it again. `catalog.owner.destroy()` retires the
registration and cancels its route work. Stopping/destroying the frame also stops
routing. A different area's handler explicitly stops or clears content it leaves;
it need not activate an area just to clean it up. Independent sidebars can remain
owned elsewhere. No generic per-feature forwarding layer is required.

Keep a real feature's richer `routeTo` boundary local to that feature. The optional
RouteApplication remains useful when the feature independently declares and owns
its registrations, as in the [desk example](../desk/README.md). Neither pattern
requires all features to use the same ownership shape. A feature that replaces its
own first startup still owns its stable presentation promise; this small example
does not implement that separate policy.
