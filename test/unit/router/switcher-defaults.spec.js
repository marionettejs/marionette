import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'vitest';
import { Application } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

const groups = new Set();
afterEach(() => { for (const group of groups) { group.destroy(); } groups.clear(); });
async function createGroup(definition = {}, options = {}, Page = Application) {
  const Pages = ChildAppSwitcher.extend(definition);
  const group = new Pages(options);
  groups.add(group);
  const page = group.addChildApp('page', new Page());
  await group.start();
  return { group, page };
}

describe('ChildAppSwitcher reconstruction defaults', () => {
  const cases = [
    ['existing false', {}, {}, {}, false],
    ['prototype true', { reconstruct: true }, {}, {}, true],
    ['class options true', { options: { reconstruct: true }, reconstruct: false }, {}, {}, true],
    ['constructor true', { reconstruct: false }, { reconstruct: true }, {}, true],
    ['constructor true over class false', { options: { reconstruct: false } }, { reconstruct: true }, {}, true],
    ['constructor false over class true', { options: { reconstruct: true } }, { reconstruct: false }, {}, false],
    ['call false over class true', { reconstruct: true }, {}, { reconstruct: false }, false],
    ['call false over constructor true', {}, { reconstruct: true }, { reconstruct: false }, false],
    ['call true over constructor false', {}, { reconstruct: false }, { reconstruct: true }, true],
    ['call undefined falls back to class', { reconstruct: true }, {}, { reconstruct: undefined }, true],
  ];
  for (const [label, definition, options, selection, restarts] of cases) {
    it(`resolves ${label} while keeping child start options per-call`, async() => {
      const runs = [];
      const Page = Application.extend({ onStart(app, startOptions) { runs.push(startOptions); } });
      const { group, page } = await createGroup(definition, options, Page);
      await group.switchTo('page', { key: 'same', options: { id: 'first' } });
      let stops = 0;
      page.on('stop', () => { stops++; });
      assert.equal(await group.switchTo('page', { key: 'same', options: { id: 'second' }, ...selection }), page);
      assert.equal(stops, Number(restarts));
      assert.deepEqual(runs, restarts ? [{ id: 'first' }, { id: 'second' }] : [{ id: 'first' }]);
      assert.equal(group.getChildApp('page'), page);
    });
  }

  it('joins retained same-key preparation when a call disables the default', async() => {
    const work = Promise.withResolvers();
    const preparations = [];
    const runs = [];
    const Page = Application.extend({
      prepareStart(options) { preparations.push(options); return work.promise; },
      onStart(app, options) { runs.push(options); },
    });
    const { group, page } = await createGroup({ reconstruct: true }, {}, Page);
    const first = group.switchTo('page', { key: { id: 1 }, options: { id: 'first' } });
    const second = group.switchTo('page', { key: { id: 1 }, reconstruct: false, options: { id: 'ignored' } });
    work.resolve();
    assert.equal(await first, undefined);
    assert.equal(await second, page);
    assert.deepEqual(preparations, [{ id: 'first' }]);
    assert.deepEqual(runs, [{ id: 'first' }]);
  });

  it('restarts same-key preparation by default and only exposes the replacement', async() => {
    const work = [Promise.withResolvers(), Promise.withResolvers()];
    const preparations = [];
    const runs = [];
    const Page = Application.extend({
      prepareStart(options, { signal }) { preparations.push({ options, signal }); return work[preparations.length - 1].promise; },
      onStart(app, options) { runs.push(options); },
    });
    const { group, page } = await createGroup({}, { reconstruct: true }, Page);
    const first = group.switchTo('page', { key: 'same', options: { id: 'first' } });
    const second = group.switchTo('page', { key: 'same', options: { id: 'second' } });
    assert.equal(preparations.length, 2);
    assert.equal(await first, undefined);
    assert.equal(preparations[0].signal.aborted, true);
    work[1].resolve();
    assert.equal(await second, page);
    work[0].reject(new Error('obsolete preparation'));
    await work[0].promise.catch(() => {});
    assert.deepEqual(runs, [{ id: 'second' }]);
  });

  it('keeps changed-key reconstruction even when a call overrides the default with false', async() => {
    const runs = [];
    const { group, page } = await createGroup({ reconstruct: true }, {}, Application.extend({
      onStart(app, options) { runs.push(options); },
    }));
    await group.switchTo('page', { key: 1, options: { id: 1 } });
    assert.equal(await group.switchTo('page', { key: 2, reconstruct: false, options: { id: 2 } }), page);
    assert.deepEqual(runs, [{ id: 1 }, { id: 2 }]);
  });

  it('preserves current startup errors when a default reconstruction fails', async() => {
    const error = new Error('replacement failed');
    let attempts = 0;
    const { group, page } = await createGroup({ reconstruct: true }, {}, Application.extend({
      prepareStart() { if (++attempts === 2) { throw error; } },
    }));
    await group.switchTo('page', { key: 1 });
    await assert.rejects(group.switchTo('page', { key: 1 }), reason => reason === error);
    assert.equal(page.isRunning(), false);
    assert.equal(group.getCurrent(), null);
  });

  it('keeps the caller signal per-call and leaves shared preparation running after caller abort', async() => {
    const work = Promise.withResolvers();
    const controller = new AbortController();
    const { group, page } = await createGroup({ reconstruct: true }, {}, Application.extend({ prepareStart: () => work.promise }));
    const first = group.switchTo('page', { signal: controller.signal });
    controller.abort();
    const second = group.switchTo('page', { reconstruct: false });
    work.resolve();
    assert.equal(await first, undefined);
    assert.equal(await second, page);
    assert.equal(page.isRunning(), true);
  });
});
