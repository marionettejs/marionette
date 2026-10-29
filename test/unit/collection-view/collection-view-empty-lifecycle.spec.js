import { afterEach, describe, expect, it } from 'vitest';
import { CollectionView, Region, View } from 'marionette';

const regions = [];
afterEach(() => {
  for (const region of regions.splice(0)) { region.destroy(); }
  document.body.replaceChildren();
});

function mount() {
  const el = document.createElement('main');
  document.body.append(el);
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

function attachedTrace() {
  return [
    ['list:before:attach', false, false],
    ['empty:before:attach', false, false],
    ['nested:before:attach', false, false],
    ['list:attach', true, true],
    ['empty:attach', true, true],
    ['nested:attach', true, true],
    ['nested:refresh', true, true],
    ['empty:refresh', true, true],
    ['list:refresh', true, true]
  ];
}

function detachedTrace() {
  return [
    ['list:before:detach', true, true],
    ['empty:before:detach', true, true],
    ['nested:before:detach', true, true],
    ['list:detach', false, false],
    ['empty:detach', false, false],
    ['nested:detach', false, false]
  ];
}

describe('CollectionView empty View attachment', () => {
  it('propagates ordered attachment and detachment through retained nested empty content', () => {
    const trace = [];
    const Nested = View.extend({ ...lifecycle('nested', trace), template: () => '<button>Retry</button>' });
    const Empty = View.extend({
      ...lifecycle('empty', trace),
      template: () => '<section></section>',
      regions: { action: 'section' },
      onRender() { this.showChildView('action', new Nested()); }
    });
    const List = CollectionView.extend({ ...lifecycle('list', trace), emptyView: Empty });
    const list = new List();
    const region = mount();
    region.show(list);
    const empty = list.getEmptyRegion().currentView;
    const nested = empty.getChildView('action');
    expect(trace).toEqual(attachedTrace());
    expect(list.children.length).toBe(0);
    trace.length = 0;
    expect(region.detachView()).toBe(list);
    expect(trace).toEqual(detachedTrace());
    trace.length = 0;
    region.show(list);
    expect(list.getEmptyRegion().currentView).toBe(empty);
    expect(empty.getChildView('action')).toBe(nested);
    expect(trace).toEqual(attachedTrace());
    trace.length = 0;
    region.destroy();
    expect(trace).toEqual(detachedTrace());
    expect(empty.isDestroyed()).toBe(true);
    expect(nested.isDestroyed()).toBe(true);
  });

  it('releases attachment-scoped work when an empty View created on-document is detached', () => {
    const source = new EventTarget();
    let deliveries = 0;
    let attachments = 0;
    const receive = () => { deliveries++; };
    const Empty = View.extend({
      template: () => 'Empty',
      onAttach() { attachments++; source.addEventListener('tick', receive); },
      onDetach() { source.removeEventListener('tick', receive); }
    });
    const list = new CollectionView({ emptyView: Empty });
    const row = new View({ template: () => 'Row' });
    list.addChildView(row);
    const region = mount();
    region.show(list);
    list.removeChildView(row);
    const empty = list.getEmptyRegion().currentView;
    expect(attachments).toBe(1);
    source.dispatchEvent(new Event('tick'));
    expect(deliveries).toBe(1);
    region.detachView();
    expect(empty.isAttached()).toBe(false);
    source.dispatchEvent(new Event('tick'));
    expect(deliveries).toBe(1);
    region.show(list);
    expect(attachments).toBe(2);
    source.dispatchEvent(new Event('tick'));
    expect(deliveries).toBe(2);
    region.destroy();
    source.dispatchEvent(new Event('tick'));
    expect(deliveries).toBe(2);
  });

  for (const monitoring of [true, false]) {
    for (const presentation of ['row', 'empty']) {
      it(`${monitoring ? 'propagates' : 'suppresses'} ${presentation} lifecycle with class monitoring ${monitoring}`, () => {
        const events = [];
        const Content = View.extend({
          template: () => 'Content',
          onAttach() { events.push('attach'); },
          onDetach() { events.push('detach'); }
        });
        const List = CollectionView.extend({ monitorViewEvents: monitoring });
        const list = new List({
          collection: presentation === 'row' ? [{}] : [], childView: Content, emptyView: Content
        });
        const region = mount();
        region.show(list);
        const child = presentation === 'row' ? list.children.first() : list.getEmptyRegion().currentView;
        expect(child.el.isConnected).toBe(true);
        expect(child.isAttached()).toBe(monitoring);
        region.detachView();
        expect(child.isAttached()).toBe(false);
        region.show(list);
        expect(child.isAttached()).toBe(monitoring);
        expect(events).toEqual(monitoring ? ['attach', 'detach', 'attach'] : []);
      });
    }
  }

  it('retains empty lifecycle when a manual child is adopted with presentation deferred', () => {
    const events = [];
    const Empty = View.extend({
      template: () => 'Empty', onAttach() { events.push('empty:attach'); }, onDetach() { events.push('empty:detach'); }
    });
    const list = new CollectionView({ emptyView: Empty }).render();
    const empty = list.getEmptyRegion().currentView;
    const manual = new View({ template: () => 'Manual' });
    list.addChildView(manual, { preventRender: true });
    const region = mount();
    region.show(list);
    expect(empty.isAttached()).toBe(true);
    expect(empty.el.isConnected).toBe(true);
    expect(manual.el.isConnected).toBe(false);
    expect(list.children.toArray()).toEqual([manual]);
    region.detachView();
    expect(empty.isAttached()).toBe(false);
    expect(events).toEqual(['empty:attach', 'empty:detach']);
    region.show(list);
    list.filter();
    expect(empty.isDestroyed()).toBe(true);
    expect(manual.el.isConnected).toBe(true);
    expect(list.children.toArray()).toEqual([manual]);
  });
});
