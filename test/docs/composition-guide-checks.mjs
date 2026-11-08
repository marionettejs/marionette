export const preparations = {
  'guides-composition-1': `
const mount = document.createElement('div');
mount.id = 'app';
document.body.append(mount);
`,
};

export const assertions = {
  'guides-composition-1': `
assert.equal(app.isRunning(), true);
const layout = app.getView();
const list = layout.getChildView('items');
const row = list.children.findByModel(app.items.get('alpha'));
const button = row.el.querySelector('button');
assert.equal(button.type, 'button');
assert.equal(button.dataset.id, 'alpha');
assert.equal(button.querySelector('[aria-hidden]').getAttribute('aria-hidden'), 'true');
let selections = 0;
list.on('select:item', itemId => { assert.equal(itemId, 'alpha'); selections++; });
for (const target of [button, button.querySelector('.label'), button.querySelector('[aria-hidden]')]) {
  const before = selections;
  target.click();
  assert.equal(selections, before + 1);
  assert.equal(layout.getChildView('detail').model, row.model);
}
const beforeOutside = selections;
row.el.click();
assert.equal(selections, beforeOutside);
assert.equal(layout.getChildView('detail').model, row.model);
row.model.set('title', '<Updated>');
assert.equal(row.el.querySelector('.label').textContent, '<Updated>');
assert.equal(layout.getChildView('detail').el.textContent, '<Updated>');
assert.equal(layout.el.querySelector('updated'), null);
const beforeRerenderClick = selections;
row.el.querySelector('.label').click();
assert.equal(selections, beforeRerenderClick + 1);
await app.restart();
assert.equal(app.getView(), layout);
assert.equal(layout.getChildView('items'), list);
assert.equal(row.isDestroyed(), true);
assert.equal(layout.getChildView('detail').el.textContent, 'Select an item.');
const currentRow = list.children.first();
currentRow.el.querySelector('button').click();
assert.equal(layout.getChildView('detail').model, currentRow.model);
app.stop();
assert.equal(layout.isDestroyed(), true);
assert.equal(list.isDestroyed(), true);
assert.equal(currentRow.isDestroyed(), true);
assert.equal(app.items.isDestroyed(), false);
await app.start();
assert.notEqual(app.getView(), layout);
app.destroy();
assert.equal(app.items.isDestroyed(), true);
assert.equal(mount.childElementCount, 0);
let completeLoad;
let pendingSignal;
const cancelled = new Feature({ region: { el: mount }, loadItems({ signal }) {
  pendingSignal = signal;
  return new Promise(resolve => { completeLoad = resolve; });
} });
const pending = cancelled.start();
cancelled.stop();
assert.equal(await pending, false);
assert.equal(pendingSignal.aborted, true);
completeLoad([{ id: 'late', title: 'Obsolete' }]);
await new Promise(resolve => setImmediate(resolve));
assert.equal(cancelled.getView(), undefined);
assert.equal(mount.childElementCount, 0);
cancelled.destroy();
const failed = new Feature({ region: { el: mount }, loadItems: async () => { throw new Error('Unavailable'); } });
await assert.rejects(failed.start(), /Unavailable/);
assert.equal(failed.isRunning(), false);
assert.equal(failed.getView(), undefined);
failed.destroy();
mount.remove();
// Verify this renderer's event boundary, rather than borrowing another renderer's API.
for (const template of [() => html\`<button @click=\${() => {}}>Invalid</button>\`,
  () => html\`<button .onclick=\${() => {}}>Invalid</button>\`]) {
  const invalid = new View({ template });
  assert.throws(() => invalid.render(), /MN_HTML_EVENT_BINDING/);
  invalid.destroy();
}
`,
};
