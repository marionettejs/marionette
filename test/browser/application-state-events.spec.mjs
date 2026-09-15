import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

test('Application filters preserve Backbone state through readiness restart and stop', async({ page }) => {
  await page.addScriptTag({ url: '/underscore.js' });
  await page.addScriptTag({ url: '/backbone.js' });
  await page.evaluate(async() => {
    const { createMarionette } = await import('marionette');
    const { default: BackboneApi } = await import('@mnjs/adapters/backbone');
    const runtime = createMarionette();
    runtime.setStateApi(BackboneApi);
    let finishLoading;
    const loading = new Promise(resolve => { finishLoading = resolve; });
    const records = [{ title: 'First', status: 'open' }, { title: 'Second', status: 'closed' }];
    const List = runtime.View.extend({
      templateContext() { return { filter: this.getState().get('filter') }; },
      template({ filter }) {
        return records.filter(record => record.status === filter)
          .map(record => `<p>${record.title}</p>`).join('');
      }
    });
    const observations = [];
    const Feature = runtime.Application.extend({
      region: '#content',
      createState() { return new window.Backbone.Model({ filter: 'all' }); },
      stateEvents: { 'change:filter': 'restart' },
      async onBeforeStart(app, options, { signal }) {
        const state = this.getState();
        // Initialize once; the source persists through later restarts.
        if (state.get('filter') === 'all') { state.set('filter', 'open'); }
        await loading;
        if (signal.aborted) { return; }
        this.setView(new List({ state }));
      },
      onStart() {
        this.showView();
        observations.push(this.getState().get('filter'));
      }
    });
    const app = new Feature();
    const state = app.getState();
    const control = document.createElement('select');
    control.setAttribute('aria-label', 'Filter');
    control.innerHTML = '<option value="open">Open</option><option value="closed">Closed</option>';
    control.addEventListener('change', () => state.set('filter', control.value));
    document.body.prepend(control);
    window.example = { app, state, observations, finishLoading, starting: app.start() };
  });

  try {
    await page.getByLabel('Filter').selectOption('closed');
    await expect(page.locator('#content')).toBeEmpty();
    assert.deepEqual(await page.evaluate(() => window.example.observations), []);
    assert.equal(await page.evaluate(async() => {
      window.example.finishLoading();
      return window.example.starting;
    }), true);
    await expect(page.locator('#content')).toHaveText('Second');

    await page.getByLabel('Filter').selectOption('open');
    await expect(page.locator('#content')).toHaveText('First');
    assert.deepEqual(await page.evaluate(() => window.example.observations), ['closed', 'open']);
    assert.equal(await page.evaluate(() => window.example.app.getState() === window.example.state), true);

    await page.evaluate(() => window.example.app.stop());
    await page.getByLabel('Filter').selectOption('closed');
    await expect(page.locator('#content')).toBeEmpty();
    assert.equal(await page.evaluate(() => window.example.app.isRunning()), false);
    await page.evaluate(() => window.example.app.start());
    await expect(page.locator('#content')).toHaveText('Second');
    assert.deepEqual(await page.evaluate(() => window.example.observations), ['closed', 'open', 'closed']);
  } finally {
    await page.evaluate(async() => {
      window.example.finishLoading();
      await window.example.app.destroy();
      window.example.state.off();
      window.example.state.stopListening();
      delete window.example;
    });
  }
});
