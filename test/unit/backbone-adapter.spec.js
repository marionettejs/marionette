import Backbone from 'backbone';
import { createMarionette } from '../../index.js';

describe('Backbone adapter', function() {
  let BackboneApi;
  let constructors;
  let prototypeDescriptors;
  let namespaceDescriptors;
  let listenerRegisteredBeforeImport;
  let modelCreatedBeforeImport;

  before(async function() {
    constructors = {
      Collection: Backbone.Collection,
      Model: Backbone.Model,
      Router: Backbone.Router,
      View: Backbone.View
    };
    prototypeDescriptors = Object.fromEntries(Object.entries(constructors)
      .map(([name, Constructor]) => [name, Object.getOwnPropertyDescriptors(Constructor.prototype)]));
    namespaceDescriptors = Object.getOwnPropertyDescriptors(Backbone);
    modelCreatedBeforeImport = new Backbone.Model({ name: 'before' });
    listenerRegisteredBeforeImport = [];
    const onNameChange = (...args) => listenerRegisteredBeforeImport.push(args);
    modelCreatedBeforeImport.on('change:name', onNameChange);

    BackboneApi = (await import('../../packages/adapters/src/backbone.js')).default;
  });

  it('exports one combined StateApi and DataApi adapter', function() {
    expect(BackboneApi).to.have.all.keys(
      'disposeOwned',
      'get',
      'has',
      'key',
      'models',
      'observeCollection',
      'serialize',
      'subscribe'
    );
  });

  it('does not modify Backbone or its prototypes', function() {
    expect(Object.getOwnPropertyDescriptors(Backbone)).to.deep.equal(namespaceDescriptors);

    Object.entries(constructors).forEach(([name, Constructor]) => {
      expect(Backbone[name]).to.equal(Constructor);
      expect(Object.getOwnPropertyDescriptors(Constructor.prototype))
        .to.deep.equal(prototypeDescriptors[name]);
      expect(Constructor.prototype.triggerMethod).to.be.undefined;
      expect(Constructor.prototype.bind).to.equal(prototypeDescriptors[name].bind?.value);
      expect(Constructor.prototype.unbind).to.equal(prototypeDescriptors[name].unbind?.value);
    });
  });

  it('preserves listeners registered before the adapter is imported', function() {
    modelCreatedBeforeImport.set('name', 'after');

    expect(listenerRegisteredBeforeImport).to.have.lengthOf(1);
    expect(listenerRegisteredBeforeImport[0].slice(0, 2))
      .to.deep.equal([modelCreatedBeforeImport, 'after']);
  });

  it('supports Marionette listenTo and stopListening with native Backbone objects', function() {
    const runtime = createMarionette();
    runtime.setDataApi(BackboneApi);
    const listener = new runtime.MnObject();
    const model = new Backbone.Model();
    const callback = this.sinon.spy();

    listener.listenTo(model, 'change:name', callback);
    model.set('name', 'first');
    listener.stopListening(model);
    model.set('name', 'second');

    expect(callback).to.have.been.calledOnce.and.calledWith(model, 'first');
    listener.destroy();
  });

  it('supports Backbone listenTo and stopListening with Marionette objects', function() {
    const runtime = createMarionette();
    const listener = new Backbone.Model();
    const source = new runtime.MnObject();
    const callback = this.sinon.spy();

    listener.listenTo(source, 'status', callback);
    source.trigger('status', 'first');
    listener.stopListening(source);
    source.trigger('status', 'second');

    expect(callback).to.have.been.calledOnce.and.calledWith('first');
    source.destroy();
  });

  it('preserves native callback arguments for state, model, and collection events', function() {
    const runtime = createMarionette();
    runtime.setDataApi(BackboneApi);
    runtime.setStateApi(BackboneApi);
    const calls = [];
    const model = new Backbone.Model({ title: 'before' });
    const collection = new Backbone.Collection([model]);
    const state = new Backbone.Model({ ready: false });
    const EventView = runtime.View.extend({
      template: false,
      modelEvents: { 'change:title': 'onTitle' },
      collectionEvents: { add: 'onAdd' },
      onTitle(...args) { calls.push(['model', ...args]); },
      onAdd(...args) { calls.push(['collection', ...args]); }
    });
    const StateOwner = runtime.MnObject.extend({
      stateEvents: { 'change:ready': 'onReady' },
      onReady(...args) { calls.push(['state', ...args]); }
    });
    const view = new EventView({ collection, model });
    const owner = new StateOwner({ state });

    model.set('title', 'after');
    const added = collection.add({ id: 2 });
    state.set('ready', true);

    expect(calls).to.have.lengthOf(3);
    expect(calls[0].slice(0, 3)).to.deep.equal(['model', model, 'after']);
    expect(calls[1].slice(0, 3)).to.deep.equal(['collection', added, collection]);
    expect(calls[2].slice(0, 3)).to.deep.equal(['state', state, true]);
    expect(calls.map(call => call[3])).to.satisfy(options =>
      options.every(option => option && typeof option === 'object'));
    expect(model.triggerMethod).to.be.undefined;
    expect(collection.triggerMethod).to.be.undefined;

    view.destroy();
    owner.destroy();
  });

  it('unsubscribes owned Backbone state without calling Model#destroy', function() {
    const runtime = createMarionette();
    runtime.setStateApi(BackboneApi);
    const state = new Backbone.Model({ ready: false });
    const destroy = this.sinon.spy(state, 'destroy');
    const onReady = this.sinon.spy();
    const externalListener = this.sinon.spy();
    state.on('external', externalListener);
    const StateOwner = runtime.MnObject.extend({
      stateEvents: { 'change:ready': onReady },
      createState() { return state; }
    });
    const owner = new StateOwner();

    owner.getState();
    state.set('ready', true);
    state.trigger('external');
    owner.destroy();
    state.set('ready', false);
    state.trigger('external');

    expect(onReady).to.have.been.calledOnce;
    expect(externalListener).to.have.been.calledTwice;
    expect(destroy).to.not.have.been.called;
  });

  it('reconciles native Backbone collection add, remove, reset, sort, and update events', function() {
    const runtime = createMarionette();
    runtime.setDataApi(BackboneApi);
    const first = new Backbone.Model({ id: 1, order: 2 });
    const second = new Backbone.Model({ id: 2, order: 1 });
    const collection = new Backbone.Collection([first], { comparator: 'order' });
    const ChildView = runtime.View.extend({ template: false });
    const ListView = runtime.CollectionView.extend({ childView: ChildView });
    const view = new ListView({ collection });

    view.render();
    collection.add(second);
    expect(view.children.map(child => child.model)).to.deep.equal([second, first]);

    collection.remove(first);
    expect(view.children.map(child => child.model)).to.deep.equal([second]);

    collection.reset([first, second]);
    expect(view.children.map(child => child.model)).to.deep.equal([second, first]);

    first.set('order', 0);
    collection.sort();
    expect(view.children.map(child => child.model)).to.deep.equal([first, second]);

    collection.set([{ id: 1, order: 3 }, { id: 3, order: 2 }], { merge: true, remove: true });
    expect(view.children.map(child => child.model.id)).to.deep.equal([3, 1]);

    view.destroy();
  });

  it('configures only the selected runtime', function() {
    const first = createMarionette();
    const second = createMarionette();
    const model = new Backbone.Model();

    first.setDataApi(BackboneApi);
    first.setStateApi(BackboneApi);

    expect(first.View.prototype.Data.key(model)).to.equal(model.cid);
    expect(second.View.prototype.Data.key(model)).to.equal(model);
    expect(first.MnObject.prototype.State.subscribe).to.equal(BackboneApi.subscribe);
    expect(second.MnObject.prototype.State.subscribe).to.not.equal(BackboneApi.subscribe);
  });
});
