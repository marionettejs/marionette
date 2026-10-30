import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectionView, Region, View } from 'marionette';

const regions = [];
afterEach(() => {
  for (const region of regions.splice(0)) { region.destroy(); }
  document.body.replaceChildren();
});

function mount() {
  const el = document.body.appendChild(document.createElement('main'));
  const region = new Region({ el });
  regions.push(region);
  return region;
}

function lifecycle(name, trace) {
  function record(event, view) {
    trace.push([`${name}:${event}`, view.isAttached(), view.el.isConnected]);
  }
  return {
    onBeforeAttach() { record('before:attach', this); },
    onAttach() { record('attach', this); },
    onDomRefresh() { record('refresh', this); },
    onBeforeDetach() { record('before:detach', this); },
    onDetach() { record('detach', this); }
  };
}

describe('CollectionView deferred child lifecycle', () => {
  it('preserves attachment on flushing markup adopted after the list was mounted', () => {
    for (const constructBeforeMount of [true, false]) {
      const onAttach = vi.fn();
      const Row = View.extend({ template: false, onAttach });
      const list = new CollectionView({ template: () => '<button>Existing action</button>' }).render();
      const el = list.el.firstElementChild;
      let row = constructBeforeMount ? new Row({ el }) : undefined;
      const region = mount();
      region.show(list);
      row ??= new Row({ el });
      list.addChildView(row, { preventRender: true });
      expect(row.isAttached()).toBe(!constructBeforeMount);
      expect(onAttach).not.toHaveBeenCalled();
      list.filter();
      expect(row.el.isConnected).toBe(true);
      expect(row.isAttached()).toBe(true);
      expect(onAttach).toHaveBeenCalledTimes(constructBeforeMount ? 1 : 0);
      region.detachView();
      expect(row.isAttached()).toBe(false);
      region.show(list);
      expect(onAttach).toHaveBeenCalledTimes(constructBeforeMount ? 2 : 1);
      region.destroy();
      expect(row.isDestroyed()).toBe(true);
    }
  });

  it('attaches a deferred child that adopts markup already inside the list', () => {
    for (const markup of ['<button>Existing action</button>', '<section><button>Existing action</button></section>']) {
      const onAttach = vi.fn();
      const Row = View.extend({ template: false, onAttach });
      const list = new CollectionView({ template: () => markup }).render();
      const row = new Row({ el: list.el.querySelector('button') });
      list.addChildView(row, { preventRender: true });
      const region = mount();
      region.show(list);
      expect(row.el.isConnected).toBe(true);
      expect(row.isAttached()).toBe(true);
      expect(onAttach).toHaveBeenCalledTimes(1);
      region.detachView();
      expect(row.isAttached()).toBe(false);
      region.show(list);
      expect(onAttach).toHaveBeenCalledTimes(2);
      region.destroy();
      expect(row.isDestroyed()).toBe(true);
    }
  });

  it('attaches late-adopted markup on remount without an intervening filter', () => {
    const onAttach = vi.fn();
    const Row = View.extend({ template: false, onAttach });
    const list = new CollectionView({ template: () => '<button>Existing action</button>' }).render();
    const row = new Row({ el: list.el.firstElementChild });
    const region = mount();
    region.show(list);
    list.addChildView(row, { preventRender: true });
    expect(row.isAttached()).toBe(false);
    expect(onAttach).not.toHaveBeenCalled();
    region.detachView();
    region.show(list);
    expect(row.el.isConnected).toBe(true);
    expect(row.isAttached()).toBe(true);
    expect(onAttach).toHaveBeenCalledTimes(1);
  });

  it('keeps markup from another detached tree pending until it enters the list', () => {
    const onAttach = vi.fn();
    const Row = View.extend({ template: false, onAttach });
    const outside = document.createElement('aside');
    outside.innerHTML = '<button>Pending action</button>';
    const row = new Row({ el: outside.firstElementChild });
    const list = new CollectionView().render();
    list.addChildView(row, { preventRender: true });
    const region = mount();
    region.show(list);
    expect(row.el.parentNode).toBe(outside);
    expect(row.isAttached()).toBe(false);
    expect(onAttach).not.toHaveBeenCalled();
    list.filter();
    expect(outside.contains(row.el)).toBe(false);
    expect(row.el.isConnected).toBe(true);
    expect(row.isAttached()).toBe(true);
    expect(onAttach).toHaveBeenCalledTimes(1);
  });

  it('attaches adopted child markup inside open and closed shadow trees', () => {
    for (const mode of ['open', 'closed']) {
      const el = document.createElement('div');
      const shadow = el.attachShadow({ mode });
      shadow.innerHTML = '<button>Shadow action</button>';
      const onAttach = vi.fn();
      const Row = View.extend({ template: false, onAttach });
      const row = new Row({ el: shadow.querySelector('button') });
      const list = new CollectionView({ el, template: false }).render();
      list.addChildView(row, { preventRender: true });
      const region = mount();
      region.show(list);
      expect(row.el.isConnected).toBe(true);
      expect(row.isAttached()).toBe(true);
      expect(onAttach).toHaveBeenCalledTimes(1);
      region.detachView();
      expect(row.isAttached()).toBe(false);
      region.show(list);
      expect(onAttach).toHaveBeenCalledTimes(2);
      region.destroy();
      expect(row.isDestroyed()).toBe(true);
    }
  });

  it('waits until presentation to attach deferred rows and their nested content', () => {
    for (const preRendered of [false, true]) {
      const trace = [];
      const Nested = View.extend({ template: () => 'Nested', ...lifecycle('nested', trace) });
      const Row = View.extend({
        template: () => '<section></section>', regions: { content: 'section' },
        ...lifecycle('row', trace),
        onRender() { this.showChildView('content', new Nested()); }
      });
      const list = new CollectionView().render();
      const visible = new View({ template: () => 'Visible' });
      list.addChildView(visible);
      const row = new Row();
      if (preRendered) { row.render(); }
      list.addChildView(row, { preventRender: true });
      const region = mount();
      region.show(list);
      expect(visible.isAttached()).toBe(true);
      expect(row.isAttached()).toBe(false);
      expect(row.el.isConnected).toBe(false);
      expect(list.children.toArray()).toEqual([visible, row]);
      region.detachView();
      region.show(list);
      expect(trace).toEqual([]);

      list.filter();
      const nested = row.getChildView('content');
      expect(trace).toEqual([
        ['row:before:attach', false, false], ['nested:before:attach', false, false],
        ['row:attach', true, true], ['nested:attach', true, true],
        ['nested:refresh', true, true], ['row:refresh', true, true]
      ]);
      trace.length = 0;
      region.detachView();
      expect(trace).toEqual([
        ['row:before:detach', true, true], ['nested:before:detach', true, true],
        ['row:detach', false, false], ['nested:detach', false, false]
      ]);
      region.show(list);
      expect(row.isAttached()).toBe(true);
      expect(nested.isAttached()).toBe(true);
      region.destroy();
      expect(row.isDestroyed()).toBe(true);
      expect(nested.isDestroyed()).toBe(true);
    }
  });

  it('keeps pending rows owned when filtering excludes them or their parent is destroyed', () => {
    const onAttach = vi.fn();
    const onDetach = vi.fn();
    const Row = View.extend({ template: () => 'Pending', onAttach, onDetach });
    const list = new CollectionView({ viewFilter: () => false }).render();
    const removed = new Row().render();
    const retained = new Row();
    list.addChildView(removed, { preventRender: true });
    list.addChildView(retained, { preventRender: true });
    const region = mount();
    region.show(list);
    list.filter();
    expect(list.children.length).toBe(0);
    expect(retained.isAttached()).toBe(false);
    expect(retained.el.isConnected).toBe(false);
    list.removeChildView(removed);
    expect(removed.isDestroyed()).toBe(true);
    region.destroy();
    expect(retained.isDestroyed()).toBe(true);
    expect(onAttach).not.toHaveBeenCalled();
    expect(onDetach).not.toHaveBeenCalled();
  });

  it('destroys an unpresented row without sending attachment or detachment events', () => {
    const onAttach = vi.fn();
    const onDetach = vi.fn();
    const Row = View.extend({ template: () => 'Pending', onAttach, onDetach });
    const row = new Row().render();
    const list = new CollectionView().render();
    list.addChildView(row, { preventRender: true });
    const region = mount();
    region.show(list);
    region.detachView();
    region.show(list);
    region.destroy();
    expect(row.isDestroyed()).toBe(true);
    expect(onAttach).not.toHaveBeenCalled();
    expect(onDetach).not.toHaveBeenCalled();
  });

  it('releases a pending row for presentation by another owner', () => {
    const onAttach = vi.fn();
    const Row = View.extend({ template: () => 'Transferred', onAttach });
    const row = new Row().render();
    const first = new CollectionView().render();
    first.addChildView(row, { preventRender: true });
    mount().show(first);
    expect(first.detachChildView(row)).toBe(row);
    expect(row.isDestroyed()).toBe(false);
    expect(onAttach).not.toHaveBeenCalled();
    const second = new CollectionView().render();
    second.addChildView(row);
    first.destroy();
    expect(row.isDestroyed()).toBe(false);
    const region = mount();
    region.show(second);
    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(row.isAttached()).toBe(true);
    expect(row.el.isConnected).toBe(true);
    region.destroy();
    expect(row.isDestroyed()).toBe(true);
  });

  it('respects monitoring opt-out when deferred descendants are presented', () => {
    const trace = [];
    const Nested = View.extend({ template: () => 'Nested', ...lifecycle('nested', trace) });
    const Row = View.extend({
      template: () => '<section></section>', regions: { content: 'section' },
      ...lifecycle('row', trace),
      onRender() { this.showChildView('content', new Nested()); }
    });
    const List = CollectionView.extend({ monitorViewEvents: false });
    const list = new List().render();
    const row = new Row().render();
    const nested = row.getChildView('content');
    list.addChildView(row, { preventRender: true });
    const region = mount();
    region.show(list);
    list.filter();
    expect(nested.el.isConnected).toBe(true);
    region.detachView();
    region.show(list);
    region.destroy();
    expect(trace).toEqual([]);
    expect(row.isDestroyed()).toBe(true);
    expect(nested.isDestroyed()).toBe(true);
  });

  it('retains lifecycle for deferred rows placed in a custom synchronous wrapper', () => {
    const onAttach = vi.fn();
    const Row = View.extend({ template: () => 'Wrapped', onAttach });
    const List = CollectionView.extend({
      template: () => '<section></section>',
      attachHtml(els, container) { container.querySelector('section').append(els); }
    });
    const list = new List().render();
    const row = new Row().render();
    list.addChildView(row, { preventRender: true });
    const region = mount();
    region.show(list);
    expect(onAttach).not.toHaveBeenCalled();
    list.filter();
    expect(list.el.querySelector('section').firstChild).toBe(row.el);
    expect(row.isAttached()).toBe(true);
    expect(onAttach).toHaveBeenCalledTimes(1);
    region.detachView();
    region.show(list);
    expect(row.isAttached()).toBe(true);
    expect(onAttach).toHaveBeenCalledTimes(2);
  });
});
