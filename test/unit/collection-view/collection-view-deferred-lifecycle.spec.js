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
  it('attaches adopted markup when add:child mounts its parent', () => {
    const trace = [];
    const Row = View.extend({ template: false, ...lifecycle('row', trace) });
    const list = new CollectionView({ template: () => '<button>Action</button>' }).render();
    const row = new Row({ el: list.el.firstElementChild });
    const region = mount();
    list.once('add:child', () => { region.show(list); });
    list.addChildView(row, { preventRender: true });
    expect(trace).toEqual([
      ['row:before:attach', false, false], ['row:attach', true, true], ['row:refresh', true, true]
    ]);
    list.filter();
    expect(trace).toHaveLength(3);
    region.detachView();
    expect(trace.slice(3)).toEqual([
      ['row:before:detach', true, true], ['row:detach', false, false]
    ]);
  });

  it('preserves presentation and later batches established by add:child callbacks', () => {
    for (const action of ['flush', 'exclude', 'next-batch']) {
      const attach = vi.fn();
      const Pending = View.extend({ template: () => 'Pending', onAttach: attach });
      const list = new CollectionView({ template: () => '<button>Action</button>' }).render();
      const row = new View({ el: list.el.firstElementChild, template: false });
      const pending = new Pending();
      const region = mount();
      list.once('add:child', () => {
        region.show(list);
        if (action === 'exclude') { list.setFilter(view => view !== row); } else { list.filter(); }
        if (action === 'next-batch') { list.addChildView(pending, { preventRender: true }); }
      });
      list.addChildView(row, { preventRender: true });
      expect(row.isAttached()).toBe(action !== 'exclude');
      expect(row.el.isConnected).toBe(action !== 'exclude');
      region.detachView();
      region.show(list);
      expect(row.isAttached()).toBe(action !== 'exclude');
      expect(attach).not.toHaveBeenCalled();
      if (action === 'next-batch') {
        expect(list.children.hasView(pending)).toBe(true);
        list.filter();
        expect(attach).toHaveBeenCalledTimes(1);
      } else { pending.destroy(); }
      region.destroy();
    }
  });

  it('keeps deferred rows inactive when adoption notifications mount the list', () => {
    for (const mountBeforeAdoption of [false, true]) {
      const attach = vi.fn();
      const Row = View.extend({ template: () => 'Row', onAttach: attach });
      const row = new Row();
      const list = new CollectionView().render();
      const region = mount();
      if (mountBeforeAdoption) {
        list.once('before:add:child', () => { region.show(list); region.detachView(); });
      }
      list.once('add:child', () => { region.show(list); });
      list.addChildView(row, { preventRender: true });
      expect(list.children.hasView(row)).toBe(true);
      expect(row.el.isConnected).toBe(false);
      expect(row.isAttached()).toBe(false);
      expect(attach).not.toHaveBeenCalled();
      list.filter();
      expect(row.el.isConnected).toBe(true);
      expect(attach).toHaveBeenCalledTimes(1);
      region.destroy();
    }
  });

  it('preserves a new deferred batch started by emptyView attachment', () => {
    const attach = vi.fn();
    const Row = View.extend({ template: () => 'Row' });
    const Pending = Row.extend({ onAttach: attach });
    const pending = new Pending();
    let added = false;
    let list;
    const Empty = View.extend({
      template: () => 'Empty',
      onAttach() {
        if (added) { return; }
        added = true;
        list.addChildView(pending, { preventRender: true });
      }
    });
    list = new CollectionView({ collection: [{ id: 1 }], childView: Row, emptyView: Empty });
    const region = mount();
    region.show(list);
    list.setFilter(() => false);
    expect(list.children.hasView(pending)).toBe(true);
    expect(pending.el.isConnected).toBe(false);
    expect(attach).not.toHaveBeenCalled();
    region.detachView();
    region.show(list);
    expect(pending.isAttached()).toBe(false);
    expect(attach).not.toHaveBeenCalled();
    list.setFilter(() => true);
    expect(pending.el.isConnected).toBe(true);
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('keeps deferred rows pending when custom isEmpty chooses the empty presentation', () => {
    let showEmpty = true;
    const attach = vi.fn();
    const Empty = View.extend({ template: () => 'Empty' });
    const Row = View.extend({ template: () => 'Row', onAttach: attach });
    const List = CollectionView.extend({ emptyView: Empty, isEmpty() { return showEmpty; } });
    const list = new List().render();
    const pending = new Row();
    list.addChildView(pending, { preventRender: true });
    list.filter();
    const region = mount();
    region.show(list);
    expect(list.children.hasView(pending)).toBe(true);
    expect(pending.el.isConnected).toBe(false);
    expect(pending.isAttached()).toBe(false);
    expect(attach).not.toHaveBeenCalled();
    showEmpty = false;
    list.filter();
    expect(pending.el.isConnected).toBe(true);
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('keeps ordinary additions inactive while custom isEmpty chooses empty content', () => {
    let showEmpty = true;
    const trace = [];
    const Empty = View.extend({ template: () => 'Empty' });
    const Row = View.extend({ template: () => 'Row', ...lifecycle('row', trace) });
    const List = CollectionView.extend({ emptyView: Empty, isEmpty() { return showEmpty; } });
    const list = new List().render();
    const row = new Row();
    list.addChildView(row);
    const region = mount();
    region.show(list);
    expect(list.getEmptyRegion().currentView.isAttached()).toBe(true);
    expect(list.children.hasView(row)).toBe(true);
    expect(row.el.isConnected).toBe(false);
    expect(row.isAttached()).toBe(false);
    region.detachView();
    region.show(list);
    expect(trace).toEqual([]);
    showEmpty = false;
    list.filter();
    expect(trace).toEqual([
      ['row:before:attach', false, false], ['row:attach', true, true], ['row:refresh', true, true]
    ]);
    region.detachView();
    expect(trace.slice(3)).toEqual([
      ['row:before:detach', true, true], ['row:detach', false, false]
    ]);
    region.show(list);
    region.destroy();
    expect(row.isDestroyed()).toBe(true);
  });

  it('keeps earlier pending rows deferred when later additions adopt existing markup', () => {
    for (const mode of ['light', 'open', 'closed']) {
      const el = document.createElement('div');
      const markup = mode === 'light' ? el : el.attachShadow({ mode });
      markup.innerHTML = '<button>Existing action</button>';
      const list = new CollectionView({ el, template: false }).render();
      const pendingAttach = vi.fn();
      const Pending = View.extend({ template: () => 'Pending', onAttach: pendingAttach });
      const pending = new Pending();
      const adopted = new View({ el: markup.querySelector('button'), template: false });
      list.addChildView(pending, { preventRender: true });
      list.addChildView(adopted, { preventRender: true });
      expect(list.children.toArray()).toEqual([pending, adopted]);
      const region = mount();
      region.show(list);
      expect(adopted.isAttached()).toBe(true);
      expect(pending.isAttached()).toBe(false);
      expect(pendingAttach).not.toHaveBeenCalled();
      region.detachView();
      region.show(list);
      expect(pendingAttach).not.toHaveBeenCalled();
      list.sort();
      expect(pending.isAttached()).toBe(true);
      expect(pendingAttach).toHaveBeenCalledTimes(1);
      region.destroy();
    }
  });

  it('presents previously excluded deferred rows and preserves their rendered contents', () => {
    let include = false;
    const renders = vi.fn();
    const Row = View.extend({ template: () => '<input value="initial">', onRender: renders });
    const list = new CollectionView({ viewFilter: () => include }).render();
    const row = new Row();
    list.addChildView(row, { preventRender: true });
    const region = mount();
    region.show(list);
    list.filter();
    expect(list.children.length).toBe(0);
    expect(row.isAttached()).toBe(false);
    expect(row.isDestroyed()).toBe(false);
    include = true;
    list.filter();
    expect(row.isAttached()).toBe(true);
    const input = row.el.firstChild;
    input.value = 'retained';
    include = false;
    list.filter();
    include = true;
    list.filter();
    expect(row.el.firstChild).toBe(input);
    expect(input.value).toBe('retained');
    expect(renders).toHaveBeenCalledTimes(1);
  });

  it('keeps remaining deferred rows pending when another row transfers or destroys itself', () => {
    const list = new CollectionView().render();
    const visible = new View({ template: () => 'Visible' });
    list.addChildView(visible);
    const transferred = new View({ template: () => 'Transferred' });
    const removed = new View({ template: () => 'Removed' });
    const pending = new View({ template: () => 'Pending' });
    for (const row of [transferred, removed, pending]) {
      list.addChildView(row, { preventRender: true });
    }
    list.detachChildView(transferred);
    removed.destroy();
    const other = new CollectionView().render();
    other.addChildView(transferred);
    mount().show(other);
    const region = mount();
    region.show(list);
    expect(transferred.isAttached()).toBe(true);
    expect(list.children.toArray()).toEqual([visible, pending]);
    expect(visible.isAttached()).toBe(true);
    expect(pending.isAttached()).toBe(false);
    list.removeChildView(pending);
    region.detachView();
    region.show(list);
    const next = new View({ template: () => 'Next batch' });
    list.addChildView(next, { preventRender: true });
    region.detachView();
    region.show(list);
    expect(next.isAttached()).toBe(false);
    list.filter();
    expect(next.isAttached()).toBe(true);
    expect(transferred.isDestroyed()).toBe(false);
  });

  it('starts a fresh deferred batch after full render destroys the previous manual rows', () => {
    const Row = View.extend({ template: () => 'Collection row' });
    const list = new CollectionView({ collection: [{ id: 1 }], childView: Row }).render();
    const pending = new View({ template: () => 'Pending' });
    list.addChildView(pending, { preventRender: true });
    const region = mount();
    region.show(list);
    expect(pending.isAttached()).toBe(false);
    list.render();
    expect(pending.isDestroyed()).toBe(true);
    expect(list.children.length).toBe(1);
    expect(list.children.first().isAttached()).toBe(true);
    const next = new View({ template: () => 'Next batch' });
    list.addChildView(next, { preventRender: true });
    region.detachView();
    region.show(list);
    expect(next.isAttached()).toBe(false);
    list.sort();
    expect(next.isAttached()).toBe(true);
  });

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
      expect(row.isAttached()).toBe(true);
      expect(onAttach).toHaveBeenCalledTimes(constructBeforeMount ? 1 : 0);
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

  it('attaches late-adopted markup before returning and preserves its remount lifecycle', () => {
    const onAttach = vi.fn();
    const Row = View.extend({ template: false, onAttach });
    const list = new CollectionView({ template: () => '<button>Existing action</button>' }).render();
    const row = new Row({ el: list.el.firstElementChild });
    const region = mount();
    region.show(list);
    list.addChildView(row, { preventRender: true });
    expect(row.isAttached()).toBe(true);
    expect(onAttach).toHaveBeenCalledTimes(1);
    region.detachView();
    region.show(list);
    expect(row.el.isConnected).toBe(true);
    expect(row.isAttached()).toBe(true);
    expect(onAttach).toHaveBeenCalledTimes(2);
  });

  it('catches up late-adopted nested markup without repeating existing attachment', () => {
    for (const mode of ['light', 'open', 'closed']) {
      for (const nestedAlreadyAttached of [false, true]) {
        const trace = [];
        const el = document.createElement('div');
        const markup = mode === 'light' ? el : el.attachShadow({ mode });
        markup.innerHTML = '<section><main></main></section>';
        const list = new CollectionView({ el, template: false }).render();
        const Row = View.extend({ template: false, regions: { content: 'main' }, ...lifecycle('row', trace) });
        const Nested = View.extend({ template: () => 'Nested', ...lifecycle('nested', trace) });
        const row = new Row({ el: markup.firstElementChild });
        const nested = new Nested();
        const region = mount();
        if (!nestedAlreadyAttached) { row.showChildView('content', nested); }
        region.show(list);
        if (nestedAlreadyAttached) { row.showChildView('content', nested); }
        trace.length = 0;
        list.addChildView(row, { preventRender: true });
        expect(trace).toEqual(nestedAlreadyAttached ? [
          ['row:before:attach', false, true], ['row:attach', true, true], ['row:refresh', true, true]
        ] : [
          ['row:before:attach', false, true], ['nested:before:attach', false, true],
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
    }
  });

  it('honors add:child presentation changes before catching up late adoption', () => {
    for (const action of ['flush', 'remove', 'filter', 'next-batch']) {
      const attach = vi.fn();
      const pendingAttach = vi.fn();
      const Row = View.extend({ template: false, onAttach: attach });
      const Pending = View.extend({ template: () => 'Pending', onAttach: pendingAttach });
      const list = new CollectionView({ template: () => '<button>Action</button>' }).render();
      const row = new Row({ el: list.el.firstElementChild });
      const pending = new Pending();
      const region = mount();
      region.show(list);
      list.once('add:child', () => {
        if (action === 'flush') { list.filter(); }
        if (action === 'remove') { list.removeChildView(row); }
        if (action === 'filter') { list.setFilter(view => view !== row); }
        if (action === 'next-batch') { list.addChildView(pending, { preventRender: true }); }
      });
      list.addChildView(row, { preventRender: true });
      expect(attach).toHaveBeenCalledTimes(action === 'flush' || action === 'next-batch' ? 1 : 0);
      expect(row.isDestroyed()).toBe(action === 'remove');
      region.detachView();
      region.show(list);
      expect(pendingAttach).not.toHaveBeenCalled();
      if (action === 'next-batch') {
        list.filter();
        expect(pendingAttach).toHaveBeenCalledTimes(1);
      } else { pending.destroy(); }
      region.destroy();
    }
  });

  it('does not catch up late adoption when parent monitoring is disabled', () => {
    const trace = [];
    const List = CollectionView.extend({ monitorViewEvents: false, template: () => '<button>Action</button>' });
    const Row = View.extend({ template: false, ...lifecycle('row', trace) });
    const list = new List().render();
    const row = new Row({ el: list.el.firstElementChild });
    const region = mount();
    region.show(list);
    list.addChildView(row, { preventRender: true });
    list.filter();
    region.detachView();
    region.show(list);
    region.destroy();
    expect(trace).toEqual([]);
    expect(row.isDestroyed()).toBe(true);
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
