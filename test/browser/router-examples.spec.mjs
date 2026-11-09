import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { routerArtifactPath } from '../router/artifact.mjs';
import { test } from './fixtures.mjs';

async function snippet(page, documentPath, names) {
  test.skip(!await page.evaluate(() => 'navigation' in window), 'Navigation API unavailable');
  const source = readFileSync(routerArtifactPath(documentPath), 'utf8').match(/```js\n([\s\S]*?)\n```/)[1];
  await page.route('**/router.js', route => route.fulfill({ path: routerArtifactPath('dist/index.js'), contentType: 'text/javascript' }));
  await page.route('**/snippet.mjs', route => route.fulfill({ body: `${source}\nexport { ${names.join(', ')} };`, contentType: 'text/javascript' }));
  await page.evaluate(() => {
    const map = document.createElement('script');
    map.type = 'importmap';
    map.textContent = JSON.stringify({ imports: { '@mnjs/router': '/router.js' } });
    document.head.append(map);
  });
}

test('README routed feature owns named Views, escapes route text and destroys owned UI', async({ page }) => {
  await snippet(page, 'readme.md', ['frame', 'router', 'catalog', 'ItemView']);
  await page.evaluate(async() => { window.readmeExample = await import('/snippet.mjs'); });
  await expect(page.getByRole('heading')).toHaveText('Item 42');
  const markup = '<img src=x onerror="globalThis.exampleInjected=true"><b>untrusted & text</b>';
  const result = await page.evaluate(async value => {
    const { frame, router, catalog, ItemView } = window.readmeExample;
    const first = catalog.getView();
    const named = first instanceof ItemView && first.isRendered() && first.isAttached();
    await router.navigate('item', { id: value }).finished;
    const current = catalog.getView();
    const heading = current.el.querySelector('h1');
    const escaped = heading.textContent === `Item ${value}` && heading.querySelector('img, b') === null;
    frame.stop();
    const stopped = !router.isRunning() && current.isDestroyed() && document.querySelector('#content').textContent === '';
    await frame.start(); await catalog.start(); await router.start();
    const initial = await router.getInitialDispatch();
    const restarted = catalog.getView();
    frame.destroy();
    return { named, escaped, replaced: first.isDestroyed(), stopped, initial: initial.status,
      destroyed: restarted.isDestroyed() && router.isDestroyed() };
  }, markup);
  expect(result).toEqual({ named: true, escaped: true, replaced: true, stopped: true, initial: 'matched', destroyed: true });
  await expect(page.locator('#content')).toBeEmpty();
});

test('Catalog README composes an ordinary Application with explicit route registration', async({ page }) => {
  await snippet(page, 'examples/catalog/README.md', ['frame', 'router', 'catalog']);
  await page.route('**/catalog.mjs', route => route.fulfill({ path: routerArtifactPath('examples/catalog/catalog.mjs'), contentType: 'text/javascript' }));
  const markup = '<img src=x><b>Catalog & title</b>';
  await page.route('**/api/items/42', route => route.fulfill({ json: { title: markup } }));
  await page.evaluate(async() => { window.catalogExample = await import('/snippet.mjs'); });
  await expect(page.getByRole('heading')).toHaveText(markup);
  await expect(page.locator('#content img, #content b')).toHaveCount(0);
  const result = await page.evaluate(async() => {
    const { frame, router, catalog } = window.catalogExample;
    const owned = frame.getChildApp('catalog') === catalog;
    const view = catalog.getView();
    const rendered = view.isRendered() && view.isAttached();
    catalog.stop();
    const retained = router.hasRoute('catalog') && view.isDestroyed();
    await router.refresh();
    const replacement = catalog.getView();
    catalog.destroy();
    const retired = !router.hasRoute('catalog') && replacement.isDestroyed();
    frame.destroy();
    return { owned, rendered, retained, retired, destroyed: router.isDestroyed() };
  });
  expect(result).toEqual({ owned: true, rendered: true, retained: true, retired: true, destroyed: true });
  await expect(page.locator('#content')).toBeEmpty();
});

test('Catalog README rejects a failed initial preparation instead of completing bootstrap', async({ page }) => {
  await snippet(page, 'examples/catalog/README.md', ['frame', 'router', 'catalog']);
  await page.route('**/catalog.mjs', route => route.fulfill({ path: routerArtifactPath('examples/catalog/catalog.mjs'), contentType: 'text/javascript' }));
  await page.route('**/api/items/42', route => route.fulfill({ status: 503, json: { message: 'unavailable' } }));
  const result = await page.evaluate(async() => {
    history.replaceState(null, '', '/catalog/42');
    return import('/snippet.mjs').then(() => 'incorrectly completed', error => error.message);
  });
  expect(result).toBe('Item request failed: 503');
  await expect(page.locator('#content')).toBeEmpty();
});

test('Desk README uses ordinary lifecycle and clears stale content at the parent destination', async({ page }) => {
  await snippet(page, 'examples/desk/README.md', ['desk', 'router', 'tools']);
  await page.route('**/desk.mjs', route => route.fulfill({ path: routerArtifactPath('examples/desk/desk.mjs'), contentType: 'text/javascript' }));
  await page.route('**/api/catalog/one', route => route.fulfill({ body: 'Loaded item one' }));
  await page.evaluate(() => {
    document.querySelector('#content').id = 'main';
    const aside = document.body.appendChild(document.createElement('aside'));
    aside.id = 'side';
  });
  await page.evaluate(async() => { window.deskReadme = await import('/snippet.mjs'); });
  await expect(page.locator('#main')).toHaveText('Loaded item one');
  const result = await page.evaluate(async() => {
    const { desk, router, tools } = window.deskReadme;
    const catalog = desk.getChildApp('catalog');
    const pageApp = catalog.getChildApp('page');
    const content = pageApp.getView();
    await router.navigate('activity', { desk: 'blue' }).finished;
    const independent = pageApp.getView() === content && tools.getChildApp('activity').isRunning();
    await router.navigate('/red').finished;
    const parent = { name: router.getCurrent().name, desk: router.getCurrent().params.desk,
      main: document.querySelector('#main').textContent, side: document.querySelector('#side').textContent,
      retired: content.isDestroyed() && !pageApp.isRunning() };
    desk.stop();
    const stopped = !router.isRunning() && !catalog.isRunning() && document.querySelector('#main').textContent === '';
    desk.destroy();
    return { independent, parent, stopped, destroyed: router.isDestroyed() && catalog.isDestroyed() };
  });
  expect(result).toEqual({ independent: true, parent: { name: 'catalog', desk: 'red', main: 'Catalog red', side: '', retired: true },
    stopped: true, destroyed: true });
});
