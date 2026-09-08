import { vi, describe, it, expect, beforeEach } from 'vitest';
import '../../setup/backbone.js';
// Anything related to emptyView

import _ from 'underscore';
import Backbone from 'backbone';
import { CollectionView } from 'marionette';
import { View } from 'marionette';
import { Region } from 'marionette';
import { Events } from '@marionette/utils';

describe('CollectionView -  Empty', function() {
  let MyEmptyView;
  let MyCollectionView;

  beforeEach(function() {
    const MyChildView = View.extend({
      template: _.noop
    });

    MyEmptyView = View.extend({
      template: _.template('Empty')
    });

    MyCollectionView = CollectionView.extend({
      childView: MyChildView,
      emptyView: MyEmptyView
    });
  });

  describe('when instantiating a CollectionView', function() {
    let myCollectionView;

    beforeEach(function() {
      vi.spyOn(MyCollectionView.prototype, 'getEmptyRegion');
      myCollectionView = new MyCollectionView();
    });

    it('should be replaceElement: false', function() {
      Region.prototype.replaceElement = true;
      expect(myCollectionView.getEmptyRegion().replaceElement).toBe(false);
      Region.prototype.replaceElement = false;
    });

    it('should instantiate the emptyRegion', function() {
      expect(myCollectionView.getEmptyRegion).toHaveBeenCalledTimes(1);
    });

    describe('when destroying the collectionView', function() {
      it('should destroy the region', function() {
        const emptyRegion = myCollectionView.getEmptyRegion();
        myCollectionView.destroy();
        expect(emptyRegion.isDestroyed()).toBe(true);
      });
    });
  });

  describe('when rendering an empty collectionview during instantiation', function() {
    it('should show the view in the emptyRegion', function() {
      const collection = new Backbone.Collection();

      const MyInitCollectionView = MyCollectionView.extend({
        initialize() {
          this.render();
        }
      });

      const myCollectionView = new MyInitCollectionView({ collection });

      expect(myCollectionView.getEmptyRegion().hasView()).toBe(true);
    });
  });

  describe('when an emptyView is rendered', function() {
    let emptyViewRenderStub;
    let myCollectionView;

    beforeEach(function() {
      const collection = new Backbone.Collection();

      emptyViewRenderStub = vi.fn();

      myCollectionView = new MyCollectionView({
        collection,
        childViewEvents: {
          'render': emptyViewRenderStub
        }
      });

      myCollectionView.render();
    });

    it('should trigger child events on the collectionView', function() {
      expect(emptyViewRenderStub).toHaveBeenCalledTimes(1);
    });

    describe('when the collection is no longer empty', function() {
      it('should empty the emptyRegion', function() {
        const emptyRegionEmptyStub = vi.fn();
        myCollectionView.getEmptyRegion().on('empty', emptyRegionEmptyStub);
        myCollectionView.collection.add({ id: 1 });
        expect(emptyRegionEmptyStub).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when rendering in a template', function() {
    it('should show the emptyView inside the childViewContainer', function() {
      const TemplatedCollectionView = MyCollectionView.extend({
        childViewContainer: '#region',
        template: _.template('<div id="region"></div>')
      });

      const cv = new TemplatedCollectionView({
        collection: new Backbone.Collection()
      });

      cv.render();

      expect(cv.el.querySelector('#region').textContent).toEqual('Empty');
    });
  });

  describe('#getEmptyRegion', function() {
    let collection;
    let myCollectionView;

    beforeEach(function() {
      collection = new Backbone.Collection();
      myCollectionView = new MyCollectionView({ collection });
    });

    it('should return the empty region for the collectionView el', function() {
      expect(myCollectionView.getEmptyRegion().el).to.equal(myCollectionView.el);
    });

    it('should return the same region on subsequent calls', function() {
      const emptyRegion = myCollectionView.getEmptyRegion();

      expect(myCollectionView.getEmptyRegion()).to.equal(emptyRegion);
    });

    // Internal implementation detail, but needs to be tested
    it('destroys its owned empty Region', function() { const region = myCollectionView.getEmptyRegion(); myCollectionView.destroy(); expect(region.isDestroyed()).toBe(true); });

    it('should return a new emptyRegion instance if the current is destroyed', function() {
      const emptyRegion = myCollectionView.getEmptyRegion();
      emptyRegion.destroy();

      expect(myCollectionView.getEmptyRegion()).to.not.equal(emptyRegion);
      expect(myCollectionView.getEmptyRegion().el).to.equal(myCollectionView.el);
    });
  });

  describe('#emptyView', function() {
    const collection = new Backbone.Collection();
    const OtherView = View.extend({ template: () => '' });
    _.extend(OtherView.prototype, Events);

    describe('when emptyView is omitted, undefined, null, or false', function() {
      [
        ['omitted', undefined],
        ['undefined', undefined],
        ['null', null],
        ['false', false],
      ].forEach(([name, emptyView]) => {
        it(`does not show an emptyView when ${name}`, function() {
          const options = { collection };
          if (name !== 'omitted') { options.emptyView = emptyView; }
          const myCollectionView = new CollectionView(options);

          vi.spyOn(myCollectionView.getEmptyRegion(), 'show');
          myCollectionView.render();

          expect(myCollectionView.getEmptyRegion().show).not.toHaveBeenCalled();
          myCollectionView.destroy();
        });
      });
    });

    ['filter', 'render'].forEach(method => {
      [undefined, null, false].forEach(disabled => {
        it(`removes the current emptyView when its resolver returns ${disabled} during ${method}`, function() {
          let EmptyView = OtherView;
          const myCollectionView = new CollectionView({
            collection,
            emptyView() { return EmptyView; }
          }).render();
          const emptyRegion = myCollectionView.getEmptyRegion();
          const previous = emptyRegion.currentView;

          EmptyView = disabled;
          myCollectionView[method]();

          expect(previous.isDestroyed()).toBe(true);
          expect(emptyRegion.hasView()).toBe(false);
          expect(myCollectionView.el.childNodes.length).to.equal(0);

          EmptyView = OtherView;
          myCollectionView[method]();
          expect(emptyRegion.currentView).to.be.instanceOf(OtherView).and.not.equal(previous);
          myCollectionView.destroy();
        });
      });
    });

    describe('when emptyView is a Marionette View subclass', function() {
      it('should show an emptyView from the defined view', function() {
        const MyView = View.extend({ template: _.noop });
        const myCollectionView = new CollectionView({
          collection,
          emptyView: MyView
        });

        vi.spyOn(myCollectionView.getEmptyRegion(), 'show');
        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().show).toHaveBeenCalledTimes(1);
        expect(myCollectionView.getEmptyRegion().show.mock.calls.map(args => args.slice(0, 1))).toContainEqual([expect.any(MyView)]);
      });

      it('does not read remove when the view has a valid destroy method', function() {
        const MyView = View.extend({ template: _.noop });
        Object.defineProperty(MyView.prototype, 'remove', {
          get() {
            throw new Error('remove should not be read');
          },
        });
        const myCollectionView = new CollectionView({ collection, emptyView: MyView });

        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().currentView).to.be.instanceOf(MyView);
        myCollectionView.destroy();
      });
    });

    describe('when emptyView is a Marionette View', function() {
      it('should show an emptyView from the defined view', function() {
        const myCollectionView = new CollectionView({
          collection,
          emptyView: OtherView
        });

        vi.spyOn(myCollectionView.getEmptyRegion(), 'show');
        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().show).toHaveBeenCalledTimes(1);
        expect(myCollectionView.getEmptyRegion().show.mock.calls.map(args => args.slice(0, 1))).toContainEqual([expect.any(OtherView)]);
      });
    });

    describe('when emptyView is a function returning a view', function() {
      [undefined, null, false].forEach(emptyView => {
        it(`does not show an emptyView when the resolver returns ${emptyView}`, function() {
          const myCollectionView = new CollectionView({
            collection,
            emptyView() {
              return emptyView;
            },
          });

          vi.spyOn(myCollectionView.getEmptyRegion(), 'show');
          myCollectionView.render();

          expect(myCollectionView.getEmptyRegion().show).not.toHaveBeenCalled();
          myCollectionView.destroy();
        });
      });

      it('shows the returned view and calls an ordinary resolver on the CollectionView', function() {
        const emptyViewStub = vi.fn();
        emptyViewStub.mockReturnValue(OtherView);

        const myCollectionView = new CollectionView({
          collection,
          emptyView: emptyViewStub
        });

        vi.spyOn(myCollectionView.getEmptyRegion(), 'show');
        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().show).toHaveBeenCalledTimes(1);
        expect(myCollectionView.getEmptyRegion().show.mock.calls.map(args => args.slice(0, 1))).toContainEqual([expect.any(OtherView)]);
        expect(emptyViewStub).toHaveBeenCalledTimes(1);
        expect(emptyViewStub.mock.contexts).toContain(myCollectionView);
        myCollectionView.destroy();
      });

      it('supports an arrow resolver', function() {
        const myCollectionView = new CollectionView({
          collection,
          emptyView: () => OtherView,
        });

        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().currentView).to.be.instanceOf(OtherView);
        myCollectionView.destroy();
      });

      it('supports a bound resolver', function() {
        const boundContext = {};
        const resolver = function() {
          expect(this).to.equal(boundContext);
          return OtherView;
        }.bind(boundContext);
        const myCollectionView = new CollectionView({ collection, emptyView: resolver });

        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().currentView).to.be.instanceOf(OtherView);
        myCollectionView.destroy();
      });

      it('supports a method-shorthand resolver with the CollectionView context', function() {
        let context;
        const resolver = {
          resolve() {
            context = this;
            return OtherView;
          },
        }.resolve;
        const myCollectionView = new CollectionView({ collection, emptyView: resolver });

        myCollectionView.render();

        expect(context).to.equal(myCollectionView);
        expect(myCollectionView.getEmptyRegion().currentView).to.be.instanceOf(OtherView);
        myCollectionView.destroy();
      });
    });

    it('propagates an error thrown by the resolver unchanged', function() {
      const error = new Error('resolver failed');
      const myCollectionView = new CollectionView({
        collection,
        emptyView() {
          throw error;
        },
      });

      expect(() => myCollectionView.render()).to.throw(error);
      myCollectionView.destroy();
    });

    it('waits to resolve the emptyView until the CollectionView is empty', function() {
      const nonemptyCollection = new Backbone.Collection([{ id: 1 }]);
      const ChildView = View.extend({ template: _.noop });
      const emptyView = vi.fn().mockReturnValue(null);
      const myCollectionView = new CollectionView({
        childView: ChildView,
        collection: nonemptyCollection,
        emptyView,
      });

      expect(() => myCollectionView.render()).not.to.throw();
      expect(emptyView).not.toHaveBeenCalled();
      expect(() => nonemptyCollection.reset()).not.to.throw();
      expect(emptyView).toHaveBeenCalledTimes(1);
      expect(emptyView.mock.contexts).toContain(myCollectionView);
      expect(myCollectionView.getEmptyRegion().hasView()).toBe(false);

      myCollectionView.destroy();
    });
  });

  describe('#emptyViewOptions', function() {
    describe('when emptyViewOptions is a function', function() {
      const collection = new Backbone.Collection();
      const MyView = View.extend({ template: _.noop });
      const emptyViewOptions = { foo: 'bar' };

      let myCollectionView;
      let emptyViewOptionsStub;

      beforeEach(function() {
        emptyViewOptionsStub = vi.fn();
        emptyViewOptionsStub.mockReturnValue(emptyViewOptions);

        myCollectionView = new CollectionView({
          collection,
          emptyView: MyView,
          emptyViewOptions: emptyViewOptionsStub
        });

        myCollectionView.render();
      });

      it('should show an emptyView with the emptyViewOptions', function() {
        const emptyView = myCollectionView.getEmptyRegion().currentView;
        expect(emptyView.options).to.deep.equal(emptyViewOptions);
      });

      it('should call childViewOptions', function() {
        expect(emptyViewOptionsStub).toHaveBeenCalledTimes(1);
      });
    });

    describe('when emptyViewOptions is undefined', function() {
      const collection = new Backbone.Collection();
      const MyView = View.extend({ template: _.noop });
      const childViewOptions = { foo: 'bar' };

      let myCollectionView;
      let childViewOptionsStub;

      beforeEach(function() {
        childViewOptionsStub = vi.fn();
        childViewOptionsStub.mockReturnValue(childViewOptions);

        myCollectionView = new CollectionView({
          collection,
          emptyView: MyView,
          childViewOptions: childViewOptionsStub
        });

        myCollectionView.render();
      });

      it('should show an emptyView with the emptyViewOptions', function() {
        const emptyView = myCollectionView.getEmptyRegion().currentView;
        expect(emptyView.options).to.deep.equal(childViewOptions);
      });

      it('should call childViewOptions', function() {
        expect(childViewOptionsStub).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('#isEmpty', function() {
    describe('when rendering a collectionView', function() {
      let myCollectionView;

      beforeEach(function() {
        const collection = new Backbone.Collection([{ id: 1 }, { id: 2 }]);
        myCollectionView = new MyCollectionView({ collection });
        vi.spyOn(myCollectionView, 'isEmpty');
        myCollectionView.render();
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).toHaveBeenCalledTimes(1);
      });

      it('should not show the emptyView', function() {
        expect(myCollectionView.getEmptyRegion().hasView()).toBe(false);
      });

      describe('when removing one child', function() {
        beforeEach(function() {
          myCollectionView.isEmpty.mockClear();
          myCollectionView.removeChildView(myCollectionView.children.first());
        });

        it('should call isEmpty', function() {
          expect(myCollectionView.isEmpty).toHaveBeenCalledTimes(1);
        });

        it('should not show the emptyView', function() {
          expect(myCollectionView.getEmptyRegion().hasView()).toBe(false);
        });
      });

      describe('when removing the only child', function() {
        beforeEach(function() {
          myCollectionView.removeChildView(myCollectionView.children.first());
          myCollectionView.isEmpty.mockClear();
          myCollectionView.removeChildView(myCollectionView.children.first());
        });

        it('should call isEmpty', function() {
          expect(myCollectionView.isEmpty).toHaveBeenCalledTimes(1);
        });

        it('should show the emptyView', function() {
          expect(myCollectionView.getEmptyRegion().hasView()).toBe(true);
        });
      });
    });

    describe('when rendering an empty collectionView', function() {
      let myCollectionView;

      beforeEach(function() {
        const collection = new Backbone.Collection();
        myCollectionView = new MyCollectionView({ collection });
        vi.spyOn(myCollectionView, 'isEmpty');
        myCollectionView.render();
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).toHaveBeenCalledTimes(1);
      });

      it('should show the emptyView', function() {
        expect(myCollectionView.getEmptyRegion().hasView()).toBe(true);
      });
    });

    describe('when filtering some views from a collectionView', function() {
      let myCollectionView;

      beforeEach(function() {
        const collection = new Backbone.Collection([{ id: 1 }, { id: 2 }]);
        myCollectionView = new MyCollectionView({ collection });
        myCollectionView.render();
        vi.spyOn(myCollectionView, 'isEmpty');
        myCollectionView.setFilter(view => {
          return view.model.id === 1;
        });
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).toHaveBeenCalledTimes(1);
      });

      it('should not show the emptyView', function() {
        expect(myCollectionView.getEmptyRegion().hasView()).toBe(false);
      });
    });

    describe('when filtering all views from a collectionView', function() {
      let myCollectionView;

      beforeEach(function() {
        const collection = new Backbone.Collection([{ id: 1 }]);
        myCollectionView = new MyCollectionView({ collection });
        myCollectionView.render();
        vi.spyOn(myCollectionView, 'isEmpty');
        myCollectionView.setFilter(_.constant(false));
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).toHaveBeenCalledTimes(1);
      });

      it('should show the emptyView', function() {
        expect(myCollectionView.getEmptyRegion().hasView()).toBe(true);
      });
    });
  });
});


