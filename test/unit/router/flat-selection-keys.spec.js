import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Application } from 'marionette';
import { RouteApplication } from '@mnjs/router';

test('changed own __proto__ values restart the registered child without reconstructing it', async() => {
  let constructed = 0;
  let started = 0;
  const Page = Application.extend({
    initialize() { constructed++; },
    onStart() { started++; },
  });
  const pages = new RouteApplication();
  const page = pages.addChildApp('page', new Page());
  try {
    await pages.start();
    const first = JSON.parse('{"__proto__":"a"}');
    const second = JSON.parse('{"__proto__":"b"}');
    assert.equal(await pages.switchTo('page', { key: first }), page);
    assert.equal(await pages.switchTo('page', { key: second }), page);
    assert.equal(await pages.switchTo('page', { key: JSON.parse('{"__proto__":"b"}') }), page);
    assert.equal(started, 2);
    assert.equal(constructed, 1);
    assert.equal(Object.getPrototypeOf(first), Object.prototype);
    assert.equal(Object.getOwnPropertyDescriptor(first, '__proto__').value, 'a');
    assert.equal(Object.getOwnPropertyDescriptor(second, '__proto__').value, 'b');
  } finally { pages.destroy(); }
});

{
  const field = 'patientId';
  test('equal key records reuse the running child and snapshot caller mutation', async() => {
    const starts = [];
    const pages = new RouteApplication();
    const page = pages.addChildApp('page', new (Application.extend({
      onStart(_app, options) {
        starts.push(options.id);
      },
    }))());
    try {
      await pages.start();
      const key = {
        [field]: 'one',
      };
      assert.equal(await pages.switchTo('page', {
        key,
        options: {
          id: 'one',
        },
      }), page);
      key[field] = 'two';
      assert.equal(await pages.switchTo('page', {
        key: {
          [field]: 'one',
        },
        options: {
          id: 'ignored',
        },
      }), page);
      assert.deepEqual(starts, ['one'], 'equal fresh app keys must reuse the running feature');
      assert.equal(await pages.switchTo('page', {
        key,
        options: {
          id: 'two',
        },
      }), page);
      assert.deepEqual(starts, ['one', 'two']);
      assert.deepEqual(key, {
        [field]: 'two',
      }, 'snapshotting must not freeze or change caller keys');
    } finally {
      pages.destroy();
    }
  });
}

test('selection captures a resource key before child lifecycle callbacks', async() => {
  const key = {
    patientId: 'one',
  };
  let starts = 0;
  const pages = new RouteApplication();
  pages.addChildApp('patient', new (Application.extend({
    onBeforeStart() {
      starts++;
      key.patientId = 'two';
    },
  }))());
  try {
    await pages.start();
    await pages.switchTo('patient', {
      key,
    });
    await pages.switchTo('patient', {
      key: {
        patientId: 'one',
      },
    });
    assert.equal(starts, 1, 'lifecycle mutation must not change the selected identity');
  } finally {
    pages.destroy();
  }
});

test('a nested key is rejected without superseding a pending selection', async() => {
  const work = Promise.withResolvers();
  const pages = new RouteApplication();
  const page = pages.addChildApp('page', new (Application.extend({
    prepareStart() {
      return work.promise;
    },
  }))());
  try {
    await pages.start();
    const selecting = pages.switchTo('page', {
      key: {
        id: 'one',
      },
    });
    await assert.rejects(pages.switchTo('page', {
      key: {
        id: ['one'],
      },
    }), TypeError);
    work.resolve();
    assert.equal(await selecting, page);
  } finally {
    work.resolve();
    pages.destroy();
  }
});
