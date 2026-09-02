import MarionetteError from '../utils/error.js';
import DataApi from '../runtime/data-api.js';

const classErrorName = 'CollectionViewError';

function createIndex() {
  return Object.create(null);
}

// Provide a container to store, retrieve and
// shut down child views.
const Container = function(dataApi = DataApi) {
  this.Data = dataApi;
  this._init();
};

function assertFunction(callback) {
  if (typeof callback !== 'function') {
    throw new MarionetteError({
      code: 'MN0024',
      name: classErrorName,
      message: 'ChildViewContainer callback must be a function.'
    });
  }
}

function assertCount(count) {
  if (!Number.isInteger(count) || count < 0) {
    throw new MarionetteError({
      code: 'MN0024',
      name: classErrorName,
      message: 'ChildViewContainer count must be a nonnegative integer.'
    });
  }

  return count;
}

function stringComparator(Data, comparator, view) {
  return view.model && Data.has(view.model, comparator) ?
    Data.get(view.model, comparator) : undefined;
}

function compareCriteria(left, right) {
  const leftCriteria = left.criteria;
  const rightCriteria = right.criteria;

  if (leftCriteria !== rightCriteria) {
    if (leftCriteria > rightCriteria || leftCriteria === undefined) { return 1; }
    if (leftCriteria < rightCriteria || rightCriteria === undefined) { return -1; }
  }

  return left.index - right.index;
}

function sortByCriteria(views, comparator, context) {
  const decoratedViews = views.map((view, index) => ({
    criteria: comparator.call(context, view),
    index,
    view
  }));

  decoratedViews.sort(compareCriteria);

  return decoratedViews.map(({ view }) => view);
}

// Container Methods
// -----------------

