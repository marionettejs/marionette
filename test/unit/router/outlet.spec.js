import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Application } from 'marionette';
import { RouteOutlet } from '@mnjs/router/outlet';

function deferred() {
  const result = {};
  result.promise = new Promise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
}

const RecordingPage = Application.extend({
  initialize() {
    this.runs = [];
  },
  onStart(app, options) {
    this.runs.push(options);
  },
});

describe('RouteOutlet', () => {
  let owner;
  let outlet;
  let cleanupErrors;

  beforeEach(async() => {
    cleanupErrors = [];
    owner = new Application();
    await owner.start();
    outlet = new RouteOutlet({ owner, onCleanupError: (error, app) => cleanupErrors.push([error, app]) });
  });

  afterEach(() => {
    owner.destroy();
  });

  function addPage(name, Page = RecordingPage) {
    return owner.addChildApp(name, new Page());
  }

  function show(name, selection = {}) {
    return outlet.show(name, selection);
  }

  describe('selection', () => {
    it('starts the child with the caller options', async() => {
      const page = addPage('page');
      const options = { feature: {} };

      const shown = await outlet.show('page', { options });

      assert.equal(shown, page);
      assert.equal(outlet.getCurrent(), page);
      assert.equal(page.isRunning(), true);
      assert.deepEqual(page.runs, [options]);
    });

    it('rejects an unknown child without retiring the selected child', async() => {
      const page = addPage('page');
      await show('page');

      await assert.rejects(show('missing'), { message: 'Child application "missing" is not registered' });

      assert.equal(outlet.getCurrent(), page);
      assert.equal(page.isRunning(), true);
    });

    it('stops the old child synchronously and completes only the latest replacement', async() => {
      const current = addPage('current');
      const first = addPage('first');
      const latest = addPage('latest');
      await show('current');

      const firstShow = show('first');
      assert.equal(current.isRunning(), false);
      const latestShow = show('latest');

      assert.equal(await firstShow, undefined);
      assert.equal(await latestShow, latest);
      assert.equal(first.isRunning(), false);
      assert.equal(outlet.getCurrent(), latest);
    });

    it('replaces the child when the key changes', async() => {
      const page = addPage('page');
      await show('page', { key: { id: '1' }, options: { id: '1' } });
      let stops = 0;
      page.on('stop', () => stops++);

      await show('page', { key: { id: '2' }, options: { id: '2' } });

      assert.equal(stops, 1);
      assert.deepEqual(page.runs, [{ id: '1' }, { id: '2' }]);
    });

    it('replaces the child when restart is requested', async() => {
      const page = addPage('page');
      await show('page', { key: { id: '1' } });
      let stops = 0;
      page.on('stop', () => stops++);

      await show('page', { key: { id: '1' }, restart: true });

      assert.equal(stops, 1);
      assert.equal(page.runs.length, 2);
    });
  });

  describe('reuse', () => {
    it('keeps the running child when the key is equal', async() => {
      const page = addPage('page');
      await show('page', { key: { id: '1', scope: ['a'] } });
      let stops = 0;
      page.on('stop', () => stops++);

      const shown = await show('page', { key: { id: '1', scope: ['a'] } });

      assert.equal(shown, page);
      assert.equal(stops, 0);
      assert.equal(page.runs.length, 1);
    });

    it('reuses the child when the key is omitted', async() => {
      const page = addPage('page');
      await show('page');

      assert.equal(await show('page'), page);
      assert.equal(page.runs.length, 1);
    });

    it('starts a reused child that stopped independently, with the new options', async() => {
      const page = addPage('page');
      await show('page', { options: { id: '1' } });
      page.stop();

      const shown = await show('page', { options: { id: '2' } });

      assert.equal(shown, page);
      assert.equal(page.isRunning(), true);
      assert.deepEqual(page.runs, [{ id: '1' }, { id: '2' }]);
    });

    it('resolves only the latest selection of a still-preparing child', async() => {
      const ready = deferred();
      const Slow = RecordingPage.extend({ prepareStart: () => ready.promise });
      const page = addPage('page', Slow);
      const first = show('page');

      const second = show('page');
      ready.resolve();

      assert.equal(await first, undefined);
      assert.equal(await second, page);
      assert.equal(page.runs.length, 1);
    });
  });

  describe('owner lifecycle', () => {
    it('cancels replacement preparation when its owner stops', async() => {
      const ready = deferred();
      const next = addPage('next', Application.extend({ prepareStart: () => ready.promise }));
      const replacing = show('next');

      assert.equal(owner.stop(), true);
      ready.resolve();

      assert.equal(await replacing, undefined);
      assert.equal(next.isRunning(), false);
      assert.equal(outlet.getCurrent(), null);
    });

    it('invalidates pending selection even when its owner is already stopped', async() => {
      owner.stop();
      const child = addPage('child');
      let starts = 0;
      const { start } = child;
      child.start = options => {
        starts++;
        return start.call(child, options);
      };
      const selecting = show('child');

      owner.stop();

      assert.equal(await selecting, undefined);
      assert.equal(starts, 1);
      assert.equal(child.isRunning(), false);
    });

    it('leaves a live child selected beneath an already-stopped owner stopped and reusable', async() => {
      owner.stop();
      const child = addPage('child');
      await show('child');
      assert.equal(child.isRunning(), true);

      owner.stop();

      assert.equal(child.isRunning(), false);
      assert.equal(outlet.getCurrent(), child);
      assert.equal(await show('child'), child);
      assert.equal(child.runs.length, 2);
    });

    it('leaves the owner methods untouched', () => {
      for (const method of ['stop', 'restart', 'destroy']) {
        assert.equal(Object.hasOwn(owner, method), false);
      }
    });

    it('clears the selection when a running owner stops', async() => {
      const child = addPage('child');
      await show('child');

      owner.stop();

      assert.equal(child.isRunning(), false);
      assert.equal(outlet.getCurrent(), null);
    });

    it('does not invalidate a selection begun while its owner starts', async() => {
      const Owner = Application.extend({
        childApps: { page: RecordingPage },
        initialize() {
          this.outlet = new RouteOutlet({ owner: this });
        },
        onBeforeStart() {
          this.shown = this.outlet.show('page');
        },
      });
      const starting = new Owner();

      await starting.start();

      assert.equal(await starting.shown, starting.getChildApp('page'));
      starting.destroy();
    });

    it('cancels child preparation when its owner is destroyed', async() => {
      const readiness = deferred();
      const preparing = deferred();
      const child = addPage('child', Application.extend({
        prepareStart() {
          preparing.resolve();
          return readiness.promise;
        },
      }));
      const selecting = show('child');
      await preparing.promise;

      owner.destroy();
      readiness.resolve();

      assert.equal(await selecting, undefined);
      assert.equal(child.isDestroyed(), true);
      assert.equal(outlet.getCurrent(), null);
      assert.equal(outlet.isDestroyed(), true);
    });

    it('preserves pending selection when its owner restarts', async() => {
      const ready = deferred();
      const child = addPage('child', RecordingPage.extend({ prepareStart: () => ready.promise }));
      const selecting = show('child');

      await owner.restart();
      ready.resolve();

      assert.equal(await selecting, child);
      assert.equal(child.isRunning(), true);
      assert.equal(outlet.getCurrent(), child);
    });

    it('invalidates pending selection and stops the current child on stop()', async() => {
      const current = addPage('current');
      const ready = deferred();
      const next = addPage('next', Application.extend({ prepareStart: () => ready.promise }));
      await show('current');
      const selecting = show('next');

      assert.equal(outlet.stop(), true);
      ready.resolve();

      assert.equal(await selecting, undefined);
      assert.equal(current.isRunning(), false);
      assert.equal(next.isRunning(), false);
      assert.equal(outlet.getCurrent(), null);
    });
  });

  describe('failure', () => {
    it('stops partially started descendants after failed child preparation', async() => {
      const failure = new Error('page failed');
      const child = addPage('child', Application.extend({
        childApps: { nested: Application },
        async prepareStart() {
          await this.getChildApp('nested').start();
          throw failure;
        },
      }));
      const next = addPage('next');

      const error = await show('child').catch(thrown => thrown);

      assert.equal(error, failure);
      assert.equal(child.getChildApp('nested').isRunning(), false);
      assert.equal(outlet.getCurrent(), null);
      assert.equal(await show('next'), next);
    });

    it('preserves the activation error when cleanup throws', async() => {
      const failure = { resource: 'action', error: { response: { status: 410 } } };
      const cleanupFailure = new Error('cleanup failed');
      const child = addPage('child', Application.extend({
        childApps: { nested: Application },
        async prepareStart() {
          const nested = this.getChildApp('nested');
          await nested.start();
          nested.onBeforeStop = () => {
            throw cleanupFailure;
          };
          throw failure;
        },
      }));

      const error = await show('child').catch(thrown => thrown);
      child.getChildApp('nested').onBeforeStop = () => {};

      assert.equal(error, failure);
      assert.deepEqual(cleanupErrors, [[cleanupFailure, child]]);
      assert.equal(outlet.getCurrent(), child);
    });

    it('leaves independently running descendants owned until explicit selection stop', async() => {
      const child = addPage('child', Application.extend({
        childApps: { nested: Application },
        start: () => Promise.resolve(false),
      }));
      const nested = child.getChildApp('nested');
      await nested.start();

      assert.equal(await show('child'), undefined);
      assert.deepEqual(cleanupErrors, []);
      assert.equal(outlet.getCurrent(), child);
      assert.equal(nested.isRunning(), true);
      outlet.stop();
      assert.equal(nested.isRunning(), false);
      assert.equal(outlet.getCurrent(), null);
    });

    it('keeps the selection and rejects when stopping the current child throws', async() => {
      const failure = new Error('stop failed');
      const current = addPage('current');
      const next = addPage('next');
      await show('current');
      current.onBeforeStop = () => {
        throw failure;
      };

      await assert.rejects(show('next'), failure);
      current.onBeforeStop = () => {};

      assert.equal(outlet.getCurrent(), current);
      assert.equal(next.isRunning(), false);
    });

    it('ignores a replacement made obsolete while the current child stops', async() => {
      const current = addPage('current');
      const first = addPage('first');
      const latest = addPage('latest');
      await show('current');
      let latestShow;
      current.on('stop', () => {
        latestShow = show('latest');
      });

      assert.equal(await show('first'), undefined);
      assert.equal(await latestShow, latest);
      assert.equal(first.isRunning(), false);
      assert.equal(outlet.getCurrent(), latest);
    });

    it('keeps a canceled selection until the next explicit selection operation', async() => {
      const child = addPage('child', Application.extend({ start: () => Promise.resolve(false) }));

      assert.equal(await show('child'), undefined);
      assert.equal(outlet.getCurrent(), child);
      outlet.stop();
      assert.equal(outlet.getCurrent(), null);
    });

    it('keeps a canceled child selected while it is still running', async() => {
      const child = addPage('child');
      await child.start();
      child.start = () => Promise.resolve(false);

      assert.equal(await show('child'), undefined);
      assert.equal(outlet.getCurrent(), child);
      assert.equal(child.isRunning(), true);
    });

    it('ignores a late startup failure after a newer child has been selected', async() => {
      const readiness = deferred();
      const preparing = deferred();
      const child = addPage('child', Application.extend({
        prepareStart() {
          preparing.resolve();
          return readiness.promise;
        },
      }));
      const next = addPage('next');
      const selecting = show('child');
      await preparing.promise;
      const replacing = show('next');

      readiness.reject(new Error('obsolete page failed'));

      assert.equal(await selecting, undefined);
      assert.equal(await replacing, next);
      assert.equal(outlet.getCurrent(), next);
      assert.equal(child.isRunning(), false);
    });

    it('rejects only the newest selection when a reused start fails', async() => {
      const failure = new Error('page failed');
      const ready = deferred();
      addPage('page', Application.extend({ prepareStart: () => ready.promise }));
      const first = show('page');
      const second = show('page');
      ready.reject(failure);

      assert.equal(await first, undefined);
      await assert.rejects(second, failure);
      assert.equal(outlet.getCurrent(), null);
    });
  });
});
