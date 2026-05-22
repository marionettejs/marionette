import { expect } from 'chai';
import { JSDOM } from 'jsdom';

describe('Backbone shim', function() {
  let Backbone;
  let ShimmedBackbone;
  let historyMethods;
  let namespaceMethods;
  let previousDocument;
  let previousWindow;

  before(function() {
    previousDocument = global.document;
    previousWindow = global.window;

    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;

    Backbone = require('backbone');
    Backbone.$ = require('jquery');

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

    ShimmedBackbone = require('../../backbone').default;
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
});
