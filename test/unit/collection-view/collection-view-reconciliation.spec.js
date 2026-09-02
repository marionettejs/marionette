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
