import { Region, Behavior } from 'marionette';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setFixtures } from '../../setup/fixtures.js';
import '../../setup/backbone.js';
// Life-cycle and base functions

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import { CollectionView } from 'marionette';
import { View } from 'marionette';
import { Events } from '@marionette/utils';

describe('CollectionView', function() {
  let MyChildView;
  let OtherChildView;

  beforeEach(function() {
    MyChildView = View.extend({
      template: _.noop,
      onBeforeRender: vi.fn(),
      onRender: vi.fn(),
      onBeforeDestroy: vi.fn(),
      onDestroy: vi.fn(),
    });

    OtherChildView = View.extend({
      template: () => '',
      onBeforeRender: vi.fn(),
      onRender: vi.fn(),
      onBeforeDestroy: vi.fn(),
      onDestroy: vi.fn(),
    });
    _.extend(OtherChildView.prototype, Events);
  });

  describe('#constructor', function() {
    let MyCollectionView;

    beforeEach(function() {
      MyCollectionView = CollectionView.extend({
        childView: MyChildView
      });
    });

    describe('when passing in options', function() {
      let collectionView;

      const mergeOptions = {
        behaviors: {},
        childView: {},
        childViewContainer: {},
        childViewEventPrefix: 'child',
        childViewEvents: {},
        childViewOptions: {},
        childViewTriggers: {},
        collectionEvents: {},
        emptyView: {},
        emptyViewOptions: {},
        modelEvents: {},
        sortWithCollection: {},
        template: {},
        templateContext: {},
        triggers: {},
        ui: {},
        viewComparator: {},
        viewFilter: {}
      };

      beforeEach(function() {
        collectionView = new MyCollectionView(mergeOptions);
      });

      // NOTE: `events` is purposefully left out as it is handled by
      // backbone.js and is mutated on instantiation
      _.each(mergeOptions, function(value, key) {
        it(`should merge option ${ key }`, function() {
          expect(collectionView[key]).to.equal(value);
        });
      });

      // _setOptions
      it('should attach options to the collectionView', function() {
        expect(collectionView.options).to.deep.equal(mergeOptions);
      });
    });

    it('allows initialize to observe later attachment', function() {
      let attached = 0;
      const List = MyCollectionView.extend({ initialize() { this.on('attach', () => attached++); } });
      const el = document.createElement('main'); document.body.append(el);
      const region = new Region({ el }); region.show(new List());
      expect(attached).toBe(1); region.destroy(); el.remove();
    });

    it('should have a valid inheritance chain back to Backbone.View', function() {
      const options = {foo: 'bar'};
      const customParam = {foo: 'baz'};

      const TestView = MyCollectionView.extend({
        initialize: vi.fn()
      })

      const testView = new TestView(options, customParam);

      expect(testView.initialize).toHaveBeenCalledTimes(1);
      expect(testView.initialize.mock.calls.map(args => args.slice(0, 2))).toContainEqual([options, customParam]);
    });

    it('should call initialize prior to delegateEntityEvents', function() {
      vi.spyOn(MyCollectionView.prototype, 'initialize').mockImplementation(() => undefined);
      vi.spyOn(MyCollectionView.prototype, 'delegateEntityEvents').mockImplementation(() => undefined);

      const myCollectionView = new MyCollectionView();

      expect(myCollectionView.initialize).toHaveBeenCalledBefore(myCollectionView.delegateEntityEvents);
    });

    it('should call initialize prior to constructing the empty Region', function() {
      vi.spyOn(MyCollectionView.prototype, 'initialize').mockImplementation(() => undefined);
      vi.spyOn(MyCollectionView.prototype, 'getEmptyRegion');

      const myCollectionView = new MyCollectionView();

      expect(myCollectionView.initialize).toHaveBeenCalledBefore(myCollectionView.getEmptyRegion);
    });

    it('notifies configured behaviors of parent initialization', function() {
      const onInitialize = vi.fn();
      const Observer = Behavior.extend({ onInitialize });
      const options = { foo: 'bar', behaviors: [Observer] };
      const owner = new MyCollectionView(options);
      expect(onInitialize).toHaveBeenCalledOnce();
      expect(onInitialize).toHaveBeenCalledWith(owner, options);
      owner.destroy();
    });
  });

  describe('#childView', function() {
    const collection = new Backbone.Collection([{ id: 1 }]);
    const model = collection.get(1);

    beforeEach(function() {
      vi.spyOn(CollectionView.prototype, 'buildChildView');
    });

    describe('when childView is falsey', function() {
      it('should throw NoChildViewError', function() {
        const myCollectionView = new CollectionView({ collection });

        expect(myCollectionView.render.bind(myCollectionView)).to.throw('A "childView" must be specified')
          .with.property('code', 'MN0011');
      });
    });

    describe('when childView is a Marionette View subclass', function() {
      it('should build children from the defined view', function() {
        const MyView = View.extend({ template: _.noop });
        const myCollectionView = new CollectionView({
          collection,
          childView: MyView
        });
        myCollectionView.render();

        expect(myCollectionView.buildChildView.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, MyView]);
      });
    });

    describe('when childView is a Marionette View', function() {
      it('should build children from the defined view', function() {
        let OtherView = View.extend({ template: () => '' });
        _.extend(OtherView.prototype, Events);
        const myCollectionView = new CollectionView({
          collection,
          childView: OtherView
        });
        myCollectionView.render();

        expect(myCollectionView.buildChildView.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, OtherView]);
      });
    });

    describe('when childView is a function returning a view', function() {
      let myCollectionView;
      let childViewStub;
      let OtherView = View.extend({ template: () => '' });
      _.extend(OtherView.prototype, Events);
      beforeEach(function() {
        childViewStub = vi.fn();
        childViewStub.mockReturnValue(OtherView);

        myCollectionView = new CollectionView({
          collection,
          childView: childViewStub
        });
        myCollectionView.render();
      });

      it('should build children from the returned view', function() {
        expect(myCollectionView.buildChildView.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, OtherView]);
      });

      it('should call childView with the model', function() {
        expect(childViewStub).toHaveBeenCalledTimes(1);
        expect(childViewStub.mock.calls.map(args => args.slice(0, 1))).toContainEqual([model]);
      });
    });

    it('resolves a concise childView method for each model', function() {
      const ChildList = CollectionView.extend({
        childView(child) {
          expect(this.collection).to.equal(collection);
          expect(child).to.equal(model);
          return MyChildView;
        }
      });
      const view = new ChildList({ collection }).render();

      expect(view.children.first()).to.be.instanceOf(MyChildView);
      view.destroy();
    });

    it('resolves an arrow childView factory', function() {
      const view = new CollectionView({
        collection,
        childView: child => child === model ? MyChildView : OtherChildView
      }).render();

      expect(view.children.first()).to.be.instanceOf(MyChildView);
      view.destroy();
    });

    it('resolves a native class childView method', function() {
      class ChildList extends CollectionView {
        childView(child) {
          expect(this.collection).to.equal(collection);
          expect(child).to.equal(model);
          return MyChildView;
        }
      }
      const view = new ChildList({ collection }).render();

      expect(view.children.first()).to.be.instanceOf(MyChildView);
      view.destroy();
    });

  });

  describe('#childViewOptions', function() {
    describe('when childViewOptions is a function', function() {
      const collection = new Backbone.Collection([{ id: 1 }]);
      const model = collection.get(1);
      const childViewOptions = {};

      let myCollectionView;
      let childViewOptionsStub;
      let childView;

      beforeEach(function() {
        childView = OtherChildView;

        childViewOptionsStub = vi.fn();
        childViewOptionsStub.mockReturnValue(childViewOptions);
        vi.spyOn(CollectionView.prototype, 'buildChildView');

        myCollectionView = new CollectionView({
          collection,
          childView,
          childViewOptions: childViewOptionsStub
        });

        myCollectionView.render();
      });

      it('should call buildChildView with childViewOptions results', function() {
        expect(myCollectionView.buildChildView.mock.calls.map(args => args.slice(0, 3))).toContainEqual([model, childView, childViewOptions]);
      });

      it('should call childViewOptions with child model', function() {
        expect(childViewOptionsStub).toHaveBeenCalledTimes(1);
        expect(childViewOptionsStub.mock.calls.map(args => args.slice(0, 1))).toContainEqual([model]);
      });
    });
  });

  describe('#buildChildView', function() {
    it('should call buildChildView with arguments', function() {
      const collection = new Backbone.Collection([{ id: 1 }]);
      const model = collection.get(1);
      const childView = OtherChildView;
      const childViewOptions = {};

      vi.spyOn(CollectionView.prototype, 'buildChildView');

      const myCollectionView = new CollectionView({
        collection,
        childView,
        childViewOptions
      });

      myCollectionView.render();
      expect(myCollectionView.buildChildView.mock.calls.map(args => args.slice(0, 3))).toContainEqual([model, childView, childViewOptions]);
    });

    it('merges only own child view options', function() {
      const defaultModel = new Backbone.Model({ id: 'default' });
      const configuredModel = new Backbone.Model({ id: 'configured' });
      const protoValue = { polluted: true };
      const childViewOptions = Object.assign(Object.create({ inherited: true }), {
        model: configuredModel,
        owned: true
      });
      Object.defineProperty(childViewOptions, '__proto__', {
        enumerable: true,
        value: protoValue
      });
      let capturedOptions;
      const ChildView = function(options) {
        capturedOptions = options;
      };
      const collectionView = new CollectionView();

      collectionView.buildChildView(defaultModel, ChildView, childViewOptions);

      expect(capturedOptions).to.include({ model: configuredModel, owned: true });
      expect(capturedOptions).to.not.have.property('inherited');
      expect(Object.getPrototypeOf(capturedOptions)).to.equal(Object.prototype);
      expect(Object.hasOwn(capturedOptions, '__proto__')).toBe(true);
      expect(Object.getOwnPropertyDescriptor(capturedOptions, '__proto__').value)
        .to.equal(protoValue);
    });
  });

  describe('element initialization', function() {

    describe('when the view does not have an attach el', function() {
      it('should not mark the view as attached', function() {
        const myCollectionView = new CollectionView({ el: $('<div>')[0] });

        expect(myCollectionView.isAttached()).toBe(false);
      });
    });

    describe('when the view is given an attach el', function() {
      it('should mark the view as attached', function() {
        setFixtures('<div id="attached"></div>');
        const myCollectionView = new CollectionView({ el: $('#attached')[0] });

        expect(myCollectionView.isAttached()).toBe(true);
      });
    });
  });

  describe('#render', function() {
    let myCollectionView;

    beforeEach(function() {
      const MyCollectionView = CollectionView.extend({
        onBeforeRender: vi.fn(),
        onRender: vi.fn(),
      });

      myCollectionView = new MyCollectionView();
      vi.spyOn(myCollectionView, 'render');
    });

    it('provides serialized collection data to its template as models', function() {
      const template = vi.fn(() => '');
      const view = new CollectionView({
        collection: new Backbone.Collection(),
        template,
      });

      view.render();

      expect(template).toHaveBeenCalledTimes(1);
      expect(template.mock.calls.map(args => args.slice(0, 1))).toContainEqual([{ models: [] }]);
      expect(template.mock.calls.at(0)[0]).to.not.have.property('items');
    });

    describe('when the view is not destroyed', function() {
      beforeEach(function() {
        myCollectionView.render();
      });

      it('should set isRendered to true', function() {
        expect(myCollectionView.isRendered()).toBe(true);
      });

      it('should call "before:render" event', function() {
        expect(myCollectionView.onBeforeRender).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onBeforeRender.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView]);
      });

      it('should call "render" event', function() {
        expect(myCollectionView.onRender).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onRender.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView]);
      });

      it('should return the collectionView instance', function() {
        expect(myCollectionView.render).toHaveReturnedWith(myCollectionView);
      });

    });

    describe('when the view is destroyed', function() {
      it('should treat repeated renders as idempotent no-ops', function() {
        const template = vi.fn(() => '<div class="children"></div>');
        const childTemplate = vi.fn(() => '<span>Child</span>');
        const childInitialize = vi.fn();
        const ChildView = View.extend({
          initialize: childInitialize,
          template: childTemplate,
        });
        const DestroyedCollectionView = CollectionView.extend({
          childView: ChildView,
          childViewContainer: '.children',
          onBeforeRender: vi.fn(),
          onRender: vi.fn(),
          template,
        });
        myCollectionView = new DestroyedCollectionView({
          collection: new Backbone.Collection([{}, {}]),
        });
        myCollectionView.render();
        const childViews = myCollectionView.children.map(view => view);
        myCollectionView.destroy();

        const sentinel = document.createElement('span');
        sentinel.textContent = 'Unmanaged content';
        myCollectionView.el.append(sentinel);
        const destroyedHtml = myCollectionView.el.innerHTML;
        template.mockClear();
        childTemplate.mockClear();
        childInitialize.mockClear();
        myCollectionView.onBeforeRender.mockClear();
        myCollectionView.onRender.mockClear();
        const getTemplate = vi.spyOn(myCollectionView, 'getTemplate');

        expect(myCollectionView.render()).to.equal(myCollectionView);
        expect(myCollectionView.render()).to.equal(myCollectionView);

        expect(getTemplate).not.toHaveBeenCalled();
        expect(template).not.toHaveBeenCalled();
        expect(childTemplate).not.toHaveBeenCalled();
        expect(childInitialize).not.toHaveBeenCalled();
        expect(myCollectionView.onBeforeRender).not.toHaveBeenCalled();
        expect(myCollectionView.onRender).not.toHaveBeenCalled();
        expect(myCollectionView.el.innerHTML).to.equal(destroyedHtml);
        expect(myCollectionView.el.lastChild).to.equal(sentinel);
        expect(myCollectionView.isRendered()).toBe(false);
        expect(myCollectionView.isAttached()).toBe(false);
        expect(myCollectionView.isDestroyed()).toBe(true);
        expect(myCollectionView.children).to.have.length(0);
        childViews.forEach(view => expect(view.isDestroyed()).toBe(true));
      });
    });
  });
});
