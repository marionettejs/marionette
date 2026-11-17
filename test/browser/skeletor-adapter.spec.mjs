import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('packed Skeletor adapter renders computed values and reconciles collections once', async({ page }) => {
  const result = await page.evaluate(async() => {
    const [{ createMarionette }, { default: SkeletorApi }, { Collection, Model }] = await Promise.all([
      import('marionette'), import('@mnjs/adapters/skeletor'), import('@converse/skeletor')
    ]);
    class Item extends Model {
      get computed() {
        return { label: { deps: ['title'], fn: model => `${model.get('title')}!` },
          empty: { deps: [], fn: () => undefined } };
      }
    }
    const runtime = createMarionette();
    runtime.setDataApi(SkeletorApi);
    runtime.setStateApi(SkeletorApi);
    let renders = 0;
    const Child = runtime.View.extend({
      template: data => ({ ...data }).label,
      modelEvents: { change: 'render' },
      onRender() { renders++; }
    });
    const first = new Item({ id: 1, title: 'A', rank: 1 });
    const second = new Item({ id: 2, title: 'B', rank: 2 });
    const collection = new Collection([first, second], { model: Item });
    const notifications = [];
    const stop = SkeletorApi.observeCollection(collection, change => notifications.push(change.kind));
    const region = new runtime.Region({ el: '#content' });
    const view = new runtime.CollectionView({ collection, childView: Child });
    region.show(view);
    const child = view.children.findByModel(first);
    const secondNode = view.children.findByModel(second).el.firstChild;
    renders = 0;
    collection.set([{ id: 1, title: 'Next' }, { id: 2, title: 'B' }]);
    const merged = { text: view.el.textContent, renders,
      sameChild: view.children.findByModel(first) === child,
      sameNode: view.children.findByModel(second).el.firstChild === secondNode };
    notifications.length = 0;
    collection.set([second, first]);
    const reordered = { text: view.el.textContent, notifications: [...notifications],
      sameChild: view.children.findByModel(first) === child };
    collection.comparator = 'rank';
    notifications.length = 0;
    collection.set([{ id: 1, rank: 3 }, { id: 3, title: 'C', rank: 0 }]);
    const updated = { text: view.el.textContent, notifications: [...notifications],
      sameChild: view.children.findByModel(first) === child };
    collection.reset([first]);
    const reset = { text: view.el.textContent, previousDestroyed: child.isDestroyed(),
      newChild: view.children.findByModel(first) !== child };
    first.attrs.title = 'Edited';
    const edited = view.el.textContent;
    const data = SkeletorApi.serialize(first);
    const snapshot = { keys: Object.keys(data), hasEmpty: Object.hasOwn(data, 'empty'),
      missing: SkeletorApi.has(first, 'missing'), persisted: first.toJSON() };
    stop(); stop();
    region.destroy(); region.destroy();
    return { merged, reordered, updated, reset, edited, snapshot };
  });
  assert.deepEqual(result.merged, { text: 'Next!B!', renders: 1, sameChild: true, sameNode: true });
  assert.deepEqual(result.reordered, { text: 'B!Next!', notifications: ['update'], sameChild: true });
  assert.deepEqual(result.updated, { text: 'C!Next!', notifications: ['update'], sameChild: true });
  assert.deepEqual(result.reset, { text: 'Next!', previousDestroyed: true, newChild: true });
  assert.equal(result.edited, 'Edited!');
  assert.deepEqual(result.snapshot, { keys: ['id', 'title', 'rank', 'label', 'empty'],
    hasEmpty: true, missing: false, persisted: { id: 1, title: 'Edited', rank: 3 } });
});

test('packed Skeletor adapter observes attached hydration and releases only owner listeners', async({ page }) => {
  const result = await page.evaluate(async() => {
    const [{ createMarionette }, { default: SkeletorApi }, { Model, PersistentStorage }] = await Promise.all([
      import('marionette'), import('@mnjs/adapters/skeletor'), import('@converse/skeletor')
    ]);
    const storage = new PersistentStorage('mnjs-skeletor-browser-test', 'local');
    await storage.storeInitialized;
    const seed = new Model({ id: 'profile', title: 'Hydrated' });
    seed.storage = storage;
    await seed.save(null, { promise: true });
    class Profile extends Model {
      get storage() { return storage; }
      get autoSync() { return true; }
      get computed() {
        return { label: { deps: ['title'], fn: model => `${model.get('title')}!` } };
      }
      destroy() { throw new Error('View teardown must not persistently destroy state'); }
    }
    const state = new Profile({ id: 'profile', title: 'Loading' });
    let caller = 0;
    state.on('change:title', () => caller++);
    let owned = 0;
    let contextMatches = true;
    const runtime = createMarionette();
    runtime.setDataApi(SkeletorApi); runtime.setStateApi(SkeletorApi);
    const Owner = runtime.View.extend({
      template: ({ label }) => label,
      createState() { return state; },
      stateEvents: { 'change:title': function() { owned++; contextMatches &&= this === view; } },
      modelEvents: { change: 'render' }
    });
    const region = new runtime.Region({ el: '#content' });
    const view = new Owner({ model: state });
    view.getState();
    region.show(view);
    const attachedInitial = view.isAttached() && view.el.textContent;
    await state.hydrated;
    const hydrated = view.el.textContent;
    view.destroy(); view.destroy(); region.destroy();
    state.attrs.title = 'After teardown';
    await state.save(null, { promise: true });
    const saved = new Model({ id: 'profile' }); saved.storage = storage;
    await saved.fetch({ promise: true });
    await storage.store.clear();
    return { attachedInitial, hydrated, owned, caller, contextMatches,
      persisted: saved.toJSON(), destroyed: view.isDestroyed() };
  });
  assert.equal(result.attachedInitial, 'Loading!');
  assert.equal(result.hydrated, 'Hydrated!');
  assert.equal(result.owned, 1);
  assert.equal(result.caller, 2);
  assert.equal(result.contextMatches, true);
  assert.equal(result.destroyed, true);
  assert.deepEqual(result.persisted, { id: 'profile', title: 'After teardown' });
});