Object.assign(Container.prototype, {

  each(callback, context) {
    assertFunction(callback);

    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      callback.call(context, this._views[index], index);
    }

    return this;
  },

  map(callback, context) {
    assertFunction(callback);

    const length = this._views.length;
    const results = Array(length);
    for (let index = 0; index < length; index++) {
      results[index] = callback.call(context, this._views[index], index);
    }

    return results;
  },

  reduce(callback, initialValue, context) {
    assertFunction(callback);

    const length = this._views.length;
    const hasInitialValue = arguments.length > 1;
    let index = 0;
    let accumulator = initialValue;

    if (!hasInitialValue) {
      if (!length) {
        throw new MarionetteError({
          code: 'MN0024',
          name: classErrorName,
          message: 'Reduce of empty ChildViewContainer with no initial value.'
        });
      }

      accumulator = this._views[index++];
    }

    for (; index < length; index++) {
      accumulator = callback.call(context, accumulator, this._views[index], index);
    }

    return accumulator;
  },

  find(predicate, context) {
    assertFunction(predicate);

    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      if (predicate.call(context, view, index)) {
        return view;
      }
    }
  },

  filter(predicate, context) {
    assertFunction(predicate);

    const results = [];
    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      if (predicate.call(context, view, index)) {
        results.push(view);
      }
    }

    return results;
  },

  reject(predicate, context) {
    assertFunction(predicate);

    const results = [];
    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      if (!predicate.call(context, view, index)) {
        results.push(view);
      }
    }

    return results;
  },

  every(predicate, context) {
    assertFunction(predicate);

    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      if (!predicate.call(context, this._views[index], index)) {
        return false;
      }
    }

    return true;
  },

  some(predicate, context) {
    assertFunction(predicate);

    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      if (predicate.call(context, this._views[index], index)) {
        return true;
      }
    }

    return false;
  },

  contains(view) {
    return this._views.indexOf(view) !== -1;
  },

  invoke(methodName, ...args) {
    if (typeof methodName !== 'string') {
      throw new MarionetteError({
        code: 'MN0024',
        name: classErrorName,
        message: 'ChildViewContainer method name must be a string.'
      });
    }

    const length = this._views.length;
    const results = Array(length);
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      const method = view[methodName];
      if (typeof method !== 'function') {
        throw new MarionetteError({
          code: 'MN0025',
          name: classErrorName,
          message: `Child view method "${ methodName }" must be callable.`
        });
      }

      results[index] = method.apply(view, args);
    }

    return results;
  },

  toArray() {
    return this._views.slice();
  },

  first(count) {
    if (count === undefined) {
      return this._views[0];
    }

    return this._views.slice(0, assertCount(count));
  },

  initial(count = 1) {
    const end = Math.max(this._views.length - assertCount(count), 0);
    return this._views.slice(0, end);
  },

  rest(count = 1) {
    return this._views.slice(assertCount(count));
  },

  last(count) {
    if (count === undefined) {
      return this._views[this._views.length - 1];
    }

    const start = Math.max(this._views.length - assertCount(count), 0);
    return this._views.slice(start);
  },

  without(...excludedViews) {
    const results = [];
    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      if (excludedViews.indexOf(view) === -1) {
        results.push(view);
      }
    }

    return results;
  },

  isEmpty() {
    return this._views.length === 0;
  },

  pluck(key) {
    const length = this._views.length;
    const results = Array(length);
    for (let index = 0; index < length; index++) {
      results[index] = this._views[index][key];
    }

    return results;
  },

  partition(predicate, context) {
    assertFunction(predicate);

    const matching = [];
    const rejected = [];
    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      (predicate.call(context, view, index) ? matching : rejected).push(view);
    }

    return [matching, rejected];
  },

  // Initializes an empty container
  _init() {
    this._views = [];
    this._viewsByCid = createIndex();
    this._indexByModel = new Map();
    this._keyByView = new Map();
    this._updateLength();
  },

  // Add a view to this container. Stores the view
  // by `cid` and makes it searchable by the model
  // identity supplied by DataApi. Additionally it stores
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
      const key = this.Data.key(view.model);
      this._indexByModel.set(key, view);
      this._keyByView.set(view, key);
    }
  },

  // Sort (mutate) and return the array of the child views.
  _sort(comparator, context) {
    if (typeof comparator === 'string') {
      return this._sortBy(view => stringComparator(this.Data, comparator, view));
    }

    if (comparator.length === 1) {
      return this._sortBy(comparator, context);
    }

    return this._views.sort(comparator.bind(context));
  },

  // Makes `sortBy` mutate the array to match `this._views.sort`
  _sortBy(comparator, context) {
    const sortedViews = sortByCriteria(this._views, comparator, context);

    this._set(sortedViews);

    return sortedViews;
  },

  // Replace array contents without overwriting the reference.
  // Should not add/remove views
  _set(views, shouldReset) {
    this._views.length = 0;

    this._views.push.apply(this._views, views.slice(0));

    if (shouldReset) {
      this._viewsByCid = createIndex();
      this._indexByModel = new Map();
      this._keyByView = new Map();

      for (const view of views) {
        this._addViewIndexes(view);
      }

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
  findByModel(model) {
    return this._indexByModel.get(this.Data.key(model));
  },

  findByKey(key) {
    return this._indexByModel.get(key);
  },

  _replaceModel(view, model, key) {
    const previousKey = this._keyByView.get(view);
    this._indexByModel.delete(previousKey);

    view.model = model;
    this._indexByModel.set(key, view);
    this._keyByView.set(view, key);
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
    return this.findByCid(view.cid) === view;
  },

  // Remove a view and clean up index references.
  _remove(view) {
    if (!this.hasView(view)) {
      return;
    }

    // delete model index
    if (view.model) {
      const modelKey = this._keyByView.get(view);
      if (this._indexByModel.get(modelKey) === view) {
        this._indexByModel.delete(modelKey);
      }
      this._keyByView.delete(view);
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

Container.prototype[Symbol.iterator] = function() {
  return this._views[Symbol.iterator]();
};

export default Container;
