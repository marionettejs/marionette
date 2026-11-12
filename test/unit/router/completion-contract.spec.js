import { expect, it, vi } from 'vitest';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

it('completes a current handler that intentionally fulfills false', async() => {
  const ready = vi.fn();
  const router = createRouter({ driver: memoryDriver({ url: 'https://example.test/page' }),
    routes: { '/page': { name: 'page', handler: () => Promise.resolve(false) } },
  });
  router.on('route:ready', ready);
  expect(await router.start()).toBe(true);
  expect((await router.getInitialDispatch()).status).toBe('matched');
  expect(await router.refresh()).toBe(true);
  expect(ready).toHaveBeenCalledTimes(2);
});

it('settles cancellation before ignored handler work ends and observes its late rejection', async() => {
  const pending = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const errors = vi.fn();
  const router = createRouter({ driver: memoryDriver({ url: 'https://example.test/outside' }),
    routes: { '/page': { name: 'page', handler() { entered.resolve(); return pending.promise; } } },
  });
  router.on('route:error', errors);
  await router.start();
  const navigation = router.navigate('/page');
  await entered.promise;
  router.stop();
  expect(await navigation.finished).toBe(false);
  pending.reject(new Error('obsolete failure'));
  await pending.promise.catch(() => {});
  expect(errors).not.toHaveBeenCalled();
});

it('marks a matched initial entry for the helper without restricting raw Back', async() => {
  const driver = memoryDriver({ url: 'https://example.test/outside' });
  await driver.navigate('/initial').finished;
  const initialKey = driver.currentEntry.key;
  const router = createRouter({ driver, routes: {
    '/initial': { name: 'initial' }, '/next': { name: 'next' },
  } });
  await router.start();
  await router.getInitialDispatch();
  await router.navigate('/next').finished;
  expect(router.canGoBack()).toBe(true);
  expect(await router.back()).toBe(true);
  expect(driver.currentEntry.key).toBe(initialKey);
  expect(router.canGoBack()).toBe(false);
  expect(await router.back()).toBe(false);
  await driver.back().finished;
  expect(driver.currentEntry.url).toBe('https://example.test/outside');
});
