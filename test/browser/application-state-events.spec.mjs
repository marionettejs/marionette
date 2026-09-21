import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('Application state events preserve active UI through rejected stop and reset safely on restart', async({ page }) => {
  await page.evaluate(async() => {
    const { createMarionette } = await import('marionette');
    const { Model, StateApi } = await import('@mnjs/data');
    const runtime = createMarionette();
    runtime.setStateApi(StateApi);
    const state = new Model();
    const writes = [];
    let rejectStop;
    let stopping;
    let needsPermission = true;
    const Layout = runtime.View.extend({
      template: () => '<input aria-label="Draft"><button>Choose next</button><output></output>',
      events: { 'click button'() { state.set('choice', 'next'); } }
    });
    const App = runtime.Application.extend({
      region: '#content',
      stateEvents: { 'change:choice': 'updateChoice' },
      onBeforeStart() { state.set('choice', 'initial'); },
      onStart() {
        this.showView(new Layout());
        this.getView().el.querySelector('output').textContent = state.get('choice');
      },
      updateChoice() {
        writes.push(state.get('choice'));
        this.getView().el.querySelector('output').textContent = state.get('choice');
      },
      prepareStop() {
        if (needsPermission) { return new Promise((resolve, reject) => { rejectStop = reject; }); }
      }
    });
    const app = new App({ state });
    await app.start();
    const root = app.getView();
    window.stateFeature = {
      app, state, writes, root,
      stop() { stopping = app.stop().catch(error => error.message); },
      async deny() { rejectStop(new Error('keep editing')); return stopping; },
      async close() { needsPermission = false; await app.stop(); }
    };
  });
  await page.getByRole('textbox', { name: 'Draft' }).fill('Keep this draft');
  await page.evaluate(() => window.stateFeature.stop());
  await page.getByRole('button', { name: 'Choose next' }).click();
  const pending = await page.evaluate(() => {
    const { app, writes, root } = window.stateFeature;
    return { running: app.isRunning(), sameRoot: app.getView() === root, writes,
      text: root.el.querySelector('output').textContent, draft: root.el.querySelector('input').value };
  });
  assert.deepEqual(pending, { running: true, sameRoot: true, writes: ['next'], text: 'next', draft: 'Keep this draft' });
  assert.equal(await page.evaluate(() => window.stateFeature.deny()), 'keep editing');
  const result = await page.evaluate(async() => {
    const feature = window.stateFeature;
    await feature.close();
    feature.state.set('choice', 'stopped');
    const stopped = { running: feature.app.isRunning(), empty: document.querySelector('#content').childElementCount === 0 };
    await feature.app.start();
    const restarted = {
      sameState: feature.app.getState() === feature.state,
      choice: feature.app.getView().el.querySelector('output').textContent,
      writes: [...feature.writes]
    };
    await feature.app.destroy();
    feature.state.destroy();
    delete window.stateFeature;
    return { stopped, restarted, empty: document.querySelector('#content').childElementCount === 0 };
  });
  assert.deepEqual(result, {
    stopped: { running: false, empty: true },
    restarted: { sameState: true, choice: 'initial', writes: ['next'] }, empty: true
  });
});

test('restart completion can stop its newly mounted root', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Application, View } = await import('marionette');
    let starts = 0;
    let stops = 0;
    let stopping;
    let root;
    const App = Application.extend({
      region: '#content',
      onStart() {
        root = this.showView(new View({ template: () => '<input value="new run">' }));
        if (++starts === 2) { stopping = this.stop(); }
      },
      onStop() { stops += 1; }
    });
    const app = new App();
    await app.start();
    await app.restart();
    const stopped = await stopping;
    const observed = { stopped, stops, running: app.isRunning(), destroyed: root.isDestroyed(),
      mounted: root.el.isConnected, empty: document.querySelector('#content').childElementCount === 0 };
    await app.destroy();
    return observed;
  });
  assert.deepEqual(result, { stopped: true, stops: 2, running: false, destroyed: true, mounted: false, empty: true });
});
