# Test Views and Applications

Consumer reference for `@mnjs/test` **0.1.1** with Marionette **5.x**.
For installation and a first complete test, start with the [package README](readme.md).
Mounting requires a DOM; importing the neutral entry and creating a cleanup scope do not.
Repository-example links follow `master` and may change; this installed guide
describes the helper version above.

Choose the part that matches your test:

- [Mocha with the core](#mocha-use-the-core)
- [Vitest fixtures](#vitest-own-mounts-per-test)
- [Testing Library queries](#testing-library-query-an-existing-mount)
- [Cypress component setup](#cypress-register-cymount-once)
- [Playwright gallery setup](#playwright-mount-named-browser-stories)
- [Views, Applications and resource scopes](#shared-api)
- [Cleanup, readiness and runner behavior](#lifecycle-semantics)
- [Tested versions](#tested-with)

## Mocha: use the core

The root `@mnjs/test` entry is runner-independent. With Mocha, use its ordinary
async tests and your own assertions; no helper adapter or hook registration is
needed. After [installing the helper and Marionette](readme.md#install), add:

```sh
npm install --save-dev --save-exact mocha@12.0.3 jsdom@30.1.1
```

Create `test/dom.mjs`. Node must load this **before** Marionette or the helper can
capture a DOM environment:

```js
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://example.test/'
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
```

Create `test/core.test.mjs`:

```js
import assert from 'node:assert/strict';
import { it } from 'mocha';
import { Application, View } from 'marionette';
import { mountApplication } from '@mnjs/test';

const Greeting = Application.extend({
  async prepareStart() { return { name: 'Ada' }; },
  onStart(_app, _options, profile) {
    this.showView(new View({ template: () => `Hello ${profile.name}` }));
  }
});

it('shows prepared output', async function() {
  const mounted = mountApplication(region => new Greeting({ region }));
  try {
    assert.equal(await mounted.ready, true);
    assert.equal(mounted.el.textContent, 'Hello Ada');
  } finally {
    await mounted.cleanup();
  }
});
```

Run from the project directory, with Node preloading the DOM before Mocha loads
the test's static imports:

```sh
node --import ./test/dom.mjs ./node_modules/mocha/bin/mocha.js test/core.test.mjs
```

The async test returns its Promise to Mocha. `ready` covers initial Application
startup, not later work; cleanup is awaited even when readiness or an assertion
fails. For multiple tests, a Mocha `afterEach` can instead return or await cleanup
of the resources owned by that test.

## Vitest: own mounts per test

Use the [README setup](readme.md#write-a-test-with-vitest) for Vitest 5 with JSDOM,
or configure Vitest Browser Mode. Each test receives its own `mounts`
fixture and awaited teardown, including concurrent tests and failing assertions.

```js
import { expect } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { View } from 'marionette';
import { withQueries } from '@mnjs/test/testing-library';

const Greeting = View.extend({ template: () => '<h1>Hello</h1>' });
test('renders a greeting', ({ mounts }) => {
  const mounted = withQueries(mounts.mountView(new Greeting()));
  expect(mounted.getByRole('heading').textContent).toBe('Hello');
}); // The fixture awaits teardown, including when the test fails.
```

## Testing Library: query an existing mount

Install `@testing-library/dom` alongside the helper, then import `withQueries` from
`@mnjs/test/testing-library`. It decorates an existing View or Application mount
in place and returns that same handle with standard `getBy*`, `getAllBy*`,
`queryBy*`, `queryAllBy*`, `findBy*` and `findAllBy*` methods. Role/name, label,
missing/multiple-result errors and asynchronous polling follow DOM Testing Library.
This is an ergonomic wrapper around `within`, not another runner or lifecycle.

```js
import { expect } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { withQueries } from '@mnjs/test/testing-library';
import { Application, View } from 'marionette';

const Editor = View.extend({ template: () => '<label>Name <input></label>' });
const Feature = Application.extend({ onStart() { this.showView(new Editor()); } });
test('queries prepared output', async ({ mounts }) => {
  const mounted = withQueries(mounts.mountApplication(region => new Feature({ region })));
  await expect(mounted.ready).resolves.toBe(true);
  expect(await mounted.findByLabelText('Name')).toBe(mounted.el.querySelector('input'));
});
```

Queries bind to the stable `mounted.container`, so `region.show()` replacement and
`replaceElement` keep working without rebinding. If you supply a borrowed container,
queries include all its descendants, including preexisting siblings. The live `el` getter, concrete
`view`/`app` types, initial `ready` Promise and `cleanup` function are preserved.
The decorator never starts an Application, awaits readiness or registers cleanup;
your existing runner fixture or test scope retains ownership. Always await or
handle `ready` on Application mounts: `findBy*` waits for queried DOM, not global
application idleness or unrelated asynchronous work.

`withQueries(mounted, { baseElement })` binds queries to that borrowed HTMLElement,
for example a portal root. It does not move the mount or change cleanup ownership;
after cleanup, unrelated content in that query root remains queryable. Detached
mounts and elements from another document work without global `screen` or registry.
Query semantics still come from DOM Testing Library and the host DOM; native label
associations may require an attached host. Detached examples use `aria-label`.
Decorating again returns the same handle and replaces its query methods with ones
bound to the newly selected root; omitting `baseElement` restores the container.
Previously destructured query functions keep their original root.

In Cypress, use `cy.mount(...).then(withQueries)` to decorate the yielded handle,
or call it inside `.then(mounted => ...)` when you need `baseElement`. Component
tests can stay in Cypress. Bound `getBy*` calls are synchronous; they do not acquire
Cypress retry semantics. `findBy*` uses Testing Library polling, and a returned
Promise is awaited by Cypress's `.then` command. Existing Cypress teardown still
owns the mount. See the [repository Cypress lifecycle example](https://github.com/marionettejs/marionette/blob/master/packages/test/examples/cypress/component/lifecycle.cy.js).

Import `userEvent` from `@testing-library/user-event` separately for interactions;
install/configure `@testing-library/jest-dom` separately if your runner supports
its matchers. Neither is required by this entrypoint. Existing `within(container)`
code continues to work; the [repository form suite](https://github.com/marionettejs/marionette/blob/master/packages/test/examples/form.spec.js)
demonstrates the decorator with per-test ownership.

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

The component HTML needs `<div data-cy-root></div>`. The configuration below uses
Cypress's custom Vite dev-server function without a UI-framework preset.

### Cypress configuration

For the setup below, install the custom dev server and Vite alongside Cypress:

```sh
npm install --save-dev --save-exact cypress@16.1.1 @cypress/mount-utils@5.0.0 @cypress/vite-dev-server@8.0.0 vite@8.0.16
```

The adapter's optional Cypress peer accepts `>=14`, with no upper cap. Future
majors are allowed by policy; the tested versions below are the verification set,
not a claim that future versions have already been tested. This modern example's
dev server requires Cypress 16; it does not set the shipped adapter's minimum.
Existing Cypress 14–15 component projects should keep their version-compatible
dev-server configuration. The adapter uses `testingType`, `cy.then`, `Cypress.log`
and mount-utils' `getContainerEl`/`setupHooks`, with a `[data-cy-root]` container.
Cypress 14.0.0 bundles Electron 33.2.1 / Chromium 130.0.6723.137, which includes
`Promise.withResolvers()` used by the helper and Marionette. This browser API
check does not establish execution of the Cypress lifecycle integration; see the
[compatibility evidence](#tested-with) before adopting the lower peer boundary.

Use `cypress.config.mjs` so the configuration works in either a CommonJS or ESM
application. Cypress's normal installation also needs its browser binary and OS
display dependencies.

```js
import { defineConfig } from 'cypress';
import { devServer } from '@cypress/vite-dev-server';

export default defineConfig({
  component: {
    devServer(config) { return devServer({ ...config, viteConfig: {} }); },
    specPattern: 'cypress/component/**/*.cy.js',
    supportFile: 'cypress/support/component.js',
    indexHtmlFile: 'cypress/support/component-index.html'
  }
});
```

Create `cypress/support/component-index.html`:

```html
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Component tests</title></head>
<body><div data-cy-root></div></body></html>
```

Keep the command registration above in `cypress/support/component.js`. Put this
first spec in `cypress/component/greeting.cy.js`, then run
`npx cypress run --component --config-file cypress.config.mjs`:

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

### Playwright configuration

Install the runner and dev server, then install Chromium through Playwright's
normal browser setup:

```sh
npm install --save-dev --save-exact @playwright/test@1.63.0 vite@8.0.16
npx playwright install chromium
```

Save the story module above as `gallery/gallery.js` and create
`gallery/index.html`:

```html
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Gallery</title></head>
<body><div id="root"></div><script type="module" src="./gallery.js"></script></body></html>
```

Use `playwright.config.mjs`:

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  use: { baseURL: 'http://127.0.0.1:4187/gallery/index.html' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187/gallery/index.html',
    reuseExistingServer: false
  }
});
```

Save the test above as `playwright/editor.spec.js` and run `npx playwright test`.
Stop any existing server on port 4187 first so the test uses this gallery. If your
project already supplies a dev server or browser configuration, adapt those two
settings while retaining the awaited `afterEach` cleanup.

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
Always await or handle `mounted.ready`, including inside a gallery story, so startup
failures reach the test that owns the mount. Cleanup does not consume startup errors.
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
while other registered disposers run. Helper-owned wrapper messages summarize
failures for runner reporters; user-created aggregate errors retain their own
message and nested errors. Application and Region destruction form one
dependent operation: an Application teardown failure skips Region destruction;
helper-owned fixture DOM is still removed. Partial framework operations are not retried.

A synchronous mount failure removes only the helper-created slot and host, then
rethrows the original error. It does not destroy or repair partially initialized
framework objects. With a borrowed host and `replaceElement`, a failed attach
callback can leave the View's own element in that host. Async startup failure
rejects `ready`; cleanup of the returned handle remains your responsibility.
Register your own listeners, subscriptions and servers, and restore runner mocks
and timers at their chosen lifetime. There is no universal leak detector.

Use `createMarionette()` for independent class/provider and Radio families. Pass
that runtime's `Region` when mounting its Views, and register cleanup for the Radio
instance your test owns. The [repository runtime isolation example](https://github.com/marionettejs/marionette/blob/master/packages/test/examples/runtime.spec.js)
shows this with ordinary `mounts.scope.defer(...)` callbacks and public channel APIs.

## Lifecycle semantics

### Runner contexts

`mounts.mountView` and `mounts.mountApplication` accept the neutral helper options
and return the same handles. Application mounting starts by default; use
`{ start: false }` for manual startup. `replaceElement` defaults to `true` in runner
contexts so the View is a direct child of its container; pass `false` if a slot is
intentional. Register project disposers with `mounts.scope.defer(...)` or
`mounts.scope.own(...)`. `mounts.cleanup()` closes this context and is idempotent. It returns the same
Promise, including a cached rejection. Catching a cleanup rejection inside a test
does not make the fixture's later teardown succeed: it reports that same failure.
Use an independently owned neutral scope or an expected-failure runner test when
asserting teardown errors.

Context teardown initiates **all owned mount cleanup immediately**, then awaits
those results before cleaning the project scope. This aborts pending Application
preparation before a slow project disposer can delay it. Project disposers remain
LIFO; failures are retained in `AggregateError.errors`. Closed contexts reject new
mounts. Code that acquires resources outside these mount functions must register
or release them itself.

The [repository form suite](https://github.com/marionettejs/marionette/blob/master/packages/test/examples/form.spec.js)
uses this fixture for validation, focus, failed saves, retry and cancellation in
JSDOM and Chromium with Testing Library. It needs no per-file mount tracking or
`beforeEach`/`afterEach` ownership boilerplate.

### Cypress queue and startup

`mount(viewOrFactory, options?)` returns a Cypress chain yielding a `MountedView`.
A factory runs **inside the queue after prior cleanup finishes**. It receives a
fresh project scope: register providers/listeners there and return a fresh View.
Factories are synchronous; put asynchronous Cypress setup in earlier commands.
Pass a View instance or `() => new MyView()`; a View constructor alone is not a factory.
The adapter uses `[data-cy-root]`, destroys the previous mount before replacement,
and awaits cleanup before and after each test. `setupCypress()` is idempotent and
component-only. Importing this entry registers no commands or hooks.
After-test cleanup also removes the final mounted UI in Cypress open mode. This
adapter prioritizes awaited resource release over leaving that UI available for inspection.

`start: true` waits for initial readiness; cancellation rejects the command and
startup failure preserves its error. `start: false` never calls `app.start()`;
use the public Application API when the test chooses to start. Its factory receives
`(region, scope)` so project setup can stay at the support-wrapper boundary.
Queued `unmount()` explicitly awaits the same teardown. Optional `log: false`
suppresses the mount log. Runner mount options accept `regionClass`,
`replaceElement`, and initial View `showOptions` or Application `startOptions`;
the runner chooses the container.
Mounting and queued cleanup use Cypress's configured `defaultCommandTimeout`.
Set that option in the project or test configuration when readiness or disposal
needs more time; later query timeouts do not extend an earlier mount command.

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
external effects. Starting a replacement invalidates the previous story's update
handle immediately, then waits for prior disposal before its factory runs.

Playwright 1.63 navigates on each fixture `mount` call and uses `window.mount` for
`component.update`. Before calling the fixture's `mount()` again in the same test,
await the previous handle's `component.unmount()` so its story's disposers run
before navigation. Use `component.update(props)` when the existing story should
remain mounted. The fixture does not invoke `window.unmount` at test teardown;
return that Promise from the `afterEach` above, which cleans up the final page. The
[repository gallery](https://github.com/marionettejs/marionette/blob/master/packages/test/examples/gallery/gallery.js)
and [repository specs](https://github.com/marionettejs/marionette/tree/master/packages/test/examples/playwright)
include a prepared Application and native keyboard submission.

## Tested with

| Entry / runner | Version and checks |
| --- | --- |
| `@mnjs/test` | Marionette 5.0.0; ESM/CommonJS, DOM-free imports and lifecycle tests. |
| `@mnjs/test/vitest` | Vitest 5.0.3; ESM fixture, JSDOM and Chromium form suite. |
| `@mnjs/test/playwright` | Playwright 1.63.0; browser gallery with its built-in fixture and ESM/CommonJS browser helper. |
| `@mnjs/test/cypress` | Cypress 16.1.1 / Electron and mount-utils 5.0.0; component lifecycle and expected-failure cleanup probes. |
| `@mnjs/test/testing-library` | DOM Testing Library 10.4.1; ESM/CommonJS and types, scoped queries, replacement, readiness and existing runner cleanup. |

The Cypress runtime result above is the existing 0.1.0 baseline. The 0.1.1 optional
Cypress peer is `>=14`. Installation and declaration checks alone do not establish
mounting or cleanup compatibility. For a published release, consult its release
notes for runtime results tied to that archive; the peer range itself does not
certify every accepted version.

The 0.1.1 installation/declaration matrix covers Cypress 14.0.0, 15.0.0, 15.21.1,
16.0.0 and 16.2.0, each with mount-utils 4.0.0 and 5.0.0. Declaration consumers
use TypeScript 6.0.3, ES2022 libraries, NodeNext
resolution and `skipLibCheck:false`; this checks ESM and CommonJS public imports.
Older Cypress's bundled Lodash declarations conflict with ES2023 symbol WeakMap
keys, so a newer library target needs compatible upstream Cypress declarations.
A separate consumer imports and type-checks the neutral helper with neither
Cypress nor mount-utils installed.

Cypress/mount-utils, Vitest and DOM Testing Library are optional peers. Import the adapter you use;
the neutral entry and browser gallery do not require these runners. Other runner versions and integrations have not been
checked. The versions above describe this package's compatibility evidence.

The [repository examples](https://github.com/marionettejs/marionette/tree/master/packages/test/examples)
include larger form, runtime-isolation and browser projects. They follow `master`
and may use newer dependencies; use their own manifest and lock when working in
that checkout. The guide installed with `@mnjs/test` remains the reference for
that installed helper version.

Runner conventions follow the [Cypress mount guide](https://docs.cypress.io/api/commands/mount),
[Vitest fixture guide](https://vitest.dev/guide/test-context) and
[Playwright component guide](https://playwright.dev/docs/test-components).
