export const preparations = {
  'guides-lists-1': `
const core = await import('marionette');
const originalViewRender = core.View.prototype.render;
const renderedAfterDestroy = [];
core.View.prototype.render = function(...args) {
  if (this.isDestroyed()) renderedAfterDestroy.push(this);
  return originalViewRender.apply(this, args);
};
`,
};

export const assertions = {
  'guides-lists-1': `
const list = catalog.list;
const apricot = list.children.findByModel(items.get('a'));
const blueberry = list.children.findByModel(items.get('b'));
const input = blueberry.el.querySelector('input');
input.value = 'Working notes';
catalog.el.querySelector('.reverse').click();
assert.equal(list.children.first(), blueberry);
assert.equal(blueberry.el.querySelector('input'), input);
assert.equal(input.value, 'Working notes');
const toggle = catalog.getUI('available')[0];
toggle.checked = true;
toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal(blueberry.isDestroyed(), false);
assert.equal(input.isConnected, false);
assert.equal(list.children.length, 1);
toggle.checked = false;
toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal(list.children.findByModel(items.get('b')), blueberry);
assert.equal(blueberry.el.querySelector('input'), input);
assert.equal(input.value, 'Working notes');
items.add({ id: 'c', label: 'Cherry', available: true });
assert.equal(list.children.findByModel(items.get('a')), apricot);
const cherry = list.children.findByModel(items.get('c'));
const removed = items.remove('c');
assert.equal(cherry.isDestroyed(), true);
assert.equal(removed.isDestroyed(), false);
list.setFilter(() => false);
assert.equal(items.length, 2);
assert.equal(list.getEmptyRegion().currentView.el.textContent, 'No matching items.');
list.removeFilter();
items.get('a').set('available', false);
list.setFilter({ available: true });
assert.equal(list.isEmpty(), true);
items.get('a').set('available', true);
assert.equal(list.isEmpty(), true);
list.filter();
assert.equal(list.children.first(), apricot);
const models = [...items];
items.reset(models);
assert.equal(apricot.isDestroyed(), true);
assert.equal(blueberry.isDestroyed(), true);
assert.notEqual(list.children.findByModel(items.get('a')), apricot);
const current = list.children.first();
region.destroy();
items.get('a').set('label', 'After destruction');
assert.equal(renderedAfterDestroy.length, 0);
assert.equal(catalog.isDestroyed(), true);
assert.equal(list.isDestroyed(), true);
assert.equal(current.isDestroyed(), true);
assert.equal(items.isDestroyed(), false);
items.add({ id: 'd', label: 'Dates', available: true });
assert.equal(list.children.length, 0);
items.destroy();
for (const model of [...models, removed]) model.destroy();
mount.remove();
`,
};
