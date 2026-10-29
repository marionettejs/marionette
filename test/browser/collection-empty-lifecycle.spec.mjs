import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('Application empty content initializes focus and retains nested lifecycle on remount', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Application, CollectionView, View } = await import('marionette');
    const events = [];
    const Action = View.extend({
      template: () => '<button>Retry search</button>',
      onAttach() { events.push('action:attach'); this.el.querySelector('button').focus(); },
      onDetach() { events.push('action:detach'); },
      onDomRefresh() { events.push('action:refresh'); }
    });
    const Empty = View.extend({
      template: () => '<section></section>',
      regions: { action: 'section' },
      onRender() { this.showChildView('action', new Action()); },
      onAttach() { events.push('empty:attach'); },
      onDetach() { events.push('empty:detach'); }
    });
    const App = Application.extend({
      region: '#content',
      prepareStart() { return []; },
      onStart(app, options, rows) {
        this.showView(new CollectionView({ collection: rows, childView: Action, emptyView: Empty }));
      }
    });
    const app = new App();
    try {
      await app.start();
      const list = app.getView();
      const empty = list.getEmptyRegion().currentView;
      const action = empty.getChildView('action');
      const button = action.el.querySelector('button');
      const initial = {
        focused: document.activeElement === button,
        attached: [list, empty, action].map(view => view.isAttached()),
        events: [...events]
      };
      const region = app.getRegion();
      region.detachView();
      const detached = {
        connected: action.el.isConnected,
        attached: [list, empty, action].map(view => view.isAttached()),
        events: [...events]
      };
      region.show(list);
      const remounted = {
        sameEmpty: list.getEmptyRegion().currentView === empty,
        sameAction: empty.getChildView('action') === action,
        focused: document.activeElement === button,
        events: [...events]
      };
      return { initial, detached, remounted };
    } finally {
      app.destroy();
    }
  });
  assert.deepEqual(result.initial, {
    focused: true, attached: [true, true, true],
    events: ['empty:attach', 'action:attach', 'action:refresh']
  });
  assert.deepEqual(result.detached, {
    connected: false, attached: [false, false, false],
    events: ['empty:attach', 'action:attach', 'action:refresh', 'empty:detach', 'action:detach']
  });
  assert.deepEqual(result.remounted, {
    sameEmpty: true, sameAction: true, focused: true,
    events: ['empty:attach', 'action:attach', 'action:refresh', 'empty:detach', 'action:detach',
      'empty:attach', 'action:attach', 'action:refresh']
  });
});

test('empty content created on-document stops attachment-scoped work while detached', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { CollectionView, Region, View } = await import('marionette');
    const source = new EventTarget();
    let deliveries = 0;
    let attaches = 0;
    let detaches = 0;
    const receive = () => { deliveries++; };
    const Empty = View.extend({
      template: () => 'No results',
      onAttach() { attaches++; source.addEventListener('tick', receive); },
      onDetach() { detaches++; source.removeEventListener('tick', receive); }
    });
    const list = new CollectionView({ emptyView: Empty });
    const row = new View({ template: () => 'Result' });
    list.addChildView(row);
    const region = new Region({ el: '#content' });
    try {
      region.show(list);
      list.removeChildView(row);
      const empty = list.getEmptyRegion().currentView;
      source.dispatchEvent(new Event('tick'));
      const mounted = { deliveries, attaches, detaches, attached: empty.isAttached() };
      region.detachView();
      source.dispatchEvent(new Event('tick'));
      const detached = { deliveries, attaches, detaches, attached: empty.isAttached(), connected: empty.el.isConnected };
      region.show(list);
      source.dispatchEvent(new Event('tick'));
      const remounted = { deliveries, attaches, detaches, sameEmpty: list.getEmptyRegion().currentView === empty };
      region.destroy();
      source.dispatchEvent(new Event('tick'));
      return { mounted, detached, remounted, destroyed: { deliveries, detaches, destroyed: empty.isDestroyed() } };
    } finally {
      region.destroy();
    }
  });
  assert.deepEqual(result.mounted, { deliveries: 1, attaches: 1, detaches: 0, attached: true });
  assert.deepEqual(result.detached, { deliveries: 1, attaches: 1, detaches: 1, attached: false, connected: false });
  assert.deepEqual(result.remounted, { deliveries: 2, attaches: 2, detaches: 1, sameEmpty: true });
  assert.deepEqual(result.destroyed, { deliveries: 2, detaches: 2, destroyed: true });
});
