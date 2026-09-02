import CollectionView from '../../../modules/collection-view';
import View from '../../../modules/view';
import MarionetteError from '../../../utils/error';

function createAdapter() {
  return {
    key(item) { return item.id; },
    get(item, property) { return item[property]; },
    has(item, property) { return Object.hasOwn(item, property); },
    serialize(item) { return item; },
    items(source) { return source.items; },
    subscribe(source, eventName, callback, context) {
      source.listeners ||= new Map();
      const listeners = source.listeners.get(eventName) || [];
      const listener = { callback, context };
      listeners.push(listener);
      source.listeners.set(eventName, listeners);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) { listeners.splice(index, 1); }
      };
    },
    observeCollection(source, notify, context) {
      source.notify = change => notify.call(context, change);
      return () => { delete source.notify; };
    }
  };
}

function emit(item, eventName, ...args) {
  for (const listener of item.listeners?.get(eventName) || []) {
    listener.callback.apply(listener.context, args);
  }
}

function expectInvalidChange(ListView, initialItems, currentItems, change) {
  const source = { items: initialItems };
  const view = new ListView({ collection: source });
  view.render();
  source.items = currentItems;

  expect(() => source.notify(change))
    .to.throw(MarionetteError).and.include({ code: 'MN0039' });

  view.destroy();
}

