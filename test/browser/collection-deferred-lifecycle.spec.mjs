import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

async function checkDeferredRow(page, renderBeforeAdoption, mountOnAddition = false) {
  const result = await page.evaluate(async({ preRendered, mountOnAddition: mountFromNotification }) => {
    const { CollectionView, Region, View } = await import('marionette');
    const source = new EventTarget();
    const attaches = [];
    let deliveries = 0;
    let detaches = 0;
    const receive = () => { deliveries++; };
    const Row = View.extend({
      tagName: 'button', template: () => 'Run action',
      onAttach() {
        attaches.push({ connected: this.el.isConnected, visible: this.el.getBoundingClientRect().width > 0 });
        this.el.focus();
        source.addEventListener('tick', receive);
      },
      onDetach() { detaches++; source.removeEventListener('tick', receive); }
    });
    const Empty = View.extend({ template: () => 'No actions yet' });
    const list = new CollectionView({ emptyView: Empty }).render();
    const empty = list.getEmptyRegion().currentView;
    const row = new Row();
    if (preRendered) { row.render(); }
    const region = new Region({ el: '#content' });
    try {
      if (mountFromNotification) { list.once('add:child', () => { region.show(list); }); }
      list.addChildView(row, { preventRender: true });
      if (!mountFromNotification) { region.show(list); }
      source.dispatchEvent(new Event('tick'));
      const mounted = {
        attached: row.isAttached(), connected: row.el.isConnected,
        focused: document.activeElement === row.el, attaches: [...attaches], deliveries,
        emptyAttached: empty.isAttached()
      };
      list.filter();
      source.dispatchEvent(new Event('tick'));
      const presented = {
        attached: row.isAttached(), connected: row.el.isConnected,
        focused: document.activeElement === row.el, attaches: [...attaches], deliveries,
        emptyDestroyed: empty.isDestroyed()
      };
      region.detachView();
      source.dispatchEvent(new Event('tick'));
      const detached = { attached: row.isAttached(), connected: row.el.isConnected, deliveries, detaches };
      region.show(list);
      source.dispatchEvent(new Event('tick'));
      const remounted = { focused: document.activeElement === row.el, attaches: [...attaches], deliveries };
      region.destroy();
      source.dispatchEvent(new Event('tick'));
      return { mounted, presented, detached, remounted, destroyed: { destroyed: row.isDestroyed(), deliveries, detaches } };
    } finally {
      if (!region.isDestroyed()) { region.destroy(); }
    }
  }, { preRendered: renderBeforeAdoption, mountOnAddition });
  assert.deepEqual(result.mounted, {
    attached: false, connected: false, focused: false, attaches: [], deliveries: 0, emptyAttached: true
  });
  assert.deepEqual(result.presented, {
    attached: true, connected: true, focused: true, attaches: [{ connected: true, visible: true }],
    deliveries: 1, emptyDestroyed: true
  });
  assert.deepEqual(result.detached, { attached: false, connected: false, deliveries: 1, detaches: 1 });
  assert.deepEqual(result.remounted, {
    focused: true, attaches: [{ connected: true, visible: true }, { connected: true, visible: true }], deliveries: 2
  });
  assert.deepEqual(result.destroyed, { destroyed: true, deliveries: 2, detaches: 2 });
}

test('deferred fresh rows initialize focus and listeners only after insertion', async({ page }) => {
  await checkDeferredRow(page, false);
});

test('deferred rows stay inactive when adoption notifications mount the list', async({ page }) => {
  await checkDeferredRow(page, false, true);
});

test('deferred pre-rendered rows initialize focus and listeners only after insertion', async({ page }) => {
  await checkDeferredRow(page, true);
});

test('deferred adoption of existing list markup preserves attachment and focus', async({ page }) => {
  const results = await page.evaluate(async() => {
    const { CollectionView, Region, View } = await import('marionette');
    const observations = [];
    for (const mode of ['light', 'open', 'closed']) {
      const attaches = [];
      const Row = View.extend({
        template: false,
        onAttach() { attaches.push(this.el.isConnected); this.el.focus(); }
      });
      const el = document.createElement('div');
      const markup = mode === 'light' ? el : el.attachShadow({ mode });
      markup.innerHTML = '<section><button>Existing action</button></section>';
      const list = new CollectionView({ el, template: false }).render();
      const pending = new View({ template: () => 'Pending action' });
      const button = markup.querySelector('button');
      const row = new Row({ el: button });
      list.addChildView(pending, { preventRender: true });
      list.addChildView(row, { preventRender: true });
      const region = new Region({ el: '#content' });
      try {
        region.show(list);
        const mounted = {
          attached: row.isAttached(), focused: button.getRootNode().activeElement === button,
          attaches: [...attaches], pendingAttached: pending.isAttached()
        };
        region.detachView();
        const detached = { attached: row.isAttached(), connected: button.isConnected };
        region.show(list);
        const remounted = { focused: button.getRootNode().activeElement === button, attaches: [...attaches] };
        region.destroy();
        observations.push({ mode, mounted, detached, remounted, destroyed: row.isDestroyed() && pending.isDestroyed() });
      } finally {
        if (!region.isDestroyed()) { region.destroy(); }
      }
    }
    return observations;
  });
  for (const result of results) {
    assert.deepEqual(result.mounted, { attached: true, focused: true, attaches: [true], pendingAttached: false }, result.mode);
    assert.deepEqual(result.detached, { attached: false, connected: false }, result.mode);
    assert.deepEqual(result.remounted, { focused: true, attaches: [true, true] }, result.mode);
    assert.equal(result.destroyed, true, result.mode);
  }
});

