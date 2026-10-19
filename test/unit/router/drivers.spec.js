import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { memoryDriver, navigationDriver } from '@mnjs/router';

import { driverConformance } from '../../router/conformance/index.js';

driverConformance({
  name: 'memoryDriver',
  createDriver: () => ({ driver: memoryDriver() }),
  describe,
  it,
  assert,
});

function record(driver, { intercept = true } = {}) {
  const events = [];
  driver.addEventListener('navigate', event => {
    events.push(event);
    if (intercept && event.canIntercept) {event.intercept();}
  });
  return events;
}

async function rejectionOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

describe('memoryDriver', () => {
  it('starts at the given URL with a single entry', () => {
    const driver = memoryDriver({ url: 'https://example.test/start?x=1' });

    assert.equal(driver.currentEntry.url, 'https://example.test/start?x=1');
    assert.equal(driver.currentEntry.index, 0);
    assert.equal(driver.entries().length, 1);
    assert.equal(driver.currentEntry.getState(), undefined);
    assert.equal(memoryDriver().currentEntry.url, 'http://localhost/');
  });

  it('resolves relative URLs against the current entry URL', async() => {
    const driver = memoryDriver({ url: 'http://localhost/a/b/c' });
    record(driver);

    await driver.navigate('d?q=1').finished;
    assert.equal(driver.currentEntry.url, 'http://localhost/a/b/d?q=1');

    await driver.navigate('/root').finished;
    assert.equal(driver.currentEntry.url, 'http://localhost/root');

    await driver.navigate('#frag').finished;
    assert.equal(driver.currentEntry.url, 'http://localhost/root#frag');
  });

  it('dispatches the event and commits synchronously for push, replace and reload', () => {
    const driver = memoryDriver();
    const seen = [];
    driver.addEventListener('navigate', event => {
      seen.push([event.navigationType, driver.currentEntry.url]);
      event.intercept();
    });

    driver.navigate('/a');
    assert.equal(driver.currentEntry.url, 'http://localhost/a');
    driver.navigate('/b', { history: 'replace' });
    driver.reload();

    assert.deepEqual(seen, [
      ['push', 'http://localhost/'],
      ['replace', 'http://localhost/a'],
      ['reload', 'http://localhost/b'],
    ]);
  });

  it('queues traversals so the event fires after the call returns', async() => {
    const driver = memoryDriver();
    const events = record(driver);
    await driver.navigate('/a').finished;
    events.length = 0;

    const navigation = driver.back();

    assert.equal(events.length, 0);
    assert.equal(driver.currentEntry.url, 'http://localhost/a');
    await navigation.finished;
    assert.equal(events.length, 1);
    assert.equal(driver.currentEntry.url, 'http://localhost/');
  });

  it('exposes the destination of non-traverse navigations without an entry', async() => {
    const driver = memoryDriver();
    const events = record(driver);

    await driver.navigate('/a', { state: { n: 1 } }).finished;

    assert.equal(events[0].destination.key, '');
    assert.equal(events[0].destination.index, -1);
    assert.deepEqual(events[0].destination.getState(), { n: 1 });
  });

  it('rejects navigation to an invalid URL or uncloneable state without throwing', async() => {
    const driver = memoryDriver();
    const events = record(driver);

    const invalid = driver.navigate('http://[bad');
    assert.equal((await rejectionOf(invalid.finished)).name, 'SyntaxError');
    assert.equal((await rejectionOf(invalid.committed)).name, 'SyntaxError');

    const uncloneable = driver.navigate('/a', { state: { fn() {} } });
    assert.equal((await rejectionOf(uncloneable.finished)).name, 'DataCloneError');

    assert.equal(events.length, 0);
    assert.equal(driver.entries().length, 1);
  });

  it('rejects back() when there is no previous entry', async() => {
    const driver = memoryDriver();
    const navigation = driver.back();

    assert.equal((await rejectionOf(navigation.finished)).name, 'InvalidStateError');
    assert.equal((await rejectionOf(navigation.committed)).name, 'InvalidStateError');
  });

  it('does not report unhandled rejections for ignored aborted navigations', async() => {
    const driver = memoryDriver();
    driver.addEventListener('navigate', event => event.preventDefault());

    driver.navigate('/a');
    driver.back();
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(driver.entries().length, 1);
  });

  it('aborts the previous navigation when a new one starts inside a listener', async() => {
    const driver = memoryDriver();
    const signals = [];
    driver.addEventListener('navigate', event => {
      signals.push(event.signal);
      if (event.destination.url === 'http://localhost/first') {
        driver.navigate('/second', { history: 'replace' });
        return;
      }
      event.intercept();
    });

    const first = driver.navigate('/first');

    assert.equal((await rejectionOf(first.finished)).name, 'AbortError');
    assert.equal(signals[0].aborted, true);
    assert.equal(signals[1].aborted, false);
    assert.equal(driver.currentEntry.url, 'http://localhost/second');
    assert.equal(driver.entries().length, 1);
  });

  it('aborts the previous navigation even when the superseding one is canceled', async() => {
    const driver = memoryDriver();
    const events = [];
    driver.addEventListener('navigate', event => {
      events.push({ event, previousAborted: events[0]?.event.signal.aborted });
      if (event.destination.url.endsWith('/blocked')) {
        event.preventDefault();
        return;
      }
      event.intercept({ handler: () => new Promise(() => {}) });
    });

    const first = driver.navigate('/first');
    const blocked = driver.navigate('/blocked');

    assert.equal((await rejectionOf(blocked.finished)).name, 'AbortError');
    assert.equal((await rejectionOf(first.finished)).name, 'AbortError');
    assert.equal(events[1].previousAborted, true);
    assert.equal(events[0].event.signal.aborted, true);
    assert.equal(driver.currentEntry.url, 'http://localhost/first');
  });

  it('restricts intercept() to the dispatch of interceptable events', async() => {
    const driver = memoryDriver();
    const events = record(driver);
    await driver.navigate('/a').finished;

    assert.throws(() => events[0].intercept(), { name: 'InvalidStateError' });

    const blocked = memoryDriver();
    blocked.addEventListener('navigate', event => {
      assert.throws(() => event.intercept(), { name: 'SecurityError' });
    });
    blocked.simulate('/a', { canIntercept: false });
  });

  it('supports multiple intercept handlers and waits for all of them', async() => {
    const driver = memoryDriver();
    const order = [];
    driver.addEventListener('navigate', event => {
      event.intercept({ handler: async() => order.push('first') });
      event.intercept({ handler: () => new Promise(resolve => setTimeout(resolve, 5)).then(() => order.push('second')) });
    });

    await driver.navigate('/a').finished;

    assert.deepEqual(order, ['first', 'second']);
  });

  it('reports handler exceptions thrown synchronously as finished rejections', async() => {
    const driver = memoryDriver();
    driver.addEventListener('navigate', event => event.intercept({
      handler() {
        throw new Error('sync failure');
      },
    }));

    const navigation = driver.navigate('/a');

    assert.equal((await rejectionOf(navigation.finished)).message, 'sync failure');
    assert.equal((await navigation.committed).url, 'http://localhost/a');
  });

  it('computes canIntercept and hashChange for programmatic navigations', async() => {
    const driver = memoryDriver({ url: 'http://localhost/page' });
    const events = record(driver, { intercept: false });

    driver.navigate('http://localhost/page#top');
    driver.navigate('https://other.test/page');

    assert.equal(events[0].hashChange, true);
    assert.equal(events[0].canIntercept, true);
    assert.equal(events[1].hashChange, false);
    assert.equal(events[1].canIntercept, false);
  });

  describe('simulate', () => {
    it('defaults to a user-initiated, interceptable push', async() => {
      const driver = memoryDriver();
      const events = record(driver);

      const navigation = driver.simulate('/link');
      await navigation.finished;

      const [event] = events;
      assert.equal(event.navigationType, 'push');
      assert.equal(event.userInitiated, true);
      assert.equal(event.canIntercept, true);
      assert.equal(event.hashChange, false);
      assert.equal(event.downloadRequest, null);
      assert.equal(event.formData, null);
      assert.equal(event.info, undefined);
      assert.equal(driver.currentEntry.url, 'http://localhost/link');
      assert.equal(driver.entries().length, 2);
    });

    it('passes through every option', async() => {
      const driver = memoryDriver();
      const events = record(driver);
      const formData = new FormData();

      await driver.simulate('/form', {
        navigationType: 'replace',
        userInitiated: false,
        canIntercept: true,
        hashChange: true,
        downloadRequest: 'report.pdf',
        formData,
        info: { from: 'form' },
      }).finished;

      const [event] = events;
      assert.equal(event.navigationType, 'replace');
      assert.equal(event.userInitiated, false);
      assert.equal(event.hashChange, true);
      assert.equal(event.downloadRequest, 'report.pdf');
      assert.equal(event.formData, formData);
      assert.deepEqual(event.info, { from: 'form' });
      assert.equal(driver.entries().length, 1);
    });

    it('rejects navigation types it cannot simulate', () => {
      assert.throws(() => memoryDriver().simulate('/a', { navigationType: 'traverse' }), TypeError);
    });

    it('detects fragment-only changes', async() => {
      const driver = memoryDriver({ url: 'http://localhost/page' });
      const events = record(driver);

      await driver.simulate('/page#section').finished;

      assert.equal(events[0].hashChange, true);
    });
  });

  describe('documentNavigations', () => {
    it('starts empty and ignores intercepted navigations', async() => {
      const driver = memoryDriver();
      record(driver);

      await driver.navigate('/a').finished;
      await driver.simulate('/b').finished;

      assert.deepEqual(driver.documentNavigations, []);
    });

    it('records navigations no listener intercepted and still commits them', async() => {
      const driver = memoryDriver();

      const navigation = driver.simulate('/logout');
      const entry = await navigation.finished;
      await driver.navigate('/download', { history: 'replace' }).finished;

      assert.equal(entry.url, 'http://localhost/logout');
      assert.deepEqual(driver.documentNavigations, ['http://localhost/logout', 'http://localhost/download']);
      assert.equal(driver.currentEntry.url, 'http://localhost/download');
      assert.equal(driver.entries().length, 2);
    });

    it('records listener-declined navigations that cannot be intercepted', async() => {
      const driver = memoryDriver();
      record(driver);

      await driver.simulate('https://other.test/x', { canIntercept: false }).finished;

      assert.deepEqual(driver.documentNavigations, ['https://other.test/x']);
      assert.equal(driver.currentEntry.url, 'https://other.test/x');
    });

    it('records traversals no listener intercepted', async() => {
      const driver = memoryDriver();
      await driver.navigate('/a').finished;

      await driver.back().finished;

      assert.deepEqual(driver.documentNavigations, ['http://localhost/a', 'http://localhost/']);
    });

    it('is a live array on the driver', async() => {
      const driver = memoryDriver();
      const { documentNavigations } = driver;

      await driver.simulate('/x').finished;

      assert.equal(driver.documentNavigations, documentNavigations);
      assert.equal(documentNavigations.length, 1);
    });
  });
});

