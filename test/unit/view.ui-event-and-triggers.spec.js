import { vi, describe, it, expect, beforeEach } from 'vitest';
import _ from 'underscore';
import * as Marionette from '../../src/index.ts';
describe('view ui event trigger configuration', function() {
  'use strict';

  describe('@ui syntax within events and triggers', function() {
    beforeEach(function(testContext) {
      testContext.fooHandlerStub = vi.fn();
      testContext.barHandlerStub = vi.fn();
      testContext.notBarHandlerStub = vi.fn();
      testContext.fooBarBazHandlerStub = vi.fn();

      testContext.templateFn = _.template('<div id="foo"></div><div id="bar"></div><div id="baz"></div>');

      testContext.uiHash = {
        foo: '#foo',
        bar: '#bar',
        'some-baz': '#baz'
      };

      testContext.triggersHash = {
        'click @ui.foo': 'fooHandler',
        'click @ui.some-baz': 'bazHandler'
      };

      testContext.eventsHash = {
        'click @ui.bar': testContext.barHandlerStub,
        'click div:not(@ui.bar)': testContext.notBarHandlerStub,
        'click @ui.foo, @ui.bar, @ui.some-baz': testContext.fooBarBazHandlerStub
      };
    });

    describe('as objects', function() {
      beforeEach(function(testContext) {
        testContext.View = Marionette.View.extend({
          template: testContext.templateFn,
          ui: testContext.uiHash,
          triggers: testContext.triggersHash,
          events: testContext.eventsHash
        });
        testContext.view = new testContext.View();
        testContext.view.render();

        testContext.view.on('fooHandler', testContext.fooHandlerStub);
      });

      it('should correctly trigger an event', function(testContext) {
        testContext.view.ui.foo[0].click();
        expect(testContext.fooHandlerStub).toHaveBeenCalledTimes(1);
        expect(testContext.fooBarBazHandlerStub).toHaveBeenCalledTimes(1);
      });

      it('should correctly trigger a complex event', function(testContext) {
        testContext.view.ui.bar[0].click();
        expect(testContext.barHandlerStub).toHaveBeenCalledTimes(1);
        expect(testContext.fooBarBazHandlerStub).toHaveBeenCalledTimes(1);
      });

      it('should correctly call an event', function(testContext) {
        testContext.view.ui['some-baz'][0].click();
        expect(testContext.notBarHandlerStub).toHaveBeenCalledTimes(1);
        expect(testContext.fooBarBazHandlerStub).toHaveBeenCalledTimes(1);
      });
    });

    describe('as functions', function() {
      beforeEach(function(testContext) {
        testContext.View = Marionette.View.extend({
          template: testContext.templateFn,
          ui: vi.fn().mockReturnValue(testContext.uiHash),
          triggers: vi.fn().mockReturnValue(testContext.triggersHash),
          events: vi.fn().mockReturnValue(testContext.eventsHash)
        });
        testContext.view = new testContext.View();
        testContext.view.render();

        testContext.view.on('fooHandler', testContext.fooHandlerStub);
      });

      it('should initialize events with context of the view', function(testContext) {
        expect(testContext.View.prototype.events.mock.contexts).toContain(testContext.view);
      });

      it('should initialize triggers with context of the view', function(testContext) {
        expect(testContext.View.prototype.triggers.mock.contexts).toContain(testContext.view);
      });

      it('should correctly trigger an event', function(testContext) {
        testContext.view.ui.foo[0].click();
        expect(testContext.fooHandlerStub).toHaveBeenCalledTimes(1);
        expect(testContext.fooBarBazHandlerStub).toHaveBeenCalledTimes(1);
      });

      it('should correctly trigger a complex event', function(testContext) {
        testContext.view.ui.bar[0].click();
        expect(testContext.barHandlerStub).toHaveBeenCalledTimes(1);
        expect(testContext.fooBarBazHandlerStub).toHaveBeenCalledTimes(1);
      });

      it('should correctly call an event', function(testContext) {
        testContext.view.ui['some-baz'][0].click();
        expect(testContext.notBarHandlerStub).toHaveBeenCalledTimes(1);
        expect(testContext.fooBarBazHandlerStub).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('rejects string event handlers that are not present on the view', function() {
    const View = Marionette.View.extend({
      template: _.template('<button class="foo"></button>'),
      events: {
        'click .foo': 'missingHandler'
      }
    });

    expect(() => new View())
      .to.throw('The handler "missingHandler" for "click .foo" must resolve to a function.')
      .with.property('code', 'MN0019');
  });

  it('rejects non-string event handlers', function() {
    const delegate = vi.fn();
    const View = Marionette.View.extend({
      events: {
        click: 1
      }
    });
    View.setEventDelegator({ delegate });

    expect(() => new View())
      .to.throw('The handler "<invalid>" for "click" must resolve to a function.')
      .with.property('code', 'MN0019');
    expect(delegate).not.toHaveBeenCalled();
  });

  it('preflights the complete event map before delegating handlers', function() {
    const delegate = vi.fn();
    const View = Marionette.View.extend({
      events: {
        click: 'onClick',
        dblclick: 'missingHandler'
      },
      onClick() {}
    });
    View.setEventDelegator({ delegate });

    expect(() => new View()).to.throw().with.property('code', 'MN0019');
    expect(delegate).not.toHaveBeenCalled();
  });
});
