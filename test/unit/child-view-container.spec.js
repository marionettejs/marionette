import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../setup/backbone.js';
import Backbone from 'backbone';
import { CollectionView, View } from 'marionette';
import BackboneApi from '@marionette/adapters/backbone';

const ChildView = View.extend({ template: false });
const owners = new Set();
function createList(dataApi = BackboneApi) {
  const List = CollectionView.extend({ viewComparator: false, template: false });
  List.setDataApi(dataApi);
  const list = new List();
  owners.add(list);
  return list;
}
function createChildren(views = []) {
  const list = createList();
  views.forEach(view => list.addChildView(view));
  return list.children;
}
afterEach(() => {
  owners.forEach(owner => owner.destroy());
  owners.clear();
});

describe('#ChildViewContainer', function() {

  describe('callback collection helpers', function() {
    let container;
    let views;

    beforeEach(function() {
      views = [
        new ChildView({ id: 1 }),
        new ChildView({ id: 2 }),
        new ChildView({ id: 3 })
      ];

      container = createChildren(views);
    });

    describe('#each', function() {
      it('visits every child view with index and context and returns the container', function() {
        const context = {};
        const callback = vi.fn(function(view, index) {
          expect(this).to.equal(context);
          expect(view).to.equal(views[index]);
        });

        expect(container.each(callback, context)).to.equal(container);
        expect(callback).toHaveBeenCalledTimes(3);
        callback.mock.calls.forEach(args => {
          expect(args).to.have.lengthOf(2);
        });
      });

      it('returns an empty container without calling the callback', function() {
        const emptyContainer = createChildren();
        const callback = vi.fn();

        expect(emptyContainer.each(callback)).to.equal(emptyContainer);
        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('#map', function() {
      it('maps every child view with index and context into a new ordered array', function() {
        const context = { prefix: 'view' };
        const callback = vi.fn(function(view, index) {
          expect(view).to.equal(views[index]);
          return `${ this.prefix }-${ index + 1 }`;
        });

        const result = container.map(callback, context);

        expect(result).to.deep.equal(['view-1', 'view-2', 'view-3']);
        expect(container.map(view => view.id)).to.not.equal(result);
        expect(callback).toHaveBeenCalledTimes(3);
        callback.mock.calls.forEach((args, index) => {
          expect(callback.mock.contexts[index]).to.equal(context);
          expect(args).to.have.lengthOf(2);
        });
      });

      it('returns a new empty array without calling the callback', function() {
        const emptyContainer = createChildren();
        const callback = vi.fn();
        const result = emptyContainer.map(callback);

        expect(result).to.deep.equal([]);
        expect(emptyContainer.map(callback)).to.not.equal(result);
        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('#reduce', function() {
      it('reduces every child view with an initial value, index, and context', function() {
        const context = { multiplier: 2 };
        const callback = vi.fn(function(total, view, index) {
          expect(view).to.equal(views[index]);
          return total + (view.id * this.multiplier);
        });

        expect(container.reduce(callback, 1, context)).to.equal(13);
        expect(callback).toHaveBeenCalledTimes(3);
        callback.mock.calls.forEach((args, index) => {
          expect(callback.mock.contexts[index]).to.equal(context);
          expect(args).to.have.lengthOf(3);
        });
      });

      it('uses the first child view when the initial value is omitted', function() {
        const callback = vi.fn((accumulator, view, index) => ({
          ids: (accumulator.ids || [accumulator.id]).concat(view.id),
          index
        }));

        const result = container.reduce(callback);

        expect(result).to.deep.equal({ ids: [1, 2, 3], index: 2 });
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls.at(0)[0]).to.equal(views[0]);
        expect(callback.mock.calls.at(0)[1]).to.equal(views[1]);
        expect(callback.mock.calls.at(0)[2]).to.equal(1);
        expect(callback.mock.calls.at(1)[1]).to.equal(views[2]);
        expect(callback.mock.calls.at(1)[2]).to.equal(2);
      });

      it('returns the exact initial value for an empty container', function() {
        const initialValue = {};
        const callback = vi.fn();

        expect(createChildren().reduce(callback, initialValue)).to.equal(initialValue);
        expect(callback).not.toHaveBeenCalled();
      });

      it('treats an explicitly supplied undefined as an initial value', function() {
        const callback = vi.fn((total, view) => (total || 0) + view.id);

        expect(container.reduce(callback, undefined)).to.equal(6);
        expect(callback).toHaveBeenCalledTimes(3);
        expect(callback.mock.calls.at(0)[0]).to.be.undefined;
        expect(callback.mock.calls.at(0)[1]).to.equal(views[0]);
        expect(callback.mock.calls.at(0)[2]).to.equal(0);
      });

      it('throws for an empty container without an initial value', function() {
        const callback = vi.fn();

        expect(() => createChildren().reduce(callback))
          .to.throw().with.property('code', 'MN0024');
        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('#invoke', function() {
      beforeEach(function() {
        views.forEach((view, index) => {
          view.describe = function(prefix, suffix) {
            expect(this).to.equal(view);
            return `${ prefix }-${ index + 1 }-${ suffix }`;
          };
        });
      });

      it('invokes a direct method on every child view with forwarded arguments', function() {
        expect(container.invoke('describe', 'view', 'done')).to.deep.equal([
          'view-1-done',
          'view-2-done',
          'view-3-done'
        ]);
      });

      it('returns an empty array for an empty container and a string method name', function() {
        expect(createChildren().invoke('render')).to.deep.equal([]);
      });

    });

    it('does not expose the removed Underscore aliases', function() {
      ['forEach', 'detect', 'select', 'all', 'any', 'include'].forEach(alias => {
        expect(container[alias]).to.be.undefined;
      });
    });

    it('does not add undocumented where helpers', function() {
      expect(container.where).to.be.undefined;
      expect(container.findWhere).to.be.undefined;
    });

    it('iterates child views in order through the prototype iterator', function() {
      expect(container).to.not.have.own.property(Symbol.iterator);
      expect(Object.getPrototypeOf(container)).to.have.own.property(Symbol.iterator);
      expect([...container]).to.deep.equal(views);
      expect(Array.from(container)).to.deep.equal(views);

      const [firstView, secondView, thirdView] = container;
      expect(firstView).to.equal(views[0]);
      expect(secondView).to.equal(views[1]);
      expect(thirdView).to.equal(views[2]);

      const iteratedViews = [];
      for (const view of container) {
        iteratedViews.push(view);
      }
      expect(iteratedViews).to.deep.equal(views);
      expect([...createChildren()]).to.deep.equal([]);
    });
  });

  describe('view property collection helpers', function() {
    let container;
    let model;
    let view;

    beforeEach(function() {
      model = new Backbone.Model({ status: 'model status' });
      view = new ChildView({ model });
      view.status = 'view status';

      container = createChildren([view, new ChildView()]);
    });

    describe('#pluck', function() {
      it('reads properties directly from child views', function() {
        const [viewModel, missingModel] = container.pluck('model');

        expect(viewModel).to.equal(model);
        expect(missingModel).to.be.undefined;
      });

      it('does not read model attributes', function() {
        const result = container.pluck('status');

        expect(result).to.deep.equal(['view status', undefined]);
        expect(container.pluck('status')).to.not.equal(result);
      });

      it('does not traverse array-form property paths', function() {
        view['model,cid'] = 'literal property';

        expect(container.pluck(['model', 'cid']))
          .to.deep.equal(['literal property', undefined]);
        expect(container.pluck(['model', 'cid'])[0]).to.not.equal(model.cid);
      });

      it('returns an empty array for an empty container', function() {
        const emptyContainer = createChildren();
        const result = emptyContainer.pluck('model');

        expect(result).to.deep.equal([]);
        expect(emptyContainer.pluck('model')).to.not.equal(result);
      });
    });

    describe('#contains', function() {
      it('matches the exact child view instance', function() {
        expect(container.contains(view)).to.be.true;
        expect(container.contains(model)).to.be.false;
        expect(container.contains({ cid: view.cid })).to.be.false;
      });

      it('returns false for an empty container', function() {
        expect(createChildren().contains(view)).to.be.false;
      });
    });
  });

  describe('predicate collection helpers', function() {
    let container;
    let views;

    function expectPredicateCall(predicate, index, context) {
      const args = predicate.mock.calls[index];
      expect(predicate.mock.contexts[index]).to.equal(context);
      expect(args).to.have.lengthOf(2);
      expect(args[0]).to.equal(views[index]);
      expect(args[1]).to.equal(index);
    }

    beforeEach(function() {
      views = [
        new ChildView(),
        new ChildView(),
        new ChildView()
      ];

      views.forEach((view, index) => {
        view.rank = index + 1;
      });

      container = createChildren(views);
    });

    describe('#find', function() {
      it('returns the first matching child view and stops iterating', function() {
        const context = { minimumRank: 2 };
        const predicate = vi.fn(function(view) {
          return view.rank >= this.minimumRank ? view : 0;
        });

        const foundView = container.find(predicate, context);

        expect(foundView).to.equal(views[1]);
        expect(predicate).toHaveBeenCalledTimes(2);
        expectPredicateCall(predicate, 0, context);
        expectPredicateCall(predicate, 1, context);
      });

      it('returns undefined after every child view fails the predicate', function() {
        const predicate = vi.fn(() => false);

        expect(container.find(predicate)).to.be.undefined;
        expect(predicate).toHaveBeenCalledTimes(3);
        expectPredicateCall(predicate, 0, undefined);
        expectPredicateCall(predicate, 1, undefined);
        expectPredicateCall(predicate, 2, undefined);
      });

      it('does not call the predicate for an empty container', function() {
        const predicate = vi.fn();

        expect(createChildren().find(predicate)).to.be.undefined;
        expect(predicate).not.toHaveBeenCalled();
      });
    });

    describe('#filter', function() {
      it('returns matching child views in order after visiting every child', function() {
        const context = { minimumRank: 2 };
        const predicate = vi.fn(function(view) {
          return view.rank >= this.minimumRank ? view : 0;
        });

        const matchingViews = container.filter(predicate, context);

        expect(matchingViews).to.have.lengthOf(2);
        expect(matchingViews[0]).to.equal(views[1]);
        expect(matchingViews[1]).to.equal(views[2]);
        expect(predicate).toHaveBeenCalledTimes(3);
        expectPredicateCall(predicate, 0, context);
        expectPredicateCall(predicate, 1, context);
        expectPredicateCall(predicate, 2, context);

        matchingViews.pop();
        expect(container).to.have.lengthOf(3);
        expect(container.last()).to.equal(views[2]);
        expect(container.filter(view => view.rank >= 2)).to.not.equal(matchingViews);
      });

      it('returns an empty array without calling the predicate for an empty container', function() {
        const predicate = vi.fn();
        const emptyContainer = createChildren();
        const result = emptyContainer.filter(predicate);

        expect(result).to.deep.equal([]);
        expect(emptyContainer.filter(predicate)).to.not.equal(result);
        expect(predicate).not.toHaveBeenCalled();
      });
    });

    describe('#reject', function() {
      it('returns rejected child views in order after visiting every child', function() {
        const context = { minimumRank: 2 };
        const predicate = vi.fn(function(view) {
          return view.rank >= this.minimumRank ? view : 0;
        });

        const rejectedViews = container.reject(predicate, context);

        expect(rejectedViews).to.have.lengthOf(1);
        expect(rejectedViews[0]).to.equal(views[0]);
        expect(predicate).toHaveBeenCalledTimes(3);
        expectPredicateCall(predicate, 0, context);
        expectPredicateCall(predicate, 1, context);
        expectPredicateCall(predicate, 2, context);

        rejectedViews.pop();
        expect(container).to.have.lengthOf(3);
        expect(container.first()).to.equal(views[0]);
        expect(container.reject(view => view.rank >= 2)).to.not.equal(rejectedViews);
      });

      it('returns an empty array without calling the predicate for an empty container', function() {
        const predicate = vi.fn();
        const emptyContainer = createChildren();
        const result = emptyContainer.reject(predicate);

        expect(result).to.deep.equal([]);
        expect(emptyContainer.reject(predicate)).to.not.equal(result);
        expect(predicate).not.toHaveBeenCalled();
      });
    });

    describe('#every', function() {
      it('returns false at the first child view that fails the predicate', function() {
        const context = { maximumRank: 1 };
        const predicate = vi.fn(function(view) {
          return view.rank <= this.maximumRank ? 'pass' : 0;
        });

        expect(container.every(predicate, context)).to.be.false;
        expect(predicate).toHaveBeenCalledTimes(2);
        expectPredicateCall(predicate, 0, context);
        expectPredicateCall(predicate, 1, context);
      });

      it('returns true after every child view passes the predicate', function() {
        const predicate = vi.fn(() => true);

        expect(container.every(predicate)).to.be.true;
        expect(predicate).toHaveBeenCalledTimes(3);
        expectPredicateCall(predicate, 0, undefined);
        expectPredicateCall(predicate, 1, undefined);
        expectPredicateCall(predicate, 2, undefined);
      });

      it('returns true without calling the predicate for an empty container', function() {
        const predicate = vi.fn();

        expect(createChildren().every(predicate)).to.be.true;
        expect(predicate).not.toHaveBeenCalled();
      });
    });

    describe('#some', function() {
      it('returns true at the first child view that passes the predicate', function() {
        const context = { minimumRank: 2 };
        const predicate = vi.fn(function(view) {
          return view.rank >= this.minimumRank ? view : null;
        });

        expect(container.some(predicate, context)).to.be.true;
        expect(predicate).toHaveBeenCalledTimes(2);
        expectPredicateCall(predicate, 0, context);
        expectPredicateCall(predicate, 1, context);
      });

      it('returns false after every child view fails the predicate', function() {
        const predicate = vi.fn(() => false);

        expect(container.some(predicate)).to.be.false;
        expect(predicate).toHaveBeenCalledTimes(3);
        expectPredicateCall(predicate, 0, undefined);
        expectPredicateCall(predicate, 1, undefined);
        expectPredicateCall(predicate, 2, undefined);
      });

      it('returns false without calling the predicate for an empty container', function() {
        const predicate = vi.fn();

        expect(createChildren().some(predicate)).to.be.false;
        expect(predicate).not.toHaveBeenCalled();
      });
    });

    describe('#partition', function() {
      it('partitions every child view into new ordered arrays', function() {
        const context = { minimumRank: 2 };
        const predicate = vi.fn(function(view) {
          return view.rank >= this.minimumRank ? view : 0;
        });

        const partitionedViews = container.partition(predicate, context);
        const [matchingViews, rejectedViews] = partitionedViews;

        expect(matchingViews).to.have.lengthOf(2);
        expect(matchingViews[0]).to.equal(views[1]);
        expect(matchingViews[1]).to.equal(views[2]);
        expect(rejectedViews).to.have.lengthOf(1);
        expect(rejectedViews[0]).to.equal(views[0]);
        expect(predicate).toHaveBeenCalledTimes(3);
        expectPredicateCall(predicate, 0, context);
        expectPredicateCall(predicate, 1, context);
        expectPredicateCall(predicate, 2, context);

        matchingViews.pop();
        rejectedViews.pop();
        expect(container).to.have.lengthOf(3);
        expect(container.first()).to.equal(views[0]);
        expect(container.last()).to.equal(views[2]);

        const nextPartition = container.partition(view => view.rank >= 2);
        expect(nextPartition).to.not.equal(partitionedViews);
        expect(nextPartition[0]).to.not.equal(matchingViews);
        expect(nextPartition[1]).to.not.equal(rejectedViews);
      });

      it('returns two empty arrays without calling the predicate for an empty container', function() {
        const predicate = vi.fn();
        const emptyContainer = createChildren();
        const result = emptyContainer.partition(predicate);
        const nextResult = emptyContainer.partition(predicate);

        expect(result).to.deep.equal([[], []]);
        expect(nextResult).to.not.equal(result);
        expect(nextResult[0]).to.not.equal(result[0]);
        expect(nextResult[1]).to.not.equal(result[1]);
        expect(predicate).not.toHaveBeenCalled();
      });
    });
  });

  describe('ordered collection helpers', function() {
    let container;
    let views;

    beforeEach(function() {
      views = [
        new ChildView(),
        new ChildView(),
        new ChildView()
      ];

      container = createChildren(views);
    });

    describe('#toArray', function() {
      it('returns a new ordered array of the child views', function() {
        const snapshot = container.toArray();

        expect(container.toArray()).to.not.equal(snapshot);
        expect(snapshot[0]).to.equal(views[0]);
        expect(snapshot[1]).to.equal(views[1]);
        expect(snapshot[2]).to.equal(views[2]);

        snapshot.pop();

        expect(container).to.have.lengthOf(3);
        expect(container.toArray()).to.deep.equal(views);
      });

      it('returns an empty array for an empty container', function() {
        expect(createChildren().toArray()).to.deep.equal([]);
      });
    });

    describe('#first', function() {
      it('returns the first child view', function() {
        expect(container.first()).to.equal(views[0]);
      });

      it('returns a new ordered array when given a count', function() {
        const firstViews = container.first(2);
        const allViews = container.first(5);

        expect(firstViews).to.have.lengthOf(2);
        expect(firstViews[0]).to.equal(views[0]);
        expect(firstViews[1]).to.equal(views[1]);
        expect(container.first(2)).to.not.equal(firstViews);
        expect(allViews).to.have.lengthOf(3);
        expect(allViews[2]).to.equal(views[2]);
        expect(container.first(0)).to.deep.equal([]);
      });

      it('returns the empty-container values', function() {
        const emptyContainer = createChildren();

        expect(emptyContainer.first()).to.be.undefined;
        expect(emptyContainer.first(2)).to.deep.equal([]);
      });
    });

    describe('#initial', function() {
      it('returns a new ordered array without the last child view by default', function() {
        const initialViews = container.initial();

        expect(initialViews).to.have.lengthOf(2);
        expect(initialViews[0]).to.equal(views[0]);
        expect(initialViews[1]).to.equal(views[1]);
        expect(container.initial()).to.not.equal(initialViews);
      });

      it('excludes a nonnegative integer count from the end', function() {
        const oneView = container.initial(2);
        const allViews = container.initial(0);

        expect(oneView).to.have.lengthOf(1);
        expect(oneView[0]).to.equal(views[0]);
        expect(allViews).to.have.lengthOf(3);
        expect(allViews[0]).to.equal(views[0]);
        expect(allViews[1]).to.equal(views[1]);
        expect(allViews[2]).to.equal(views[2]);
        allViews.pop();
        expect(container).to.have.lengthOf(3);
        expect(container.first()).to.equal(views[0]);
        expect(container.findByIndex(1)).to.equal(views[1]);
        expect(container.last()).to.equal(views[2]);
        expect(container.initial(3)).to.deep.equal([]);
        expect(container.initial(5)).to.deep.equal([]);
      });

      it('returns an empty array for an empty container', function() {
        const emptyContainer = createChildren();

        expect(emptyContainer.initial()).to.deep.equal([]);
        expect(emptyContainer.initial(2)).to.deep.equal([]);
      });
    });

    describe('#rest', function() {
      it('returns a new ordered array without the first child view by default', function() {
        const remainingViews = container.rest();

        expect(remainingViews).to.have.lengthOf(2);
        expect(remainingViews[0]).to.equal(views[1]);
        expect(remainingViews[1]).to.equal(views[2]);
        expect(container.rest()).to.not.equal(remainingViews);
      });

      it('excludes a nonnegative integer count from the start', function() {
        const oneView = container.rest(2);
        const allViews = container.rest(0);

        expect(oneView).to.have.lengthOf(1);
        expect(oneView[0]).to.equal(views[2]);
        expect(allViews).to.have.lengthOf(3);
        expect(allViews[0]).to.equal(views[0]);
        expect(allViews[1]).to.equal(views[1]);
        expect(allViews[2]).to.equal(views[2]);
        allViews.shift();
        expect(container).to.have.lengthOf(3);
        expect(container.first()).to.equal(views[0]);
        expect(container.findByIndex(1)).to.equal(views[1]);
        expect(container.last()).to.equal(views[2]);
        expect(container.rest(3)).to.deep.equal([]);
        expect(container.rest(5)).to.deep.equal([]);
      });

      it('returns an empty array for an empty container', function() {
        const emptyContainer = createChildren();

        expect(emptyContainer.rest()).to.deep.equal([]);
        expect(emptyContainer.rest(2)).to.deep.equal([]);
      });
    });

    describe('#last', function() {
      it('returns the last child view', function() {
        expect(container.last()).to.equal(views[2]);
      });

      it('returns a new ordered array when given a count', function() {
        const lastViews = container.last(2);
        const allViews = container.last(5);

        expect(lastViews).to.have.lengthOf(2);
        expect(lastViews[0]).to.equal(views[1]);
        expect(lastViews[1]).to.equal(views[2]);
        expect(container.last(2)).to.not.equal(lastViews);
        expect(allViews).to.have.lengthOf(3);
        expect(allViews[0]).to.equal(views[0]);
        expect(container.last(0)).to.deep.equal([]);
      });

      it('returns the empty-container values', function() {
        const emptyContainer = createChildren();

        expect(emptyContainer.last()).to.be.undefined;
        expect(emptyContainer.last(2)).to.deep.equal([]);
      });
    });

    describe('#without', function() {
      it('returns a new ordered array without the exact child views', function() {
        const remainingViews = container.without(views[1]);
        const middleView = container.without(views[0], views[2]);

        expect(remainingViews).to.have.lengthOf(2);
        expect(remainingViews[0]).to.equal(views[0]);
        expect(remainingViews[1]).to.equal(views[2]);
        expect(container.without(views[1])).to.not.equal(remainingViews);
        expect(middleView).to.have.lengthOf(1);
        expect(middleView[0]).to.equal(views[1]);
      });

      it('does not exclude models or lookalikes or mutate the container', function() {
        const model = new Backbone.Model();
        views[1].model = model;
        const remainingViews = container.without(model, { cid: views[1].cid });

        expect(remainingViews).to.have.lengthOf(3);
        expect(remainingViews[0]).to.equal(views[0]);
        expect(remainingViews[1]).to.equal(views[1]);
        expect(remainingViews[2]).to.equal(views[2]);
        remainingViews.pop();

        expect(container).to.have.lengthOf(3);
        expect(container.first()).to.equal(views[0]);
        expect(container.last()).to.equal(views[2]);
      });

      it('returns a new array of every child view without arguments', function() {
        const allViews = container.without();

        expect(allViews).to.have.lengthOf(3);
        expect(allViews[0]).to.equal(views[0]);
        expect(allViews[1]).to.equal(views[1]);
        expect(allViews[2]).to.equal(views[2]);
        expect(container.without()).to.not.equal(allViews);
      });

      it('returns an empty array for an empty container', function() {
        const emptyContainer = createChildren();

        expect(emptyContainer.without()).to.deep.equal([]);
        expect(emptyContainer.without(views[0])).to.deep.equal([]);
      });
    });

    describe('#isEmpty', function() {
      it('reports whether the container has child views without mutating it', function() {
        expect(container.isEmpty()).to.be.false;
        expect(container).to.have.lengthOf(3);
        expect(container.first()).to.equal(views[0]);
        expect(container.last()).to.equal(views[2]);
        expect(createChildren().isEmpty()).to.be.true;
      });
    });

    it('rejects counts that are not nonnegative integers', function() {
      ['first', 'initial', 'rest', 'last'].forEach(methodName => {
        [-1, 1.5, NaN, '1', null].forEach(count => {
          expect(() => container[methodName](count))
            .to.throw().with.property('code', 'MN0024');
        });
      });
    });
  });


  describe('mutation through CollectionView ownership', () => {
    it('updates every public lookup when children are inserted, detached, and destroyed', () => {
      const list = createList();
      const views = [1, 2, 3].map(id => new ChildView({ model: new Backbone.Model({ id }) }));
      list.addChildView(views[0]);
      list.addChildView(views[2]);
      list.addChildView(views[1], 1);
      expect(list.children.toArray()).toEqual(views);
      views.forEach((view, index) => {
        expect(list.children.findByCid(view.cid)).toBe(view);
        expect(list.children.findByModel(view.model)).toBe(view);
        expect(list.children.findByIndex(index)).toBe(view);
        expect(list.children.hasView(view)).toBe(true);
      });
      expect(list.detachChildView(views[1])).toBe(views[1]);
      expect(views[1].isDestroyed()).toBe(false);
      expect(list.children.findByModel(views[1].model)).toBeUndefined();
      expect(list.children.findByCid(views[1].cid)).toBeUndefined();
      expect(list.children.findIndexByView(views[1])).toBe(-1);
      list.addChildView(views[1], 1);
      list.removeChildView(views[1]);
      expect(views[1].isDestroyed()).toBe(true);
      list.destroy();
      expect(list.children.toArray()).toEqual([]);
      expect(list.children.length).toBe(0);
      views.forEach(view => expect(list.children.hasView(view)).toBe(false));
    });

    it('indexes prototype-collision cids and rejects same-cid impostors', () => {
      const list = createList();
      const views = ['constructor', 'toString', '__proto__'].map(cid => {
        const model = new Backbone.Model();
        model.cid = cid;
        const view = new ChildView({ model });
        view.cid = cid;
        list.addChildView(view);
        return view;
      });
      views.forEach(view => {
        expect(list.children.findByCid(view.cid)).toBe(view);
        expect(list.children.findByModel(view.model)).toBe(view);
        expect(list.children.hasView({ cid: view.cid })).toBe(false);
      });
      list.removeChildView({ cid: 'toString' });
      expect(list.children.toArray()).toEqual(views);
      list.removeChildView(views[2]);
      expect(list.children.findByCid('__proto__')).toBeUndefined();
      expect(list.children.length).toBe(2);
    });

    it('keeps the later child owning a duplicate data key after removing the first', () => {
      const list = createList({ key: model => model.id });
      const first = new ChildView({ model: { id: 1 } });
      const second = new ChildView({ model: { id: 1 } });
      list.addChildView(first);
      list.addChildView(second);
      list.removeChildView(first);
      expect(list.children.findByModel(second.model)).toBe(second);
      expect(list.children.findByKey(1)).toBe(second);
    });

    it('sorts model attributes and places children without models last', () => {
      const list = createList();
      const views = ['foo', 'bar', 'baz'].map(text => new ChildView({ model: new Backbone.Model({ text }) }));
      const orphan = new ChildView();
      [...views, orphan].forEach(view => list.addChildView(view));
      list.setComparator('text');
      expect(list.children.toArray()).toEqual([views[1], views[2], views[0], orphan]);
    });

    it.each([
      [[1, 1, 0], [2, 0, 1]],
      [[undefined, 1, undefined, 0], [3, 1, 0, 2]],
      [[NaN, 1], [0, 1]],
      [[{}, {}], [0, 1]]
    ])('preserves stable order for comparator criteria %j', (criteria, order) => {
      const list = createList();
      const views = criteria.map(rank => Object.assign(new ChildView(), { rank }));
      views.forEach(view => list.addChildView(view));
      const comparator = vi.fn(view => view.rank);
      list.setComparator(comparator);
      expect(list.children.toArray()).toEqual(order.map(index => views[index]));
      expect(comparator).toHaveBeenCalledTimes(views.length);
      expect(comparator.mock.contexts.every(context => context === list)).toBe(true);
    });

    it('preserves the child order when criterion evaluation or comparison throws', () => {
      const list = createList();
      const views = [new ChildView(), new ChildView()];
      views.forEach(view => list.addChildView(view));
      const failure = new Error('criterion failed');
      expect(() => list.setComparator(view => {
        if (view === views[1]) { throw failure; }
        return 1;
      })).toThrow(failure);
      expect(list.children.toArray()).toEqual(views);
      expect(() => list.setComparator(view => Symbol(view.cid))).toThrow(TypeError);
      expect(list.children.toArray()).toEqual(views);
    });

    it('sorts binary comparators with their public owner as receiver', () => {
      const list = createList();
      const views = [1, 2, 3].map(rank => Object.assign(new ChildView(), { rank }));
      views.forEach(view => list.addChildView(view));
      const comparator = vi.fn(function(left, right) { expect(this).toBe(list); return right.rank - left.rank; });
      expect(list.setComparator(comparator)).toBe(list);
      expect(list.children.toArray()).toEqual([...views].reverse());
    });

    it('swaps owned children and rejects unowned children without losing identity', () => {
      const list = createList();
      const views = [new ChildView(), new ChildView(), new ChildView()];
      views.forEach(view => list.addChildView(view));
      list.swapChildViews(views[0], views[2]);
      expect(list.children.toArray()).toEqual([views[2], views[1], views[0]]);
      const outsider = new ChildView();
      expect(() => list.swapChildViews(outsider, views[0])).toThrow(expect.objectContaining({ code: 'MN0015' }));
      expect(() => list.swapChildViews(views[0], outsider)).toThrow(expect.objectContaining({ code: 'MN0015' }));
      expect(list.children.toArray()).toEqual([views[2], views[1], views[0]]);
      outsider.destroy();
    });
  });
});
