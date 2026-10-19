/**
 * Shared driver conformance suite. Runs under node:test and in a browser
 * (Cypress/Mocha): the runner is injected, so this module imports nothing.
 *
 * Every navigation the suite performs is intercepted by a listener it
 * registers, so a real Navigation API stays same-document. Tests only move
 * through entries they created and use unique URLs, so they are independent of
 * the history the driver starts with.
 *
 * Assertion subset relied on (identical under `node:assert/strict` and Chai's
 * `assert`): `ok`, `equal`, `notEqual` and `deepEqual`, used with primitives and
 * plain JSON-like values only.
 *
 * @param {object} config Runner and driver configuration.
 * @param {string} config.name Suite label.
 * @param {() => ({ driver: object, dispose?: () => void } | Promise<{ driver: object, dispose?: () => void }>)} config.createDriver
 *   Fresh driver per test; `dispose` runs after each test.
 * @param {Function} config.describe Suite registration.
 * @param {Function} config.it Test registration.
 * @param {object} config.assert Chai-style `assert` (ok, equal, notEqual, deepEqual).
 */
export function driverConformance({ name, createDriver, describe, it, assert }) {
  const pathPrefix = '/__router-conformance__';
  let sequence = 0;

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function isPending(promise) {
    const outcome = await Promise.race([
      promise.then(() => 'settled', () => 'settled'),
      delay(20).then(() => 'pending'),
    ]);
    return outcome === 'pending';
  }

  async function failureOf(start) {
    let navigation;
    try {
      navigation = start();
    } catch (error) {
      return error;
    }
    const [, finished] = await Promise.allSettled([navigation.committed, navigation.finished]);
    if (finished.status !== 'rejected') {
      throw new Error('Expected the navigation to reject');
    }
    return finished.reason;
  }

  function createGate() {
    const gate = {};
    gate.promise = new Promise(resolve => {
      gate.open = resolve;
    });
    return gate;
  }

  function snapshot(event) {
    const { destination } = event;
    return {
      navigationType: event.navigationType,
      canIntercept: event.canIntercept,
      hashChange: event.hashChange,
      downloadRequest: event.downloadRequest,
      formData: event.formData,
      userInitiated: event.userInitiated,
      cancelable: event.cancelable,
      info: event.info,
      signal: event.signal,
      url: destination.url,
      key: destination.key,
      index: destination.index,
      state: destination.getState(),
    };
  }

  function createHarness(driver) {
    const controller = new AbortController();
    const events = [];
    const queuedHandlers = [];
    const behavior = { prevent: false };

    driver.addEventListener('navigate', event => {
      events.push(snapshot(event));
      if (behavior.prevent) {
        event.preventDefault();
        return;
      }
      if (!event.canIntercept) {return;}
      const handler = queuedHandlers.shift() || (() => {});
      event.intercept({ handler, focusReset: 'manual', scroll: 'manual' });
    }, { signal: controller.signal });

    return {
      driver,
      events,
      controller,
      behavior,
      stop: () => controller.abort(),
      handleNext: handler => queuedHandlers.push(handler),
      last: () => events[events.length - 1],
      url(label) {
        sequence += 1;
        return new URL(`${ pathPrefix }/${ sequence }/${ label }`, driver.currentEntry.url).href;
      },
      async go(url, options) {
        const navigation = driver.navigate(url, options);
        return navigation.finished;
      },
    };
  }

  function scenario(title, run) {
    it(title, async() => {
      const { driver, dispose } = await createDriver();
      const harness = createHarness(driver);
      try {
        await run(harness);
      } finally {
        harness.stop();
        if (dispose) {dispose();}
      }
    });
  }

  describe(`driver conformance: ${ name }`, () => {
    scenario('exposes capabilities, the current entry and entries', async({ driver }) => {
      assert.equal(typeof driver.capabilities.cancelTraverse, 'boolean');
      assert.equal(typeof driver.capabilities.interceptsLinks, 'boolean');

      const { currentEntry } = driver;
      assert.equal(typeof currentEntry.url, 'string');
      assert.equal(typeof currentEntry.key, 'string');
      assert.equal(typeof currentEntry.index, 'number');
      assert.equal(typeof currentEntry.getState, 'function');
      assert.equal(driver.entries()[currentEntry.index].key, currentEntry.key);
    });

    scenario('returns committed and finished promises for every navigation method', async h => {
      const navigation = h.driver.navigate(h.url('promises'));
      assert.equal(typeof navigation.committed.then, 'function');
      assert.equal(typeof navigation.finished.then, 'function');
      await navigation.finished;

      const reload = h.driver.reload();
      assert.equal(typeof reload.committed.then, 'function');
      assert.equal(typeof reload.finished.then, 'function');
      await reload.finished;
    });

    scenario('push commits a new entry and reports the navigate event', async h => {
      const { driver, events } = h;
      const before = driver.currentEntry.index;
      const url = h.url('push');
      const navigation = driver.navigate(url, { info: { source: 'test' } });

      const committed = await navigation.committed;
      assert.equal(committed.url, url);
      assert.equal(driver.currentEntry.key, committed.key);
      assert.equal(driver.currentEntry.url, url);
      assert.equal(driver.currentEntry.index, before + 1);
      assert.equal(driver.entries().length, before + 2);

      const finished = await navigation.finished;
      assert.equal(finished.key, committed.key);

      assert.equal(events.length, 1);
      const [event] = events;
      assert.equal(event.navigationType, 'push');
      assert.equal(event.url, url);
      assert.equal(event.canIntercept, true);
      assert.equal(event.hashChange, false);
      assert.equal(event.downloadRequest, null);
      assert.equal(event.formData, null);
      assert.equal(event.userInitiated, false);
      assert.equal(event.cancelable, true);
      assert.deepEqual(event.info, { source: 'test' });
    });

    scenario('leaves info undefined when none is given', async h => {
      await h.go(h.url('no-info'));
      assert.equal(h.last().info, undefined);
    });

    scenario('replace swaps the current entry and keeps its key', async h => {
      const { driver } = h;
      const first = await h.go(h.url('base'));
      const { key, index } = first;
      const length = driver.entries().length;
      const url = h.url('replaced');

      const entry = await h.go(url, { history: 'replace' });
      assert.equal(h.last().navigationType, 'replace');
      assert.equal(entry.url, url);
      assert.equal(entry.key, key);
      assert.equal(entry.index, index);
      assert.equal(driver.currentEntry.url, url);
      assert.equal(driver.entries().length, length);
    });

    scenario('auto pushes a new URL and replaces when the URL is unchanged', async h => {
      const { driver } = h;
      const url = h.url('auto');
      await h.go(url);
      const length = driver.entries().length;

      await h.go(url);
      assert.equal(driver.entries().length, length);

      await h.go(h.url('auto-other'));
      assert.equal(driver.entries().length, length + 1);
      assert.deepEqual(h.events.map(event => event.navigationType), ['push', 'replace', 'push']);
    });

    scenario('stores structured-cloned state and defaults to undefined', async h => {
      const state = { nested: { value: 1 }, list: [1, 2] };
      const entry = await h.go(h.url('state'), { state });
      state.nested.value = 2;

      assert.deepEqual(entry.getState(), { nested: { value: 1 }, list: [1, 2] });
      assert.notEqual(entry.getState(), entry.getState());
      assert.deepEqual(h.last().state, { nested: { value: 1 }, list: [1, 2] });

      const plain = await h.go(h.url('no-state'));
      assert.equal(plain.getState(), undefined);
    });

    scenario('updateCurrentEntry replaces state without a navigate event', async h => {
      const { driver } = h;
      const entry = await h.go(h.url('update'), { state: { a: 1 } });
      const count = h.events.length;

      driver.updateCurrentEntry({ state: { b: 2 } });

      assert.deepEqual(driver.currentEntry.getState(), { b: 2 });
      assert.deepEqual(driver.entries()[driver.currentEntry.index].getState(), { b: 2 });
      assert.equal(driver.currentEntry.key, entry.key);
      assert.equal(h.events.length, count);
    });

    scenario('reload re-dispatches the current entry and keeps or replaces its state', async h => {
      const { driver } = h;
      const entry = await h.go(h.url('reload'), { state: { keep: true } });
      const length = driver.entries().length;

      const reloaded = await driver.reload({ info: 'reloading' }).finished;
      assert.equal(h.last().navigationType, 'reload');
      assert.equal(h.last().info, 'reloading');
      assert.equal(h.last().url, entry.url);
      assert.equal(reloaded.key, entry.key);
      assert.equal(driver.entries().length, length);
      assert.deepEqual(driver.currentEntry.getState(), { keep: true });

      await driver.reload({ state: { keep: false } }).finished;
      assert.deepEqual(driver.currentEntry.getState(), { keep: false });
      assert.equal(driver.currentEntry.key, entry.key);
    });

    scenario('flags fragment-only navigations as hash changes', async h => {
      const base = h.url('hash');
      await h.go(base);
      await h.go(`${ base }#section`);
      await h.go(h.url('after-hash'));

      assert.deepEqual(h.events.map(event => event.hashChange), [false, true, false]);
      assert.equal(h.events[1].navigationType, 'push');
    });

    scenario('assigns unique keys and sequential indexes', async h => {
      const { driver } = h;
      const start = driver.currentEntry.index;
      await h.go(h.url('one'));
      await h.go(h.url('two'));
      await h.go(h.url('three'));

      const created = driver.entries().slice(start);
      created.forEach((entry, offset) => assert.equal(entry.index, start + offset));
      const keys = created.map(entry => entry.key);
      assert.equal(new Set(keys).size, keys.length);
      assert.equal(driver.currentEntry.index, start + 3);
    });

    scenario('back and traverseTo traverse existing entries', async h => {
      const { driver } = h;
      const first = await h.go(h.url('a'), { state: { n: 1 } });
      const second = await h.go(h.url('b'));
      const length = driver.entries().length;

      const backward = driver.back();
      const arrived = await backward.committed;
      assert.equal(arrived.key, first.key);
      assert.equal(driver.currentEntry.key, first.key);
      await backward.finished;

      assert.equal(h.last().navigationType, 'traverse');
      assert.equal(h.last().url, first.url);
      assert.equal(h.last().key, first.key);
      assert.equal(h.last().index, first.index);
      assert.deepEqual(h.last().state, { n: 1 });
      assert.equal(h.last().userInitiated, false);
      assert.equal(h.last().hashChange, false);

      const forward = await driver.traverseTo(second.key).finished;
      assert.equal(forward.key, second.key);
      assert.equal(driver.currentEntry.url, second.url);
      assert.equal(h.last().navigationType, 'traverse');
      assert.equal(driver.entries().length, length);
    });

    scenario('traverseTo the current key resolves without a navigate event', async h => {
      const { driver } = h;
      const entry = await h.go(h.url('current'));
      const count = h.events.length;

      const result = await driver.traverseTo(entry.key).finished;

      assert.equal(result.key, entry.key);
      assert.equal(h.events.length, count);
    });

    scenario('traverseTo an unknown key rejects with InvalidStateError', async h => {
      const error = await failureOf(() => h.driver.traverseTo('no-such-entry-key'));
      assert.equal(error.name, 'InvalidStateError');
    });

    scenario('a push after traversing back drops the forward entries', async h => {
      const { driver } = h;
      const first = await h.go(h.url('a'));
      await h.go(h.url('b'));
      await driver.back().finished;
      const third = await h.go(h.url('c'));

      assert.equal(driver.entries().length, driver.currentEntry.index + 1);
      assert.deepEqual(driver.entries().slice(-2).map(entry => entry.url), [first.url, third.url]);
    });

    scenario('finished waits for the intercept handler but committed does not', async h => {
      const { driver } = h;
      const gate = createGate();
      h.handleNext(() => gate.promise);

      const navigation = driver.navigate(h.url('slow'));
      const entry = await navigation.committed;
      assert.equal(driver.currentEntry.key, entry.key);
      assert.ok(await isPending(navigation.finished));

      gate.open();
      const finished = await navigation.finished;
      assert.equal(finished.key, entry.key);
      assert.equal(h.last().signal.aborted, false);
    });

    scenario('rejects finished with the handler failure after committing', async h => {
      h.handleNext(() => Promise.reject(new Error('handler failed')));

      const navigation = h.driver.navigate(h.url('failing'));
      const [committed, finished] = await Promise.allSettled([navigation.committed, navigation.finished]);

      assert.equal(committed.status, 'fulfilled');
      assert.equal(finished.status, 'rejected');
      assert.equal(finished.reason.message, 'handler failed');
    });

    scenario('a new navigation aborts the previous one with AbortError', async h => {
      const { driver } = h;
      const gate = createGate();
      h.handleNext(() => gate.promise);

      const first = driver.navigate(h.url('first'));
      await first.committed;
      const second = driver.navigate(h.url('second'));

      const error = await failureOf(() => first);
      assert.equal(error.name, 'AbortError');
      const secondEntry = await second.finished;

      assert.equal(h.events[0].signal.aborted, true);
      assert.equal(h.events[1].signal.aborted, false);
      assert.equal(driver.currentEntry.key, secondEntry.key);

      gate.open();
      await delay(0);
      assert.equal(driver.currentEntry.key, secondEntry.key);
    });

    scenario('a new navigation aborts the ongoing one before its event dispatches, even if it is then canceled', async h => {
      const { driver } = h;
      const gate = createGate();
      h.handleNext(() => gate.promise);
      const first = driver.navigate(h.url('first'));
      await first.committed;
      const committedKey = driver.currentEntry.key;
      const [ongoing] = h.events.slice(-1);
      const observed = [];
      h.driver.addEventListener('navigate', () => observed.push(ongoing.signal.aborted), { signal: h.controller.signal });
      h.behavior.prevent = true;

      const second = driver.navigate(h.url('second'));
      const [committed, finished] = await Promise.allSettled([second.committed, second.finished]);

      assert.deepEqual(observed, [true]);
      assert.equal(committed.status, 'rejected');
      assert.equal(finished.status, 'rejected');
      assert.equal((await failureOf(() => first)).name, 'AbortError');
      assert.equal(driver.currentEntry.key, committedKey);
      gate.open();
    });

    scenario('preventDefault rejects both promises with AbortError and commits nothing', async h => {
      const { driver } = h;
      const before = driver.currentEntry.key;
      const length = driver.entries().length;
      h.behavior.prevent = true;

      const navigation = driver.navigate(h.url('blocked'));
      const [committed, finished] = await Promise.allSettled([navigation.committed, navigation.finished]);

      assert.equal(committed.status, 'rejected');
      assert.equal(committed.reason.name, 'AbortError');
      assert.equal(finished.status, 'rejected');
      assert.equal(finished.reason.name, 'AbortError');
      assert.equal(h.last().cancelable, true);
      assert.equal(driver.currentEntry.key, before);
      assert.equal(driver.entries().length, length);

      h.behavior.prevent = false;
      await h.go(h.url('allowed'));
      assert.notEqual(driver.currentEntry.key, before);
    });

    scenario('traversals are cancelable when the driver says so', async h => {
      const { driver } = h;
      if (!driver.capabilities.cancelTraverse) {return;}
      await h.go(h.url('a'));
      const second = await h.go(h.url('b'));
      h.behavior.prevent = true;

      const error = await failureOf(() => driver.back());

      assert.equal(error.name, 'AbortError');
      assert.equal(h.last().navigationType, 'traverse');
      assert.equal(h.last().cancelable, true);
      assert.equal(driver.currentEntry.key, second.key);
    });

    scenario('removes listeners when their signal aborts', async h => {
      const calls = [];
      const controller = new AbortController();
      const alreadyAborted = new AbortController();
      alreadyAborted.abort();
      h.driver.addEventListener('navigate', () => calls.push('removable'), { signal: controller.signal });
      h.driver.addEventListener('navigate', () => calls.push('never'), { signal: alreadyAborted.signal });

      await h.go(h.url('listened'));
      assert.deepEqual(calls, ['removable']);

      controller.abort();
      await h.go(h.url('unlistened'));
      assert.deepEqual(calls, ['removable']);
    });
  });
}
