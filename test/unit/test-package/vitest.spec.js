import { afterAll, describe, expect } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { Application, View } from 'marionette';

const mounted = [];
const cleanups = [];
const Card = View.extend({ template: () => '<button>Open</button>' });

describe('Vitest per-test mount fixture', () => {
  test('owns views and awaits deferred project cleanup', ({ mounts }) => {
    const handle = mounts.mountView(new Card());
    mounted.push(handle);
    mounts.scope.defer(async() => { await Promise.resolve(); cleanups.push('first'); });
    expect(handle.el.parentNode).toBe(handle.container);
  });
  test('previous cleanup is complete before the next test', async({ mounts }) => {
    expect(mounted[0].view.isDestroyed()).toBe(true);
    expect(cleanups).toEqual(['first']);
    const Feature = Application.extend({ onStart() { this.showView(new Card()); } });
    const handle = mounts.mountApplication(region => new Feature({ region }));
    mounted.push(handle);
    await expect(handle.ready).resolves.toBe(true);
    expect(handle.el.parentNode).toBe(handle.container);
  });
  test.fails('cleans even when the test body fails', ({ mounts }) => {
    mounted.push(mounts.mountView(new Card()));
    throw new Error('intentional fixture teardown probe');
  });
});

test.concurrent.for(['left', 'right'])('independent fixture %s', async(label, { mounts }) => {
  const handle = mounts.mountView(new Card());
  mounted.push(handle);
  handle.el.dataset.fixture = label;
  await Promise.resolve();
  expect(handle.view.isDestroyed()).toBe(false);
  expect(handle.el.dataset.fixture).toBe(label);
});

afterAll(() => {
  expect(mounted).toHaveLength(5);
  for (const handle of mounted) {
    expect(handle.container.isConnected).toBe(false);
    expect(handle.region.isDestroyed()).toBe(true);
  }
});
