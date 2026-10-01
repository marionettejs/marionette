import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

const markdown = await readFile(new URL('../../docs/application-effects.md', import.meta.url), 'utf8');
const code = markdown.match(/<!-- executable-example: application-active-effects -->\n```javascript\n([\s\S]*?)\n```/)[1];

test('Application effects release synchronously on stop and reactivate on start', async({ page }) => {
  await page.evaluate(async source => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const { StatusFeature } = await import(url);
    URL.revokeObjectURL(url);
    const { Model } = await import('@mnjs/data');
    const { Radio } = await import('@mnjs/radio');
    const state = new Model();
    const channel = Radio.channel('effects-browser');
    const ready = Promise.withResolvers();
    const app = new StatusFeature({
      region: { el: document.querySelector('#content') }, state, channel,
      load: () => ready.promise
    });
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Filter');
    input.addEventListener('input', () => state.set('filter', input.value));
    document.body.prepend(input);
    window.effectsExample = { app, state, channel, ready, starting: app.start() };
  }, code);
  try {
    await page.getByLabel('Filter').fill('closed');
    await expect(page.locator('#content')).toBeEmpty();
    assert.equal(await page.evaluate(async() => {
      window.effectsExample.ready.resolve({ label: 'Queue' });
      return window.effectsExample.starting;
    }), true);
    await expect(page.locator('#content')).toHaveText('Queue: closed');
    await page.getByLabel('Filter').fill('open');
    await expect(page.locator('#content')).toHaveText('Queue: open');
    assert.equal(await page.evaluate(() => window.effectsExample.app.stop()), true);
    await page.getByLabel('Filter').fill('closed');
    await expect(page.locator('#content')).toBeEmpty();
    assert.equal(await page.evaluate(() => window.effectsExample.channel.request('current:filter')), undefined);
    await page.evaluate(() => window.effectsExample.app.start());
    await expect(page.locator('#content')).toHaveText('Queue: closed');
    assert.equal(await page.evaluate(() => window.effectsExample.app.getState() === window.effectsExample.state), true);
  } finally {
    await page.evaluate(async() => {
      const feature = window.effectsExample;
      feature.ready.resolve({ label: 'Done' });
      await feature.app.destroy();
      feature.state.destroy();
      feature.channel.reset();
      delete window.effectsExample;
    });
  }
});
