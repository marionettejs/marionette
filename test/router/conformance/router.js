import { Router } from '@mnjs/router';

/**
 * Router behavior that depends on the driver's navigation semantics: event
 * dispatch timing, navigations started from an intercept handler, entry state
 * updates during a handler, and traversal. Runs under node:test with the memory
 * driver and in a browser with the Navigation API driver.
 *
 * Every URL the routers own lives under a per-scenario prefix, and each
 * scenario starts from an entry it creates, so a real Navigation API stays
 * same-document and scenarios are independent.
 *
 * @param {object} config Runner and driver configuration.
 * @param {string} config.name Suite label.
 * @param {() => ({ driver: object } | Promise<{ driver: object }>)} config.createDriver Fresh driver factory.
 * @param {Function} config.describe Suite registration.
 * @param {Function} config.it Test registration.
 * @param {object} config.assert Chai-style `assert` (ok, equal, deepEqual).
 */
export function routerConformance({ name, createDriver, describe, it, assert }) {
  const root = '/__router-conformance__/router';
  let sequence = 0;

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  function createGate() {
    const gate = {};
    gate.promise = new Promise(resolve => {
      gate.open = resolve;
    });
    return gate;
  }

  function createRoutes() {
    return [{
      path: `${ root }/:run`,
      children: [
        { name: 'page', path: 'page/:id' },
        { name: 'canonical', path: 'canonical/:id' },
        { name: 'legacy', path: 'legacy/:id', redirect: ({ params, query }) => ({ name: 'canonical', params, query }) },
        {
          name: 'source',
          path: 'source/:id',
          redirect: ({ params }) => ({ name: 'page', params }),
        },
        {
          name: 'async-source',
          path: 'async-source/:id',
          redirect: async({ params }) => {
            await delay(5);
            return { name: 'page', params };
          },
        },
      ],
    }];
  }

  // Moves the driver to `url` without a router, so the next router starts there.
  async function moveTo(driver, url) {
    const listeners = new AbortController();
    driver.addEventListener('navigate', event => {
      if (event.canIntercept) {event.intercept({ focusReset: 'manual', scroll: 'manual' });}
    }, { signal: listeners.signal });
    try {
      await driver.navigate(url).finished;
    } finally {
      listeners.abort();
    }
  }

  function createHarness(driver) {
    sequence += 1;
    const run = `run-${ sequence }`;
    const prefix = `${ root }/${ run }/`;
    const log = [];
    const matches = [];
    const behaviors = {};

    const router = new Router({
      routes: createRoutes(),
      driver,
      intercept: url => url.pathname.startsWith(prefix),
      handler: match => {
        log.push(`handler:${ match.name }:${ match.params.id }`);
        return behaviors[match.params.id]?.(match);
      },
    });

    router.on('route', match => {
      matches.push(match);
      log.push(`route:${ match.name }:${ match.params.id }`);
    });
    router.on('route:ready', match => log.push(`ready:${ match.name }:${ match.params.id }`));
    router.on('route:error', (error, match) => log.push(`error:${ match.name }:${ match.params.id }:${ error.message }`));

    return {
      driver,
      router,
      run,
      log,
      behaviors,
      last: () => matches[matches.length - 1],
      href: path => new URL(`${ prefix }${ path }`, driver.currentEntry.url).href,
      moveTo: path => moveTo(driver, new URL(`${ prefix }${ path }`, driver.currentEntry.url).href),
    };
  }

  function scenario(title, run) {
    it(title, async() => {
      const { driver } = await createDriver();
      const harness = createHarness(driver);
      try {
        await run(harness);
      } finally {
        harness.router.stop();
      }
    });
  }

  async function rejectionOf(promise) {
    try {
      await promise;
    } catch (error) {
      return error;
    }
    throw new Error('Expected the promise to reject');
  }

  describe(`router conformance: ${ name }`, () => {
    scenario('dispatches a named navigation', async h => {
      await h.moveTo('start');
      assert.equal(await h.router.start(), true);

      const navigation = h.router.navigate('page', { run: h.run, id: 'a b' }, { info: { from: 'test' } });

      assert.equal(await navigation.committed, true);
      assert.equal(await navigation.finished, true);
      assert.equal(h.driver.currentEntry.url, h.href('page/a%20b'));
      assert.deepEqual(h.log, ['route:page:a b', 'handler:page:a b', 'ready:page:a b']);
      assert.equal(h.last().navigationType, 'push');
      assert.deepEqual(h.last().info, { from: 'test' });
      assert.equal(h.router.getCurrent(), h.last());
    });

    scenario('follows a synchronous redirect with one new history entry', async h => {
      await h.moveTo('start');
      await h.router.start();
      const index = h.driver.currentEntry.index;

      const navigation = h.router.navigate('source', { run: h.run, id: 'x' });

      assert.equal(await navigation.finished, true);
      assert.equal(h.driver.currentEntry.url, h.href('page/x'));
      assert.equal(h.driver.currentEntry.index, index + 1);
      assert.deepEqual(h.log, ['route:page:x', 'handler:page:x', 'ready:page:x']);
      assert.equal(h.last().navigationType, 'replace');
    });

    scenario('redirects a named legacy URL', async h => {
      await h.moveTo('start');
      await h.router.start();

      const navigation = h.router.navigate(new URL(h.href('legacy/y')).pathname);

      assert.equal(await navigation.finished, true);
      assert.equal(h.driver.currentEntry.url, h.href('canonical/y'));
      assert.equal(h.last().name, 'canonical');
      assert.deepEqual(h.log, ['route:canonical:y', 'handler:canonical:y', 'ready:canonical:y']);
    });

    scenario('follows an asynchronous redirect after committing its source', async h => {
      await h.moveTo('start');
      await h.router.start();
      const index = h.driver.currentEntry.index;

      const navigation = h.router.navigate('async-source', { run: h.run, id: 'z' });

      assert.equal(await navigation.finished, true);
      assert.equal(h.driver.currentEntry.url, h.href('page/z'));
      assert.equal(h.driver.currentEntry.index, index + 1);
      assert.deepEqual(h.log, ['route:async-source:z', 'route:page:z', 'handler:page:z', 'ready:page:z']);
    });

    scenario('resolves a superseded navigation false and dispatches only the latest', async h => {
      await h.moveTo('start');
      await h.router.start();
      const slow = createGate();
      h.behaviors.slow = () => slow.promise;

      const first = h.router.navigate('page', { run: h.run, id: 'slow' });
      assert.equal(await first.committed, true);
      const superseded = h.last();
      const second = h.router.navigate('page', { run: h.run, id: 'fast' });

      assert.equal(await first.finished, false);
      assert.equal(await second.finished, true);
      assert.equal(superseded.signal.aborted, true);
      slow.open();
      await delay(0);

      assert.deepEqual(h.log, [
        'route:page:slow', 'handler:page:slow',
        'route:page:fast', 'handler:page:fast', 'ready:page:fast',
      ]);
    });

    scenario('rejects finished with a handler failure and keeps the URL', async h => {
      await h.moveTo('start');
      await h.router.start();
      h.behaviors.fail = () => Promise.reject(new Error('boom'));

      const navigation = h.router.navigate('page', { run: h.run, id: 'fail' });
      const error = await rejectionOf(navigation.finished);

      assert.equal(error.message, 'boom');
      assert.equal(h.driver.currentEntry.url, h.href('page/fail'));
      assert.deepEqual(h.log, ['route:page:fail', 'handler:page:fail', 'error:page:fail:boom']);
    });

    scenario('dispatches the initial entry on start through a redirect', async h => {
      await h.moveTo('source/init');
      const ready = new Promise(resolve => h.router.once('route:ready', resolve));

      assert.equal(await h.router.start(), true);
      await ready;
      assert.equal(h.driver.currentEntry.url, h.href('page/init'));
      assert.equal(h.last().name, 'page');
      assert.equal(h.last().initial, true);
    });

    scenario('traverses back to a router-owned entry', async h => {
      await h.moveTo('start');
      await h.router.start();
      await h.router.navigate('page', { run: h.run, id: 'one' }).finished;
      await h.router.navigate('page', { run: h.run, id: 'two' }).finished;

      assert.equal(h.router.canGoBack(), true);
      assert.equal(await h.router.back(), true);
      assert.equal(h.driver.currentEntry.url, h.href('page/one'));
      assert.equal(h.last().params.id, 'one');
      assert.equal(h.last().navigationType, 'traverse');
    });

    scenario('refresh re-dispatches the current entry without adding one', async h => {
      await h.moveTo('start');
      await h.router.start();
      await h.router.navigate('page', { run: h.run, id: 'r' }).finished;
      const { length } = h.driver.entries();

      assert.equal(await h.router.refresh(), true);
      assert.equal(h.driver.entries().length, length);
      assert.equal(h.last().navigationType, 'replace');
      assert.equal(h.last().params.id, 'r');
    });

    scenario('persists router state on the entries it dispatches', async h => {
      await h.moveTo('start');
      await h.router.start();
      await h.router.navigate('page', { run: h.run, id: 's' }, { state: { scroll: 4 } }).finished;

      h.router.updateState({ focus: 'main' });

      assert.deepEqual(h.router.getCurrent().state, { scroll: 4, focus: 'main' });
      assert.equal(h.driver.currentEntry.getState()['@mnjs/router'], true);
    });

    // The browser would reload the spec document, so a real driver cancels the
    // reload after the router has seen it. The memory driver hands each listener
    // its own event, so it reports a missed reload through documentNavigations.
    scenario('does not intercept a reload navigation', async h => {
      const listeners = new AbortController();
      const seen = { reloads: 0, intercepted: false };
      const isMemory = Array.isArray(h.driver.documentNavigations);
      h.driver.addEventListener('navigate', event => {
        if (event.navigationType !== 'reload') {return;}
        seen.reloads += 1;
        const intercept = event.intercept.bind(event);
        event.intercept = options => {
          seen.intercepted = true;
          return intercept(options);
        };
      }, { signal: listeners.signal });
      await h.moveTo('start');
      await h.router.start();
      await h.router.navigate('page', { run: h.run, id: 'reload' }).finished;
      if (!isMemory) {
        h.driver.addEventListener('navigate', event => {
          if (event.navigationType === 'reload') {event.preventDefault();}
        }, { signal: listeners.signal });
      }
      const logged = h.log.length;

      const reload = h.driver.reload();
      reload.committed.catch(() => {});
      await reload.finished.then(() => {}, () => {});
      listeners.abort();

      assert.equal(seen.reloads, 1);
      assert.equal(seen.intercepted, false);
      assert.equal(h.log.length, logged);
      if (isMemory) {assert.deepEqual(h.driver.documentNavigations.at(-1), h.driver.currentEntry.url);}
    });

    scenario('lets a navigation started from the previous match abort listener win', async h => {
      await h.moveTo('start');
      await h.router.start();
      await h.router.navigate('page', { run: h.run, id: 'one' }).finished;
      let latest;
      h.last().signal.addEventListener('abort', () => {
        latest = h.router.navigate('page', { run: h.run, id: 'three' });
      }, { once: true });

      const superseded = h.router.navigate('page', { run: h.run, id: 'two' });

      assert.equal(await superseded.finished, false);
      assert.equal(await latest.finished, true);
      assert.equal(h.driver.currentEntry.url, h.href('page/three'));
      assert.equal(h.router.getCurrent().params.id, 'three');
      assert.equal(h.log.some(entry => entry.endsWith(':page:two')), false);
    });

    scenario('lets a navigation started from a route listener win', async h => {
      await h.moveTo('start');
      await h.router.start();
      let latest;
      h.router.once('route', () => {
        latest = h.router.navigate('page', { run: h.run, id: 'three' });
      });

      const superseded = h.router.navigate('page', { run: h.run, id: 'two' });

      assert.equal(await superseded.finished, false);
      assert.equal(await latest.finished, true);
      assert.equal(h.driver.currentEntry.url, h.href('page/three'));
      assert.deepEqual(h.log, ['route:page:two', 'route:page:three', 'handler:page:three', 'ready:page:three']);
    });

    scenario('runs no handler when stop() is called from a route listener', async h => {
      await h.moveTo('start');
      await h.router.start();
      h.router.once('route', () => h.router.stop());

      const stopped = h.router.navigate('page', { run: h.run, id: 'two' });

      assert.equal(await stopped.finished, false);
      assert.deepEqual(h.log, ['route:page:two']);
    });

    scenario('aborts a finished match signal when the next match commits and when the router stops', async h => {
      await h.moveTo('start');
      await h.router.start();
      await h.router.navigate('page', { run: h.run, id: 'one' }).finished;
      const first = h.last().signal;
      assert.equal(first.aborted, false);

      await h.router.navigate('page', { run: h.run, id: 'two' }).finished;
      const second = h.last().signal;

      assert.equal(first.aborted, true);
      assert.equal(second.aborted, false);

      h.router.stop();
      assert.equal(second.aborted, true);
    });
  });
}
