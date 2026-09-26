import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

const markdown = await readFile(new URL('../../docs/application-refresh.md', import.meta.url), 'utf8');
const extract = id => markdown.split(`<!-- executable-example: ${id} -->`)[1]
  .match(/^\s*```javascript\n([\s\S]*?)\n```/)[1];
const controllerSource = extract('application-latest-request');
const featureSource = extract('application-data-refresh');

test('Application refresh preserves editor focus and draft while only latest results commit', async({ page }) => {
  await page.evaluate(async({ controller, feature }) => {
    const helperURL = URL.createObjectURL(new Blob([controller], { type: 'text/javascript' }));
    const featureURL = URL.createObjectURL(new Blob([
      feature.replace('./latest-request.js', helperURL)
    ], { type: 'text/javascript' }));
    const { ResultsFeature } = await import(featureURL);
    URL.revokeObjectURL(helperURL);
    URL.revokeObjectURL(featureURL);
    const { Collection } = await import('@mnjs/data');
    const items = new Collection([{ id: 1, name: 'Original' }]);
    const pending = new Map();
    let denyStop = true;
    const result = new ResultsFeature({
      region: { el: document.querySelector('#content') }, items,
      loadItems(query, { signal }) {
        const request = { signal, ...Promise.withResolvers() };
        pending.set(query, request);
        return request.promise;
      },
      beforeStop() { if (denyStop) { throw new Error('Keep editing'); } }
    });
    await result.start();
    const query = document.createElement('input');
    query.setAttribute('aria-label', 'Filter');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    document.body.prepend(query, status);
    const fixture = {
      application: result, refresh: (...args) => result.refresh(...args), cancel: () => result.cancel(), items, pending,
      layout: result.getView(), row: document.querySelector('li'),
      editor: document.querySelector('textarea'),
      allowStop() { denyStop = false; }
    };
    query.addEventListener('input', () => {
      status.textContent = 'Loading';
      fixture.refreshing = result.refresh(query.value).then(committed => {
        if (committed) { status.textContent = 'Ready'; }
        return committed;
      }, error => { status.textContent = error.message; return false; });
    });
    window.refreshExample = fixture;
  }, { controller: controllerSource, feature: featureSource });
  try {
    await page.getByLabel('Draft').fill('Unsaved editing');
    await page.getByLabel('Filter').fill('slow');
    await page.getByLabel('Filter').fill('latest');
    await page.getByLabel('Draft').focus();
    await page.getByLabel('Draft').evaluate(editor => editor.setSelectionRange(2, 5));
    await page.evaluate(() => window.refreshExample.pending.get('latest').resolve([{ id: 1, name: 'Latest' }]));
    await expect(page.getByRole('status')).toHaveText('Ready');
    await expect(page.locator('li')).toHaveText('Latest');
    await page.evaluate(() => window.refreshExample.pending.get('slow').reject(new Error('Obsolete error')));
    await expect(page.getByRole('status')).toHaveText('Ready');
    await expect(page.getByLabel('Draft')).toBeFocused();
    await expect(page.getByLabel('Draft')).toHaveValue('Unsaved editing');
    assert.deepEqual(await page.evaluate(() => {
      const f = window.refreshExample;
      return [f.application.getView() === f.layout, document.querySelector('li') === f.row,
        document.querySelector('textarea') === f.editor, f.editor.selectionStart, f.editor.selectionEnd];
    }), [true, true, true, 2, 5]);

    await page.getByLabel('Filter').fill('failure');
    await page.evaluate(() => window.refreshExample.pending.get('failure').reject(new Error('Retry this load')));
    await expect(page.getByRole('status')).toHaveText('Retry this load');
    await expect(page.locator('li')).toHaveText('Latest');
    await page.getByLabel('Filter').fill('retry');
    await page.evaluate(() => window.refreshExample.pending.get('retry').resolve([{ id: 1, name: 'Recovered' }]));
    await expect(page.locator('li')).toHaveText('Recovered');
    assert.equal(await page.evaluate(() => window.refreshExample.application.stop().then(() => false, () => true)), true);
    await expect(page.getByLabel('Draft')).toHaveValue('Unsaved editing');
    await page.getByLabel('Filter').fill('teardown');
    await page.evaluate(async() => {
      const f = window.refreshExample;
      f.allowStop();
      await f.application.stop();
      f.pending.get('teardown').resolve([{ id: 1, name: 'Too late' }]);
      await f.refreshing;
    });
    await expect(page.locator('#content')).toBeEmpty();
    assert.equal(await page.evaluate(() => window.refreshExample.items.get(1).get('name')), 'Recovered');
  } finally {
    await page.evaluate(async() => {
      const f = window.refreshExample;
      f.allowStop();
      f.pending.forEach(request => request.resolve([]));
      await f.application.destroy();
      f.items.destroy();
      delete window.refreshExample;
    });
  }
});

