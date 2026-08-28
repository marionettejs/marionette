import { createRequire } from 'module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

describe('Backbone shim', function() {
  let Backbone;
  let ShimmedBackbone;
  let constructors;
  let historyMethods;
  let namespaceMethods;
  let prototypes;
  let previousDocument;
  let previousWindow;

  before(async function() {
    previousDocument = global.document;
    previousWindow = global.window;

    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;

    Backbone = require('backbone');
    Backbone.$ = require('jquery');

    constructors = {
      Collection: Backbone.Collection,
      Model: Backbone.Model,
      Router: Backbone.Router,
      View: Backbone.View
    };
    prototypes = {
      Collection: Backbone.Collection.prototype,
      Model: Backbone.Model.prototype,
      Router: Backbone.Router.prototype,
      View: Backbone.View.prototype
    };
    namespaceMethods = {
      on: Backbone.on,
      off: Backbone.off,
      trigger: Backbone.trigger,
      triggerMethod: Backbone.triggerMethod,
      bindEvents: Backbone.bindEvents,
      stopListening: Backbone.stopListening
    };
    historyMethods = {
      triggerMethod: Backbone.History.prototype.triggerMethod
    };

    ShimmedBackbone = (await import('../../backbone.js')).default;
  });

  after(function() {
    global.document = previousDocument;
    global.window = previousWindow;
  });

  it('does not mix Marionette Events into the Backbone namespace', function() {
    expect(ShimmedBackbone).to.equal(Backbone);

    expect(Backbone.on).to.equal(namespaceMethods.on);
    expect(Backbone.off).to.equal(namespaceMethods.off);
    expect(Backbone.trigger).to.equal(namespaceMethods.trigger);
    expect(Backbone.triggerMethod).to.equal(namespaceMethods.triggerMethod);
    expect(Backbone.bindEvents).to.equal(namespaceMethods.bindEvents);
    expect(Backbone.stopListening).to.equal(namespaceMethods.stopListening);
  });

  it('does not mix Marionette Events into Backbone.History', function() {
    expect(Backbone.History.prototype.triggerMethod).to.equal(historyMethods.triggerMethod);
  });

  it('preserves the Backbone module, constructors, and prototypes by identity', function() {
    expect(ShimmedBackbone).to.equal(Backbone);

    Object.keys(constructors).forEach(name => {
      expect(Backbone[name]).to.equal(constructors[name]);
      expect(Backbone[name].prototype).to.equal(prototypes[name]);
    });
  });

  it('mixes Marionette Events into supported Backbone instances', function() {
    [
      new Backbone.Model(),
      new Backbone.Collection(),
      new Backbone.View(),
      new Backbone.Router()
    ].forEach(instance => {
      let callCount = 0;

      expect(instance.triggerMethod).to.be.a('function');
      instance.on('shim:test', function() {
        callCount += 1;
      });
      instance.triggerMethod('shim:test');
      expect(callCount).to.equal(1);
    });
  });

  it('preserves Model and Collection data and event behavior', function() {
    const model = new Backbone.Model({ id: 1, name: 'before' });
    const collection = new Backbone.Collection([model]);
    const listener = new Backbone.Model();
    const calls = [];

    listener.listenTo(model, 'change:name', (changedModel, value) => {
      calls.push(['change', changedModel, value]);
    });
    listener.listenTo(collection, 'add', (addedModel, changedCollection) => {
      calls.push(['add', addedModel, changedCollection]);
    });

    model.set('name', 'after');
    const addedModel = collection.add({ id: 2, name: 'second' });

    expect(collection.get(1)).to.equal(model);
    expect(collection.get(2)).to.equal(addedModel);
    expect(calls).to.deep.equal([
      ['change', model, 'after'],
      ['add', addedModel, collection]
    ]);

    listener.stopListening();
    model.set('name', 'ignored');
    collection.add({ id: 3 });

    expect(calls).to.have.lengthOf(2);
  });
});
