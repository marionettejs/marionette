import { afterAll, expect, it } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { MountError, mountView } from '@mnjs/test';
import { createRadio } from '@mnjs/radio';
import { View } from 'marionette';

const cleanupEvents = [];
const Card = View.extend({ template: () => '<button>Owned</button>' });

test('owns public Region mounts, scoped replies and local services', async({ mounts }) => {
  const radio = createRadio();
  const mounted = mounts.mountRegion();
  const view = new Card();
  mounted.scope.reply(radio, 'mounted', 'value', () => 'owned');
  mounted.scope.defer(async() => {
    expect(view.isDestroyed()).toBe(false);
    await Promise.resolve();
    cleanupEvents.push('region service');
  });
  mounted.region.show(view);
  expect(radio.request('mounted', 'value')).toBe('owned');
  await mounted.cleanup();
  expect(view.isDestroyed()).toBe(true);
  expect(mounted.region.isDestroyed()).toBe(true);
  expect(radio.request('mounted', 'value')).toBeUndefined();
});

it('awaits failed acquisition and reports asynchronous cleanup failure with its cause', async() => {
  const failure = new Error('owned factory');
  const disposal = new Error('owned disposal');
  let reported;
  try {
    mountView(scope => {
      scope.defer(async() => { await Promise.resolve(); throw disposal; });
      throw failure;
    });
  } catch (error) { reported = error; }
  expect(reported).toBeInstanceOf(MountError);
  expect(reported.cause).toBe(failure);
  const combined = await reported.cleanup.catch(error => error);
  expect(combined.errors[0]).toBe(failure);
  expect(combined.errors[1].errors).toEqual([disposal]);
});

test.fails('releases nested services when a body assertion fails', ({ mounts }) => {
  const mounted = mounts.mountView(() => new Card());
  mounted.scope.defer(async() => { await Promise.resolve(); cleanupEvents.push('failed body service'); });
  throw new Error('expected body failure');
});

afterAll(() => {
  expect(cleanupEvents).toEqual(['region service', 'failed body service']);
});
