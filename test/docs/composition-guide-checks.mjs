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
  'guides-composition-2': `
await new Promise(resolve => setImmediate(resolve));
assert.match(page.el.textContent, /Order A100/);
assert.match(page.el.textContent, /S1: In transit/);
orderRegion.destroy();
assert.equal(page.isDestroyed(), true);
const orders = [];
const deliveries = [];
const pending = (queue, id, signal) => new Promise((resolve, reject) => queue.push({ id, signal, resolve, reject }));
const host = document.createElement('main');
document.body.append(host);
const region = new Region({ el: host });
const detail = new OrderPage({
  loadOrder: (id, { signal }) => pending(orders, id, signal),
  loadShipments: (id, { signal }) => pending(deliveries, id, signal)
});
region.show(detail);
const first = detail.load('A');
const second = detail.load('B');
assert.equal(orders[0].signal.aborted, true);
orders[1].resolve({ id: 'B', total: '$20' });
assert.equal(await second, true);
assert.match(host.textContent, /Order B/);
assert.match(host.textContent, /Loading shipments/);
assert.equal(deliveries[0].id, 'B');
orders[0].resolve({ id: 'A', total: '$10' });
assert.equal(await first, false);
assert.match(host.textContent, /Order B/);
const bShipments = detail.getChildView('shipments');
deliveries[0].reject(new Error('Unavailable'));
await new Promise(resolve => setImmediate(resolve));
assert.match(host.textContent, /Shipments unavailable/);
assert.match(host.textContent, /Order B/);
bShipments.el.querySelector('.retry').click();
assert.equal(deliveries.length, 2);
const laterRetry = bShipments.load();
assert.equal(deliveries[1].signal.aborted, true);
deliveries[2].resolve([{ id: '<S2>', status: 'Delivered' }]);
assert.equal(await laterRetry, true);
deliveries[1].reject(new Error('Stale retry'));
await new Promise(resolve => setImmediate(resolve));
assert.match(host.textContent, /<S2>: Delivered/);
assert.equal(host.querySelector('s2'), null);
assert.doesNotMatch(host.textContent, /unavailable/);
const obsoleteShipment = bShipments.load();
const next = detail.load('C');
assert.equal(bShipments.isDestroyed(), true);
assert.equal(deliveries[3].signal.aborted, true);
orders[2].resolve({ id: 'C', total: '$30' });
assert.equal(await next, true);
deliveries[3].resolve([{ id: 'old', status: 'Obsolete' }]);
assert.equal(await obsoleteShipment, false);
assert.match(host.textContent, /Order C/);
assert.doesNotMatch(host.textContent, /Obsolete/);
deliveries[4].resolve([]);
await new Promise(resolve => setImmediate(resolve));
assert.match(host.textContent, /No shipments yet/);
const oldFailure = detail.load('D');
const missing = detail.load('missing');
orders[4].resolve(null);
assert.equal(await missing, false);
orders[3].reject(new Error('Old destination'));
assert.equal(await oldFailure, false);
assert.match(host.textContent, /Order not found/);
assert.doesNotMatch(host.textContent, /unavailable/);
const failing = detail.load('E');
orders[5].reject(new Error('Offline'));
assert.equal(await failing, false);
assert.match(host.textContent, /Order unavailable/);
assert.doesNotMatch(host.textContent, /not found/);
const recovered = detail.load('E');
orders[6].resolve({ id: 'E', total: '$40' });
assert.equal(await recovered, true);
const lastChild = detail.getChildView('shipments');
const ending = detail.load('F');
assert.equal(lastChild.isDestroyed(), true);
deliveries[5].reject(new Error('Destroyed child'));
region.destroy();
assert.equal(orders[7].signal.aborted, true);
orders[7].resolve({ id: 'F', total: '$50' });
assert.equal(await ending, false);
assert.equal(host.childElementCount, 0);
assert.equal(await detail.load('ignored'), false);
assert.equal(await lastChild.load(), false);
await new Promise(resolve => setImmediate(resolve));
host.remove();
`,
};
