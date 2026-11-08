import { expect } from '@playwright/test';
import { routerArtifactPath } from '../router/artifact.mjs';
import { test } from './fixtures.mjs';

async function desk(page) {
  test.skip(!await page.evaluate(() => 'navigation' in window), 'Navigation API unavailable');
  await page.route('**/router.js', route => route.fulfill({
    path: routerArtifactPath('dist/index.js'), contentType: 'text/javascript',
  }));
  await page.route('**/desk.mjs', route => route.fulfill({
    path: routerArtifactPath('examples/desk/desk.mjs'), contentType: 'text/javascript',
  }));
  await page.evaluate(async() => {
    const imports = document.createElement('script'); imports.type = 'importmap';
    imports.textContent = JSON.stringify({ imports: { '@mnjs/router': '/router.js' } });
    document.head.append(imports);
    const { navigationDriver } = await import('/router.js');
    const { createDesk } = await import('/desk.mjs');
    const main = document.getElementById('content');
    const side = document.body.appendChild(document.createElement('aside'));
    side.id = 'inspector';
    const first = Promise.withResolvers();
    const replacement = Promise.withResolvers();
    const app = createDesk({ main, side, driver: navigationDriver(), load: () => first.promise });
    window.deskExample = { app, first, replacement };
    await app.start();
    await app.router.getInitialDispatch();
  });
}

for (const failure of [false, true]) {
  test(`feature-owned replacement delays native readiness until attached ${failure ? 'handled error' : 'content'}`, async({ page }) => {
    await desk(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluate(() => {
      const state = window.deskExample;
      state.finished = false;
      state.navigation = state.app.router.navigate('item', { desk: 'blue', id: 'one' }).finished.then(value => {
        state.finished = true; return value;
      });
    });
    await expect(page.locator('#content')).toHaveText('loading');
    await page.evaluate(() => {
      const state = window.deskExample;
      state.restarted = state.app.catalog.page.restart({ id: 'one', load: () => state.replacement.promise });
    });
    expect(await page.evaluate(() => window.deskExample.finished)).toBe(false);
    expect(await page.evaluate(async failed => {
      const state = window.deskExample;
      if (failed) { state.replacement.reject(new Error('Replacement failed')); } else { state.replacement.resolve('Replacement ready'); }
      return { restarted: await state.restarted, navigation: await state.navigation };
    }, failure)).toEqual({ restarted: true, navigation: true });
    await expect(page.locator('#content')).toHaveText(failure ? 'Replacement failed' : 'Replacement ready');
    await page.evaluate(() => window.deskExample.first.reject(new Error('obsolete request')));
    await page.evaluate(() => new Promise(done => requestAnimationFrame(done)));
    expect(errors).toEqual([]);
  });
}

test('lazy sidebar routes refresh after mounting and registration survives UI stop', async({ page }) => {
  await desk(page);
  await page.evaluate(() => {
    window.deskExample.activity = window.deskExample.app.mountActivity();
  });
  expect(await page.evaluate(() => window.deskExample.activity.isRunning())).toBe(false);
  expect(await page.evaluate(() => window.deskExample.app.router.navigate('activity', { desk: 'green' }).finished)).toBe(true);
  await expect(page.locator('#inspector')).toHaveText('Activity inspector');
  expect(await page.evaluate(async() => {
    const state = window.deskExample; state.activity.stop();
    const registered = state.app.router.hasRoute('activity');
    const refreshed = await state.app.router.refresh();
    state.activity.destroy();
    return { registered, refreshed, removed: !state.app.router.hasRoute('activity'), current: state.app.router.getCurrent() };
  })).toEqual({ registered: true, refreshed: true, removed: true, current: null });
});
