import CollectionView from '../../../src/modules/collection-view';
import Behavior from '../../../src/modules/behavior';
import View from '../../../src/modules/view';
import MarionetteError from '../../../src/modules/error';

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

function expectInvalidChange(ListView, initialModels, currentModels, change) {
  const source = { models: initialModels };
  const view = new ListView({ collection: source });
  view.render();
  source.models = currentModels;

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

  it('keeps existing children intact when a replacement constructor fails', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const firstReplacement = { id: 1, name: 'first replacement' };
    const secondReplacement = { id: 2, name: 'second replacement' };
    const source = { models: [first, second] };
    const constructionError = new Error('replacement construction failed');
    let shouldFail = true;
    let stagedChild;
    const FailureList = ListView.extend({
      buildChildView(model, ChildViewClass, childViewOptions) {
        if (shouldFail && model === secondReplacement) { throw constructionError; }
        const child = CollectionView.prototype.buildChildView.call(
          this, model, ChildViewClass, childViewOptions
        );
        if (model === firstReplacement) { stagedChild = child; }
        return child;
      }
    });
    const view = new FailureList({ collection: source });
    view.render();
    const originalChildren = view.children.toArray();
    const originalElements = originalChildren.map(child => child.el);

    source.models = [firstReplacement, secondReplacement];
    expect(() => source.notify({
      kind: 'update',
      added: [],
      removed: [],
      updated: [
        { previous: first, current: firstReplacement },
        { previous: second, current: secondReplacement }
      ]
    })).to.throw(constructionError);

    expect(stagedChild.isDestroyed()).to.be.true;
    expect(originalChildren.every(child => !child.isDestroyed())).to.be.true;
    expect(view.children.toArray()).to.deep.equal(originalChildren);
    expect([...view.el.children]).to.deep.equal(originalElements);

    shouldFail = false;
    source.notify({ kind: 'reset' });
    expect(view.children.toArray().map(child => child.model))
      .to.deep.equal([firstReplacement, secondReplacement]);
    expect(originalChildren.every(child => child.isDestroyed())).to.be.true;
    view.destroy();
  });

  it('destroys staged replacements when a later add hook fails', function() {
    const first = { id: 1, name: 'one' };
    const replacement = { id: 1, name: 'replacement' };
    const added = { id: 2, name: 'added' };
    const failingAddition = { id: 3, name: 'failing addition' };
    const source = { models: [first] };
    const hookError = new Error('add hook failed');
    let stagedReplacement;
    let stagedAddition;
    let failedAddition;
    const lifecycle = [];
    const FailureList = ListView.extend({
      buildChildView(model, ChildViewClass, childViewOptions) {
        const child = CollectionView.prototype.buildChildView.call(
          this, model, ChildViewClass, childViewOptions
        );
        if (model === replacement) { stagedReplacement = child; }
        if (model === added) { stagedAddition = child; }
        if (model === failingAddition) { failedAddition = child; }
        return child;
      },
      onBeforeAddChild(collectionView, child) {
        lifecycle.push(`before:add:${ child.model.name }`);
        if (child.model === failingAddition) { throw hookError; }
      },
      onAddChild(collectionView, child) {
        lifecycle.push(`add:${ child.model.name }`);
      },
      onBeforeRemoveChild(collectionView, child) {
        lifecycle.push(`before:remove:${ child.model.name }`);
      },
      onRemoveChild(collectionView, child) {
        lifecycle.push(`remove:${ child.model.name }`);
      }
    });
    const view = new FailureList({ collection: source });
    view.render();
    lifecycle.length = 0;

    source.models = [replacement, added, failingAddition];
    expect(() => source.notify({
      kind: 'update',
      added: [added, failingAddition],
      removed: [],
      updated: [{ previous: first, current: replacement }]
    })).to.throw(hookError);

    expect(stagedReplacement.isDestroyed()).to.be.true;
    expect(stagedAddition.isDestroyed()).to.be.true;
    expect(failedAddition.isDestroyed()).to.be.true;
    expect(view.children.toArray().map(child => child.model)).to.deep.equal([first]);
    expect(view.el.textContent).to.equal('one');
    expect(lifecycle).to.deep.equal([
      'before:add:added',
      'add:added',
      'before:add:failing addition',
      'before:remove:added',
      'remove:added'
    ]);
    view.destroy();
  });

  it('recovers the latest source snapshot after a reconciliation hook fails', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const third = { id: 3, name: 'three' };
    const fourth = { id: 4, name: 'four' };
    const source = { models: [first] };
    const hookError = new Error('add hook failed');
    let shouldFail = true;
    const RecoveringList = ListView.extend({
      onBeforeAddChild(collectionView, child) {
        if (!shouldFail || child.model !== second) { return; }
        shouldFail = false;
        source.models = [first, second, third];
        source.notify({ kind: 'update', added: [third], removed: [], updated: [] });
        throw hookError;
      }
    });
    const view = new RecoveringList({ collection: source });
    view.render();

    source.models = [first, second];
    expect(() => source.notify({
      kind: 'update', added: [second], removed: [], updated: []
    })).to.throw(hookError);

    source.models = [first, second, third, fourth];
    expect(() => source.notify({
      kind: 'update', added: [fourth], removed: [], updated: []
    })).to.not.throw();
    expect(view.children.toArray().map(child => child.model))
      .to.deep.equal([first, second, third, fourth]);
    expect(view.el.textContent).to.equal('onetwothreefour');
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

  it('diagnoses malformed collection snapshots and structural records', function() {
    const InvalidModelsList = ListView.extend({});
    InvalidModelsList.setDataApi({ models() { return {}; } });
    const invalidModelsView = new InvalidModelsList({ collection: {} });
    expect(() => invalidModelsView.render())
      .to.throw(MarionetteError, 'DataApi.models() must return an ordered model snapshot.')
      .and.include({ code: 'MN0039' });
    invalidModelsView.destroy();

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

  it('releases collection observation before failed-construction child cleanup', function() {
    const first = { id: 1, name: 'one' };
    const source = { models: [first] };
    const constructionError = new Error('initialize failed');
    const onDestroy = this.sinon.spy(() => {
      expect(source.notify).to.be.undefined;
      source.models = [];
      source.notify?.({ kind: 'update', added: [], removed: [first], updated: [] });
    });
    const CleanupChild = ChildView.extend({ onDestroy });
    CleanupChild.setDataApi(Adapter);
    const BrokenList = ListView.extend({
      childView: CleanupChild,
      initialize() {
        this.render();
        throw constructionError;
      }
    });

    expect(() => new BrokenList({ collection: source })).to.throw(constructionError);
    expect(onDestroy).to.have.been.calledOnce;
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

  it('renders reconciled children when an overridden sort does not render them', function() {
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

    expect(child.renderCount).to.equal(2);
    expect(child.el.textContent).to.equal('after');
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

  it('diagnoses an invalid structural observer cleanup value', function() {
    const InvalidList = ListView.extend({});
    InvalidList.setDataApi({ observeCollection() {} });
    const view = new InvalidList({ collection: { models: [] } });

    expect(() => view.render()).to.throw(MarionetteError).and.include({ code: 'MN0038' });
    view.destroy();
  });
});
