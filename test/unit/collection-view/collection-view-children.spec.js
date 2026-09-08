import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setFixtures } from '../../setup/fixtures.js';
import * as Marionette from '../../../src/index.ts';
import '../../setup/backbone.js';
// Tests for the children container integration

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import CollectionView from '../../../src/modules/collection-view';
import ChildViewContainer from '../../../src/modules/child-view-container';
import View from '../../../src/modules/view';
import Region from '../../../src/modules/region';

describe('CollectionView Children', function() {
  const collection = new Backbone.Collection([
    { id: 1 },
    { id: 2 },
    { id: 3 }
  ]);
  let MyCollectionView;

  beforeEach(function() {
    const MyChildView = View.extend({
      template: _.noop
    });

    MyCollectionView = CollectionView.extend({
      childView: MyChildView
    });
  });

  it('collects attachments after all child render hooks finish', function() {
    const collectionView = new CollectionView({ viewComparator: false });
    const first = new View({ template: false });
    const second = new View({ template: () => '' });
    collectionView.render();
    collectionView.addChildView(first);
    second.on('render', () => first.el.remove());

    const attached = [];
    collectionView.attachHtml = function(buffer, container) {
      attached.push(...buffer.childNodes);
      container.append(buffer);
    };
    collectionView.addChildView(second);

    expect(attached).to.deep.equal([first.el, second.el]);
    collectionView.destroy();
  });

  describe('when instantiating a CollectionView', function() {
    let myCollectionView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView();
    });

    it('should instantiate the children container', function() {
      expect(myCollectionView.children).to.be.instanceOf(ChildViewContainer);
    });

    it('should instantiate the children container', function() {
      expect(myCollectionView.children).to.be.instanceOf(ChildViewContainer);
    });
  });

  describe('when rendering a CollectionView', function() {
    let myCollectionView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({ collection });
      myCollectionView.onBeforeRenderChildren = vi.fn();
      myCollectionView.onRenderChildren = vi.fn();
      myCollectionView.onBeforeAddChild = vi.fn();
      myCollectionView.onAddChild = vi.fn();

      vi.spyOn(myCollectionView.children, '_add');
      myCollectionView.render();
    });

    it('should add children to match the collection', function() {
      collection.each((model, index) => {
        const args = myCollectionView.children._add.mock.calls[index];
        expect(args[0].model).to.equal(model);
        expect(args[1]).to.equal(undefined);
      });
    });

    it('should trigger "before:render:children"', function() {
      expect(myCollectionView.onBeforeRenderChildren).toHaveBeenCalledTimes(1);
      expect(myCollectionView.onBeforeRenderChildren.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, myCollectionView.children._views]);
    });

    it('should trigger "render:children"', function() {
      expect(myCollectionView.onRenderChildren).toHaveBeenCalledTimes(1);
      expect(myCollectionView.onRenderChildren.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, myCollectionView.children._views]);
    });

    it('should trigger "before:add:child" for each model', function() {
      collection.each((model, index) => {
        const args = myCollectionView.onBeforeAddChild.mock.calls[index];
        expect(args[0]).to.equal(myCollectionView);
        expect(args[1].model).to.equal(model);
      });
    });

    it('should trigger "add:child" for each model', function() {
      collection.each((model, index) => {
        const args = myCollectionView.onAddChild.mock.calls[index];
        expect(args[0]).to.equal(myCollectionView);
        expect(args[1].model).to.equal(model);
      });
    });
  });

  describe('#swapChildViews', function() {
    let collectionView;

    beforeEach(function() {
      collectionView = new MyCollectionView({ collection });
      collectionView.render();
    });

    describe('when both children are in the collectionview', function() {
      let view1;
      let view2;

      beforeEach(function() {
        view1 = collectionView.children.first();
        view2 = collectionView.children.last();
      });

      it('should swap the children', function() {
        vi.spyOn(collectionView.children, '_swap');

        collectionView.swapChildViews(view1, view2);

        expect(collectionView.children._swap).toHaveBeenCalledTimes(1);
        expect(collectionView.children._swap.mock.calls.map(args => args.slice(0, 2))).toContainEqual([view1, view2]);
      });

      it('should swap the filtered children', function() {
        vi.spyOn(collectionView.children, '_swap');

        collectionView.swapChildViews(view1, view2);

        expect(collectionView.children._swap).toHaveBeenCalledTimes(1);
        expect(collectionView.children._swap.mock.calls.map(args => args.slice(0, 2))).toContainEqual([view1, view2]);
      });

      it('should exchange the elements with two moves and leave intervening children in place', function() {
        const elements = [...collectionView.el.children];
        const move = vi.spyOn(collectionView.Dom, 'moveEl');

        collectionView.swapChildViews(view1, view2);

        expect(move).toHaveBeenCalledTimes(2);
        expect([...collectionView.el.children]).to.deep.equal([
          elements.at(-1), ...elements.slice(1, -1), elements[0]
        ]);
      });

      it('should swap adjacent children in either direction with one move', function() {
        const first = collectionView.children.first();
        const second = collectionView.children.findByIndex(1);
        const elements = [...collectionView.el.children];
        const move = vi.spyOn(collectionView.Dom, 'moveEl');

        collectionView.swapChildViews(first, second);
        expect(move).toHaveBeenCalledTimes(1);
        expect([...collectionView.el.children]).to.deep.equal([
          elements[1], elements[0], ...elements.slice(2)
        ]);

        move.mockClear();
        collectionView.swapChildViews(first, second);
        expect(move).toHaveBeenCalledTimes(1);
        expect([...collectionView.el.children]).to.deep.equal(elements);
      });

      it('should leave a child swapped with itself in place', function() {
        const elements = [...collectionView.el.children];
        const move = vi.spyOn(collectionView.Dom, 'moveEl');

        collectionView.swapChildViews(view1, view1);

        expect(move).not.toHaveBeenCalled();
        expect([...collectionView.el.children]).to.deep.equal(elements);
      });

      it('should return the collectionView', function() {
        expect(collectionView.swapChildViews(view1, view2)).to.equal(collectionView);
      });

      it('should not re-filter the collectionView', function() {
        vi.spyOn(collectionView, 'filter');

        collectionView.swapChildViews(view1, view2);

        expect(collectionView.filter).not.toHaveBeenCalled();
      });

      describe('when one of the children is attached but the other is not', function() {
        it('should re-filter the collectionView', function() {
          collectionView.setFilter(view => {
            return view.model.id !== 1;
          });

          vi.spyOn(collectionView, 'filter');

          collectionView.swapChildViews(view1, view2);

          expect(collectionView.filter).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('when the first child is not in the collectionview', function() {
      it('should throw an error', function() {
        const view1 = new View();
        const view2 = collectionView.children.first();

        expect(function() {
          collectionView.swapChildViews(view1, view2);
        }).to.throw().with.property('code', 'MN0015');
      });

      it('rejects an impostor with the same cid as an owned child', function() {
        const ownedView = collectionView.children.first();
        const impostor = new View();
        impostor.cid = ownedView.cid;

        expect(() => collectionView.swapChildViews(impostor, ownedView))
          .to.throw().with.property('code', 'MN0015');
      });
    });

    describe('when the second child is not in the collectionview', function() {
      it('should throw an error', function() {
        const view1 = collectionView.children.first();
        const view2 = new View();

        expect(function() {
          collectionView.swapChildViews(view1, view2);
        }).to.throw();
      });
    });
  });

  describe('#addChildView', function() {
    let myCollectionView;
    let addView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({ collection });
      addView = new View({ template: _.noop });

      myCollectionView.render();
      myCollectionView.onBeforeRenderChildren = vi.fn();
      myCollectionView.onRenderChildren = vi.fn();
      myCollectionView.onBeforeAddChild = vi.fn();
      myCollectionView.onAddChild = vi.fn();

      vi.spyOn(myCollectionView.children, '_add');
      vi.spyOn(myCollectionView, 'addChildView');
      vi.spyOn(myCollectionView, 'sort');
    });

    [null, { preventRender: false }, {}].forEach(indexOrOptions => {
      it(`sorts a manual addition without a numeric index: ${JSON.stringify(indexOrOptions)}`, function() {
        myCollectionView.viewComparator = child => child.model?.id ?? 0;

        myCollectionView.addChildView(addView, indexOrOptions);

        expect(myCollectionView.sort).toHaveBeenCalledTimes(1);
        expect(myCollectionView.children.first()).to.equal(addView);
        expect(myCollectionView.el.firstChild).to.equal(addView.el);
      });
    });

    [null, {}, { index: null }, { preventRender: true }].forEach(indexOrOptions => {
      it(`appends without a numeric index when sorting is disabled: ${JSON.stringify(indexOrOptions)}`, function() {
        myCollectionView.viewComparator = false;
        const previousChildren = myCollectionView.children.toArray();

        myCollectionView.addChildView(addView, indexOrOptions);

        expect(myCollectionView.children.toArray()).to.deep.equal([...previousChildren, addView]);
        if (indexOrOptions?.preventRender) {
          expect(addView.isRendered()).to.be.false;
          myCollectionView.sort();
        }
        expect(Array.from(myCollectionView.el.children)).to.deep.equal(
          [...previousChildren, addView].map(view => view.el));
      });
    });

    it('filters an options-only addition and appends it when the filter is removed', function() {
      myCollectionView.viewComparator = false;
      myCollectionView.viewFilter = view => view !== addView;
      const previousChildren = myCollectionView.children.toArray();

      myCollectionView.addChildView(addView, {});

      expect(myCollectionView.children.toArray()).to.deep.equal(previousChildren);
      expect(Array.from(myCollectionView.el.children)).to.deep.equal(previousChildren.map(view => view.el));
      myCollectionView.removeFilter();
      expect(myCollectionView.children.toArray()).to.deep.equal([...previousChildren, addView]);
      expect(myCollectionView.el.lastChild).to.equal(addView.el);
    });

    describe('when called with preventRender option', function() {

      beforeEach(function() {
        myCollectionView.addChildView(addView, { preventRender: true });
      });

      it('should return the added view', function() {
        expect(myCollectionView.addChildView).toHaveReturnedWith(addView);
      });

      it('should add to the children container', function() {
        expect(myCollectionView.children._add).toHaveBeenCalledTimes(1);
        expect(myCollectionView.children._add.mock.calls.map(args => args.slice(0, 1))).toContainEqual([addView]);
      });

      it('should not call sort', function() {
        expect(myCollectionView.sort).not.toHaveBeenCalled();
      });

      it('should not trigger "before:render:children"', function() {
        expect(myCollectionView.onBeforeRenderChildren).not.toHaveBeenCalled();
      });

      it('should not trigger "render:children"', function() {
        expect(myCollectionView.onRenderChildren).not.toHaveBeenCalled();
      });

      it('should trigger "add:child"', function() {
        expect(myCollectionView.onAddChild).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onAddChild.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, addView]);
      });

      it('should trigger "before:add:child"', function() {
        expect(myCollectionView.onBeforeAddChild).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onBeforeAddChild.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, addView]);
      });

    });

    describe('when called with an index in options', function() {
      const addIndex = 1;
      beforeEach(function() {
        myCollectionView.addChildView(addView, 0, { preventRender: true, index: addIndex });
      });

      it('should add to the children container at the index from options', function() {
        expect(myCollectionView.children._add).toHaveBeenCalledTimes(1);
        expect(myCollectionView.children._add.mock.calls.map(args => args.slice(0, 2))).toContainEqual([addView, addIndex]);
      });

    });

    describe('when called without preventRender after preventReder calls', function() {
      const addIndex = 1;
      beforeEach(function() {
        const addView2 = new View({ template: _.noop });
        myCollectionView.addChildView(addView, { preventRender: true, index: addIndex });
        myCollectionView.addChildView(addView2);
      });

      it('should report all visible children', function() {
        expect(myCollectionView.onRenderChildren.mock.calls[0][1]).to.have.lengthOf(myCollectionView.children.length);
      });

    });

    describe('when collection changed having unrendered views', function() {
      let onRender;
      beforeEach(function() {
        onRender = vi.fn();
        let addView1 = new View({ template: _.noop, onRender });
        let addView2 = new View({ template: _.noop, onRender });
        myCollectionView.addChildView(addView1, { preventRender: true, index: 0 });
        myCollectionView.addChildView(addView2, { preventRender: true });
        collection.add({id: 4});
      });
      afterEach(function() {
        collection.remove(collection.last());
      });
      it('should render all unrendered views', function() {
        expect(onRender).toHaveBeenCalledTimes(2);
      });
    });

    describe('when called without an index', function() {
      beforeEach(function() {

        myCollectionView.viewComparator = false;
        myCollectionView.addChildView(addView);
      });

      it('should return the added view', function() {
        expect(myCollectionView.addChildView).toHaveReturnedWith(addView);
      });

      it('should add to the children container', function() {
        expect(myCollectionView.children._add).toHaveBeenCalledTimes(1);
        expect(myCollectionView.children._add.mock.calls.map(args => args.slice(0, 1))).toContainEqual([addView]);
      });

      it('should trigger "before:render:children"', function() {
        expect(myCollectionView.onBeforeRenderChildren).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onBeforeRenderChildren.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView]);
      });

      it('should trigger "render:children"', function() {
        expect(myCollectionView.onRenderChildren).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onRenderChildren.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView]);
      });

      it('should report all visible children', function() {
        expect(myCollectionView.onRenderChildren.mock.calls[0][1]).to.have.lengthOf(myCollectionView.children.length);
      });

      it('should trigger "add:child"', function() {
        expect(myCollectionView.onAddChild).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onAddChild.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, addView]);
      });

      it('should trigger "before:add:child"', function() {
        expect(myCollectionView.onBeforeAddChild).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onBeforeAddChild.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, addView]);
      });

      it('should sort the children', function() {
        expect(myCollectionView.sort).toHaveBeenCalledTimes(1);
      });
    });

    describe('when called with an index', function() {
      const addIndex = 1;

      beforeEach(function() {
        myCollectionView.addChildView(addView, addIndex);
      });

      it('should add to the children container at the index', function() {
        expect(myCollectionView.children._add).toHaveBeenCalledTimes(1);
        expect(myCollectionView.children._add.mock.calls.map(args => args.slice(0, 2))).toContainEqual([addView, addIndex]);
      });

      it('should trigger "before:render:children"', function() {
        expect(myCollectionView.onBeforeRenderChildren).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onBeforeRenderChildren.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView]);
      });

      it('should trigger "render:children"', function() {
        expect(myCollectionView.onRenderChildren).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onRenderChildren.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView]);
      });

      it('should report all visible children', function() {
        expect(myCollectionView.onRenderChildren.mock.calls[0][1]).to.have.lengthOf(myCollectionView.children.length);
      });

      it('should trigger "add:child"', function() {
        expect(myCollectionView.onAddChild).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onAddChild.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, addView]);
      });

      it('should trigger "before:add:child"', function() {
        expect(myCollectionView.onBeforeAddChild).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onBeforeAddChild.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, addView]);
      });

      it('should not sort the children', function() {
        expect(myCollectionView.sort).not.toHaveBeenCalled();
      });
    });

    describe('when the collectionView is not rendered', function() {
      let unrenderedCollectionView;

      beforeEach(function() {
        unrenderedCollectionView = new MyCollectionView({ collection });
        vi.spyOn(unrenderedCollectionView, 'render');

        unrenderedCollectionView.addChildView(addView);
      });

      it('should render the collectionView', function() {
        expect(unrenderedCollectionView.render).toHaveBeenCalledTimes(1);
      });
    });

    describe('when called without a view', function() {
      beforeEach(function() {
        myCollectionView.addChildView();
      });

      it('should not trigger "add:child"', function() {
        expect(myCollectionView.onAddChild).not.toHaveBeenCalled();
      });
    });

    describe('when called with a destroyed view', function() {
      let destroyedView;

      beforeEach(function() {
        destroyedView = new View();
        destroyedView.destroy();

        myCollectionView.addChildView(destroyedView);
      });

      it('should not trigger "add:child"', function() {
        expect(myCollectionView.onAddChild).not.toHaveBeenCalled();
      });

      it('should return the destroyed view', function() {
        expect(myCollectionView.addChildView).toHaveReturnedWith(destroyedView);
      });
    });

    describe('when called with showed view', function() {
      let anotherCollectionView;

      beforeEach(function() {
        anotherCollectionView = new MyCollectionView();
        addView = new View({ template: _.noop });
        anotherCollectionView.addChildView(addView);
      });

      it('should throw an error', function() {
        expect(myCollectionView.addChildView.bind(myCollectionView, addView)).to.throw()
          .with.property('code', 'MN0003');
      });

    });

    [false, true].forEach(deferred => {
      it(`keeps ${deferred ? 'deferred' : 'filtered'} children owned until explicitly detached`, function() {
        const owner = new CollectionView({ viewFilter: () => false }).render();
        const region = new Region({ el: document.createElement('div') });
        const child = new View({ template: _.noop });
        owner.addChildView(child, { preventRender: deferred });

        expect(() => myCollectionView.addChildView(child)).to.throw()
          .with.property('code', 'MN0003');
        expect(() => owner.addChildView(child)).to.throw()
          .with.property('code', 'MN0003');
        expect(() => region.show(child)).to.throw()
          .with.property('code', 'MN0003');
        expect(owner._children.hasView(child)).to.be.true;
        expect(myCollectionView._children.hasView(child)).to.be.false;
        expect(region.hasView()).to.be.false;

        owner.detachChildView(child);
        region.show(child);
        owner.destroy();
        expect(child.isDestroyed()).to.be.false;
        region.detachView();
        myCollectionView.addChildView(child);
        expect(myCollectionView.children.hasView(child)).to.be.true;
        region.destroy();
        myCollectionView.destroy();
      });

      it(`destroys and releases an owned ${deferred ? 'deferred' : 'filtered'} child`, function() {
        const owner = new CollectionView({ viewFilter: () => false }).render();
        const child = new View({ template: _.noop });
        owner.addChildView(child, { preventRender: deferred });

        owner.destroy();

        expect(child.isDestroyed()).to.be.true;
        expect(child).not.to.have.property('_parent');
      });
    });

    describe('when adding detached view', function() {
      let anotherCollectionView;
      let region;
      beforeEach(function() {
        anotherCollectionView = new MyCollectionView();
        setFixtures('<div id="region"></div>');
        region = new Region({ el: '#region' });
        addView = new View({ template: _.noop });
      });

      it('should not throw an error if view was detached from CollectionView',function() {
        anotherCollectionView.addChildView(addView);
        anotherCollectionView.detachChildView(addView);
        expect(myCollectionView.addChildView.bind(myCollectionView, addView)).to.not.throw();
      });

      it('should not throw an error if view was detached from Region',function() {
        region.show(addView);
        region.detachView(addView);
        expect(myCollectionView.addChildView.bind(myCollectionView, addView)).to.not.throw();
      });

    });
  });

  describe('#detachChildView', function() {
    let myCollectionView;
    let detachView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({ collection });
      vi.spyOn(myCollectionView, 'removeChildView');
      vi.spyOn(myCollectionView, 'detachChildView');

      myCollectionView.render();
      detachView = myCollectionView.children.first();

      myCollectionView.detachChildView(detachView);
    });

    it('should return the detached view', function() {
      expect(myCollectionView.detachChildView).toHaveReturnedWith(detachView);
    });

    it('should call removeChildView', function() {
      expect(myCollectionView.removeChildView).toHaveBeenCalledTimes(1);
      expect(myCollectionView.removeChildView.mock.calls.map(args => args.slice(0, 2))).toContainEqual([detachView, { shouldDetach: true }]);
    });

  });

  describe('#removeChildView', function() {
    let myCollectionView;
    let removeView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({ collection });
      myCollectionView.onBeforeRemoveChild = vi.fn();
      myCollectionView.onRemoveChild = vi.fn();

      vi.spyOn(myCollectionView.children, '_remove');
      vi.spyOn(myCollectionView, 'removeChildView');

      myCollectionView.render();
      removeView = myCollectionView.children.first();

      myCollectionView.removeChildView(removeView);
    });

    it('should return the removed view', function() {
      expect(myCollectionView.removeChildView).toHaveReturnedWith(removeView);
    });

    it('should destroy the removed view', function() {
      expect(removeView.isDestroyed()).to.be.true;
    });

    it('should remove from the children container', function() {
      expect(myCollectionView.children._remove).toHaveBeenCalledTimes(1);
      expect(myCollectionView.children._remove.mock.calls.map(args => args.slice(0, 1))).toContainEqual([removeView]);
    });

    it('should trigger "remove:child"', function() {
      expect(myCollectionView.onRemoveChild).toHaveBeenCalledTimes(1);
      expect(myCollectionView.onRemoveChild.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, removeView]);
    });

    it('should trigger "before:remove:child"', function() {
      expect(myCollectionView.onBeforeRemoveChild).toHaveBeenCalledTimes(1);
      expect(myCollectionView.onBeforeRemoveChild.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, removeView]);
    });

    describe('when called without a view', function() {
      beforeEach(function() {
        myCollectionView.onRemoveChild.mockClear();
        myCollectionView.removeChildView.mockClear();
        myCollectionView.removeChildView();
      });

      it('should not trigger "remove:child"', function() {
        expect(myCollectionView.onRemoveChild).not.toHaveBeenCalled();
      });
    });

    it('does not mutate an unowned view with an owned or inherited cid', function() {
      const ownedView = myCollectionView.children.first();
      const childCount = myCollectionView.children.length;
      const sameCidImpostor = new View();
      const inheritedCidImpostor = new View();
      sameCidImpostor.cid = ownedView.cid;
      inheritedCidImpostor.cid = 'toString';
      myCollectionView.children._remove.mockClear();
      myCollectionView.onBeforeRemoveChild.mockClear();
      myCollectionView.onRemoveChild.mockClear();

      myCollectionView.removeChildView(sameCidImpostor);
      myCollectionView.detachChildView(inheritedCidImpostor);

      expect(sameCidImpostor.isDestroyed()).to.be.false;
      expect(inheritedCidImpostor.isDestroyed()).to.be.false;
      expect(ownedView.isDestroyed()).to.be.false;
      expect(myCollectionView.children).to.have.lengthOf(childCount);
      expect(myCollectionView.children._remove).not.toHaveBeenCalled();
      expect(myCollectionView.onBeforeRemoveChild).not.toHaveBeenCalled();
      expect(myCollectionView.onRemoveChild).not.toHaveBeenCalled();
    });

    // Used only by #detachChildView
    describe('when called with shouldDetach', function() {
      let detachView;

      beforeEach(function() {
        myCollectionView.onRemoveChild.mockClear();
        myCollectionView.removeChildView.mockClear();
        vi.spyOn(myCollectionView, 'detachHtml');

        detachView = myCollectionView.children.first();

        myCollectionView.removeChildView(detachView, { shouldDetach: true });
      });

      it('should not destroy the view', function() {
        expect(detachView.isDestroyed()).to.be.false;
      });

      it('should detach the view\'s html', function() {
        expect(myCollectionView.detachHtml).toHaveBeenCalledTimes(1);
        expect(myCollectionView.detachHtml.mock.calls.map(args => args.slice(0, 1))).toContainEqual([detachView]);
      });
    });
  });

  describe('when destroying a childView', function() {
    let myCollectionView;
    let destroyedView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({ collection });
      vi.spyOn(myCollectionView, 'removeChildView');

      myCollectionView.render();
      destroyedView = myCollectionView.children.first();
      destroyedView.destroy();
    });

    it('should remove the childView', function() {
      expect(myCollectionView.removeChildView).toHaveBeenCalledTimes(1);
      expect(myCollectionView.removeChildView.mock.calls.map(args => args.slice(0, 1))).toContainEqual([destroyedView]);
    });
  });

  // Child Views provide their own lifecycle.
  describe('childView lifecycle', function() {
    let myCollectionView;
    let childView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView();

      const ChildView = View.extend({
        template: () => '',
        onBeforeRender: vi.fn(),
        onRender: vi.fn(),
        onBeforeAttach: vi.fn(),
        onAttach: vi.fn(),
        onBeforeDetach: vi.fn(),
        onDetach: vi.fn(),
        onBeforeDestroy: vi.fn(),
        onDestroy: vi.fn()
      });

      _.extend(ChildView.prototype, Marionette.Events);

      childView = new ChildView();
    });

    describe('when the collectionView is attached', function() {
      describe('when attaching the childview', function() {
        beforeEach(function() {
          const myRegion = new Region({ el: '#fixtures' });
          myRegion.show(myCollectionView);
          myCollectionView.addChildView(childView);
        });

        it('should trigger "before:render" event on the childView', function() {
          expect(childView.onBeforeRender).toHaveBeenCalledTimes(1);
          expect(childView.onBeforeRender.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
        });

        it('should trigger "render" event on the childView', function() {
          expect(childView.onRender).toHaveBeenCalledTimes(1);
          expect(childView.onRender.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
        });

        it('should trigger "before:attach" event on the childView', function() {
          expect(childView.onBeforeAttach).toHaveBeenCalledTimes(1);
          expect(childView.onBeforeAttach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
        });

        it('should trigger "attach" event on the childView', function() {
          expect(childView.onAttach).toHaveBeenCalledTimes(1);
          expect(childView.onAttach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
        });

        // All children are possibly attached when adding any children
        describe('when attaching another childview', function() {
          let anotherView;

          beforeEach(function() {
            const AnotherView = View.extend({
              template: _.noop,
              onBeforeAttach: vi.fn(),
              onAttach: vi.fn()
            })
            anotherView = new AnotherView();
            childView.onBeforeAttach.mockClear();
            childView.onAttach.mockClear();
            myCollectionView.addChildView(anotherView, 0);
          });

          it('should not trigger "before:attach" event on the childView', function() {
            expect(childView.onBeforeAttach).not.toHaveBeenCalled();
          });

          it('should not trigger "attach" event on the childView', function() {
            expect(childView.onAttach).not.toHaveBeenCalled();
          });

          it('should trigger "before:attach" event on anotherView', function() {
            expect(anotherView.onBeforeAttach).toHaveBeenCalledTimes(1);
            expect(anotherView.onBeforeAttach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([anotherView]);
          });

          it('should trigger "attach" event on anotherView', function() {
            expect(anotherView.onAttach).toHaveBeenCalledTimes(1);
            expect(anotherView.onAttach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([anotherView]);
          });
        });

        describe('when attaching another childview at the end', function() {
          let anotherView;
          let AnotherView;
          beforeEach(function() {
            AnotherView = View.extend({
              template: _.noop,
              onBeforeAttach: vi.fn(),
              onAttach: vi.fn()
            })
            anotherView = new AnotherView();
            childView.onBeforeAttach.mockClear();
            childView.onAttach.mockClear();
            myCollectionView.addChildView(anotherView);
          });

          it('should not trigger "before:attach" event on the childView', function() {
            expect(childView.onBeforeAttach).not.toHaveBeenCalled();
          });

          it('should not trigger "attach" event on the childView', function() {
            expect(childView.onAttach).not.toHaveBeenCalled();
          });

          it('should trigger "before:attach" event on anotherView', function() {
            expect(anotherView.onBeforeAttach).toHaveBeenCalledTimes(1);
            expect(anotherView.onBeforeAttach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([anotherView]);
          });

          it('should trigger "attach" event on anotherView', function() {
            expect(anotherView.onAttach).toHaveBeenCalledTimes(1);
            expect(anotherView.onAttach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([anotherView]);
          });

          it('should only append the added child', function() {
            vi.spyOn(myCollectionView, 'attachHtml').mockImplementation(() => undefined);

            // Only true if not maintaining collection sort
            myCollectionView.sortWithCollection = false;
            myCollectionView.addChildView(new AnotherView());
            const callArgs = myCollectionView.attachHtml.mock.calls[0];
            const attachHtmlEls = callArgs[0];
            expect($(attachHtmlEls).children()).to.have.lengthOf(1);
          });

          it('should still have all children attached', function() {
            expect(myCollectionView.el.children).to.have.lengthOf(2);
          });
        });

        describe('when removing the childview', function() {
          beforeEach(function() {
            myCollectionView.removeChildView(childView);
          });

          it('should trigger "before:detach" event on the childView', function() {
            expect(childView.onBeforeDetach).toHaveBeenCalledTimes(1);
            expect(childView.onBeforeDetach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
          });

          it('should trigger "detach" event on the childView', function() {
            expect(childView.onDetach).toHaveBeenCalledTimes(1);
            expect(childView.onDetach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
          });

          it('should trigger "before:destroy" event on the childView', function() {
            expect(childView.onBeforeDestroy).toHaveBeenCalledTimes(1);
            expect(childView.onBeforeDestroy.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
          });

          it('should trigger "destroy" event on the childView', function() {
            expect(childView.onDestroy).toHaveBeenCalledTimes(1);
            expect(childView.onDestroy.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
          });
        });

        describe('when detaching the childview', function() {
          beforeEach(function() {
            myCollectionView.detachChildView(childView);
          });

          it('should trigger "before:detach" event on the childView', function() {
            expect(childView.onBeforeDetach).toHaveBeenCalledTimes(1);
            expect(childView.onBeforeDetach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
          });

          it('should trigger "detach" event on the childView', function() {
            expect(childView.onDetach).toHaveBeenCalledTimes(1);
            expect(childView.onDetach.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
          });

          it('should not trigger "before:destroy" event on the childView', function() {
            expect(childView.onBeforeDestroy).not.toHaveBeenCalled();
          });

          it('should not trigger "destroy" event on the childView', function() {
            expect(childView.onDestroy).not.toHaveBeenCalled();
          });
        });
      });

      describe('when the collectionView is not monitoring events', function() {
        beforeEach(function() {
          const myRegion = new Region({ el: '#fixtures' });
          myRegion.show(myCollectionView);
          myCollectionView.monitorViewEvents = false;
          myCollectionView.addChildView(childView);
        });

        it('should not trigger "before:attach" event on the childView', function() {
          expect(childView.onBeforeAttach).not.toHaveBeenCalled();
        });

        it('should not trigger "attach" event on the childView', function() {
          expect(childView.onAttach).not.toHaveBeenCalled();
        });

        describe('when removing the childview', function() {
          beforeEach(function() {
            myCollectionView.removeChildView(childView);
          });

          it('should not trigger "before:detach" event on the childView', function() {
            expect(childView.onBeforeDetach).not.toHaveBeenCalled();
          });

          it('should not trigger "detach" event on the childView', function() {
            expect(childView.onDetach).not.toHaveBeenCalled();
          });
        });

        describe('when detaching the childview', function() {
          beforeEach(function() {
            myCollectionView.detachChildView(childView);
          });

          it('should not trigger "before:detach" event on the childView', function() {
            expect(childView.onBeforeDetach).not.toHaveBeenCalled();
          });

          it('should not trigger "detach" event on the childView', function() {
            expect(childView.onDetach).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe('when the collectionView is not attached', function() {
      beforeEach(function() {
        myCollectionView.addChildView(childView);
        myCollectionView.removeChildView(childView);
      });

      it('should trigger "before:render" event on the childView', function() {
        expect(childView.onBeforeRender).toHaveBeenCalledTimes(1);
        expect(childView.onBeforeRender.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
      });

      it('should trigger "render" event on the childView', function() {
        expect(childView.onRender).toHaveBeenCalledTimes(1);
        expect(childView.onRender.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
      });

      it('should not trigger "before:attach" event on the childView', function() {
        expect(childView.onBeforeAttach).not.toHaveBeenCalled();
      });

      it('should not trigger "attach" event on the childView', function() {
        expect(childView.onAttach).not.toHaveBeenCalled();
      });

      it('should not trigger "before:detach" event on the childView', function() {
        expect(childView.onBeforeDetach).not.toHaveBeenCalled();
      });

      it('should not trigger "detach" event on the childView', function() {
        expect(childView.onDetach).not.toHaveBeenCalled();
      });

      it('should trigger "before:destroy" event on the childView', function() {
        expect(childView.onBeforeDestroy).toHaveBeenCalledTimes(1);
        expect(childView.onBeforeDestroy.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
      });

      it('should trigger "destroy" event on the childView', function() {
        expect(childView.onDestroy).toHaveBeenCalledTimes(1);
        expect(childView.onDestroy.mock.calls.map(args => args.slice(0, 1))).toContainEqual([childView]);
      });
    });
  });

  describe('when destroying the collectionView with children', function() {
    let myCollectionView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({ collection });
      myCollectionView.onBeforeDestroyChildren = vi.fn();
      myCollectionView.onDestroyChildren = vi.fn();

      vi.spyOn(myCollectionView.children, '_init');
      myCollectionView.render();
    });

    it('should destroy each view', function() {
      myCollectionView.destroy();
      myCollectionView.children.each(view => {
        expect(view.isDestroyed()).to.be.true;
      });
    });

    it('should trigger "before:destroy:children"', function() {
      myCollectionView.destroy();
      expect(myCollectionView.onBeforeDestroyChildren).toHaveBeenCalledTimes(1);
      expect(myCollectionView.onBeforeDestroyChildren.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView]);
    });

    it('should reinit the children container', function() {
      myCollectionView.destroy();
      expect(myCollectionView.children._init).toHaveBeenCalledTimes(1);
    });

    it('should trigger "destroy:children"', function() {
      myCollectionView.destroy();
      expect(myCollectionView.onDestroyChildren).toHaveBeenCalledTimes(1);
      expect(myCollectionView.onDestroyChildren.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView]);
    });

    describe('when view events are not monitored', function() {
      it('should detach the contents from the dom prior to destroying', function() {
        myCollectionView.Dom = _.clone(myCollectionView.Dom);
        myCollectionView.Dom.detachContents = vi.fn();
        myCollectionView.monitorViewEvents = false;
        myCollectionView.destroy();
        expect(myCollectionView.Dom.detachContents).toHaveBeenCalledTimes(1);
        expect(myCollectionView.Dom.detachContents.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView.el]);
        expect(myCollectionView.Dom.detachContents).toHaveBeenCalledAfter(myCollectionView.onBeforeDestroyChildren);
        expect(myCollectionView.Dom.detachContents).toHaveBeenCalledBefore(myCollectionView.onDestroyChildren);
      });
    });
  });

  describe('when destroying the collectionView without children', function() {
    let myCollectionView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({ collection });
      myCollectionView.onDestroyChildren = vi.fn();

      myCollectionView.destroy();
    });

    it('should not trigger "destroy:children"', function() {
      expect(myCollectionView.onDestroyChildren).not.toHaveBeenCalled();
    });
  });
});
