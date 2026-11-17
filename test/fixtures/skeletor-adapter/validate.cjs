const assert = require('node:assert/strict');
const SkeletorApi = require('@mnjs/adapters/skeletor');

// Skeletor 4.0.2's Node require target is not usable as native CommonJS.
// Its ESM import can supply models to the adapter's CommonJS export.
(async() => {
  const { Model } = await import('@converse/skeletor');
  const model = new Model({ title: 'CommonJS adapter' });
  assert.equal(SkeletorApi.get(model, 'title'), 'CommonJS adapter');
  let calls = 0;
  const stop = SkeletorApi.subscribe(model, 'change', () => calls++);
  model.attrs.title = 'Next';
  stop(); stop();
  model.set('title', 'After');
  assert.equal(calls, 1);
})().catch(error => { console.error(error); process.exitCode = 1; });
