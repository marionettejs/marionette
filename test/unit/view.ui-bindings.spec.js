import { vi, describe, it, expect, beforeEach } from 'vitest';
import _ from 'underscore';
import Backbone from 'backbone';
import * as Marionette from '../../src/index.ts';
import '../setup/backbone.js';
describe('view ui elements', function() {
  'use strict';

  beforeEach(function(testContext) {
    testContext.templateFn = _.template('<div id="<%= name %>"></div>');
    testContext.uiHash = {foo: '#foo', bar: '#bar'};
    testContext.model = testContext.model = new Backbone.Model({name: 'foo'});
    testContext.View = Marionette.View.extend({
      template: testContext.templateFn,
      ui: testContext.uiHash
    });
  });

  describe('when normalizing a ui string', function() {
    beforeEach(function(testContext) {
      testContext.view = new testContext.View({model: testContext.model});
      testContext.view.render();
    });

    it('should return the string unmodified if it does not begin with @ui.', function(testContext) {
      expect(testContext.view.normalizeUIString('baz')).to.equal('baz');
    })

    it('should translate it if it can be found', function(testContext) {
      expect(testContext.view.normalizeUIString('@ui.foo')).to.equal('#foo');
    });

    it('should throw a stable diagnostic if it begins with @ui. but can not be found', function(testContext) {
      expect(() => testContext.view.normalizeUIString('@ui.baz'))
        .to.throw('The ui reference "baz" must be declared as an own ui key.')
        .with.property('code', 'MN0018');
    });
  });

  describe('when accessing a ui element from the hash', function() {
    beforeEach(function(testContext) {
      testContext.view = new testContext.View({model: testContext.model});
      testContext.view.render();
    });

    it('should return its native selector result if it can be found', function(testContext) {
      expect(testContext.view.ui.foo).to.be.instanceOf(NodeList).and.to.have.lengthOf(1);
    });

    it('should return an empty native selector result if it cannot be found', function(testContext) {
      expect(testContext.view.ui.bar).to.be.instanceOf(NodeList).and.to.have.lengthOf(0);
    });

    it('should return its native selector result through getUI', function(testContext) {
      expect(testContext.view.getUI('foo')).to.be.instanceOf(NodeList).and.to.have.lengthOf(1);
      expect(testContext.view.getUI('bar')).to.be.instanceOf(NodeList).and.to.have.lengthOf(0);
    });
  });

  describe('when re-rendering a view with a UI element configuration', function() {
    beforeEach(function(testContext) {
      testContext.view = new testContext.View({model: testContext.model});
      testContext.view.render();
      testContext.view.model.set('name', 'bar');
      testContext.view.render();
    });

    it('should return an up-to-date selector on subsequent renders', function(testContext) {
      expect(testContext.view.ui.foo).to.be.instanceOf(NodeList).and.to.have.lengthOf(0);
      expect(testContext.view.ui.bar).to.be.instanceOf(NodeList).and.to.have.lengthOf(1);
    });

    it('should return an up-to-date selector through getUI', function(testContext) {
      expect(testContext.view.getUI('foo')).to.be.instanceOf(NodeList).and.to.have.lengthOf(0);
      expect(testContext.view.getUI('bar')).to.be.instanceOf(NodeList).and.to.have.lengthOf(1);
    });
  });

  describe('when the ui element is a function that returns a hash', function() {
    beforeEach(function(testContext) {
      testContext.View = testContext.View.extend({
        ui: vi.fn().mockReturnValue(testContext.uiHash)
      });

      testContext.view = new testContext.View({model: testContext.model});
      testContext.view.render();
    });

    it('should return its native selector result if it can be found', function(testContext) {
      expect(testContext.view.ui.foo).to.be.instanceOf(NodeList).and.to.have.lengthOf(1);
    });

    it('should return an empty native selector result if it cannot be found', function(testContext) {
      expect(testContext.view.ui.bar).to.be.instanceOf(NodeList).and.to.have.lengthOf(0);
    });

    it('should return an up-to-date selector on subsequent renders', function(testContext) {
      expect(testContext.view.ui.foo).to.be.instanceOf(NodeList).and.to.have.lengthOf(1);
      expect(testContext.view.ui.bar).to.be.instanceOf(NodeList).to.have.lengthOf(0);

      testContext.view.model.set('name', 'bar');
      testContext.view.render();

      expect(testContext.view.ui.foo).to.have.lengthOf(0);
      expect(testContext.view.ui.bar).to.have.lengthOf(1);
    });

    it('should return its native selector result through getUI', function(testContext) {
      expect(testContext.view.getUI('foo')).to.be.instanceOf(NodeList).and.to.have.lengthOf(1);
    });
  });

  describe('when destroying a view that has not been rendered', function() {
    beforeEach(function(testContext) {
      testContext.viewOne = new testContext.View({model: testContext.model});
      testContext.viewTwo = new testContext.View({model: testContext.model});
    });

    it('should not affect future ui bindings', function(testContext) {
      expect(testContext.viewTwo.ui).to.deep.equal(testContext.uiHash);
    });
  });

  describe('when destroying a view', function() {
    beforeEach(function(testContext) {
      testContext.view = new testContext.View({model: testContext.model});
      testContext.view.render();
      testContext.view.destroy();
    });

    it('should unbind UI elements and reset them to the selector', function(testContext) {
      expect(testContext.view.ui).to.deep.equal(testContext.uiHash);
    });
  });
});
