import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).pathname;
const require = createRequire(`${root}/package.json`);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.document = dom.window.document;
const report = JSON.parse(readFileSync('test/tmp/docs-v5-package/report.json', 'utf8'));
const { Region, View, CollectionView } = await import(pathToFileURL(`${report.consumer.directory}/node_modules/marionette/dist/marionette.js`));
const runs = [];
const checks = [];
for (const replaceElement of [false, true]) {
  const trace = [];
  const observe = (label, names) => Object.fromEntries(names.map(name => ['on' + name.split(':').map(word => word[0].toUpperCase() + word.slice(1)).join(''), () => trace.push(`${label}:${name}`)]));
  const Row = View.extend({ template: false, ...observe('row', ['before:destroy', 'destroy']) });
  const List = CollectionView.extend({ childView: Row, ...observe('list', ['before:destroy', 'before:detach', 'detach', 'before:destroy:children', 'destroy:children', 'destroy']) });
  const Incoming = View.extend({ template: () => '<p>Next</p>', ...observe('next', ['before:render', 'render', 'before:attach', 'attach']) });
  const TestRegion = Region.extend(observe('region', ['before:show', 'before:empty', 'empty', 'show']));
  const el = document.createElement('section'); document.body.append(el);
  const region = new TestRegion({ el, replaceElement });
  region.show(new List({ collection: [{}] })); trace.length = 0;
  region.show(new Incoming());
  const first = ['region:before:show', 'region:before:empty'];
  const detaching = replaceElement ? ['list:before:detach', 'list:detach', 'list:before:destroy'] : ['list:before:destroy', 'list:before:detach', 'list:detach'];
  const rest = ['list:before:destroy:children', 'row:before:destroy', 'row:destroy', 'list:destroy:children', 'list:destroy', 'region:empty', 'next:before:render', 'next:render', 'next:before:attach', 'next:attach', 'region:show'];
  assert.deepEqual(trace, [...first, ...detaching, ...rest]);
  runs.push({ replaceElement, trace: [...trace] }); region.destroy(); el.remove();
}
// Focused probes resolve reviewer questions without changing runtime behavior.
function expectMissingElement(operation) {
  assert.throws(operation, error => error.code === 'MN0004');
}
for (const options of [undefined, {}, { allowMissingEl: true }, { allowMissingEl: false }]) {
  const region = new Region({ el: '.absent', allowMissingEl: true });
  const child = new View({ template: false });
  assert.equal(region.show(child), undefined);
  assert.equal(region.hasView(), false);
  expectMissingElement(() => region.empty(options));
  child.destroy();
}
checks.push('empty after failed lookup throws MN0004 with or without options');
const page = new View({ template: () => '<p>Page</p>', regions: { content: { el: '.absent', allowMissingEl: true } } });
const child = new View({ template: false });
assert.equal(page.showChildView('content', child), child);
assert.equal(child.isDestroyed(), false);
assert.equal(page.getRegion('content').hasView(), false);
const owner = new Region({ el: document.createElement('section') });
owner.show(child); // A skipped show left the child unowned and available.
expectMissingElement(() => page.render());
owner.destroy();
checks.push('skipped showChildView returns a live unowned child; later parent render throws MN0004');
let calls = 0;
const source = () => { calls++; return {}; };
const sourceView = new View({ model: source, collection: source, template: false });
assert.equal(sourceView.model, source);
assert.equal(sourceView.collection, source);
assert.equal(calls, 0);
sourceView.destroy();
checks.push('model and collection functions are retained as sources, not resolved');
for (const Parent of [View, Region]) {
  for (const method of ['call', 'apply']) {
    const constructor = function(options) {
      if (method === 'call') { Parent.call(this, options); } else { Parent.apply(this, arguments); }
    };
    const Child = Parent.extend({ constructor });
    const instance = new Child({ el: document.createElement('section'), template: false });
    assert.ok(instance.cid);
    assert.ok(instance instanceof Parent);
    instance.destroy();
  }
}
checks.push('View and Region custom constructors support Parent.call and Parent.apply');
const { Model, DataApi } = await import(pathToFileURL(`${report.consumer.directory}/node_modules/@mnjs/data/dist/index.js`));
const model = new Model({ title: 'Before' });
const ModelPage = View.extend({}).setDataApi(DataApi);
const modelPage = new ModelPage({ model, modelEvents: { change: 'render' }, template: ({ title }) => `<h2>${title}</h2><main></main>`, regions: { content: 'main' } });
const modelChild = new View({ template: false });
modelPage.showChildView('content', modelChild);
model.set('title', 'After');
assert.equal(modelPage.el.querySelector('h2').textContent, 'After');
assert.equal(modelChild.isDestroyed(), true);
assert.equal(modelPage.getRegion('content').hasView(), false);
modelPage.destroy(); model.destroy();
checks.push('modelEvents change:render updates template data and destroys managed children');
writeFileSync('test/tmp/docs-v5-package/reference-contracts.json', JSON.stringify({ passed: true, probeSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'), consumer: report.consumer.directory, scope: 'Installed candidate contract checks; no fresh-reader claim. Row detach propagation is covered separately by source tests.', runs, checks }, null, 2) + '\n');
console.log('Installed reference contract and replacement lifecycle checks passed.');
