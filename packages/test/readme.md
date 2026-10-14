# @mnjs/test

Mount real Marionette **5.x** Views and Applications, then release resources your
test owns. The package exports `mountView`, `mountApplication`, and
`createTestScope`. Optional `/cypress`, `/playwright`, and `/vitest` entries adapt
the lifecycle to their runners. Use your runner's assertions, Testing Library queries,
or browser Locators alongside them. Mounting requires a DOM; importing the package
and creating a cleanup scope do not. Production Marionette does not depend on it.
See the [Marionette testing guide](https://marionettejs.com/docs/guides/testing/)
for application testing fundamentals.

This initial `0.1.0` package is unpublished. Build and pack it from the Marionette
repository:

```sh
npm run build
npm pack ./packages/test --ignore-scripts
```

Then, from your application's directory, install the tarball as a development
dependency alongside Marionette 5:

```sh
npm install --save-dev /absolute/path/to/mnjs-test-0.1.0.tgz
```

## Vitest: own mounts per test

Use Vitest 5 with JSDOM or Browser Mode. Each test receives its own `mounts`
fixture and awaited teardown, including concurrent tests and failing assertions.

```js
import { expect } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { View } from 'marionette';
import { within } from '@testing-library/dom';

const Greeting = View.extend({ template: () => '<h1>Hello</h1>' });
test('renders a greeting', ({ mounts }) => {
  const mounted = mounts.mountView(new Greeting());
  expect(within(mounted.container).getByRole('heading').textContent).toBe('Hello');
}); // The fixture awaits teardown, including when the test fails.
```

## Cypress: register cy.mount once

Install Cypress and `@cypress/mount-utils` alongside the helper. Register commands
explicitly in the component support file:

```js
// cypress/support/component.js
import { mount, mountApplication, setupCypress } from '@mnjs/test/cypress';

setupCypress();
Cypress.Commands.add('mount', mount);
Cypress.Commands.add('mountApplication', mountApplication);
```

The component HTML needs `<div data-cy-root></div>`. Use the normal custom-framework
Vite dev server, as shown in the [example project](https://github.com/marionettejs/marionette/tree/master/packages/test/examples).

```js
// cypress/component/greeting.cy.js, with the support file above
import { View } from 'marionette';

const Greeting = View.extend({ template: () => '<h1>Hello</h1>' });
it('replaces the previous mount', () => {
  let previous;
  cy.mount(() => new Greeting()).then(mounted => { previous = mounted; });
  cy.mount(() => new Greeting()).then(mounted => {
    expect(previous.view.isDestroyed()).to.equal(true);
    expect(mounted.el.parentElement).to.equal(mounted.container);
  });
  cy.get('h1').should('have.text', 'Hello');
});
```

Choose Application startup explicitly with `start: true` (await readiness) or
`start: false` (start it yourself):

```js
// cypress/component/shell.cy.js, with the support file above
import { Application, View } from 'marionette';

it('shows a shell without starting feature work', () => {
  cy.mountApplication(region => new Application({ region }), { start: false })
    .then(({ app }) => {
      app.showView(new View({ template: () => '<h1>Shell</h1>' }));
    });
  cy.get('h1').should('have.text', 'Shell');
});
```

For TypeScript, add the command declarations to your component support types:

```ts
import { mount, mountApplication } from '@mnjs/test/cypress';
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
      mountApplication: typeof mountApplication;
    }
  }
}
```

## Playwright: mount named browser stories

Use Playwright 1.63's built-in `mount` fixture with a browser gallery served by your
dev server. Stories create Views in the browser; tests use Playwright Locators.

```js
// gallery/gallery.js, served by your dev server from a page with <div id="root"></div>
import { View } from 'marionette';
import { createGallery } from '@mnjs/test/playwright';

const Editor = View.extend({ template: () => '<h1>Editor</h1><input aria-label="Draft">' });
const gallery = createGallery({
  'editor/Default'(props, mounts) {
    const mounted = mounts.mountView(new Editor());
    return { update(next) { mounted.el.querySelector('h1').textContent = next.title; } };
  },
}, { container: document.querySelector('#root') });
Object.assign(window, gallery);
```

```js
// playwright/editor.spec.js; baseURL points to the gallery page
import { test, expect } from '@playwright/test';

test.afterEach(async ({ page }) => {
  await page.evaluate(async () => { await window.unmount?.(); });
});
test('updates preserve the draft', async ({ mount }) => {
  const editor = await mount('editor/Default');
  await editor.getByRole('textbox', { name: 'Draft' }).fill('Keep me');
  await editor.update({ title: 'Rename' });
  await expect(editor.getByRole('heading')).toHaveText('Rename');
  await expect(editor.getByRole('textbox', { name: 'Draft' })).toHaveValue('Keep me');
  await editor.unmount();
  await expect(editor).toBeEmpty();
});
```

Return the gallery's `unmount()` Promise from `afterEach` to await teardown.

## Shared API

Use the neutral entry with any DOM-capable test runner. Always await cleanup.

### Mount a View

```js
import { View } from 'marionette';
import { mountView } from '@mnjs/test';

const Greeting = View.extend({ template: () => '<h1>Hello</h1>' });
const mounted = mountView(new Greeting());
try {
  console.log(mounted.view.isAttached(), mounted.el.textContent);
} finally {
  await mounted.cleanup();
}
```

`mountView(view, options?)` transfers a live, unowned View to a new Region. The
handle exposes the original `view`, `region`, `container`, and `slot`. Its live `el`
getter follows `region.currentView`, including replacements, and is `undefined`
when empty. Handle identities are readonly in TypeScript; the actual View and
Region retain their public methods. Use `mounted.region.show(nextView)` to replace
the root. Cleanup destroys the current View and its owned children. Calling
`region.detachView()` transfers that View back to you to destroy or adopt elsewhere.

| Mount option | Behavior |
| --- | --- |
| `container` | Borrow this Element; append a slot and preserve the host and siblings. Takes precedence over `attachTo`. |
| `attachTo` | Append a helper-created host to this Element; `null` keeps it detached. Defaults to the chosen document's body. |
| `document` | Fallback Document, after `container.ownerDocument` and `attachTo.ownerDocument`, before the global document. |
| `regionClass` | Defaults to Marionette's Region. Pass `runtime.Region` for an isolated `createMarionette()` runtime. |
| `replaceElement` | Uses the Region class default when omitted (`false` for the standard Region). Set `true` to put each View root directly inside the container, including later replacements. |
| `showOptions` | View-only options for the initial `Region.show`, including `replaceElement`. |

`container` is the host; `slot` is the original Region placeholder, temporarily
unparented during replacement. Scope DOM queries to `container`. Ownership is
captured at mount time; later changes to options or handle properties cannot
redirect cleanup. Borrowed data, channels, providers and destination elements
remain borrowed.

### Mount an Application

```js
import { Application, View } from 'marionette';
import { mountApplication } from '@mnjs/test';

const Feature = Application.extend({
  async prepareStart() {
    return { name: 'Ada' };
  },
  onStart(app, options, profile) {
    this.showView(new View({ template: () => profile.name }));
  },
});
const mounted = mountApplication(region => new Feature({ region }));
try {
  if (!await mounted.ready) throw new Error('Startup was cancelled');
  console.log(mounted.app.getView(), mounted.el);
} finally {
  await mounted.cleanup();
}
```

The factory must return a **fresh, unstarted Application**. The helper passes its
Region to the factory and initial `start()`; `startOptions` forwards other startup
options. The returned handle adds `app` and `ready` to the mount fields above.

By default the helper starts the Application. `ready` is the actual initial start
Promise: `true` for success, `false` for cancellation, rejection for failure.
Pass `start: false` to leave startup to the caller; then `ready` resolves `false`
without calling `start()`. It remains the initial attempt after restart;
await `app.restart()` explicitly. Cleanup begins in the calling turn and cancels
pending preparation before destroying the Application and helper Region. You can
also call `app.stop()` while preparation is pending.

To test an existing shell without starting its feature work:

```js
import { Application, View } from 'marionette';
import { mountApplication } from '@mnjs/test';

const mounted = mountApplication(region => new Application({ region }), {
  start: false, replaceElement: true,
});
try {
  mounted.app.showView(new View({ template: () => '<h1>Shell</h1>' }));
  console.log(mounted.container.firstElementChild === mounted.app.getView().el);
  await mounted.app.start(); // The test chooses when startup happens.
} finally {
  await mounted.cleanup();
}
```

Readiness covers preparation, including children that preparation explicitly awaits.
It does not await asynchronous notification hooks, later saves or every future task.
Observe those operations' own completion boundaries. Coordinate cancellation of
required child startup explicitly; a preparation signal is not a lifetime signal
after startup succeeds.

### Own a test's resources

```js
import { View } from 'marionette';
import { createTestScope, mountView } from '@mnjs/test';

const scope = createTestScope();
const controller = new AbortController();
scope.defer(() => controller.abort());
const mounted = scope.own(mountView(new View({ template: () => '<p>Owned</p>' })));
try {
  console.log(mounted.el.textContent);
} finally {
  await scope.cleanup();
}
```

`own(resource)` registers `resource.cleanup()` and returns the same resource.
`defer(callback)` registers a disposer. Returned values are ignored and promises
are awaited, one callback at a time in reverse registration order. Cleanup returns
the same Promise on every call. Registration after cleanup begins throws; create
a fresh scope for the next test. A disposer must not await its own scope's cleanup.

Always await or return cleanup so failures reach your runner. An
`AggregateError.errors` array preserves encountered failures in execution order
while other registered disposers run. Application and Region destruction form one
dependent operation: an Application teardown failure skips Region destruction;
helper-owned fixture DOM is still removed. Partial framework operations are not retried.

A synchronous mount failure removes only the helper-created slot and host, then
rethrows the original error. It does not destroy or repair partially initialized
framework objects. With a borrowed host and `replaceElement`, a failed attach
callback can leave the View's own element in that host. Async startup failure
rejects `ready`; cleanup of the returned handle remains your responsibility.
Register your own listeners, subscriptions and servers, and restore runner mocks
and timers at their chosen lifetime. There is no universal leak detector.

## Lifecycle semantics

### Runner contexts

`mounts.mountView` and `mounts.mountApplication` accept the neutral helper options
and return the same handles. Application mounting starts by default; use
`{ start: false }` for manual startup. `replaceElement` defaults to `true` in runner
contexts so the View is a direct child of its container; pass `false` if a slot is
intentional. Register project disposers with `mounts.scope.defer(...)` or
`mounts.scope.own(...)`. `mounts.cleanup()` closes this context and is idempotent.

Context teardown initiates **all owned mount cleanup immediately**, then awaits
those results before cleaning the project scope. This aborts pending Application
preparation before a slow project disposer can delay it. Project disposers remain
LIFO; failures are retained in `AggregateError.errors`. Closed contexts reject new
mounts. Code that acquires resources outside these mount functions must register
or release them itself.

The runnable [form suite](https://github.com/marionettejs/marionette/blob/master/packages/test/examples/form.spec.js)
uses this fixture for validation, focus, failed saves, retry and cancellation in
JSDOM and Chromium with Testing Library. It needs no per-file mount tracking or
`beforeEach`/`afterEach` ownership boilerplate.

### Cypress queue and startup

`mount(viewOrFactory, options?)` returns a Cypress chain yielding a `MountedView`.
A factory runs **inside the queue after prior cleanup finishes**. It receives a
fresh project scope: register providers/listeners there and return a fresh View.
Factories are synchronous; put asynchronous Cypress setup in earlier commands.
The adapter uses `[data-cy-root]`, destroys the previous mount before replacement,
and awaits cleanup before and after each test. `setupCypress()` is idempotent and
component-only. Importing this entry registers no commands or hooks.

`start: true` waits for initial readiness; cancellation rejects the command and
startup failure preserves its error. `start: false` never calls `app.start()`;
use the public Application API when the test chooses to start. Its factory receives
`(region, scope)` so project setup can stay at the support-wrapper boundary.
Queued `unmount()` explicitly awaits the same teardown. Optional `log: false`
suppresses the mount log. Runner mount options accept `regionClass`,
`replaceElement`, and initial View `showOptions` or Application `startOptions`;
the runner chooses the container.

The chain yields a handle, not a DOM query subject. Use `cy.get(...)` or a project
wrapper ending in `.get('#root')` when a DOM subject is required. The integration
does not choose application startup, global providers or CSS for that wrapper.

### Playwright stories and updates

Each story receives serializable props and a context with the same owned mount
methods as the Vitest fixture. Stories own browser providers, callbacks and CSS.
A story can await setup; acquire resources through the context before waiting so
`unmount()` can cancel pending Application startup. Return an `update(props)`
callback for state-preserving updates; returning nothing means updates are unsupported.
With TypeScript, `Story<{ title: string }>` and the resulting gallery preserve the
required props. Runtime data from the browser boundary still belongs to the story
to validate. Direct gallery calls forward absent props as `undefined`; declare an
optional or defaulted story parameter when omission is supported. Playwright's
fixture also passes omitted props as `undefined`.

`gallery.mount({ story, props? })` mounts a new story or updates the current one;
`gallery.unmount()` starts teardown without waiting for unfinished setup/update.
Unknown story ids and missing update callbacks reject with the story name. Setup
failure cleans acquired resources; combined setup/cleanup failure reports both.
An async setup or update that finishes after unmount rejects. User async work still
needs its own cancellation: cleanup cannot stop arbitrary promises or roll back
external effects. A replacement waits for prior disposal before its factory runs.

Playwright 1.63 navigates on each fixture `mount` call and uses `window.mount` for
`component.update`. Its fixture does not invoke `window.unmount` at test teardown;
return that Promise from the `afterEach` above. The
[gallery](https://github.com/marionettejs/marionette/blob/master/packages/test/examples/gallery/gallery.js)
and [specs](https://github.com/marionettejs/marionette/tree/master/packages/test/examples/playwright)
include a prepared Application and native keyboard submission.

## Tested with

| Entry / runner | Version and checks |
| --- | --- |
| `@mnjs/test` | Marionette 5.0.0; ESM/CommonJS, DOM-free imports and lifecycle tests. |
| `@mnjs/test/vitest` | Vitest 5.0.3; ESM fixture, JSDOM and Chromium form suite. |
| `@mnjs/test/playwright` | Playwright 1.63.0; browser gallery with its built-in fixture and ESM/CommonJS browser helper. |
| `@mnjs/test/cypress` | Cypress 16.1.1 declarations and mount-utils 4.0.0 queue/hook contract checks. |

Cypress/mount-utils and Vitest are optional peers. Import the adapter you use;
the neutral entry and browser gallery do not require these runners. The
[example manifest and lockfile](https://github.com/marionettejs/marionette/tree/master/packages/test/examples)
record exact tool versions. Other runner versions and integrations have not been
checked. This package remains unpublished.

From the Marionette repository, after building, run the installed consumer checks:

```sh
npm run test:helpers:consumer
MNJS_TEST_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:helpers:consumer -- --browser
```

These pack the helper and install the locked example project in isolation to check
ESM/CommonJS imports, strict declarations and DOM interactions. The browser flag
adds Vitest Browser and Playwright Test. Cypress declarations are checked
separately from neutral consumers to keep their globals isolated.

Runner conventions follow the [Cypress mount guide](https://docs.cypress.io/api/commands/mount),
[Vitest fixture guide](https://vitest.dev/guide/test-context) and
[Playwright component guide](https://playwright.dev/docs/test-components).
