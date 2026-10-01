import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

test('retained restart keeps loading and failed UI interactive and commits only latest preparation', async({ page }) => {
  await page.evaluate(async() => {
    const { Application, View } = await import('marionette');
    const requests = [];
    const Root = View.extend({
      template: () => '<label>Draft<input></label><button>Reload</button><output>Initial</output>',
      triggers: { 'click button': 'reload' }
    });
    const Feature = Application.extend({
      region: '#content',
      viewEvents: { reload: 'reload' },
      reload() {
        this.pending = this.restart({ load: true }).catch(error => {
          this.getView().el.querySelector('output').textContent = error.message;
        });
      },
      prepareStart(options, { signal }) {
        if (!options?.load) { return; }
        this.getView().el.querySelector('output').textContent = 'Loading';
        const request = { signal, ...Promise.withResolvers() };
        requests.push(request);
        return request.promise;
      },
      onStart(owner, options, result) {
        if (!this.getView()) { this.showView(new Root()); }
        if (result) { this.getView().el.querySelector('output').textContent = result; }
      }
    });
    const app = new Feature();
    const child = app.addChildApp('child', new Application());
    await app.start();
    await child.start();
    window.retained = { app, child, requests, root: app.getView(), input: document.querySelector('input') };
  });
  await page.getByLabel('Draft').fill('Keep editing');
  await page.getByRole('button', { name: 'Reload' }).click();
  await page.getByRole('button', { name: 'Reload' }).click();
  await page.getByLabel('Draft').focus();
  await page.getByLabel('Draft').evaluate(el => el.setSelectionRange(2, 5));
  expect(await page.evaluate(() => {
    const f = window.retained;
    return [f.app.isRunning(), f.child.isRunning(), f.requests[0].signal.aborted];
  })).toEqual([true, true, true]);
  await page.evaluate(async() => {
    const f = window.retained;
    f.requests[1].resolve('Latest');
    await f.app.pending;
    f.requests[0].resolve('Obsolete');
    await f.requests[0].promise;
  });
  await expect(page.locator('output')).toHaveText('Latest');
  await expect(page.getByLabel('Draft')).toBeFocused();
  await page.getByRole('button', { name: 'Reload' }).click();
  await page.getByLabel('Draft').focus();
  await page.evaluate(async() => {
    const f = window.retained;
    f.requests[2].reject(new Error('Retry'));
    await f.app.pending;
  });
  await expect(page.locator('output')).toHaveText('Retry');
  await expect(page.getByLabel('Draft')).toBeFocused();
  await expect(page.getByLabel('Draft')).toHaveValue('Keep editing');
  expect(await page.evaluate(() => {
    const f = window.retained;
    return [f.app.getView() === f.root, document.querySelector('input') === f.input, f.app.isRunning()];
  })).toEqual([true, true, true]);
  await page.getByRole('button', { name: 'Reload' }).click();
  await page.evaluate(async() => {
    const f = window.retained;
    f.requests[3].resolve('Recovered');
    await f.app.pending;
    await f.app.stop();
    await f.app.start();
  });
  await expect(page.getByLabel('Draft')).toHaveValue('');
  expect(await page.evaluate(() => {
    const f = window.retained;
    return [f.root.isDestroyed(), f.child.isRunning(), f.app.getView() === f.root];
  })).toEqual([true, false, false]);
  await page.evaluate(async() => { await window.retained.app.destroy(); delete window.retained; });
  await expect(page.locator('#content')).toBeEmpty();
});
