import { extend, partial, sortBy } from 'underscore';

import { forEach, each, map, find, detect, filter,
  select, reject, every, all, some, any, include,
  contains, invoke, toArray, first, initial, rest,
  last, without, isEmpty, pluck, reduce, partition } from 'underscore';

const _ = { forEach, each, map, find, detect, filter,
  select, reject, every, all, some, any, include,
  contains, invoke, toArray, first, initial, rest,
  last, without, isEmpty, pluck, reduce, partition };

// Provide a container to store, retrieve and
// shut down child views.
const Container = function() {
  this._init();
};

// Mix in methods from Underscore, for iteration, and other
// collection related features.
// Borrowing this code from Backbone.Collection:
// https://github.com/jashkenas/backbone/blob/1.1.2/backbone.js#L962
const methods = ['forEach', 'each', 'map', 'find', 'detect', 'filter',
  'select', 'reject', 'every', 'all', 'some', 'any', 'include',
  'contains', 'invoke', 'toArray', 'first', 'initial', 'rest',
  'last', 'without', 'isEmpty', 'pluck', 'reduce', 'partition'];

each(methods, function(method) {
  Container.prototype[method] = function(...args) {
    return _[method].apply(_, [this._views].concat(args));
  };
});

function stringComparator(comparator, view) {
  return view.model && view.model.get(comparator);
}

// Container Methods
// -----------------

extend(Container.prototype, {

  // Initializes an empty container
  _init() {
    this._views = [];
    this._viewsByCid = {};
    this._indexByModel = {};
    this._updateLength();
  },

  // Add a view to this container. Stores the view
  // by `cid` and makes it searchable by the model
  // cid (and model itself). Additionally it stores
  // the view by index in the _views array
  _add(view, index = this._views.length) {
    this._addViewIndexes(view);

    // add to end by default
    this._views.splice(index, 0, view);

    this._updateLength();
  },

  _addViewIndexes(view) {
    // store the view
    this._viewsByCid[view.cid] = view;

    // index it by model
    if (view.model) {
      this._indexByModel[view.model.cid] = view;
    }
  },

  // Sort (mutate) and return the array of the child views.
  _sort(comparator, context) {
    if (typeof comparator === 'string') {
      comparator = partial(stringComparator, comparator);
      return this._sortBy(comparator);
    }

    if (comparator.length === 1) {
      return this._sortBy(comparator.bind(context));
    }

    return this._views.sort(comparator.bind(context));
  },

  // Makes `sortBy` mutate the array to match `this._views.sort`
  _sortBy(comparator) {
    const sortedViews = sortBy(this._views, comparator);

    this._set(sortedViews);

    return sortedViews;
  },

  // Replace array contents without overwriting the reference.
  // Should not add/remove views
  _set(views, shouldReset) {
    this._views.length = 0;

    this._views.push.apply(this._views, views.slice(0));

    if (shouldReset) {
      this._viewsByCid = {};
      this._indexByModel = {};

      each(views, this._addViewIndexes.bind(this));

      this._updateLength();
    }
  },

  // Swap views by index
  _swap(view1, view2) {
    const view1Index = this.findIndexByView(view1);
    const view2Index = this.findIndexByView(view2);

    if (view1Index === -1 || view2Index === -1) {
      return;
    }

    const swapView = this._views[view1Index];
    this._views[view1Index] = this._views[view2Index];
    this._views[view2Index] = swapView;
  },

  // Find a view by the model that was attached to it.
  // Uses the model's `cid` to find it.
  findByModel(model) {
    return this.findByModelCid(model.cid);
  },

  // Find a view by the `cid` of the model that was attached to it.
  findByModelCid(modelCid) {
    return this._indexByModel[modelCid];
  },

  // Find a view by index.
  findByIndex(index) {
    return this._views[index];
  },

  // Find the index of a view instance
  findIndexByView(view) {
    return this._views.indexOf(view);
  },

  // Retrieve a view by its `cid` directly
  findByCid(cid) {
    return this._viewsByCid[cid];
  },

  hasView(view) {
    return !!this.findByCid(view.cid);
  },

  // Remove a view and clean up index references.
  _remove(view) {
    if (!this._viewsByCid[view.cid]) {
      return;
    }

    // delete model index
    if (view.model) {
      delete this._indexByModel[view.model.cid];
    }

    // remove the view from the container
    delete this._viewsByCid[view.cid];

    const index = this.findIndexByView(view);
    this._views.splice(index, 1);

    this._updateLength();
  },

  // Update the `.length` attribute on this container
  _updateLength() {
    this.length = this._views.length;
  }
});

export default Container;
