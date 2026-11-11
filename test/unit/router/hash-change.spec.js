import assert from 'node:assert/strict';
import { it } from 'vitest';
import { memoryDriver } from '@mnjs/router';
import { hashChanges } from '../../router/conformance/hash-changes.js';
import { createRouter } from './helpers.js';

for (const { from, to, expected } of hashChanges) {
  it(`matches native hashChange for ${from} to ${to}`, async() => {
    const driver = memoryDriver({ url: `https://routes.example${from}` });
    const events = [];
    driver.addEventListener('navigate', event => events.push(event.hashChange));
    await driver.navigate(to).finished;
    assert.deepEqual(events, [expected]);
    assert.equal(driver.currentEntry.url, `https://routes.example${to}`);
  });
}

it('keeps an ordinary explicit empty fragment native in the memory Router', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/page' });
  let handlers = 0;
  const router = createRouter({ driver, routes: { page: { path: '/page', handler() { handlers++; } } } });
  await router.start(); await router.getInitialDispatch();
  const current = router.getCurrent();
  await driver.navigate('/page#').finished;
  assert.equal(handlers, 1);
  assert.equal(router.getCurrent(), current);
  assert.equal(driver.documentNavigations.at(-1), 'https://routes.example/page#');
});
