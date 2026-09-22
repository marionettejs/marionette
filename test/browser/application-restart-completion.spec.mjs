import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('restart from completion mounts a fresh run after releasing prior roots', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Application, View } = await import('marionette');
    const roots = [];
    const labels = [];
    let stops = 0;
    let nested;
    const App = Application.extend({
      region: '#content',
      onStart(owner, { label }) {
        labels.push(label);
        roots.push(this.showView(new View({ template: () => `<input value="${label}">` })));
        if (label === 'outer') { nested = this.restart({ label: 'next' }); }
      },
      onStop() { stops += 1; }
    });
    const app = new App();
    await app.start({ label: 'initial' });
    const outer = app.restart({ label: 'outer' });
    const outerResult = await outer;
    const nestedResult = await nested;
    const observed = {
      outerResult, nestedResult, distinct: outer !== nested, labels, stops,
      destroyed: roots.map(view => view.isDestroyed()),
      mounted: roots.map(view => view.el.isConnected),
      input: document.querySelector('#content input').value
    };
    await app.destroy();
    return observed;
  });
  assert.deepEqual(result, {
    outerResult: true, nestedResult: true, distinct: true,
    labels: ['initial', 'outer', 'next'], stops: 2,
    destroyed: [true, true, false], mounted: [false, false, true], input: 'next'
  });
});
