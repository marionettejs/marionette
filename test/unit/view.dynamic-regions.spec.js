import { vi, describe, it, expect, beforeEach } from 'vitest';
import _ from 'underscore';
import * as Marionette from 'marionette';
describe('view - dynamic regions', function() {
  'use strict';

  let TestView;

  beforeEach(function(testContext) {
    TestView = Marionette.View.extend({ template: () => '' });
    _.extend(TestView.prototype, Marionette.Events);

    testContext.template = function() {
      return '<div id="foo"></div><div id="bar"></div>';
    };
  });

  describe('when adding a region to a layoutView, after it has been rendered', function() {
    beforeEach(function(testContext) {
      testContext.MyView = Marionette.View.extend({
        onAddRegion: function() {},
        onBeforeAddRegion: function() {}
      });

      testContext.layoutView = new testContext.MyView({
        template: testContext.template
      });

      testContext.beforeAddHandler = vi.fn();
      testContext.addHandler = vi.fn();
      testContext.onBeforeAddSpy = vi.spyOn(testContext.layoutView, 'onBeforeAddRegion');
      testContext.onAddSpy = vi.spyOn(testContext.layoutView, 'onAddRegion');
      testContext.layoutView.on('before:add:region', testContext.beforeAddHandler);
      testContext.layoutView.on('add:region', testContext.addHandler);

      testContext.layoutView.render();

      testContext.region = testContext.layoutView.addRegion('foo', '#foo');

      testContext.view = new TestView();
      testContext.layoutView.getRegion('foo').show(testContext.view);
    });

    it('should add the region to the layoutView', function(testContext) {
      expect(testContext.layoutView.getRegion('foo')).to.equal(testContext.region);
    });

    it('should add the region definition to the regions property', function(testContext) {
      expect(testContext.layoutView.regions.foo).to.equal('#foo');
    });

    it('should set the parent of the region to the layoutView', function(testContext) {
      expect(testContext.region.el.parentNode).to.equal(testContext.layoutView.el);
    });

    it('should be able to show a view in the region', function(testContext) {
      expect(testContext.layoutView.getRegion('foo').el.children.length).to.equal(1);
    });

    it('should trigger a before:add:region event', function(testContext) {
      expect(testContext.beforeAddHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual([testContext.layoutView, 'foo']);
      expect(testContext.onBeforeAddSpy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([testContext.layoutView, 'foo']);
    });

    it('should trigger a add:region event', function(testContext) {
      expect(testContext.addHandler.mock.calls.map(args => args.slice(0, 3))).toContainEqual([testContext.layoutView, 'foo', testContext.region]);
      expect(testContext.onAddSpy.mock.calls.map(args => args.slice(0, 3))).toContainEqual([testContext.layoutView, 'foo', testContext.region]);
    });
  });

  describe('when adding a region to a layoutView, before it has been rendered', function() {
    beforeEach(function(testContext) {
      testContext.layoutView = new Marionette.View({
        template: testContext.template
      });

      testContext.region = testContext.layoutView.addRegion('foo', '#foo');

      testContext.layoutView.render();

      testContext.view = new TestView();
      testContext.layoutView.getRegion('foo').show(testContext.view);
    });

    it('should add the region to the layoutView after it is rendered', function(testContext) {
      expect(testContext.layoutView.getRegion('foo')).to.equal(testContext.region);
    });

    it('should set the parent of the region to the layoutView', function(testContext) {
      expect(testContext.region.el.parentNode).to.equal(testContext.layoutView.el);
    });

    it('should be able to show a view in the region', function(testContext) {
      expect(testContext.layoutView.getRegion('foo').el.children.length).to.equal(1);
    });
  });

  describe('when adding a region to a layoutView that does not have any regions defined, and re-rendering the layoutView', function() {
    beforeEach(function(testContext) {
      testContext.layoutView = new Marionette.View({
        template: testContext.template
      });

      testContext.region = testContext.layoutView.addRegion('foo', '#foo');

      testContext.layoutView.render();
      testContext.layoutView.render();

      testContext.view = new TestView();
      testContext.layoutView.getRegion('foo').show(testContext.view);
    });

    it('should re-add the region to the layoutView after it is re-rendered', function(testContext) {
      expect(testContext.layoutView.getRegion('foo')).to.equal(testContext.region);
    });

    it('should set the parent of the region to the layoutView', function(testContext) {
      expect(testContext.region.el.parentNode).to.equal(testContext.layoutView.el);
    });

    it('should be able to show a view in the region', function(testContext) {
      expect(testContext.layoutView.getRegion('foo').el.children.length).to.equal(1);
    });
  });

  describe('when adding a region to a layoutView that already has regions defined, and re-rendering the layoutView', function() {
    beforeEach(function(testContext) {
      testContext.layoutView = new Marionette.View({
        regions: {
          bar: '#bar'
        },
        template: testContext.template
      });

      testContext.barRegion = testContext.layoutView.getRegion('bar');

      testContext.region = testContext.layoutView.addRegion('foo', '#foo');

      testContext.layoutView.render();
      testContext.layoutView.render();

      testContext.view = new TestView();
      testContext.layoutView.getRegion('foo').show(testContext.view);
    });

    it('should keep the original regions', function(testContext) {
      expect(testContext.layoutView.getRegion('bar')).to.equal(testContext.barRegion);
    });

    it('should re-add the region to the layoutView after it is re-rendered', function(testContext) {
      expect(testContext.layoutView.getRegion('foo')).to.equal(testContext.region);
    });

    it('should set the parent of the region to the layoutView', function(testContext) {
      testContext.region.show(new TestView());
      expect(testContext.region.el.parentNode).to.equal(testContext.layoutView.el);
    });

    it('should be able to show a view in the region', function(testContext) {
      expect(testContext.layoutView.getRegion('foo').el.children.length).to.equal(1);
    });
  });

  describe('when removing a region from a layoutView', function() {
    beforeEach(function(testContext) {
      testContext.View = Marionette.View.extend({
        template: testContext.template,
        regions: {
          foo: '#foo'
        },
        onBeforeRemoveRegion: function() {},
        onRemoveRegion: function() {}
      });

      testContext.emptyHandler = vi.fn();
      testContext.beforeRemoveHandler = vi.fn();
      testContext.removeHandler = vi.fn();
      testContext.beforeDestroyHandler = vi.fn();
      testContext.destroyHandler = vi.fn();

      testContext.layoutView = new testContext.View();

      testContext.onBeforeRemoveSpy = vi.spyOn(testContext.layoutView, 'onBeforeRemoveRegion');
      testContext.onRemoveSpy = vi.spyOn(testContext.layoutView, 'onRemoveRegion');

      testContext.layoutView.render();
      testContext.layoutView.getRegion('foo').show(new TestView());
      testContext.region = testContext.layoutView.getRegion('foo');

      testContext.region.on('empty', testContext.emptyHandler);
      testContext.layoutView.on('before:remove:region', testContext.beforeRemoveHandler);
      testContext.layoutView.on('remove:region', testContext.removeHandler);
      testContext.region.on('before:destroy', testContext.beforeDestroyHandler);
      testContext.region.on('destroy', testContext.destroyHandler);
      testContext.layoutView.removeRegion('foo');
    });

    it('should empty the region', function(testContext) {
      expect(testContext.emptyHandler).toHaveBeenCalled();
    });

    it('should trigger a before:destroy event on the region', function(testContext) {
      expect(testContext.beforeDestroyHandler.mock.calls.map(args => args.slice(0, 1))).toContainEqual([testContext.region]);
    });

    it('should trigger a destroy event on the region', function(testContext) {
      expect(testContext.destroyHandler.mock.calls.map(args => args.slice(0, 1))).toContainEqual([testContext.region]);
    });

    it('should trigger a before:remove:region event', function(testContext) {
      expect(testContext.onBeforeRemoveSpy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([testContext.layoutView, 'foo']);
      expect(testContext.beforeRemoveHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual([testContext.layoutView, 'foo']);
    });

    it('should trigger a remove:region event', function(testContext) {
      expect(testContext.onRemoveSpy.mock.calls.map(args => args.slice(0, 3))).toContainEqual([testContext.layoutView, 'foo', testContext.region]);
      expect(testContext.removeHandler.mock.calls.map(args => args.slice(0, 3))).toContainEqual([testContext.layoutView, 'foo', testContext.region]);
    });

    it('should remove the region', function(testContext) {
      expect(testContext.layoutView.getRegion('foo')).to.be.undefined;
      expect(testContext.layoutView.regions.foo).to.be.undefined;
    });
  });

  describe('when removing a region and then re-rendering the layoutView', function() {
    beforeEach(function(testContext) {
      testContext.View = Marionette.View.extend({
        template: testContext.template,
        regions: {
          foo: '#foo'
        }
      });

      testContext.layoutView = new testContext.View();

      testContext.layoutView.render();
      testContext.layoutView.getRegion('foo').show(new TestView());

      testContext.layoutView.removeRegion('foo');
      testContext.layoutView.render();

      testContext.region = testContext.layoutView.getRegion('foo');
    });

    it('should not re-attach the region to the layoutView', function(testContext) {
      expect(testContext.region).to.be.undefined;
    });
  });

  describe('when adding a region to a layoutView then destroying the layoutView', function() {
    beforeEach(function(testContext) {
      testContext.emptyHandler = vi.fn();
      testContext.layoutView = new Marionette.View({
        template: testContext.template
      });

      testContext.layoutView.render();

      testContext.region = testContext.layoutView.addRegion('foo', '#foo');
      testContext.region.on('empty', testContext.emptyHandler);

      testContext.view = new TestView();
      testContext.layoutView.getRegion('foo').show(testContext.view);

      testContext.layoutView.destroy();
    });

    it('should empty the region', function(testContext) {
      expect(testContext.emptyHandler).toHaveBeenCalled();
    });
  });

  describe('when calling emptyRegions', function() {
    beforeEach(function(testContext) {

      testContext.view = new Marionette.View({
        template: testContext.template
      });
      testContext.view.render();
      testContext.region = testContext.view.addRegion('foo', '#foo');
      testContext.regions = testContext.view.getRegions();
      testContext.region.show(new TestView());

      testContext.emptyHandler = vi.fn();
      testContext.region.on('empty', testContext.emptyHandler);

      vi.spyOn(testContext.view, 'emptyRegions');
      testContext.view.emptyRegions();
    });

    it('should empty all regions', function(testContext) {
      expect(testContext.emptyHandler).toHaveBeenCalled();
    });

    it('should not remove all regions', function(testContext) {
      expect(testContext.view.getRegion('foo')).to.equal(testContext.region);
    });

    it('should return the regions', function(testContext) {
      expect(testContext.view.emptyRegions.mock.results.at(0).value).to.have.property('foo', testContext.region);
    });
  });
});
