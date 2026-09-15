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
    const { createResultsFeature } = await import(featureURL);
    URL.revokeObjectURL(helperURL);
    URL.revokeObjectURL(featureURL);
    const { Collection } = await import('@mnjs/data');
    const items = new Collection([{ id: 1, name: 'Original' }]);
    const pending = new Map();
    let denyStop = true;
    const result = await createResultsFeature({
      el: document.querySelector('#content'), items,
      loadItems(query, { signal }) {
        const request = { signal, ...Promise.withResolvers() };
        pending.set(query, request);
        return request.promise;
      },
      beforeStop() { if (denyStop) { throw new Error('Keep editing'); } }
    });
    const query = document.createElement('input');
    query.setAttribute('aria-label', 'Filter');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    document.body.prepend(query, status);
    const fixture = {
      ...result, items, pending,
      layout: result.application.getView(), row: document.querySelector('li'),
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