describe('empty Region follows the public child container', () => {
  it('reuses the empty Region across replaced and relocated template containers', () => {
    const destroyed = vi.fn();
    const Empty = View.extend({ template: () => 'Empty', onDestroy: destroyed });
    const Item = View.extend({ template: () => 'Item' });
    const collection = new Backbone.Collection();
    let selector = '.first';
    const list = new CollectionView({
      collection,
      childView: Item,
      emptyView: Empty,
      childViewContainer: () => selector,
      template: () => '<section class="first"></section><section class="second"></section>'
    });
    const root = list.el;
    const emptyRegion = list.getEmptyRegion();
    list.render();
    let previousContainer = root.querySelector(selector);
    let previousEmpty = emptyRegion.currentView;
    expect(emptyRegion.el).toBe(previousContainer);
    expect(previousEmpty.el.parentNode).toBe(previousContainer);
    for (const nextSelector of ['.first', '.second']) {
      selector = nextSelector;
      list.render();
      const container = root.querySelector(selector);
      expect(list.el).toBe(root);
      expect(container).not.toBe(previousContainer);
      expect(previousContainer.isConnected).toBe(false);
      expect(previousEmpty.isDestroyed()).toBe(true);
      expect(list.getEmptyRegion()).toBe(emptyRegion);
      expect(emptyRegion.el).toBe(container);
      expect(emptyRegion.currentView.el.parentNode).toBe(container);
      expect(root.textContent).toBe('Empty');
      previousContainer = container;
      previousEmpty = emptyRegion.currentView;
    }
    expect(destroyed).toHaveBeenCalledTimes(2);
    collection.add({ id: 1 });
    expect(emptyRegion.hasView()).toBe(false);
    expect(previousEmpty.isDestroyed()).toBe(true);
    expect(root.querySelector(selector).textContent).toBe('Item');
    collection.reset([]);
    expect(emptyRegion.currentView.el.parentNode).toBe(root.querySelector(selector));
    list.destroy();
    expect(emptyRegion.isDestroyed()).toBe(true);
    expect(destroyed).toHaveBeenCalledTimes(4);
  });

  it('keeps the same root as the empty Region target across repeated rendering', () => {
    const Empty = View.extend({ template: () => 'Empty' });
    const list = new CollectionView({ template: false, emptyView: Empty }).render();
    const region = list.getEmptyRegion();
    const first = region.currentView;
    list.render();
    expect(list.getEmptyRegion()).toBe(region);
    expect(region.el).toBe(list.el);
    expect(first.isDestroyed()).toBe(true);
    expect(region.currentView.el.parentNode).toBe(list.el);
    expect(list.el.textContent).toBe('Empty');
    list.destroy();
  });
});
