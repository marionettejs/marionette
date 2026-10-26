// Outcome checks for the canonical data reference fences. The shared reference
// runner executes the actual Markdown code before these assertions.
export const assertions = {
  'api-providers-data-1': `
assert.deepEqual(summary.titles, ['Draft', 'Draft', 'Ready']);
assert.equal(source.isDestroyed(), true);
const { default: Backbone } = await import('backbone');
const { default: BackboneApi } = await import('@mnjs/adapters/backbone');
for (const [api, source] of [[DataApi, new Model()], [BackboneApi, new Backbone.Model()]]) {
  const editor = { titles: [] };
  const inspector = { titles: [] };
  function refresh(model) { this.titles.push(model.get('title')); }
  const stopEditor = api.subscribe(source, 'change', refresh, editor);
  const stopInspector = api.subscribe(source, 'change', refresh, inspector);
  source.set('title', 'Draft');
  stopEditor();
  stopEditor();
  source.set('title', 'Ready');
  stopInspector();
  stopInspector();
  source.set('title', 'Closed');
  assert.deepEqual(editor.titles, ['Draft']);
  assert.deepEqual(inspector.titles, ['Draft', 'Ready']);
}
`,
  'api-providers-data-2': `
const { Model } = await import('@mnjs/data');
const shared = new Model({ count: 0 });
const replacement = new Model({ count: 10 });
const panel = new Panel({ model: shared, state: shared });
let renders = 0;
panel.on('render', () => renders++);
shared.set('count', 1);
assert.equal(renders, 2);
panel.model = replacement;
panel.delegateEntityEvents();
shared.set('count', 2);
assert.equal(renders, 3);
assert.equal(panel.el.textContent, '10');
replacement.set('count', 11);
assert.equal(renders, 4);
panel.undelegateEntityEvents();
shared.set('count', 3);
replacement.set('count', 12);
assert.equal(renders, 5);
assert.equal(panel.el.textContent, '11');
panel.destroy();
assert.equal(shared.isDestroyed(), false);
assert.equal(replacement.isDestroyed(), false);
shared.set('count', 4);
assert.equal(renders, 5);
shared.destroy();
replacement.destroy();
`,
  'packages-data-1': `
assert.deepEqual(changes, ['dark', 'system']);
assert.deepEqual(preferences.toObject(), { compact: false, theme: 'system' });
const snapshot = preferences.toObject();
preferences.unset('theme');
assert.equal(preferences.has('theme'), false);
assert.equal(snapshot.theme, 'system');
preferences.clear();
assert.deepEqual(preferences.toObject(), {});
preferences.reset();
assert.deepEqual(preferences.toObject(), { compact: false });
preferences.destroy();
assert.equal(preferences.set('compact', true), preferences);
assert.equal(preferences.clear(), preferences);
assert.equal(preferences.reset({ compact: true }), preferences);
assert.equal(preferences.isDestroyed(), true);
assert.equal(preferences.get('compact'), false);
const { DataApi, StateApi } = await import('@mnjs/data');
for (const provider of [DataApi, StateApi]) {
  const source = new Model({ compact: false });
  const context = { calls: [] };
  let independent = 0;
  source.on('change', () => independent++);
  const cleanup = provider.subscribe(source, {
    'change:compact'(model, value) { this.calls.push([model, value]); },
    change(model) { this.calls.push([model]); },
  }, context);
  source.set('compact', true);
  assert.deepEqual(context.calls, [[source, true], [source]]);
  cleanup();
  cleanup();
  source.set('compact', false);
  assert.equal(context.calls.length, 2);
  assert.equal(independent, 2);
  source.destroy();
}
`,
  'packages-data-2': `
assert.equal(items.get('a'), first);
assert.equal(items.get(first.cid), first);
assert.deepEqual(labels, ['Beta', 'Updated Alpha', 'Gamma']);
assert.deepEqual(plainItems.map(item => item.id), ['b', 'a', 'c']);
assert.equal(items.at(-1).id, 'c');
const notifications = [];
items.on('update', (collection, options) => notifications.push(options.changes));
assert.equal(items.add({ id: 'a', label: 'Duplicate' }), undefined);
assert.equal(notifications.length, 0);
items.remove('c');
assert.deepEqual(notifications[0].removed.map(model => model.id), ['c']);
assert.deepEqual(notifications[0].updated, []);
assert.throws(() => items.reset([first, first]), TypeError);
assert.equal(items.length, 2);
items.sort('label');
assert.equal(items.at(1), first);
const other = new Collection([first]);
const destruction = [];
const destroyOptions = { source: 'local' };
for (const [name, collection] of [['items', items], ['other', other]]) {
  collection.on({
    remove(model, owner, options) {
      assert.equal(model, first);
      assert.equal(owner, collection);
      assert.equal(options, destroyOptions);
      destruction.push([name, 'remove']);
    },
    update(owner, change) {
      assert.equal(owner, collection);
      assert.deepEqual(change.changes.removed, [first]);
      destruction.push([name, 'update']);
    },
    destroy(model, options) {
      assert.equal(model, first);
      assert.equal(options, destroyOptions);
      assert.equal(collection.get(first), undefined);
      destruction.push([name, 'destroy']);
    },
  });
}
first.destroy(destroyOptions);
assert.deepEqual(destruction, [
  ['items', 'remove'], ['items', 'update'], ['items', 'destroy'],
  ['other', 'remove'], ['other', 'update'], ['other', 'destroy'],
]);
items.off('destroy');
other.off('destroy');
assert.equal(items.get('a'), undefined);
assert.equal(other.length, 0);
const survivor = items.at(0);
items.destroy();
assert.equal(items.isDestroyed(), true);
assert.equal(survivor.isDestroyed(), false);
assert.equal(items.at(0), survivor);
assert.equal(items.reset([]), items);
assert.deepEqual(items.add([{ id: 'd' }]), []);
assert.equal(items.at(0), survivor);
other.destroy();
survivor.destroy();
`,
  'packages-data-3': `
assert.equal(theme, 'light');
assert.deepEqual(copies, { theme: 'light', compact: true });
assert.equal(selections.length, 2);
assert.equal(selections.at(0), preferences);
assert.equal(selections.at(1).get('theme'), 'dark');
assert.equal(change.kind, 'reorder');
assert.equal(metadata.source, 'settings');
selections.destroy();
assert.equal(preferences.isDestroyed(), false);
preferences.destroy();
`,
};