describe('CollectionView normalized reconciliation', function() {
  let Adapter;
  let ChildView;
  let ListView;

  beforeEach(function() {
    Adapter = createAdapter();
    ChildView = View.extend({
      template: model => model.name,
      onRender() { this.renderCount = (this.renderCount || 0) + 1; },
      onDestroy() { this.destroyCount = (this.destroyCount || 0) + 1; }
    });
    ChildView.setDataApi(Adapter);
    ListView = CollectionView.extend({ childView: ChildView });
    ListView.setDataApi(Adapter);
  });

  it('adds and removes only affected child Views', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const source = { items: [first, second] };
    const view = new ListView({ collection: source });
    view.render();
    const firstView = view.children.findByModel(first);
    const secondView = view.children.findByModel(second);
    const third = { id: 3, name: 'three' };

    source.items = [first, second, third];
    source.notify({ kind: 'update', added: [third], removed: [], updated: [] });
    const thirdView = view.children.findByModel(third);

    expect(view.children.findByModel(first)).to.equal(firstView);
    expect(view.children.findByModel(second)).to.equal(secondView);
    expect(firstView.renderCount).to.equal(1);
    expect(secondView.renderCount).to.equal(1);
    expect(thirdView.renderCount).to.equal(1);

    source.items = [first, third];
    source.notify({ kind: 'update', added: [], removed: [second], updated: [] });

    expect(firstView.isDestroyed()).to.be.false;
    expect(secondView.isDestroyed()).to.be.true;
    expect(thirdView.isDestroyed()).to.be.false;
    view.destroy();
  });

  it('moves survivor elements on reorder without recreating or rendering their Views', function() {
    const items = [
      { id: 1, name: 'one' },
      { id: 2, name: 'two' },
      { id: 3, name: 'three' }
    ];
    const source = { items };
    const view = new ListView({ collection: source });
    view.render();
    const views = items.map(item => view.children.findByModel(item));
    const elements = views.map(child => child.el);

    source.items = [items[2], items[0], items[1]];
    source.notify({ kind: 'reorder' });

    expect(view.children.toArray()).to.deep.equal([views[2], views[0], views[1]]);
    expect([...view.el.children]).to.deep.equal([elements[2], elements[0], elements[1]]);
    expect(views.map(child => child.renderCount)).to.deep.equal([1, 1, 1]);

    view.destroy();
  });

  it('follows source order without an index comparator', function() {
    const items = [
      { id: 1, name: 'one' },
      { id: 2, name: 'two' },
      { id: 3, name: 'three' }
    ];
    const source = { items };
    const view = new ListView({ collection: source, viewComparator: false });
    view.render();
    const views = items.map(item => view.children.findByModel(item));
    const elements = views.map(child => child.el);
    const indexComparator = this.sinon.spy(view, '_viewComparator');

    source.items = [items[2], items[0], items[1]];
    source.notify({ kind: 'reorder' });

    expect(indexComparator).to.not.have.been.called;
    expect(view.children.toArray()).to.deep.equal([views[2], views[0], views[1]]);
    expect([...view.el.children]).to.deep.equal([elements[2], elements[0], elements[1]]);
    expect(views.map(child => child.renderCount)).to.deep.equal([1, 1, 1]);

    const inserted = { id: 4, name: 'four' };
    source.items = [items[2], inserted, items[0], items[1]];
    source.notify({ kind: 'update', added: [inserted], removed: [], updated: [] });

    const insertedView = view.children.findByModel(inserted);
    expect(indexComparator).to.not.have.been.called;
    expect(view.children.toArray()).to.deep.equal([
      views[2], insertedView, views[0], views[1]
    ]);
    expect([...view.el.children]).to.deep.equal([
      elements[2], insertedView.el, elements[0], elements[1]
    ]);
    expect(insertedView.renderCount).to.equal(1);
    view.destroy();
  });

  it('preserves a child View, replaces its model, rebinds modelEvents, and renders it', function() {
    const previous = { id: 1, name: 'before' };
    const current = { id: 1, name: 'after' };
    const source = { items: [previous] };
    const handler = this.sinon.spy();
    const TestChild = ChildView.extend({
      modelEvents: { changed: 'onChanged' },
      onChanged: handler
    });
    TestChild.setDataApi(Adapter);
    const TestList = ListView.extend({ childView: TestChild });
    const view = new TestList({ collection: source });
    view.render();
    const child = view.children.findByModel(previous);

    source.items = [current];
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous, current }]
    });

    expect(view.children.findByModel(current)).to.equal(child);
    expect(child.model).to.equal(current);
    expect(child.renderCount).to.equal(2);
    expect(child.el.textContent).to.equal('after');

    emit(previous, 'changed', previous);
    emit(current, 'changed', current);
    expect(handler).to.have.been.calledOnce.and.calledWith(current);
    view.destroy();
  });

  it('renders in-place updates through the same path', function() {
    const item = { id: 1, name: 'before' };
    const source = { items: [item] };
    const view = new ListView({ collection: source });
    view.render();
    const child = view.children.findByModel(item);

    item.name = 'after';
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous: item, current: item }]
    });

    expect(child.renderCount).to.equal(2);
    expect(child.el.textContent).to.equal('after');
    view.destroy();
  });

  it('treats reset as destructive whole-list replacement', function() {
    const first = { id: 1, name: 'one' };
    const source = { items: [first] };
    const view = new ListView({ collection: source });
    view.render();
    const firstView = view.children.findByModel(first);
    const replacement = { id: 1, name: 'replacement' };

    source.items = [replacement];
    source.notify({ kind: 'reset' });

    expect(firstView.isDestroyed()).to.be.true;
    expect(view.children.findByModel(replacement)).to.not.equal(firstView);
    view.destroy();
  });

  it('diagnoses duplicate, missing, and unstable keys', function() {
    const duplicate = { id: 1, name: 'duplicate' };
    expect(() => new ListView({ collection: { items: [duplicate, duplicate] } }).render())
      .to.throw(MarionetteError).and.include({ code: 'MN0039' });

    const missing = { name: 'missing' };
    expect(() => new ListView({ collection: { items: [missing] } }).render())
      .to.throw(MarionetteError).and.include({ code: 'MN0039' });

    const item = { id: 1, name: 'unstable' };
    const source = { items: [item] };
    const view = new ListView({ collection: source });
    view.render();
    item.id = 2;
    expect(() => source.notify({ kind: 'reorder' }))
      .to.throw(MarionetteError).and.include({ code: 'MN0039' });
    view.destroy();
  });

  it('diagnoses malformed collection snapshots and structural records', function() {
    const InvalidItemsList = ListView.extend({});
    InvalidItemsList.setDataApi({ items() { return {}; } });
    const invalidItemsView = new InvalidItemsList({ collection: {} });
    expect(() => invalidItemsView.render())
      .to.throw(MarionetteError).and.include({ code: 'MN0039' });
    invalidItemsView.destroy();

    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const third = { id: 3, name: 'three' };

    expectInvalidChange(ListView, [first], [first], null);
    expectInvalidChange(ListView, [first], [first], { kind: 'unknown' });
    expectInvalidChange(ListView, [first], [first, second], { kind: 'reorder' });

    expectInvalidChange(ListView, [first], [first], { kind: 'update' });
    expectInvalidChange(ListView, [first], [first], {
      kind: 'update', added: [], updated: []
    });
    expectInvalidChange(ListView, [first], [first], {
      kind: 'update', added: [], removed: []
    });

    expectInvalidChange(ListView, [first], [first, second], {
      kind: 'update', added: [], removed: [], updated: []
    });
    expectInvalidChange(ListView, [first], [first, second], {
      kind: 'update', added: [third], removed: [], updated: []
    });
    expectInvalidChange(ListView, [first, second], [second], {
      kind: 'update', added: [], removed: [], updated: []
    });
  });

  it('diagnoses malformed and incomplete updated entries', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const replacement = { id: 1, name: 'replacement' };
    const validUpdate = { kind: 'update', added: [], removed: [] };

    for (const updated of [[null], [{}], [{ previous: first }]]) {
      expectInvalidChange(ListView, [first], [first], { ...validUpdate, updated });
    }

    expectInvalidChange(ListView, [first], [first], {
      ...validUpdate,
      updated: [{ previous: {}, current: first }]
    });
    expectInvalidChange(ListView, [first], [first], {
      ...validUpdate,
      updated: [{ previous: first, current: {} }]
    });
    expectInvalidChange(ListView, [first], [first, second], {
      kind: 'update',
      added: [second],
      removed: [],
      updated: [{ previous: first, current: second }]
    });
    expectInvalidChange(ListView, [first], [first], {
      ...validUpdate,
      updated: [
        { previous: first, current: first },
        { previous: first, current: first }
      ]
    });
    expectInvalidChange(ListView, [first], [replacement], {
      ...validUpdate,
      updated: []
    });
  });

  it('diagnoses an update whose child View is missing', function() {
    const item = { id: 1, name: 'one' };
    const source = { items: [item] };
    const view = new ListView({ collection: source });
    view.render();
    const child = view.children.first();
    view.removeChildView(child);

    expect(() => source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous: item, current: item }]
    })).to.throw(MarionetteError).and.include({ code: 'MN0039' });

    view.destroy();
  });

  it('rebinds a same-key replacement even when its child is filtered out', function() {
    const previous = { id: 1, name: 'before' };
    const current = { id: 1, name: 'after' };
    const source = { items: [previous] };
    const FilteredList = ListView.extend({ viewFilter: () => false });
    const view = new FilteredList({ collection: source });
    let child;
    view.on('add:child', (collectionView, addedChild) => { child = addedChild; });
    view.render();

    source.items = [current];
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous, current }]
    });

    expect(child.model).to.equal(current);
    expect(view.children.hasView(child)).to.be.false;
    expect(child.renderCount).to.be.undefined;
    view.destroy();
  });

  it('does not render an added child that is filtered out', function() {
    const first = { id: 1, name: 'one' };
    const hidden = { id: 2, name: 'hidden' };
    const source = { items: [first] };
    const FilteredList = ListView.extend({
      viewFilter(child) { return child.model.id === 1; }
    });
    const view = new FilteredList({ collection: source });
    let child;
    view.on('add:child', (collectionView, addedChild) => {
      if (addedChild.model === hidden) { child = addedChild; }
    });
    view.render();

    source.items = [first, hidden];
    source.notify({ kind: 'update', added: [hidden], removed: [], updated: [] });

    expect(view.children.hasView(child)).to.be.false;
    expect(child.renderCount).to.be.undefined;
    expect(view.el.textContent).to.equal('one');
    view.destroy();
  });

  it('renders reconciled children when an overridden sort does not render them', function() {
    const item = { id: 1, name: 'before' };
    const source = { items: [item] };
    const view = new ListView({ collection: source });
    view.render();
    const child = view.children.first();
    view.sort = () => view;

    item.name = 'after';
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous: item, current: item }]
    });

    expect(child.renderCount).to.equal(2);
    expect(child.el.textContent).to.equal('after');
    view.destroy();
  });

  it('restores focused controls and their text selection after DOM moves', function() {
    for (const control of ['input', 'button']) {
      const items = [
        { id: 1, name: 'one' },
        { id: 2, name: 'two' }
      ];
      const FocusChild = ChildView.extend({
        template: model => `<${ control }>${ model.name }</${ control }>`
      });
      FocusChild.setDataApi(Adapter);
      const FocusList = ListView.extend({ childView: FocusChild });
      const source = { items };
      const view = new FocusList({ collection: source });
      view.render();
      document.body.appendChild(view.el);
      const activeElement = view.children.first().el.querySelector(control);
      activeElement.focus();
      if (control === 'input') { activeElement.setSelectionRange(0, 0, 'forward'); }
      view.Dom = {
        ...view.Dom,
        moveEl(el, parent, before) {
          parent.insertBefore(el, before);
          activeElement.blur();
        }
      };

      source.items = [items[1], items[0]];
      source.notify({ kind: 'reorder' });

      expect(document.activeElement).to.equal(activeElement);
      if (control === 'input') {
        expect(activeElement.selectionStart).to.equal(0);
        expect(activeElement.selectionEnd).to.equal(0);
        expect(activeElement.selectionDirection).to.equal('forward');
      }
      view.destroy();
    }
  });

  it('ignores stale observer callbacks after destruction', function() {
    const source = { items: [{ id: 1, name: 'one' }] };
    let staleNotify;
    const StaleList = ListView.extend({});
    StaleList.setDataApi({
      observeCollection(collection, notify, context) {
        staleNotify = change => notify.call(context, change);
        return () => {};
      }
    });
    const view = new StaleList({ collection: source });
    view.render();
    const child = view.children.first();
    view.destroy();

    source.items = [];
    staleNotify({ kind: 'reset' });
    expect(child.destroyCount).to.equal(1);
  });

  it('diagnoses an invalid structural observer disposer', function() {
    const InvalidList = ListView.extend({});
    InvalidList.setDataApi({ observeCollection() {} });
    const view = new InvalidList({ collection: { items: [] } });

    expect(() => view.render()).to.throw(MarionetteError).and.include({ code: 'MN0038' });
    view.destroy();
  });
});