test('adopted markup initializes focus when add:child mounts the list', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { CollectionView, Region, View } = await import('marionette');
    const trace = [];
    const Row = View.extend({
      template: false,
      onBeforeAttach() { trace.push(['before:attach', this.isAttached(), this.el.isConnected]); },
      onAttach() { trace.push(['attach', this.isAttached(), this.el.isConnected]); this.el.focus(); },
      onBeforeDetach() { trace.push(['before:detach', this.isAttached(), this.el.isConnected]); },
      onDetach() { trace.push(['detach', this.isAttached(), this.el.isConnected]); }
    });
    const list = new CollectionView({ template: () => '<button>Action</button>' }).render();
    const row = new Row({ el: list.el.firstElementChild });
    const region = new Region({ el: '#content' });
    try {
      list.once('add:child', () => { region.show(list); });
      list.addChildView(row, { preventRender: true });
      const focused = document.activeElement === row.el;
      list.filter();
      region.detachView();
      return { focused, trace };
    } finally { region.destroy(); list.destroy(); }
  });
  assert.equal(result.focused, true);
  assert.deepEqual(result.trace, [
    ['before:attach', false, false], ['attach', true, true],
    ['before:detach', true, true], ['detach', false, false]
  ]);
});

test('flushing late markup adoption completes attachment and focus', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { CollectionView, Region, View } = await import('marionette');
    const attaches = [];
    const Row = View.extend({
      template: false,
      onAttach() { attaches.push(this.el.isConnected); this.el.focus(); }
    });
    const list = new CollectionView({ template: () => '<button>Existing action</button>' }).render();
    const row = new Row({ el: list.el.firstElementChild });
    const region = new Region({ el: '#content' });
    try {
      region.show(list);
      list.addChildView(row, { preventRender: true });
      const deferred = { attached: row.isAttached(), attaches: [...attaches] };
      list.filter();
      const flushed = {
        attached: row.isAttached(), focused: document.activeElement === row.el, attaches: [...attaches]
      };
      region.detachView();
      const detached = { attached: row.isAttached(), connected: row.el.isConnected };
      region.show(list);
      return { deferred, flushed, detached, remounted: [...attaches] };
    } finally { region.destroy(); }
  });
  assert.deepEqual(result.deferred, { attached: false, attaches: [] });
  assert.deepEqual(result.flushed, { attached: true, focused: true, attaches: [true] });
  assert.deepEqual(result.detached, { attached: false, connected: false });
  assert.deepEqual(result.remounted, [true, true]);
});


test('empty presentation keeps deferred rows inactive until a later flush', async({ page }) => {
  const results = await page.evaluate(async() => {
    const { CollectionView, Region, View } = await import('marionette');
    const observations = [];
    for (const fromEmptyHook of [true, false]) {
      let list;
      let showEmpty = true;
      let added = false;
      const attaches = [];
      const Row = View.extend({ tagName: 'button', template: () => 'Action' });
      const Pending = Row.extend({
        onAttach() { attaches.push(this.el.isConnected); this.el.focus(); }
      });
      const pending = new Pending();
      const Empty = View.extend({
        template: () => 'Empty',
        onAttach() {
          if (!fromEmptyHook || added) { return; }
          added = true;
          list.addChildView(pending, { preventRender: true });
        }
      });
      const List = fromEmptyHook ? CollectionView : CollectionView.extend({ isEmpty() { return showEmpty; } });
      list = new List({ childView: Row, emptyView: Empty, collection: fromEmptyHook ? [{ id: 1 }] : [] }).render();
      const region = new Region({ el: '#content' });
      try {
        region.show(list);
        if (fromEmptyHook) {
          list.setFilter(() => false);
        } else {
          list.addChildView(pending, { preventRender: true });
          list.filter();
        }
        region.detachView();
        region.show(list);
        const waiting = { attached: pending.isAttached(), connected: pending.el.isConnected, attaches: [...attaches] };
        showEmpty = false;
        if (fromEmptyHook) {
          list.setFilter(() => true);
        } else {
          list.filter();
        }
        const flushed = { attached: pending.isAttached(), connected: pending.el.isConnected,
          focused: document.activeElement === pending.el, attaches: [...attaches] };
        region.destroy();
        observations.push({ waiting, flushed, destroyed: pending.isDestroyed() });
      } finally {
        if (!region.isDestroyed()) { region.destroy(); }
      }
    }
    return observations;
  });
  for (const result of results) {
    assert.deepEqual(result.waiting, { attached: false, connected: false, attaches: [] });
    assert.deepEqual(result.flushed, { attached: true, connected: true, focused: true, attaches: [true] });
    assert.equal(result.destroyed, true);
  }
});
