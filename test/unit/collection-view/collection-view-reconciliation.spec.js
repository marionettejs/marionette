import CollectionView from '../../../src/modules/collection-view';
import Behavior from '../../../src/modules/behavior';
import View from '../../../src/modules/view';
import Region from '../../../src/modules/region';
import { MarionetteError } from '@marionette/utils';

function createAdapter() {
  return {
    key(model) { return model.id; },
    get(model, property) { return model[property]; },
    has(model, property) { return Object.hasOwn(model, property); },
    serialize(model) { return model; },
    models(source) { return source.models; },
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

function emit(model, eventName, ...args) {
  for (const listener of model.listeners?.get(eventName) || []) {
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
    const source = { models: [first, second] };
    const view = new ListView({ collection: source });
    view.render();
    const firstView = view.children.findByModel(first);
    const secondView = view.children.findByModel(second);
    const third = { id: 3, name: 'three' };

    source.models = [first, second, third];
    source.notify({ kind: 'update', added: [third], removed: [], updated: [] });
    const thirdView = view.children.findByModel(third);

    expect(view.children.findByModel(first)).to.equal(firstView);
    expect(view.children.findByModel(second)).to.equal(secondView);
    expect(firstView.renderCount).to.equal(1);
    expect(secondView.renderCount).to.equal(1);
    expect(thirdView.renderCount).to.equal(1);

    source.models = [first, third];
    source.notify({ kind: 'update', added: [], removed: [second], updated: [] });

    expect(firstView.isDestroyed()).to.be.false;
    expect(secondView.isDestroyed()).to.be.true;
    expect(thirdView.isDestroyed()).to.be.false;
    view.destroy();
  });

  it('moves survivor elements on reorder without recreating or rendering their Views', function() {
    const models = [
      { id: 1, name: 'one' },
      { id: 2, name: 'two' },
      { id: 3, name: 'three' }
    ];
    const source = { models };
    const view = new ListView({ collection: source });
    view.render();
    const views = models.map(model => view.children.findByModel(model));
    const elements = views.map(child => child.el);

    source.models = [models[2], models[0], models[1]];
    source.notify({ kind: 'reorder' });

    expect(view.children.toArray()).to.deep.equal([views[2], views[0], views[1]]);
    expect([...view.el.children]).to.deep.equal([elements[2], elements[0], elements[1]]);
    expect(views.map(child => child.renderCount)).to.deep.equal([1, 1, 1]);

    view.destroy();
  });

  it('follows source order without an index comparator', function() {
    const models = [
      { id: 1, name: 'one' },
      { id: 2, name: 'two' },
      { id: 3, name: 'three' }
    ];
    const source = { models };
    const view = new ListView({ collection: source, viewComparator: false });
    view.render();
    const views = models.map(model => view.children.findByModel(model));
    const elements = views.map(child => child.el);
    const indexComparator = this.sinon.spy(view, '_viewComparator');

    source.models = [models[2], models[0], models[1]];
    source.notify({ kind: 'reorder' });

    expect(indexComparator).to.not.have.been.called;
    expect(view.children.toArray()).to.deep.equal([views[2], views[0], views[1]]);
    expect([...view.el.children]).to.deep.equal([elements[2], elements[0], elements[1]]);
    expect(views.map(child => child.renderCount)).to.deep.equal([1, 1, 1]);

    const inserted = { id: 4, name: 'four' };
    source.models = [models[2], inserted, models[0], models[1]];
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

  it('recreates a child View for an immutable same-key replacement', function() {
    const previous = { id: 1, name: 'before' };
    const sibling = { id: 2, name: 'sibling' };
    const current = { id: 1, name: 'after' };
    const source = { models: [previous, sibling] };
    const childHandler = this.sinon.spy();
    const behaviorHandler = this.sinon.spy();
    const behaviorDestroyed = this.sinon.spy();
    const behaviors = [];
    const lifecycle = [];
    const TrackingBehavior = Behavior.extend({
      initialize() {
        this.initialModel = this.view.model;
        behaviors.push(this);
      },
      modelEvents: { changed: 'onChanged' },
      onChanged: behaviorHandler,
      onDestroy: behaviorDestroyed
    });
    const TestChild = ChildView.extend({
      behaviors: [TrackingBehavior],
      initialize() {
        this.initializedModel = this.model;
        this.optionsModel = this.options.model;
      },
      modelEvents: { changed: 'onChanged' },
      onChanged: childHandler,
      onDestroy() { lifecycle.push(`destroy:${ this.model.name }`); },
      template: model => `<input value="${ model.name }">`
    });
    TestChild.setDataApi(Adapter);
    const TestList = ListView.extend({
      childView: TestChild,
      onBeforeRemoveChild(collectionView, child) {
        lifecycle.push(`before:remove:${ child.model.name }`);
      },
      onRemoveChild(collectionView, child) {
        lifecycle.push(`remove:${ child.model.name }`);
      },
      onBeforeAddChild(collectionView, child) {
        lifecycle.push(`before:add:${ child.model.name }`);
      },
      onAddChild(collectionView, child) {
        lifecycle.push(`add:${ child.model.name }`);
      },
      viewComparator: child => child.model.name,
      viewFilter: child => child.model.name !== 'hidden'
    });
    const view = new TestList({ collection: source });
    view.render();
    document.body.appendChild(view.el);
    const previousChild = view.children.findByModel(previous);
    const previousInput = previousChild.el.querySelector('input');
    previousInput.focus();
    lifecycle.length = 0;

    source.models = [current, sibling];
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous, current }]
    });

    const currentChild = view.children.findByModel(current);
    const currentBehavior = behaviors.find(behavior => behavior.initialModel === current);
    expect(currentChild).to.not.equal(previousChild);
    expect(previousChild.isDestroyed()).to.be.true;
    expect(currentChild.model).to.equal(current);
    expect(currentChild.optionsModel).to.equal(current);
    expect(currentChild.initializedModel).to.equal(current);
    expect(currentBehavior.initialModel).to.equal(current);
    expect(behaviorDestroyed).to.have.been.calledOnce;
    expect(currentChild.renderCount).to.equal(1);
    expect(currentChild.el.querySelector('input').value).to.equal('after');
    expect(view.children.toArray().map(child => child.model)).to.deep.equal([current, sibling]);
    expect(previousInput.isConnected).to.be.false;
    expect(document.activeElement).to.not.equal(previousInput);
    expect(lifecycle).to.deep.equal([
      'before:remove:before',
      'remove:before',
      'before:add:after',
      'add:after',
      'destroy:before'
    ]);

    emit(previous, 'changed', previous);
    emit(current, 'changed', current);
    expect(childHandler).to.have.been.calledOnce.and.calledWith(current);
    expect(behaviorHandler).to.have.been.calledOnce.and.calledWith(current);
    view.destroy();
  });

  it('preserves manual child order for an immutable same-key replacement', function() {
    const previous = { id: 1, name: 'before' };
    const second = { id: 2, name: 'second' };
    const third = { id: 3, name: 'third' };
    const current = { id: 1, name: 'after' };
    const source = { models: [previous, second, third] };
    const view = new ListView({ collection: source, sortWithCollection: false });
    view.render();

    source.models = [current, second, third];
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous, current }]
    });

    expect(view.children.toArray().map(child => child.model)).to.deep.equal([current, second, third]);
    expect(view.el.textContent).to.equal('aftersecondthird');
    view.destroy();
  });

  it('renders in-place updates through the same path', function() {
    const model = { id: 1, name: 'before' };
    const source = { models: [model] };
    const view = new ListView({ collection: source });
    view.render();
    const child = view.children.findByModel(model);

    model.name = 'after';
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous: model, current: model }]
    });

    expect(child.renderCount).to.equal(2);
    expect(child.el.textContent).to.equal('after');
    view.destroy();
  });

  ['removal', 'replacement'].forEach(changeType => {
    it(`keeps a managed child when a before-remove hook rejects ${ changeType }`, function() {
      const first = { id: 1, name: 'one' };
      const replacement = { id: 1, name: 'replacement' };
      const source = { models: [first] };
      const hookError = new Error('before remove failed');
      let shouldFail = true;
      const FailureList = ListView.extend({
        onBeforeRemoveChild() {
          if (!shouldFail) { return; }
          shouldFail = false;
          throw hookError;
        }
      });
      const view = new FailureList({ collection: source });
      view.render();
      const originalChild = view.children.findByModel(first);
      const isReplacement = changeType === 'replacement';

      source.models = isReplacement ? [replacement] : [];
      expect(() => source.notify({
        kind: 'update',
        added: [],
        removed: isReplacement ? [] : [first],
        updated: isReplacement ? [{ previous: first, current: replacement }] : []
      })).to.throw(hookError);

      expect(view.children.findByModel(first)).to.equal(originalChild);
      expect(originalChild.isDestroyed()).to.be.false;
      source.notify({ kind: 'reset' });
      expect(view.children.toArray().map(child => child.model))
        .to.deep.equal(isReplacement ? [replacement] : []);
      expect(originalChild.isDestroyed()).to.be.true;
      view.destroy();
    });
  });

  it('treats reset as destructive whole-list replacement', function() {
    const first = { id: 1, name: 'one' };
    const source = { models: [first] };
    const view = new ListView({ collection: source });
    view.render();
    const firstView = view.children.findByModel(first);
    const replacement = { id: 1, name: 'replacement' };

    source.models = [replacement];
    source.notify({ kind: 'reset' });

    expect(firstView.isDestroyed()).to.be.true;
    expect(view.children.findByModel(replacement)).to.not.equal(firstView);
    view.destroy();
  });

  it('diagnoses duplicate, missing, and unstable keys', function() {
    const duplicate = { id: 1, name: 'duplicate' };
    expect(() => new ListView({ collection: { models: [duplicate, duplicate] } }).render())
      .to.throw(MarionetteError).and.include({ code: 'MN0039' });

    const missing = { name: 'missing' };
    expect(() => new ListView({ collection: { models: [missing] } }).render())
      .to.throw(MarionetteError).and.include({ code: 'MN0039' });

    const model = { id: 1, name: 'unstable' };
    const source = { models: [model] };
    const view = new ListView({ collection: source });
    view.render();
    model.id = 2;
    expect(() => source.notify({ kind: 'reorder' }))
      .to.throw(MarionetteError).and.include({ code: 'MN0039' });
    view.destroy();
  });

  it('uses SameValueZero when validating stable keys', function() {
    const previous = { id: -0, name: 'before' };
    const source = { models: [previous] };
    const view = new ListView({ collection: source });
    view.render();
    const previousChild = view.children.findByModel(previous);

    previous.id = 0;
    source.notify({ kind: 'reorder' });
    expect(view.children.findByModel(previous)).to.equal(previousChild);

    const current = { id: -0, name: 'after' };
    source.models = [current];
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous, current }]
    });

    expect(previousChild.isDestroyed()).to.be.true;
    expect(view.children.findByModel(current)).to.not.equal(previousChild);
    view.destroy();
  });

  it('diagnoses an update whose child View is missing', function() {
    const model = { id: 1, name: 'one' };
    const source = { models: [model] };
    const view = new ListView({ collection: source });
    view.render();
    const child = view.children.first();
    view.removeChildView(child);

    expect(() => source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous: model, current: model }]
    })).to.throw(MarionetteError).and.include({ code: 'MN0039' });

    view.destroy();
  });

  it('recreates a same-key replacement even when its child is filtered out', function() {
    const previous = { id: 1, name: 'before' };
    const current = { id: 1, name: 'after' };
    const source = { models: [previous] };
    const FilteredList = ListView.extend({ viewFilter: () => false });
    const view = new FilteredList({ collection: source });
    const children = [];
    view.on('add:child', (collectionView, addedChild) => { children.push(addedChild); });
    view.render();
    const previousChild = children[0];

    source.models = [current];
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous, current }]
    });

    const currentChild = children[1];
    expect(previousChild.isDestroyed()).to.be.true;
    expect(currentChild).to.not.equal(previousChild);
    expect(currentChild.model).to.equal(current);
    expect(view.children.hasView(currentChild)).to.be.false;
    expect(currentChild.renderCount).to.be.undefined;
    view.destroy();
  });

  it('queues synchronous structural notifications and keeps later updates coherent', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const third = { id: 3, name: 'three' };
    const fourth = { id: 4, name: 'four' };
    const fifth = { id: 5, name: 'five' };
    const source = { models: [first] };
    const ReentrantList = ListView.extend({
      onAddChild(collectionView, child) {
        if (child.model === second) {
          source.models = [first, second, third];
          source.notify({ kind: 'update', added: [third], removed: [], updated: [] });
        } else if (child.model === third) {
          source.models = [first, second, third, fourth];
          source.notify({ kind: 'update', added: [fourth], removed: [], updated: [] });
        } else if (child.model === fourth) {
          source.models = [first, second, third, fourth, fifth];
          source.notify({ kind: 'update', added: [fifth], removed: [], updated: [] });
        }
      }
    });
    const view = new ReentrantList({ collection: source });
    view.render();

    source.models = [first, second];
    source.notify({ kind: 'update', added: [second], removed: [], updated: [] });

    expect(view.children.toArray().map(child => child.model))
      .to.deep.equal([first, second, third, fourth, fifth]);
    expect(view.el.textContent).to.equal('onetwothreefourfive');

    source.models = [second, third, fifth];
    source.notify({
      kind: 'update', added: [], removed: [first, fourth], updated: []
    });

    expect(view.children.toArray().map(child => child.model)).to.deep.equal([second, third, fifth]);
    expect(view.el.textContent).to.equal('twothreefive');
    view.destroy();
  });

  it('renders each queued notification in its captured source order', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const replacement = { id: 2, name: 'replacement' };
    const source = { models: [first] };
    const orders = [];
    const ReentrantList = ListView.extend({
      onAddChild(owner, child) {
        if (child.model !== second) { return; }
        source.models = [first, replacement];
        source.notify({ kind: 'update', added: [], removed: [],
          updated: [{ previous: second, current: replacement }] });
      }
    });
    const view = new ReentrantList({ collection: source }).render();
    view.on('render:children', owner => orders.push(owner.children.map(child => child.model)));

    source.models = [first, second];
    source.notify({ kind: 'update', added: [second], removed: [], updated: [] });

    expect(orders).to.deep.equal([[first, second], [first, replacement]]);
    expect(view.el.textContent).to.equal('onereplacement');
    view.destroy();
  });

  it('fires before:sort before changing children to the new source order', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const source = { models: [first, second] };
    const view = new ListView({ collection: source }).render();
    let before;
    view.on('before:sort', owner => { before = owner._children.map(child => child.model); });

    source.models = [second, first];
    source.notify({ kind: 'reorder' });

    expect(before).to.deep.equal([first, second]);
    expect(view.children.map(child => child.model)).to.deep.equal([second, first]);
    view.destroy();
  });

  it('keeps a reorder queued from before:sort separate from the current render', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const source = { models: [first, second] };
    const view = new ListView({ collection: source }).render();
    const orders = [];
    view.on('render:children', owner => orders.push(owner.children.map(child => child.model)));
    view.once('before:sort', () => {
      source.models = [first, second];
      source.notify({ kind: 'reorder' });
    });

    source.models = [second, first];
    source.notify({ kind: 'reorder' });

    expect(orders).to.deep.equal([[second, first], [first, second]]);
    expect(view.el.textContent).to.equal('onetwo');
    view.destroy();
  });

  it('sorts reset children from the reset snapshot when an add hook queues a reorder', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const source = { models: [] };
    const orders = [];
    const ReentrantList = ListView.extend({
      onAddChild(owner, child) {
        if (child.model !== second) { return; }
        source.models = [second, first];
        source.notify({ kind: 'reorder' });
      }
    });
    const view = new ReentrantList({ collection: source }).render();
    view.on('render:children', owner => orders.push(owner.children.map(child => child.model)));

    source.models = [first, second];
    source.notify({ kind: 'reset' });

    expect(orders).to.deep.equal([[first, second], [second, first]]);
    expect(view.el.textContent).to.equal('twoone');
    view.destroy();
  });

  [undefined, false, function(child) { return child.model.rank; }].forEach(viewComparator => {
    it(`preserves manual children and source ties with a ${typeof viewComparator} comparator`, function() {
      const first = { id: 1, rank: 0, name: 'one' };
      const second = { id: 2, rank: 0, name: 'two' };
      const manual = { id: 3, rank: 0, name: 'manual' };
      const source = { models: [first, second] };
      const view = new ListView({ collection: source, viewComparator }).render();
      const manualView = new ChildView({ model: manual });
      view.addChildView(manualView);

      source.models = [second, first];
      source.notify({ kind: 'reorder' });

      expect(view.children.map(child => child.model)).to.deep.equal(viewComparator === undefined ?
        [manual, second, first] : [second, first, manual]);
      expect(view.children.findByModel(manual)).to.equal(manualView);
      expect(manualView.renderCount).to.equal(1);
      view.destroy();
    });
  });

  it('retains custom comparator ties when source ordering is disabled', function() {
    const first = { id: 1, rank: 0, name: 'one' };
    const second = { id: 2, rank: 0, name: 'two' };
    const added = { id: 3, rank: 0, name: 'three' };
    const source = { models: [first, second] };
    const view = new ListView({ collection: source, sortWithCollection: false,
      viewComparator: child => child.model.rank }).render();

    source.models = [added, second, first];
    source.notify({ kind: 'update', added: [added], removed: [], updated: [] });

    expect(view.children.map(child => child.model)).to.deep.equal([first, second, added]);
    expect(view.el.textContent).to.equal('onetwothree');
    view.destroy();
  });

  it('reconciles a same-key replacement queued from an add hook', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const replacement = { id: 2, name: 'replacement' };
    const source = { models: [first] };
    let addedChild;
    const ReentrantList = ListView.extend({
      onAddChild(collectionView, child) {
        if (child.model !== second) { return; }
        addedChild = child;
        source.models = [first, replacement];
        source.notify({
          kind: 'update',
          added: [],
          removed: [],
          updated: [{ previous: second, current: replacement }]
        });
      }
    });
    const view = new ReentrantList({ collection: source });
    view.render();

    source.models = [first, second];
    source.notify({ kind: 'update', added: [second], removed: [], updated: [] });

    const replacementChild = view.children.findByModel(replacement);
    expect(addedChild.isDestroyed()).to.be.true;
    expect(replacementChild).to.not.equal(addedChild);
    expect(view.children.toArray().map(child => child.model)).to.deep.equal([first, replacement]);
    expect(view.el.textContent).to.equal('onereplacement');
    view.destroy();
  });

  it('drops a queued structural update after reentrant destruction', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const third = { id: 3, name: 'three' };
    const source = { models: [first] };
    let thirdBuilds = 0;
    const ReentrantList = ListView.extend({
      buildChildView(model, ChildViewClass, childViewOptions) {
        if (model === third) { thirdBuilds++ }
        return CollectionView.prototype.buildChildView.call(
          this, model, ChildViewClass, childViewOptions
        );
      },
      onAddChild(collectionView, child) {
        if (child.model !== second) { return; }
        source.models = [first, second, third];
        source.notify({ kind: 'update', added: [third], removed: [], updated: [] });
        collectionView.destroy();
      }
    });
    const view = new ReentrantList({ collection: source });
    view.render();

    source.models = [first, second];
    expect(() => source.notify({
      kind: 'update', added: [second], removed: [], updated: []
    })).to.not.throw();

    expect(view.isDestroyed()).to.be.true;
    expect(thirdBuilds).to.equal(0);
    expect(view.children.length).to.equal(0);
    expect(view.el.textContent).to.equal('');
  });

  it('processes added and removed children in snapshot order', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const third = { id: 3, name: 'three' };
    const source = { models: [first] };
    const view = new ListView({ collection: source, sortWithCollection: false });
    const added = [];
    const removed = [];
    view.render();
    view.on('add:child', (owner, child) => added.push(child.model));
    view.on('remove:child', (owner, child) => removed.push(child.model));

    source.models = [third, first, second];
    source.notify({ kind: 'update', added: [second, third], removed: [], updated: [] });

    expect(added).to.deep.equal([third, second]);
    expect(view.children.toArray().map(child => child.model)).to.deep.equal([first, third, second]);
    expect(view.el.textContent).to.equal('onethreetwo');

    source.models = [second];
    source.notify({ kind: 'update', added: [], removed: [first, third], updated: [] });

    expect(removed).to.deep.equal([third, first]);
    expect(view.el.textContent).to.equal('two');
    view.destroy();
  });

  it('does not render an added child that is filtered out', function() {
    const first = { id: 1, name: 'one' };
    const hidden = { id: 2, name: 'hidden' };
    const source = { models: [first] };
    const FilteredList = ListView.extend({
      viewFilter(child) { return child.model.id === 1; }
    });
    const view = new FilteredList({ collection: source });
    let child;
    view.on('add:child', (collectionView, addedChild) => {
      if (addedChild.model === hidden) { child = addedChild; }
    });
    view.render();

    source.models = [first, hidden];
    source.notify({ kind: 'update', added: [hidden], removed: [], updated: [] });

    expect(view.children.hasView(child)).to.be.false;
    expect(child.renderCount).to.be.undefined;
    expect(view.el.textContent).to.equal('one');
    view.destroy();
  });

  it('lets an overridden sort defer rendering until filter is called', function() {
    const model = { id: 1, name: 'before' };
    const source = { models: [model] };
    const view = new ListView({ collection: source });
    view.render();
    const child = view.children.first();
    view.sort = () => view;

    model.name = 'after';
    source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous: model, current: model }]
    });

    expect(child.renderCount).to.equal(1);
    expect(child.el.textContent).to.equal('before');

    view.filter();

    expect(child.renderCount).to.equal(2);
    expect(child.el.textContent).to.equal('after');
    view.destroy();
  });

  Object.entries({
    defaults: {},
    filter: { viewFilter: () => true },
    comparator: { viewComparator: child => child.model.id },
    sortOverride: { sort() { return CollectionView.prototype.sort.call(this); } }
  }).forEach(([name, options]) => {
    it(`keeps survivors mounted through updates, sort, and filter with ${name}`, function() {
      const models = [{ id: 1, name: 'one' }, { id: 2, name: 'two' }];
      const source = { models };
      const InputChild = ChildView.extend({ template: () => '<input value="unchanged">' });
      const List = ListView.extend({ ...options, childView: InputChild });
      const view = new List({ collection: source }).render();
      document.body.appendChild(view.el);
      const survivor = view.children.last();
      const input = survivor.el.firstChild;
      input.focus();
      input.setSelectionRange(1, 3);
      const detach = this.sinon.spy(view.Dom, 'detachEl');
      const move = this.sinon.spy(view.Dom, 'moveEl');
      const render = this.sinon.spy(survivor, 'render');
      const added = { id: 0, name: 'zero' };

      source.models = [added, ...models];
      source.notify({ kind: 'update', added: [added], removed: [], updated: [] });
      view.sort();
      view.filter();
      source.models = [added, models[1]];
      source.notify({ kind: 'update', added: [], removed: [models[0]], updated: [] });

      expect(document.activeElement).to.equal(input);
      expect([input.selectionStart, input.selectionEnd]).to.deep.equal([1, 3]);
      expect(render).not.to.have.been.called;
      expect(detach).not.to.have.been.calledWith(survivor.el);
      expect(move).not.to.have.been.calledWith(survivor.el);
      expect([...view.el.children]).to.deep.equal([...view.children].map(child => child.el));
      view.destroy();
    });
  });

  it('reattaches a filtered child when detachHtml retains its element', function() {
    const source = { models: [{ id: 1, name: 'one' }] };
    const RetainedList = ListView.extend({ detachHtml() {} });
    const view = new RetainedList({ collection: source });
    const el = document.createElement('div');
    document.body.appendChild(el);
    const region = new Region({ el });
    region.show(view);
    const child = view.children.first();
    const attached = this.sinon.spy();
    child.on('attach', attached);

    view.setFilter(() => false);
    expect(child.el.parentNode).to.equal(view.el);
    expect(child.isAttached()).to.be.false;

    view.removeFilter();

    expect(view.children.first()).to.equal(child);
    expect(child.isAttached()).to.be.true;
    expect(attached).to.have.been.calledOnce;
    expect(child.renderCount).to.equal(1);
    region.destroy();
    el.remove();
  });

  it('renders additions and resets with the presentation comparator disabled', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const source = { models: [first] };
    const view = new ListView({ collection: source, viewComparator: false }).render();

    source.models = [second, first];
    source.notify({ kind: 'update', added: [second], removed: [], updated: [] });
    expect(view.el.textContent).to.equal('twoone');
    const previous = [...view.children];

    source.models = [first];
    source.notify({ kind: 'reset' });
    expect(view.el.textContent).to.equal('one');
    expect(previous.every(child => child.isDestroyed())).to.be.true;
    view.destroy();
  });

  it('places a prepended child without moving a thousand survivors', function() {
    const models = Array.from({ length: 1000 }, (_, id) => ({ id, name: String(id) }));
    const source = { models };
    const view = new ListView({ collection: source }).render();
    const move = this.sinon.spy(view.Dom, 'moveEl');
    const added = { id: 1000, name: 'new' };

    source.models = [added, ...models];
    source.notify({ kind: 'update', added: [added], removed: [], updated: [] });

    expect(move).to.have.been.calledOnce;
    expect(move.firstCall.args[0]).to.equal(view.children.first().el);
    expect([...view.el.children]).to.deep.equal([...view.children].map(child => child.el));
    view.destroy();
  });

  it('preserves template contents before the children when placing an addition', function() {
    const source = { models: [{ id: 1, name: 'one' }] };
    const List = ListView.extend({ template: () => '<header>Heading</header>' });
    const view = new List({ collection: source }).render();
    const header = view.el.firstChild;
    const added = { id: 2, name: 'two' };

    source.models.unshift(added);
    source.notify({ kind: 'update', added: [added], removed: [], updated: [] });

    expect(view.el.firstChild).to.equal(header);
    expect(view.el.textContent).to.equal('Headingtwoone');
    view.destroy();
  });

  it('restores focused controls and their text selection after DOM moves', function() {
    for (const control of ['input', 'button']) {
      const models = [
        { id: 1, name: 'one' },
        { id: 2, name: 'two' }
      ];
      const FocusChild = ChildView.extend({
        template: model => `<${ control }>${ model.name }</${ control }>`
      });
      FocusChild.setDataApi(Adapter);
      const FocusList = ListView.extend({ childView: FocusChild });
      const source = { models };
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

      source.models = [models[1], models[0]];
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
    const source = { models: [{ id: 1, name: 'one' }] };
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

    source.models = [];
    staleNotify({ kind: 'reset' });
    expect(child.destroyCount).to.equal(1);
  });

});
