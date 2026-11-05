import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application } from 'marionette';
import { ChildAppSwitcher, memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

const groups = new Set();
afterEach(() => {
  for (const group of groups) { group.destroy(); }
  groups.clear();
});

async function pagesWith(Page = Application) {
  const pages = new ChildAppSwitcher();
  groups.add(pages);
  const page = pages.addChildApp('page', new Page());
  await pages.start();
  return { pages, page };
}

describe('reconstructed navigation correctness', () => {
  it('does not invoke a handler superseded between redirect continuation and handler dispatch', async() => {
    const pending = Promise.withResolvers();
    const obsolete = vi.fn();
    const router = createRouter({
      driver: memoryDriver({ url: 'https://example.test/outside' }),
      routes: [
        { name: 'old', path: '/old', redirect: () => pending.promise, handler: obsolete },
        { name: 'next', path: '/next' },
      ],
    });
    await router.start();
    await router.getInitialDispatch();
    const first = router.navigate('/old');
    expect(await first.committed).toBe(true);
    const match = router.getCurrent();
    let next;
    pending.resolve();
    queueMicrotask(() => { next = router.navigate('/next'); });
    expect(await first.finished).toBe(false);
    expect(await next.finished).toBe(true);
    expect(match.signal.aborted).toBe(true);
    expect(obsolete).not.toHaveBeenCalled();
    expect(router.getCurrent().name).toBe('next');
  });

  for (const target of ['target', '?done=1', '#done']) {
    it(`resolves synchronous and asynchronous ${target} redirects against their navigation URL`, async() => {
      const paths = [];
      for (const asynchronous of [false, true]) {
        const driver = memoryDriver({ url: 'https://example.test/app/home' });
        const router = createRouter({ driver, routes: [
          { name: 'home', path: '/app/home' },
          { name: 'legacy', path: '/legacy/old', redirect(match) {
            const value = match.url.search || match.url.hash ? undefined : target;
            return asynchronous ? Promise.resolve(value) : value;
          } },
          { name: 'target', path: '/legacy/target' },
        ] });
        await router.start();
        await router.getInitialDispatch();
        expect(await router.navigate('/legacy/old').finished).toBe(true);
        paths.push(driver.currentEntry.url);
      }
      const expected = new URL(target, 'https://example.test/legacy/old').href;
      expect(paths).toEqual([expected, expected]);
    });
  }

  for (const initial of [false, true]) {
    it(`preserves an operational AbortError during ${initial ? 'initial dispatch' : 'navigation'}`, async() => {
      const failure = new DOMException('independent fetch aborted', 'AbortError');
      const errors = vi.fn();
      const router = createRouter({
        driver: memoryDriver({ url: initial ? 'https://example.test/fail' : 'https://example.test/outside' }),
        routes: [{ name: 'fail', path: '/fail', handler() { return Promise.reject(failure); } }],
      });
      router.on('route:error', errors);
      await router.start();
      if (initial) {
        const result = await router.getInitialDispatch();
        expect(result.status).toBe('failed');
        expect(result.error).toBe(failure);
      } else {
        await router.getInitialDispatch();
        await expect(router.navigate('/fail').finished).rejects.toBe(failure);
      }
      expect(router.getCurrent().signal.aborted).toBe(false);
      expect(errors).toHaveBeenCalledExactlyOnceWith(failure, router.getCurrent());
    });
  }

  it('preserves an operational AbortError from the destination of an initial redirect', async() => {
    const failure = new DOMException('destination fetch aborted', 'AbortError');
    const router = createRouter({ driver: memoryDriver({ url: 'https://example.test/old' }), routes: [
      { name: 'old', path: '/old', redirect: () => '/fail' },
      { name: 'fail', path: '/fail', handler() { throw failure; } },
    ] });
    await router.start();
    const result = await router.getInitialDispatch();
    expect(result.status).toBe('failed');
    expect(result.error).toBe(failure);
  });

  for (const asynchronous of [false, true]) {
    it(`preserves a current ${asynchronous ? 'asynchronous' : 'synchronous'} redirect rejection`, async() => {
      const failure = new DOMException('redirect fetch aborted', 'AbortError');
      const errors = vi.fn();
      const router = createRouter({ driver: memoryDriver({ url: 'https://example.test/outside' }), routes: [
        { name: 'fail', path: '/fail', redirect() {
          if (asynchronous) { return Promise.reject(failure); }
          throw failure;
        } },
      ] });
      router.on('route:error', errors);
      await router.start();
      await router.getInitialDispatch();
      await expect(router.navigate('/fail').finished).rejects.toBe(failure);
      expect(errors).toHaveBeenCalledExactlyOnceWith(failure, router.getCurrent());
      expect(router.getCurrent().signal.aborted).toBe(false);
    });
  }

  for (const policy of ['intercept', 'within']) {
    it(`reports and rejects a refresh ${policy} policy failure through the route boundary`, async() => {
      let fail = false;
      const failure = new Error(`${policy} failed`);
      const errors = vi.fn();
      const driver = memoryDriver({ url: 'https://example.test/page' });
      const router = createRouter({ driver,
        routes: policy === 'intercept' ? [{ name: 'page', path: '/page' }] : [],
        intercept() { if (fail && policy === 'intercept') { throw failure; } return true; },
        notFound: { name: 'missing', within() { if (fail && policy === 'within') { throw failure; } return true; } },
      });
      await router.start();
      await router.getInitialDispatch();
      router.on('route:error', errors);
      fail = true;
      let readiness;
      expect(() => { readiness = router.refresh(); }).not.toThrow();
      await expect(readiness).rejects.toBe(failure);
      expect(errors).toHaveBeenCalledExactlyOnceWith(failure, null);
      expect(driver.currentEntry.url).toBe('https://example.test/page');
    });
  }

  it('returns false for a clean unclaimed refresh without changing the entry', async() => {
    const driver = memoryDriver({ url: 'https://example.test/outside' });
    const router = createRouter({ driver });
    await router.start();
    await router.getInitialDispatch();
    const before = driver.currentEntry;
    expect(await router.refresh()).toBe(false);
    expect(driver.currentEntry).toBe(before);
  });
});

describe('reconstructed selection correctness', () => {
  for (const operation of ['clear', 'stop', 'destroy']) {
    it(`revalidates a reused child after a queued ${operation}`, async() => {
      const { pages, page } = await pagesWith();
      expect(await pages.switchTo('page')).toBe(page);
      const selecting = pages.switchTo('page');
      queueMicrotask(() => pages[operation]());
      expect(await selecting).toBeUndefined();
      expect(page.isRunning()).toBe(false);
    });
  }

  it('does not return a child that stops itself in onStart', async() => {
    const Page = Application.extend({ onStart() { this.stop(); } });
    const { pages, page } = await pagesWith(Page);
    expect(await pages.switchTo('page')).toBeUndefined();
    expect(page.isRunning()).toBe(false);
  });

  it('keeps a same-key selection started by the old child stop listener tracked', async() => {
    const { pages, page } = await pagesWith();
    await pages.switchTo('page');
    let replacement;
    page.once('stop', () => { replacement = pages.switchTo('page'); });
    pages.clear();
    expect(await replacement).toBe(page);
    expect(page.isRunning()).toBe(true);
    expect(pages.getCurrent()).toBe(page);
    pages.clear();
    expect(page.isRunning()).toBe(false);
    expect(pages.getCurrent()).toBeNull();
  });
});
