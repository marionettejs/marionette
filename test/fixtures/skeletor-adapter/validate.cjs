const assert = require('node:assert/strict');
const SkeletorApi = require('@mnjs/adapters/skeletor');
const { Model } = require('@converse/skeletor');

const model = new Model({ title: 'CommonJS adapter' });
assert.equal(SkeletorApi.get(model, 'title'), 'CommonJS adapter');
let calls = 0;
const stop = SkeletorApi.subscribe(model, 'change', () => calls++);
model.attrs.title = 'Next';
stop(); stop();
model.set('title', 'After');
assert.equal(calls, 1);
