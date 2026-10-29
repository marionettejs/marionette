# @mnjs/test

Runner-independent helpers for mounting real Marionette Views and Applications
and awaiting cleanup of the resources your test owns. The core works with any
DOM-capable test runner and your choice of assertions. Optional Vitest, Cypress
and Playwright integrations adapt that same lifecycle; DOM Testing Library adds
queries to an existing mount. Production Marionette does not depend on this
development package.

## Install

Use Marionette 5 and Node.js `^22.22.2 || >=24.15.0`:

```sh
npm install --save-exact marionette@5.0.0
npm install --save-dev --save-exact @mnjs/test@0.1.0
```

Install only the optional tools your tests use. Component tests can stay in
Cypress; the helper does not require a second runner.

## Use the runner-independent core

Import `mountView`, `mountApplication` and `createTestScope` from `@mnjs/test`.
They register no runner hooks or commands. Mounting needs a DOM configured
**before** importing Marionette; a browser already supplies one. This Node example
assumes that preload has run:

```js
import assert from 'node:assert/strict';
import { View } from 'marionette';
import { mountView } from '@mnjs/test';

const mounted = mountView(new View({ template: () => '<h1>Hello</h1>' }));
try {
  assert.equal(mounted.el.textContent, 'Hello');
} finally {
  await mounted.cleanup();
}
```

Use your runner's asynchronous teardown or `try`/`finally` to await cleanup. The
[Mocha example](guide.md#mocha-use-the-core) includes the DOM preload and an
Application readiness check. Optional runner fixtures can manage this ownership
for you, as in the Vitest example below.

## Write a test with Vitest

For a JSDOM test with accessible DOM queries, add:

```sh
npm install --save-dev --save-exact vitest@5.0.3 jsdom@30.1.1 @testing-library/dom@10.4.1
```

Set the environment in `vitest.config.js` (or `vitest.config.mjs` if your project
uses CommonJS):

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'jsdom', include: ['test/**/*.spec.js'] } });
```

Create `test/greeting.spec.js`:

```js
import { expect } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { withQueries } from '@mnjs/test/testing-library';
import { View } from 'marionette';

const Greeting = View.extend({ template: () => '<h1>Hello</h1>' });

test('shows the greeting', ({ mounts }) => {
  const mounted = withQueries(mounts.mountView(new Greeting()));
  expect(mounted.getByRole('heading', { name: 'Hello' }).textContent).toBe('Hello');
});
```

Run `npx vitest run`. The fixture awaits teardown after every test, including a
failing assertion; the test needs no mount registry or cleanup hook.

## Choose your integration

| Import | Use it for |
| --- | --- |
| `@mnjs/test` | `mountView`, `mountApplication` and `createTestScope` with any DOM-capable runner. Register and await cleanup yourself. |
| `@mnjs/test/vitest` | A per-test `mounts` fixture with awaited teardown, including concurrent tests. Requires Vitest 5. |
| `@mnjs/test/cypress` | Explicit command registration, queued mounts and awaited replacement/teardown. Requires Cypress 16.1.1 and mount-utils 4. |
| `@mnjs/test/playwright` | A browser-side story gallery used with Playwright's mount fixture and Locators. Return browser cleanup from the test's `afterEach`. |
| `@mnjs/test/testing-library` | Standard queries bound to an existing mount's stable container. Requires DOM Testing Library 10.4.1; adds no separate lifecycle. |

The neutral entry and gallery do not require the other runners. Mounting requires
a DOM; importing the neutral entry and creating a cleanup scope do not.

## Ownership and readiness

A mount owns its View or Application and the fixture DOM it creates. Supplied
containers, models, providers and channels remain borrowed. Register your own
listeners and subscriptions with the test scope, or release them yourself.

Application mounts start by default. Always await or handle `mounted.ready`: it
resolves `true` for initial startup, `false` for cancellation, and rejects on
failure. It does not wait for later saves or every asynchronous task. Use
`{ start: false }` when the test chooses startup itself.

Always await cleanup. Runner fixtures do this for their owned mounts; neutral
handles need your runner's teardown hook or a `try`/`finally`. Cleanup errors reach
the runner and remain rejected on repeated calls. There is no universal leak
checker or automatic repair of partially failed framework operations.

## Version-matched reference

This package includes its own [consumer guide](guide.md). Open
`node_modules/@mnjs/test/guide.md` from your project for complete runner setup,
all mount options, bound queries, readiness, ownership, teardown errors and tested
versions. Its examples use public package imports. This reference ships with the
helper; it does not require a newer documentation copy in `marionette@5.0.0`.

The general [Marionette testing guide](https://marionettejs.com/docs/guides/testing/)
explains testing rendered content, interaction, readiness and disposal.
