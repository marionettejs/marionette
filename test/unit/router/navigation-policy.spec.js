import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

function setup({ routes = [], handler, beforeSubscribe } = {}) {
  const driver = memoryDriver({ url: 'https://example.test/' });
  beforeSubscribe?.(driver);
  const policies = [];
  const subscribe = driver.addEventListener.bind(driver);
  driver.addEventListener = (type, listener, options) => subscribe(type, event => listener(Object.create(event, {
    intercept: { value(init) {
      const { handler: ignored, ...policy } = init;
      void ignored;
      policies.push(policy);
      event.intercept(init);
    } },
  })), options);
  const router = createRouter({ driver, routes: [
    { name: 'home', path: '/' }, { name: 'next', path: '/next' }, { name: 'other', path: '/other' }, ...routes,
  ], handler });
  return { router, driver, policies };
}

const manual = { focusReset: 'manual', scroll: 'manual' };

describe('navigation focus and scroll policy', () => {
  it('keeps refresh manual without passing interception options to the Driver', async() => {
    const { router, driver, policies } = setup();
    const navigate = vi.spyOn(driver, 'navigate');
    await router.start();
    await router.refresh();
    assert.deepEqual(policies, [manual]);
    assert.deepEqual(Object.keys(navigate.mock.calls[0][1]).sort(), ['history', 'state']);
  });

  for (const policy of [
    { focusReset: 'manual' }, { scroll: 'manual' },
    { focusReset: 'after-transition', scroll: 'manual' },
    { focusReset: 'manual', scroll: 'after-transition' },
  ]) {
    it(`uses explicit ${ JSON.stringify(policy) } for only its own navigation`, async() => {
      const { router, driver, policies } = setup();
      await router.start();
      const info = { source: 'test' };
      await router.navigate('next', {}, { ...policy, info, state: { draft: 1 } }).finished;
      assert.equal(router.getCurrent().info, info);
      assert.deepEqual(router.getCurrent().state, { draft: 1 });
      await router.navigate('/other').finished;
      await router.back();
      await driver.simulate('/next?link=1').finished;
      assert.deepEqual(policies, [policy, {}, {}, {}]);
    });
  }

  for (const asyncRedirect of [false, true]) {
    it(`snapshots policy through ${ asyncRedirect ? 'asynchronous' : 'synchronous' } redirect hops`, async() => {
      const lookup = Promise.withResolvers();
      const { router, policies } = setup({ routes: [{ name: 'old', path: '/old', redirect: () => asyncRedirect ? lookup.promise : '/next' }] });
      await router.start();
      const options = { ...manual };
      const pending = router.navigate('/old', options);
      options.focusReset = 'after-transition'; options.scroll = 'after-transition';
      lookup.resolve('/next');
      assert.equal(await pending.finished, true);
      assert.deepEqual(policies, [manual, manual]);
      await router.navigate('/other').finished;
      assert.deepEqual(policies.at(-1), {});
    });
  }

  it('starts an independent policy for imperative navigation inside a handler', async() => {
    const context = setup({ handler(match) {
      if (match.name === 'next') { return context.router.navigate('/other').finished; }
    } });
    await context.router.start();
    assert.equal(await context.router.navigate('/next', manual).finished, false);
    assert.deepEqual(context.policies, [manual, {}]);
  });

  it('inherits refresh policy through redirects', async() => {
    let redirect = false;
    const { router, policies } = setup({ routes: [{ name: 'current', path: '/current', redirect: () => redirect ? '/next' : null }] });
    await router.start();
    await router.navigate('/current').finished;
    policies.length = 0;
    redirect = true;
    await router.refresh();
    assert.deepEqual(policies, [manual, manual]);
  });

  it('does not retain policy after a canceled or unclaimed request', async() => {
    const { router, policies } = setup({ beforeSubscribe(driver) {
      driver.addEventListener('navigate', event => { if (event.destination.url.endsWith('/blocked')) { event.preventDefault(); } });
    } });
    await router.start();
    assert.equal(await router.navigate('/blocked', manual).finished, false);
    await router.navigate('/unclaimed', manual).finished;
    await router.navigate('/next').finished;
    assert.deepEqual(policies, [{}]);
  });

  it('does not leak policy from a superseded redirect to its replacement navigation', async() => {
    const lookup = Promise.withResolvers();
    const { router, policies } = setup({ routes: [{ name: 'old', path: '/old', redirect: () => lookup.promise }] });
    await router.start();
    const stale = router.navigate('/old', manual);
    await router.navigate('/other').finished;
    lookup.resolve('/next');
    assert.equal(await stale.finished, false);
    assert.equal(router.getCurrent().name, 'other');
    assert.deepEqual(policies, [manual, {}]);
  });
});
