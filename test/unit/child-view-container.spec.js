import _ from 'underscore';
import Backbone from 'backbone';
import ChildViewContainer from '../../src/child-view-container';

describe('#ChildViewContainer', function() {

  describe('emulate collection', function() {
    let container;

    beforeEach(function() {
      container = new ChildViewContainer();

      container._set([
        new Backbone.View({ id: 1 }),
        new Backbone.View({ id: 2 }),
        new Backbone.View({ id: 3 })
      ], true);
    });

    it('should be able to map over list', function() {
      expect(container.map('id')).to.eql([1, 2, 3]);
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
      expect(container._indexByModel).to.deep.equal({});
    });

    it('should update length to 0', function() {
      expect(container).to.have.lengthOf(0);
    });
  });

  describe('#_add', function() {
    describe('when adding a view that does not have a model', function() {
      let container;
      let view;
      let foundView;
      let indexView;

      beforeEach(function() {
        view = new Backbone.View();

        container = new ChildViewContainer();

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
    });
  });

  describe('when using iterators and collection functions', function() {
    let container;
    let view;
    let views;

    beforeEach(function() {
      views = [];
      view = new Backbone.View();

      container = new ChildViewContainer();
      container._add(view);

      container.each(function(v) {
        views.push(v);
      });
    });

    it('should provide a .each iterator', function() {
      expect(_.isFunction(container.each)).to.equal(true);
    });

    it('should iterate the views with the .each function', function() {
      expect(views[0]).to.equal(view);
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

        container = new ChildViewContainer();

        collection.each(model => {
          const view = new Backbone.View({ model });
          container._add(view);
        });

        container._sort('text');
      });

      it('should should re-sort the container', function() {
        expect(container.findByIndex(0).model).to.equal(collection.models[1]);
        expect(container.findByIndex(1).model).to.equal(collection.models[2]);
        expect(container.findByIndex(2).model).to.equal(collection.models[0]);
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

        container._sort(this.comparator, this);
      });

      it('should call the comparator with context', function() {
        expect(comparator).to.have.been.calledOn(this);
      });

      it('should should re-sort the container', function() {
        expect(container.findByIndex(0).model).to.equal(collection.models[1]);
        expect(container.findByIndex(1).model).to.equal(collection.models[2]);
        expect(container.findByIndex(2).model).to.equal(collection.models[0]);
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

        container._sort(this.comparator, this);
      });

      it('should call the comparator with context', function() {
        expect(comparator).to.have.been.calledOn(this);
      });

      it('should re-sort the container', function() {
        expect(container.findByIndex(0).model).to.equal(collection.models[0]);
        expect(container.findByIndex(1).model).to.equal(collection.models[2]);
        expect(container.findByIndex(2).model).to.equal(collection.models[1]);
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
  });
});
