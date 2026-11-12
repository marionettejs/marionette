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
    const { Desk } = await import('/desk.mjs');
    const main = document.getElementById('content');
    const side = document.body.appendChild(document.createElement('aside'));
    side.id = 'inspector';
    const first = Promise.withResolvers();
    const replacement = Promise.withResolvers();
    const app = new Desk({ main, side, driver: navigationDriver(), load: () => first.promise });
    const router = app.getChildApp('navigation');
    const catalog = app.getChildApp('catalog');
    const tools = app.getChildApp('tools');
    const pageApp = catalog.getChildApp('page');
    window.deskExample = { app, router, catalog, tools, pageApp, first, replacement };
    await app.start();
    await router.start();
    await router.getInitialDispatch();
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
      state.navigation = state.router.navigate('item', { desk: 'blue', id: 'one' }).finished.then(value => {
        state.finished = true; return value;
      });
    });
    await expect(page.locator('#content')).toHaveText('loading');
    await page.evaluate(() => {
      const state = window.deskExample;
      state.restarted = state.pageApp.restart({ id: 'one', load: () => state.replacement.promise });
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
  await page.evaluate(async() => {
    const { Activity } = await import('/desk.mjs');
    const state = window.deskExample;
    state.activity = state.tools.addChildApp('activity', new Activity({
      region: state.tools.getRegion(),
    }));
    state.activity.mountRoutes(state.router, { parent: 'desk' });
    await state.tools.start();
    await state.activity.start();
  });
  expect(await page.evaluate(() => window.deskExample.activity.isRunning())).toBe(true);
  expect(await page.evaluate(() => window.deskExample.router.navigate('activity', { desk: 'green' }).finished)).toBe(true);
  await expect(page.locator('#inspector')).toHaveText('Activity inspector');
  expect(await page.evaluate(async() => {
    const state = window.deskExample; state.activity.clear();
    const registered = state.router.hasRoute('activity');
    const refreshed = await state.router.refresh();
    state.activity.destroy();
    return { registered, refreshed, removed: !state.router.hasRoute('activity'), current: state.router.getCurrent() };
  })).toEqual({ registered: true, refreshed: true, removed: true, current: null });
});
