import Backbone from 'backbone';
import ChildViewContainer from '../../modules/child-view-container';
import BackboneDataApi from '../../runtime/backbone-data-api';

describe('#ChildViewContainer', function() {

  describe('callback collection helpers', function() {
    let container;
    let views;

    beforeEach(function() {
      views = [
        new Backbone.View({ id: 1 }),
        new Backbone.View({ id: 2 }),
        new Backbone.View({ id: 3 })
      ];

      container = new ChildViewContainer();
      container._set(views, true);
    });

    describe('#each', function() {
      it('visits every child view with index and context and returns the container', function() {
        const context = {};
        const callback = this.sinon.spy(function(view, index) {
          expect(this).to.equal(context);
          expect(view).to.equal(views[index]);
        });

        expect(container.each(callback, context)).to.equal(container);
        expect(callback).to.have.callCount(3);
        callback.getCalls().forEach(call => {
          expect(call.args).to.have.lengthOf(2);
        });
      });

      it('returns an empty container without calling the callback', function() {
        const emptyContainer = new ChildViewContainer();
        const callback = this.sinon.spy();

        expect(emptyContainer.each(callback)).to.equal(emptyContainer);
        expect(callback).to.not.have.been.called;
      });
    });

    describe('#map', function() {
      it('maps every child view with index and context into a new ordered array', function() {
        const context = { prefix: 'view' };
        const callback = this.sinon.spy(function(view, index) {
          expect(view).to.equal(views[index]);
          return `${ this.prefix }-${ index + 1 }`;
        });

        const result = container.map(callback, context);

        expect(result).to.deep.equal(['view-1', 'view-2', 'view-3']);
        expect(container.map(view => view.id)).to.not.equal(result);
        expect(callback).to.have.callCount(3);
        callback.getCalls().forEach(call => {
          expect(call.thisValue).to.equal(context);
          expect(call.args).to.have.lengthOf(2);
        });
      });

      it('returns a new empty array without calling the callback', function() {
        const emptyContainer = new ChildViewContainer();
        const callback = this.sinon.spy();
        const result = emptyContainer.map(callback);

        expect(result).to.deep.equal([]);
        expect(emptyContainer.map(callback)).to.not.equal(result);
        expect(callback).to.not.have.been.called;
      });
    });

    describe('#reduce', function() {
      it('reduces every child view with an initial value, index, and context', function() {
        const context = { multiplier: 2 };
        const callback = this.sinon.spy(function(total, view, index) {
          expect(view).to.equal(views[index]);
          return total + (view.id * this.multiplier);
        });

        expect(container.reduce(callback, 1, context)).to.equal(13);
        expect(callback).to.have.callCount(3);
        callback.getCalls().forEach(call => {
          expect(call.thisValue).to.equal(context);
          expect(call.args).to.have.lengthOf(3);
        });
      });

      it('uses the first child view when the initial value is omitted', function() {
        const callback = this.sinon.spy((accumulator, view, index) => ({
          ids: (accumulator.ids || [accumulator.id]).concat(view.id),
          index
        }));

        const result = container.reduce(callback);

        expect(result).to.deep.equal({ ids: [1, 2, 3], index: 2 });
        expect(callback).to.have.callCount(2);
        expect(callback.firstCall.args[0]).to.equal(views[0]);
        expect(callback.firstCall.args[1]).to.equal(views[1]);
        expect(callback.firstCall.args[2]).to.equal(1);
        expect(callback.secondCall.args[1]).to.equal(views[2]);
        expect(callback.secondCall.args[2]).to.equal(2);
      });

      it('returns the exact initial value for an empty container', function() {
        const initialValue = {};
        const callback = this.sinon.spy();

        expect(new ChildViewContainer().reduce(callback, initialValue)).to.equal(initialValue);
        expect(callback).to.not.have.been.called;
      });

      it('treats an explicitly supplied undefined as an initial value', function() {
        const callback = this.sinon.spy((total, view) => (total || 0) + view.id);

        expect(container.reduce(callback, undefined)).to.equal(6);
        expect(callback).to.have.callCount(3);
        expect(callback.firstCall.args[0]).to.be.undefined;
        expect(callback.firstCall.args[1]).to.equal(views[0]);
        expect(callback.firstCall.args[2]).to.equal(0);
      });

      it('throws for an empty container without an initial value', function() {
        const callback = this.sinon.spy();

        expect(() => new ChildViewContainer().reduce(callback))
          .to.throw().with.property('code', 'MN0024');
        expect(callback).to.not.have.been.called;
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
        expect(new ChildViewContainer().invoke('render')).to.deep.equal([]);
      });

      it('throws at a missing or non-callable child view method', function() {
        delete views[1].describe;
        expect(() => container.invoke('describe'))
          .to.throw().with.property('code', 'MN0025');

        views[1].describe = 'not callable';
        expect(() => container.invoke('describe'))
          .to.throw().with.property('code', 'MN0025');
      });

      it('stops invoking children at the first missing method', function() {
        views[0].describe = this.sinon.spy();
        delete views[1].describe;
        views[2].describe = this.sinon.spy();

        expect(() => container.invoke('describe'))
          .to.throw().with.property('code', 'MN0025');
        expect(views[0].describe).to.have.been.calledOnce;
        expect(views[2].describe).to.not.have.been.called;
      });

      it('rejects non-string and deep-path method names', function() {
        views.forEach(view => {
          view.nested = { describe: view.describe };
        });

        expect(() => container.invoke(views[0].describe))
          .to.throw().with.property('code', 'MN0024');
        expect(() => container.invoke(['describe']))
          .to.throw().with.property('code', 'MN0024');
        expect(() => container.invoke('nested.describe'))
          .to.throw().with.property('code', 'MN0025');
      });
    });

    it('rejects invalid callbacks consistently, including for empty containers', function() {
      const callbackMethods = ['each', 'map', 'find', 'filter', 'reject', 'every', 'some', 'partition'];
      const invalidCallbacks = [undefined, null, 'id', { id: 1 }];

      callbackMethods.forEach(methodName => {
        invalidCallbacks.forEach(callback => {
          expect(() => container[methodName](callback))
            .to.throw().with.property('code', 'MN0024');
          expect(() => new ChildViewContainer()[methodName](callback))
            .to.throw().with.property('code', 'MN0024');
        });
      });

      invalidCallbacks.forEach(callback => {
        expect(() => container.reduce(callback, 0))
          .to.throw().with.property('code', 'MN0024');
        expect(() => new ChildViewContainer().reduce(callback, 0))
          .to.throw().with.property('code', 'MN0024');
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
      expect([...new ChildViewContainer()]).to.deep.equal([]);
    });
  });

  describe('view property collection helpers', function() {
    let container;
    let model;
    let view;

    beforeEach(function() {
      model = new Backbone.Model({ status: 'model status' });
      view = new Backbone.View({ model });
      view.status = 'view status';

      container = new ChildViewContainer();
      container._set([view, new Backbone.View()], true);
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
        const emptyContainer = new ChildViewContainer();
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
        expect(new ChildViewContainer().contains(view)).to.be.false;
      });
    });
  });

  describe('predicate collection helpers', function() {
    let container;
    let views;

    function expectPredicateCall(call, index, context) {
      expect(call.thisValue).to.equal(context);
      expect(call.args).to.have.lengthOf(2);
      expect(call.args[0]).to.equal(views[index]);
      expect(call.args[1]).to.equal(index);
    }

    beforeEach(function() {
      views = [
        new Backbone.View(),
        new Backbone.View(),
        new Backbone.View()
      ];

      views.forEach((view, index) => {
        view.rank = index + 1;
      });

      container = new ChildViewContainer();
      container._set(views, true);
    });

    describe('#find', function() {
      it('returns the first matching child view and stops iterating', function() {
        const context = { minimumRank: 2 };
        const predicate = this.sinon.spy(function(view) {
          return view.rank >= this.minimumRank ? view : 0;
        });

        const foundView = container.find(predicate, context);

        expect(foundView).to.equal(views[1]);
        expect(predicate).to.have.callCount(2);
        expectPredicateCall(predicate.getCall(0), 0, context);
        expectPredicateCall(predicate.getCall(1), 1, context);
      });

      it('returns undefined after every child view fails the predicate', function() {
        const predicate = this.sinon.spy(() => false);

        expect(container.find(predicate)).to.be.undefined;
        expect(predicate).to.have.callCount(3);
        expectPredicateCall(predicate.getCall(0), 0, undefined);
        expectPredicateCall(predicate.getCall(1), 1, undefined);
        expectPredicateCall(predicate.getCall(2), 2, undefined);
      });

      it('does not call the predicate for an empty container', function() {
        const predicate = this.sinon.spy();

        expect(new ChildViewContainer().find(predicate)).to.be.undefined;
        expect(predicate).to.not.have.been.called;
      });
    });

    describe('#filter', function() {
      it('returns matching child views in order after visiting every child', function() {
        const context = { minimumRank: 2 };
        const predicate = this.sinon.spy(function(view) {
          return view.rank >= this.minimumRank ? view : 0;
        });

        const matchingViews = container.filter(predicate, context);

        expect(matchingViews).to.have.lengthOf(2);
        expect(matchingViews[0]).to.equal(views[1]);
        expect(matchingViews[1]).to.equal(views[2]);
        expect(predicate).to.have.callCount(3);
        expectPredicateCall(predicate.getCall(0), 0, context);
        expectPredicateCall(predicate.getCall(1), 1, context);
        expectPredicateCall(predicate.getCall(2), 2, context);

        matchingViews.pop();
        expect(container).to.have.lengthOf(3);
        expect(container.last()).to.equal(views[2]);
        expect(container.filter(view => view.rank >= 2)).to.not.equal(matchingViews);
      });

      it('returns an empty array without calling the predicate for an empty container', function() {
        const predicate = this.sinon.spy();
        const emptyContainer = new ChildViewContainer();
        const result = emptyContainer.filter(predicate);

        expect(result).to.deep.equal([]);
        expect(emptyContainer.filter(predicate)).to.not.equal(result);
        expect(predicate).to.not.have.been.called;
      });
    });

    describe('#reject', function() {
      it('returns rejected child views in order after visiting every child', function() {
        const context = { minimumRank: 2 };
        const predicate = this.sinon.spy(function(view) {
          return view.rank >= this.minimumRank ? view : 0;
        });

        const rejectedViews = container.reject(predicate, context);

        expect(rejectedViews).to.have.lengthOf(1);
        expect(rejectedViews[0]).to.equal(views[0]);
        expect(predicate).to.have.callCount(3);
        expectPredicateCall(predicate.getCall(0), 0, context);
        expectPredicateCall(predicate.getCall(1), 1, context);
        expectPredicateCall(predicate.getCall(2), 2, context);

        rejectedViews.pop();
        expect(container).to.have.lengthOf(3);
        expect(container.first()).to.equal(views[0]);
        expect(container.reject(view => view.rank >= 2)).to.not.equal(rejectedViews);
      });

      it('returns an empty array without calling the predicate for an empty container', function() {
        const predicate = this.sinon.spy();
        const emptyContainer = new ChildViewContainer();
        const result = emptyContainer.reject(predicate);

        expect(result).to.deep.equal([]);
        expect(emptyContainer.reject(predicate)).to.not.equal(result);
        expect(predicate).to.not.have.been.called;
      });
    });

    describe('#every', function() {
      it('returns false at the first child view that fails the predicate', function() {
        const context = { maximumRank: 1 };
        const predicate = this.sinon.spy(function(view) {
          return view.rank <= this.maximumRank ? 'pass' : 0;
        });

        expect(container.every(predicate, context)).to.be.false;
        expect(predicate).to.have.callCount(2);
        expectPredicateCall(predicate.getCall(0), 0, context);
        expectPredicateCall(predicate.getCall(1), 1, context);
      });

      it('returns true after every child view passes the predicate', function() {
        const predicate = this.sinon.spy(() => true);

        expect(container.every(predicate)).to.be.true;
        expect(predicate).to.have.callCount(3);
        expectPredicateCall(predicate.getCall(0), 0, undefined);
        expectPredicateCall(predicate.getCall(1), 1, undefined);
        expectPredicateCall(predicate.getCall(2), 2, undefined);
      });

      it('returns true without calling the predicate for an empty container', function() {
        const predicate = this.sinon.spy();

        expect(new ChildViewContainer().every(predicate)).to.be.true;
        expect(predicate).to.not.have.been.called;
      });
    });

    describe('#some', function() {
      it('returns true at the first child view that passes the predicate', function() {
        const context = { minimumRank: 2 };
        const predicate = this.sinon.spy(function(view) {
          return view.rank >= this.minimumRank ? view : null;
        });

        expect(container.some(predicate, context)).to.be.true;
        expect(predicate).to.have.callCount(2);
        expectPredicateCall(predicate.getCall(0), 0, context);
        expectPredicateCall(predicate.getCall(1), 1, context);
      });

      it('returns false after every child view fails the predicate', function() {
        const predicate = this.sinon.spy(() => false);

        expect(container.some(predicate)).to.be.false;
        expect(predicate).to.have.callCount(3);
        expectPredicateCall(predicate.getCall(0), 0, undefined);
        expectPredicateCall(predicate.getCall(1), 1, undefined);
        expectPredicateCall(predicate.getCall(2), 2, undefined);
      });

      it('returns false without calling the predicate for an empty container', function() {
        const predicate = this.sinon.spy();

        expect(new ChildViewContainer().some(predicate)).to.be.false;
        expect(predicate).to.not.have.been.called;
      });
    });

    describe('#partition', function() {
      it('partitions every child view into new ordered arrays', function() {
        const context = { minimumRank: 2 };
        const predicate = this.sinon.spy(function(view) {
          return view.rank >= this.minimumRank ? view : 0;
        });

        const partitionedViews = container.partition(predicate, context);
        const [matchingViews, rejectedViews] = partitionedViews;

        expect(matchingViews).to.have.lengthOf(2);
        expect(matchingViews[0]).to.equal(views[1]);
        expect(matchingViews[1]).to.equal(views[2]);
        expect(rejectedViews).to.have.lengthOf(1);
        expect(rejectedViews[0]).to.equal(views[0]);
        expect(predicate).to.have.callCount(3);
        expectPredicateCall(predicate.getCall(0), 0, context);
        expectPredicateCall(predicate.getCall(1), 1, context);
        expectPredicateCall(predicate.getCall(2), 2, context);

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
        const predicate = this.sinon.spy();
        const emptyContainer = new ChildViewContainer();
        const result = emptyContainer.partition(predicate);
        const nextResult = emptyContainer.partition(predicate);

        expect(result).to.deep.equal([[], []]);
        expect(nextResult).to.not.equal(result);
        expect(nextResult[0]).to.not.equal(result[0]);
        expect(nextResult[1]).to.not.equal(result[1]);
        expect(predicate).to.not.have.been.called;
      });
    });
  });

  describe('ordered collection helpers', function() {
    let container;
    let views;

    beforeEach(function() {
      views = [
        new Backbone.View(),
        new Backbone.View(),
        new Backbone.View()
      ];

      container = new ChildViewContainer();
      container._set(views, true);
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
        expect(new ChildViewContainer().toArray()).to.deep.equal([]);
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
        const emptyContainer = new ChildViewContainer();

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
        const emptyContainer = new ChildViewContainer();

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
        const emptyContainer = new ChildViewContainer();

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
        const emptyContainer = new ChildViewContainer();

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
        const emptyContainer = new ChildViewContainer();

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
        expect(new ChildViewContainer().isEmpty()).to.be.true;
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

  describe('#_init', function() {
    let container;

    beforeEach(function() {
      container = new ChildViewContainer();

      container._set([
        new Backbone.View(),
        new Backbone.View(),
        new Backbone.View(),
        new Backbone.View()
      ], true);

      container._init();
    });

    it('should empty all of the view buffers', function() {
      expect(container._views).to.deep.equal([]);
      expect(container._viewsByCid).to.deep.equal({});
      expect(container._indexByModel).to.deep.equal(new Map());
    });

    it('should update length to 0', function() {
      expect(container).to.have.lengthOf(0);
    });
  });

  describe('#_add', function() {
    it('indexes prototype-collision view and model cids as ordinary keys', function() {
      const container = new ChildViewContainer(BackboneDataApi);
      const views = ['constructor', 'toString', '__proto__'].map(cid => {
        const model = new Backbone.Model();
        model.cid = cid;
        const view = new Backbone.View({ model });
        view.cid = cid;
        container._add(view);
        return view;
      });

      views.forEach(view => {
        expect(container.findByCid(view.cid)).to.equal(view);
        expect(container.findByModel(view.model)).to.equal(view);
        expect(container.hasView(view)).to.be.true;
      });
    });

    describe('when adding a view that does not have a model', function() {
      let container;
      let view;
      let foundView;
      let indexView;

      beforeEach(function() {
        view = new Backbone.View();

        container = new ChildViewContainer(BackboneDataApi);

        container._add(view);

        foundView = container.findByCid(view.cid);
        indexView = container.findByIndex(0);
      });

      it('should make the view retrievable by the view\'s cid', function() {
        expect(foundView).to.equal(view);
      });

      it('should make the view retrievable by numeric index', function() {
        expect(indexView).to.equal(view);
      });

      it('should update the size of the chidren', function() {
        expect(container).to.have.lengthOf(1);
      })
    });

    describe('when adding a view that has a model', function() {
      let container;
      let view;
      let foundView;
      let model;

      beforeEach(function() {
        model = new Backbone.Model();
        view = new Backbone.View({
          model: model
        });

        container = new ChildViewContainer();

        container._add(view);

        foundView = container.findByModel(model);
      });

      it('should make the view retrievable by the model', function() {
        expect(foundView).to.equal(view);
      });
    });

    describe('when adding a view with an index value', function() {
      let container;
      let view;
      let foundView;

      beforeEach(function() {
        view = new Backbone.View();

        container = new ChildViewContainer();

        container._set([
          new Backbone.View(),
          new Backbone.View(),
          new Backbone.View(),
          new Backbone.View()
        ], true);

        container._add(view, 3);

        foundView = container.findByIndex(3);
      });

      it('should make the view retrievable by the index', function() {
        expect(foundView).to.equal(view);
      });
    });

  });

  describe('#_set', function() {
    let container;
    let views;
    let originalViews;
    let originalView;

    beforeEach(function() {
      views = [
        new Backbone.View(),
        new Backbone.View()
      ];

      container = new ChildViewContainer();

      container._add(new Backbone.View());
      container._add(new Backbone.View());
      container._add(new Backbone.View());

      originalViews = container._views;
      originalView = container._views[0];
    });

    it('should replace the contents of _views', function() {
      container._set(views);
      expect(container._views[0]).to.equal(views[0]);
    });

    it('should keep the _views array reference', function() {
      container._set(views);
      expect(container._views).to.equal(originalViews);
    });

    describe('when resetting', function() {
      beforeEach(function() {
        container._set(views, true);
      });

      it('should not have an old view', function() {
        expect(container.hasView(originalView)).to.be.false;
      });

      it('should have a new view', function() {
        expect(container.hasView(views[0])).to.be.true;
      });

      it('should update the length', function() {
        expect(container).to.have.lengthOf(2);
      });
    });
  });

  describe('#_remove', function() {
    it('preserves a later child that currently owns the same data key', function() {
      const container = new ChildViewContainer({ key: model => model.id });
      const first = new Backbone.View({ model: { id: 1 } });
      const second = new Backbone.View({ model: { id: 1 } });
      container._add(first);
      container._add(second);

      container._remove(first);

      expect(container.findByModel(second.model)).to.equal(second);
    });

    describe('when removing a view that has a model', function() {
      let container;
      let view;
      let model;

      beforeEach(function() {
        model = new Backbone.Model();

        view = new Backbone.View({
          model: model
        });

        container = new ChildViewContainer();

        container._set([
          new Backbone.View(),
          new Backbone.View(),
          new Backbone.View(),
          new Backbone.View()
        ], true);

        container._add(view, 1);

        container._remove(view);
      });

      it('should update the size of the children', function() {
        expect(container).to.have.lengthOf(4);
      });

      it('should remove the index by model', function() {
        const foundView = container.findByModel(model);
        expect(foundView).to.be.undefined;
      });

      it('should remove the index', function() {
        const foundView = container.findByIndex(1);
        expect(foundView).to.not.equal(view);
      });

      it('should remove the view from the container', function() {
        const foundView = container.findByCid(view.cid);
        expect(foundView).to.be.undefined;
      });
    });

    describe('when removing a view that does not have a model', function() {
      let container;
      let view;

      beforeEach(function() {
        view = new Backbone.View();

        container = new ChildViewContainer();

        container._set([
          new Backbone.View(),
          new Backbone.View(),
          new Backbone.View(),
          new Backbone.View()
        ], true);

        container._add(view, 1);

        container._remove(view);
      });

      it('should update the size of the children', function() {
        expect(container).to.have.lengthOf(4);
      });

      it('should remove the index', function() {
        const foundView = container.findByIndex(1);
        expect(foundView).to.not.equal(view);
      });

      it('should remove the view from the container', function() {
        const foundView = container.findByCid(view.cid);
        expect(foundView).to.be.undefined;
      });
    });

    describe('when removing a view not in the container', function() {
      let container;
      let view;

      beforeEach(function() {
        view = new Backbone.View();

        container = new ChildViewContainer();

        container._set([
          new Backbone.View(),
          new Backbone.View(),
          new Backbone.View(),
          new Backbone.View()
        ], true);

        container._remove(view);
      });

      it('should not remove a view from the container', function() {
        expect(container).to.have.lengthOf(4);
      });

      it('does not remove a real child for an inherited-key or same-cid impostor', function() {
        const realView = container.first();
        const inheritedKeyImpostor = { cid: 'toString' };
        const sameCidImpostor = { cid: realView.cid };

        container._remove(inheritedKeyImpostor);
        container._remove(sameCidImpostor);

        expect(container).to.have.lengthOf(4);
        expect(container.first()).to.equal(realView);
        expect(container.findByCid(realView.cid)).to.equal(realView);
      });
    });

    it('fully removes a child whose cid is __proto__', function() {
      const container = new ChildViewContainer();
      const view = new Backbone.View();
      view.cid = '__proto__';

      container._add(view);
      container._remove(view);

      expect(container).to.have.lengthOf(0);
      expect(container.findByCid('__proto__')).to.be.undefined;
      expect(container.hasView(view)).to.be.false;
    });
  });

  describe('#_sort', function() {
    describe('when using a string comparator', function() {
      let container;
      let collection;

      beforeEach(function() {
        collection = new Backbone.Collection([
          { text: 'foo' },
          { text: 'bar' },
          { text: 'baz' }
        ]);

        container = new ChildViewContainer(BackboneDataApi);

        collection.each(model => {
          const view = new Backbone.View({ model });
          container._add(view);
        });

        this.modelGetSpies = collection.map(model => this.sinon.spy(model, 'get'));
        this.viewsReference = container._views;
        container._sort('text');
      });

      it('should should re-sort the container', function() {
        expect(container.findByIndex(0).model).to.equal(collection.models[1]);
        expect(container.findByIndex(1).model).to.equal(collection.models[2]);
        expect(container.findByIndex(2).model).to.equal(collection.models[0]);
      });

      it('preserves the child array reference', function() {
        expect(container._views).to.equal(this.viewsReference);
      });

      it('evaluates each model attribute once', function() {
        this.modelGetSpies.forEach(get => {
          expect(get).to.have.been.calledOnce.and.calledWithExactly('text');
        });
      });

      describe('when a view does not have a model', function() {
        beforeEach(function() {
          container._add(new Backbone.View());
          container._sort('text');
        });

        it('should should re-sort the container', function() {
          expect(container.findByIndex(0).model).to.equal(collection.models[1]);
          expect(container.findByIndex(1).model).to.equal(collection.models[2]);
          expect(container.findByIndex(2).model).to.equal(collection.models[0]);
        });

        it('should sort the view without model at the end', function() {
          expect(container.findByIndex(3).model).to.be.undefined;
        });
      });
    });

    describe('when using a sortBy iterator', function() {
      let container;
      let collection;
      let comparator;

      beforeEach(function() {
        collection = new Backbone.Collection([
          { text: 'foo' },
          { text: 'bar' },
          { text: 'baz' }
        ]);

        container = new ChildViewContainer();

        collection.each(model => {
          const view = new Backbone.View({ model });
          container._add(view);
        });

        this.comparator = function(view) {
          return view.model.get('text').substring(1);
        };

        comparator = this.sinon.spy(this, 'comparator');

        this.viewsReference = container._views;
        container._sort(this.comparator, this);
      });

      it('should call the comparator with context', function() {
        expect(comparator).to.have.been.calledOn(this);
        expect(comparator).to.have.callCount(3);
      });

      it('should should re-sort the container', function() {
        expect(container.findByIndex(0).model).to.equal(collection.models[1]);
        expect(container.findByIndex(1).model).to.equal(collection.models[2]);
        expect(container.findByIndex(2).model).to.equal(collection.models[0]);
      });

      it('preserves the child array reference', function() {
        expect(container._views).to.equal(this.viewsReference);
      });

      it('keeps equal criteria stable and evaluates each view once', function() {
        const stableContainer = new ChildViewContainer();
        const views = [
          Object.assign(new Backbone.View(), { rank: 1 }),
          Object.assign(new Backbone.View(), { rank: 1 }),
          Object.assign(new Backbone.View(), { rank: 0 })
        ];
        const rank = this.sinon.spy(view => view.rank);

        stableContainer._set(views, true);
        stableContainer._sort(rank);

        expect(rank).to.have.callCount(3);
        expect(stableContainer.toArray()).to.deep.equal([views[2], views[0], views[1]]);
      });

      it('places undefined criteria last while preserving their order', function() {
        const undefinedContainer = new ChildViewContainer();
        const views = [
          Object.assign(new Backbone.View(), { rank: undefined }),
          Object.assign(new Backbone.View(), { rank: 1 }),
          Object.assign(new Backbone.View(), { rank: undefined }),
          Object.assign(new Backbone.View(), { rank: 0 })
        ];

        undefinedContainer._set(views, true);
        undefinedContainer._sort(view => view.rank);

        expect(undefinedContainer.toArray()).to.deep.equal([
          views[3], views[1], views[0], views[2]
        ]);
      });

      it('keeps NaN and otherwise incomparable criteria stable', function() {
        const nanContainer = new ChildViewContainer();
        const nanViews = [
          Object.assign(new Backbone.View(), { rank: NaN }),
          Object.assign(new Backbone.View(), { rank: 1 })
        ];
        const objectContainer = new ChildViewContainer();
        const objectViews = [
          Object.assign(new Backbone.View(), { rank: {} }),
          Object.assign(new Backbone.View(), { rank: {} })
        ];

        nanContainer._set(nanViews, true);
        nanContainer._sort(view => view.rank);
        objectContainer._set(objectViews, true);
        objectContainer._sort(view => view.rank);

        expect(nanContainer.toArray()).to.deep.equal(nanViews);
        expect(objectContainer.toArray()).to.deep.equal(objectViews);
      });

      it('leaves order and reference unchanged when criteria evaluation throws', function() {
        const viewsReference = container._views;
        const originalOrder = container.toArray();
        const error = new Error('criterion failed');

        expect(() => container._sort(view => {
          if (view === originalOrder[1]) { throw error; }
          return view.model.get('text');
        })).to.throw(error);
        expect(container._views).to.equal(viewsReference);
        expect(container.toArray()).to.deep.equal(originalOrder);
      });

      it('leaves order and reference unchanged when criteria comparison throws', function() {
        const viewsReference = container._views;
        const originalOrder = container.toArray();

        expect(() => container._sort(view => Symbol(view.cid))).to.throw(TypeError);
        expect(container._views).to.equal(viewsReference);
        expect(container.toArray()).to.deep.equal(originalOrder);
      });
    });

    describe('when using a sort iterator', function() {
      let container;
      let collection;
      let comparator;

      beforeEach(function() {
        collection = new Backbone.Collection([
          { text: 'foo' },
          { text: 'bar' },
          { text: 'baz' }
        ]);

        container = new ChildViewContainer();

        collection.each(model => {
          const view = new Backbone.View({ model });
          container._add(view);
        });

        this.comparator = function(viewa, viewb) {
          const aText = viewa.model.get('text');
          const bText = viewb.model.get('text');
          return bText.localeCompare(aText);
        };

        comparator = this.sinon.spy(this, 'comparator');

        this.viewsReference = container._views;
        this.result = container._sort(this.comparator, this);
      });

      it('should call the comparator with context', function() {
        expect(comparator).to.have.been.calledOn(this);
      });

      it('should re-sort the container', function() {
        expect(container.findByIndex(0).model).to.equal(collection.models[0]);
        expect(container.findByIndex(1).model).to.equal(collection.models[2]);
        expect(container.findByIndex(2).model).to.equal(collection.models[1]);
      });

      it('retains native binary sort mutation and return behavior', function() {
        expect(container._views).to.equal(this.viewsReference);
        expect(this.result).to.equal(this.viewsReference);
      });
    });
  });

  describe('#_swap', function() {
    let container;
    let collection;

    beforeEach(function() {
      collection = new Backbone.Collection([
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ]);

      container = new ChildViewContainer();

      collection.each(model => {
        const view = new Backbone.View({ model });
        container._add(view);
      });

    });

    describe('when both views are in the container', function() {
      it('should swap the views', function() {
        container._swap(container.findByIndex(0), container.findByIndex(2));

        expect(container.findByIndex(0).model).to.equal(collection.get(3));
        expect(container.findByIndex(1).model).to.equal(collection.get(2));
        expect(container.findByIndex(2).model).to.equal(collection.get(1));
      });
    });

    describe('when the first view is not in the container', function() {
      it('should not swap views', function() {
        container._swap(new Backbone.View(), container.findByIndex(2));

        expect(container.findByIndex(0).model).to.equal(collection.get(1));
        expect(container.findByIndex(1).model).to.equal(collection.get(2));
        expect(container.findByIndex(2).model).to.equal(collection.get(3));
      });
    });

    describe('when the second view is not in the container', function() {
      it('should not swap views', function() {
        container._swap(container.findByIndex(0), new Backbone.View());

        expect(container.findByIndex(0).model).to.equal(collection.get(1));
        expect(container.findByIndex(1).model).to.equal(collection.get(2));
        expect(container.findByIndex(2).model).to.equal(collection.get(3));
      });
    });
  });

  describe('#hasView', function() {
    it('should return true if a view exists in the container', function() {
      const container = new ChildViewContainer();
      const view = new Backbone.View();
      container._add(view);
      expect(container.hasView(view)).to.be.true;
    });

    it('should return false if a view does not exist in the container', function() {
      const container = new ChildViewContainer();
      const view = new Backbone.View();
      expect(container.hasView(view)).to.be.false;
    });

    it('requires the exact registered view for matching and inherited cids', function() {
      const container = new ChildViewContainer();
      const view = new Backbone.View();
      container._add(view);

      expect(container.hasView({ cid: view.cid })).to.be.false;
      expect(container.hasView({ cid: 'toString' })).to.be.false;
    });
  });
});
