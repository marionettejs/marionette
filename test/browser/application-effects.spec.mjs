import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

const markdown = await readFile(new URL('../../docs/application-effects.md', import.meta.url), 'utf8');
const code = markdown.match(/<!-- executable-example: application-active-effects -->\n```javascript\n([\s\S]*?)\n```/)[1];

test('Application effects survive denied stop and release on successful deactivation', async({ page }) => {
  await page.evaluate(async source => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const { createStatusFeature } = await import(url);
    URL.revokeObjectURL(url);
    const { Model } = await import('@mnjs/data');
    const { Radio } = await import('@mnjs/radio');
    const state = new Model();
    const channel = Radio.channel('effects-browser');
    const ready = Promise.withResolvers();
    let deny = true;
    const app = createStatusFeature({
      el: document.querySelector('#content'), state, channel,
      load: () => ready.promise,
      beforeStop: async() => { if (deny) { throw new Error('Keep editing'); } }
    });
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Filter');
    input.addEventListener('input', () => state.set('filter', input.value));
    document.body.prepend(input);
    window.effectsExample = { app, state, channel, ready, starting: app.start(), allowStop() { deny = false; } };
  }, code);
  try {
    await page.getByLabel('Filter').fill('closed');
    await expect(page.locator('#content')).toBeEmpty();
    assert.equal(await page.evaluate(async() => {
      window.effectsExample.ready.resolve({ label: 'Queue' });
      return window.effectsExample.starting;
    }), true);
    await expect(page.locator('#content')).toHaveText('Queue: closed');
    assert.equal(await page.evaluate(() => window.effectsExample.app.stop().then(() => false, () => true)), true);
    await page.getByLabel('Filter').fill('open');
    await expect(page.locator('#content')).toHaveText('Queue: open');
    await page.evaluate(async() => { window.effectsExample.allowStop(); await window.effectsExample.app.stop(); });
    await page.getByLabel('Filter').fill('closed');
    await expect(page.locator('#content')).toBeEmpty();
    assert.equal(await page.evaluate(() => window.effectsExample.channel.request('current:filter')), undefined);
    await page.evaluate(() => window.effectsExample.app.start());
    await expect(page.locator('#content')).toHaveText('Queue: closed');
    assert.equal(await page.evaluate(() => window.effectsExample.app.getState() === window.effectsExample.state), true);
  } finally {
    await page.evaluate(async() => {
      const feature = window.effectsExample;
      feature.allowStop();
      feature.ready.resolve({ label: 'Done' });
      await feature.app.destroy();
      feature.state.destroy();
      feature.channel.reset();
      delete window.effectsExample;
    });
  }
});