describe('navigationDriver', () => {
  it('delegates to the injected navigation and reads the current entry live', () => {
    const calls = [];
    const navigation = {
      currentEntry: { key: 'one' },
      entries: () => [navigation.currentEntry],
      navigate: (...args) => calls.push(['navigate', ...args]),
      reload: (...args) => calls.push(['reload', ...args]),
      back: () => calls.push(['back']),
      traverseTo: key => calls.push(['traverseTo', key]),
      updateCurrentEntry: options => calls.push(['updateCurrentEntry', options]),
      addEventListener: (...args) => calls.push(['addEventListener', ...args]),
    };
    const driver = navigationDriver(navigation);
    const listener = () => {};
    const options = { signal: new AbortController().signal };

    driver.navigate('/a', { history: 'replace' });
    driver.reload({ info: 1 });
    driver.back();
    driver.traverseTo('two');
    driver.updateCurrentEntry({ state: 1 });
    driver.addEventListener('navigate', listener, options);
    navigation.currentEntry = { key: 'two' };

    assert.deepEqual(calls, [
      ['navigate', '/a', { history: 'replace' }],
      ['reload', { info: 1 }],
      ['back'],
      ['traverseTo', 'two'],
      ['updateCurrentEntry', { state: 1 }],
      ['addEventListener', 'navigate', listener, options],
    ]);
    assert.equal(driver.currentEntry.key, 'two');
    assert.deepEqual(driver.entries(), [navigation.currentEntry]);
  });

  it('passes native promises through unchanged', () => {
    const result = { committed: Promise.resolve(), finished: Promise.resolve() };
    const driver = navigationDriver({ navigate: () => result });

    assert.equal(driver.navigate('/a'), result);
  });

  it('requires a Navigation API', () => {
    assert.throws(() => navigationDriver(null), TypeError);
  });
});