const composition = await readFile(new URL('../../docs/application-composition.md', import.meta.url), 'utf8');
const feedSource = composition.split('<!-- executable-example: application-feed-composition -->')[1]
  .match(/^\s*```javascript\n([\s\S]*?)\n```/)[1];

test('canonical feed routes retry to its Application and preserves a sibling draft during pagination', async({ page }) => {
  await page.evaluate(async({ source, apiSource }) => {
    const apiURL = URL.createObjectURL(new Blob([apiSource], { type: 'text/javascript' }));
    const { feedApi } = await import(apiURL);
    const url = URL.createObjectURL(new Blob([source.replace('./feed-api.js', apiURL)], { type: 'text/javascript' }));
    const { RootApplication } = await import(url);
    URL.revokeObjectURL(url);
    URL.revokeObjectURL(apiURL);
    window.feedRequests = [];
    feedApi.loadPage = (pageNumber, { signal }) => {
      const request = { page: pageNumber, signal, ...Promise.withResolvers() };
      window.feedRequests.push(request);
      return request.promise;
    };
    window.root = new RootApplication({ region: { el: document.querySelector('main') } });
    window.startingFeed = window.root.start();
  }, { source: feedSource, apiSource: composition.split('<!-- executable-example: application-feed-api -->')[1]
    .match(/^\s*```javascript\n([\s\S]*?)\n```/)[1] });
  await expect(page.getByRole('status')).toHaveText('Loading…');
  await page.evaluate(async() => {
    window.feedRequests[0].reject(new Error('Unavailable'));
    await window.startingFeed;
  });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.evaluate(() => window.feedRequests[1].resolve({ items: [{ id: 1, title: 'First' }], hasNext: true }));
  await expect(page.getByRole('status')).toHaveText('Page 1');
  await page.getByLabel('Notes').fill('Retain this draft');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Notes').focus();
  await page.getByLabel('Notes').evaluate(el => {
    window.feedDraft = el;
    el.setSelectionRange(2, 6);
  });
  await page.evaluate(() => window.feedRequests[2].resolve({ items: [{ id: 1, title: 'Updated' }], hasNext: false }));
  await expect(page.getByRole('status')).toHaveText('Page 2');
  await expect(page.getByLabel('Notes')).toBeFocused();
  await expect(page.getByLabel('Notes')).toHaveValue('Retain this draft');
  expect(await page.getByLabel('Notes').evaluate(el => [el === window.feedDraft, el.selectionStart, el.selectionEnd])).toEqual([true, 2, 6]);
  await page.evaluate(async() => {
    window.pendingFeed = window.root.getChildApp('feed').refresh(3);
    await window.root.destroy();
    window.feedRequests[3].resolve({ items: [{ id: 2, title: 'Too late' }], hasNext: false });
    await window.pendingFeed;
  });
  await expect(page.locator('main')).toBeEmpty();
});
