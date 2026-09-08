# Testing a Marionette application

Test observable application behavior through the same package and integrations
used in production. Keep fast View tests for local contracts, then use a real
browser for focus, layout, navigation, and third-party DOM behavior. Marionette
does not require a particular test runner or supply a browser environment.

## A small View test

This complete example uses Node's test runner and a DOM supplied by `jsdom`.
Install `jsdom` as a development dependency and run `node --test counter.test.mjs`.
Keep DOM-dependent modules inside the configured environment. The View uses no
Backbone or jQuery adapter.

```javascript
// counter.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('a delegated button updates the existing screen and stops after destruction', async () => {
  const dom = new JSDOM('<!doctype html><main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let region;
  try {
    const { Region, View } = await import('marionette');
    const Counter = View.extend({
      template: () => '<button type="button"><span>Increment</span></button><output>0</output>',
      events: { 'click button': 'increment' },
      initialize() { this.count = 0; },
      increment(event) {
        assert.equal(event.delegateTarget.tagName, 'BUTTON');
        this.count += 1;
        this.el.querySelector('output').textContent = String(this.count);
      }
    });
    region = new Region({ el: document.querySelector('main') });
    const view = new Counter();
    region.show(view);
    const button = view.el.querySelector('button');
    button.querySelector('span').click();
    assert.equal(view.el.querySelector('output').textContent, '1');
    assert.equal(view.el.querySelector('button'), button);
    region.empty();
    assert.equal(view.isDestroyed(), true);
    button.click();
    assert.equal(view.count, 1);
    assert.equal(document.querySelector('main').children.length, 0);
  } finally {
    region?.destroy();
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});
```

Run tests that mutate global DOM objects in isolation, or use your runner's DOM
environment and cleanup hooks. Configure adapters before constructing owners.
Use `createMarionette()` for independent runtimes with different global defaults;
it is not necessary for every test. Avoid test order dependence from shared Radio
channels or runtime configuration.

## Assert resource ownership

| Change under test | Assertions that establish behavior |
| --- | --- |
| Region replacement | The new View is current; the old one is destroyed exactly once; its subscriptions no longer fire. |
| Deliberate detach | The View is alive and reusable; another owner eventually shows or destroys it. |
| Collection update | Unaffected child View and input identities survive; draft, focus, and selection remain; removed children are destroyed. |
| Provider/source replacement | Updates from the new source reach the owner; old source updates no longer do. |
| Async navigation | Resolve the second request first; a late first success or failure cannot replace it. Test a client that ignores abort. |
| Application shutdown | Await stop/destroy; pending work is canceled; no late DOM write occurs. |
| Widget rendering | Acquire once per host; release before replacement and on final removal; no duplicate global listeners. |

Do not prove teardown only by asserting that `destroy()` was called. Trigger the
old source, click a retained detached node, or resolve the late promise and verify
that nothing commits. The [routing fixture](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-routing/validate.mjs)
and [form/widget fixture](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-application-guides/validate.mjs)
show these assertions against the exact documented examples.

## Use a real browser where it changes the conclusion

A simulated DOM can establish event wiring and object identity. It cannot prove
layout, paint, native constraint-validation presentation, or announcements by
assistive technology. In the browser, test keyboard submission, focus and selection
through provider updates, direct navigation to a deep URL, and cleanup after
leaving and returning to a feature. Exercise the actual selected DomApi and widget,
not a mock that always preserves nodes.

Observe failures through the rendered UI and application API boundary. A green
compiler, coverage percentage, or matching screenshot alone does not establish
that the intended operation succeeded. Keep test data anonymous and deterministic.

## Keep examples and evidence together

For repository contributions, an `executable-example` marker connects a canonical
JavaScript fence to a fixture that extracts and executes it. The marker checker
checks the connection, not behavior. `npm run test:fixtures` builds and tests
installed package artifacts; `npm run docs:check` verifies example markers and
document links. Application projects should use their own package lock and CI
commands rather than copying Marionette's maintainer workflow wholesale.
