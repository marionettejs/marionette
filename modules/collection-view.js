// Collection View
// ---------------

import { assignOwn } from '../utils/assign-in.js';
import extend from '../utils/extend.js';
import getValue from '../utils/get-value.js';
import isString from '../utils/is-string.js';
import uniqueId from '../utils/unique-id.js';
import MarionetteError from '../utils/error.js';
import disposeAll from '../utils/dispose-all.js';
import { renderView, destroyView, isViewClass } from './common/view.js';
import monitorViewEvents from './common/monitor-view-events.js';
import ChildViewContainer from './child-view-container.js';
import Region from './region.js';
import ViewMixin, { ViewOptions } from '../mixins/view.js';
import { setDomApi } from '../runtime/dom-api.js';
import { setEventDelegator } from '../runtime/event-delegator.js';
import { setRenderer } from '../runtime/renderer.js';
import { setDataApi } from '../runtime/data-api.js';
import { setStateApi } from '../runtime/state-api.js';
import { normalizeDisposer } from '../utils/subscribe-bindings.js';

const classErrorName = 'CollectionViewError';

function throwCollectionProtocolError(message) {
  throw new MarionetteError({
    code: 'MN0039',
    name: classErrorName,
    message,
    url: 'data.api.html#collection-observations'
  });
}

function buildCollectionSnapshot(Data, collection, previous) {
  const items = Data.items(collection);
  if (!Array.isArray(items)) {
    throwCollectionProtocolError('DataApi.items() must return an ordered array snapshot.');
  }

  const previousKeys = new Map(previous.map(entry => [entry.item, entry.key]));
  const keys = new Map();
  const itemEntries = new Map();
  const snapshot = Array(items.length);

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const key = Data.key(item);

    if (key == null) {
      throwCollectionProtocolError(`DataApi.key() returned a missing key for item at index ${ index }.`);
    }
    if (keys.has(key)) {
      throwCollectionProtocolError(`DataApi.key() returned duplicate key "${ String(key) }".`);
    }
    if (previousKeys.has(item) && !Object.is(previousKeys.get(item), key)) {
      throwCollectionProtocolError('DataApi.key() changed while an item remained in the CollectionView.');
    }

    const entry = { item, key };
    snapshot[index] = entry;
    keys.set(key, entry);
    itemEntries.set(item, entry);
  }

  return { entries: snapshot, items: itemEntries, keys };
}

function sameItems(actual, expected) {
  if (actual.length !== expected.length) { return false; }
  const remaining = new Set(expected);

  for (const item of actual) {
    if (!remaining.delete(item)) { return false; }
  }

  return true;
}

function normalizeCollectionChange(change, previous, current) {
  if (!change || typeof change !== 'object') {
    throwCollectionProtocolError('DataApi.observeCollection() must notify with a structural change record.');
  }
  if (change.kind === 'reset') { return { kind: 'reset' }; }
  if (change.kind !== 'reorder' && change.kind !== 'update') {
    throwCollectionProtocolError(`Unknown collection change kind "${ String(change.kind) }".`);
  }

  const added = current.entries.filter(entry => !previous.keys.has(entry.key));
  const removed = previous.entries.filter(entry => !current.keys.has(entry.key));
  const replacements = current.entries
    .filter(entry => previous.keys.has(entry.key) && previous.keys.get(entry.key).item !== entry.item)
    .map(entry => ({
      key: entry.key,
      previous: previous.keys.get(entry.key).item,
      current: entry.item
    }));

  if (change.kind === 'reorder') {
    if (added.length || removed.length || replacements.length) {
      throwCollectionProtocolError('A reorder record cannot add, remove, or replace items.');
    }
    return { kind: 'reorder' };
  }

  if (!Array.isArray(change.added) || !Array.isArray(change.removed) ||
      !Array.isArray(change.updated)) {
    throwCollectionProtocolError('An update record requires added, removed, and updated arrays.');
  }
  if (!sameItems(change.added, added.map(entry => entry.item)) ||
      !sameItems(change.removed, removed.map(entry => entry.item))) {
    throwCollectionProtocolError('An update record must match the source snapshot additions and removals.');
  }

  const updated = [];
  const updatedKeys = new Set();
  for (const pair of change.updated) {
    if (!pair || typeof pair !== 'object' ||
        !Object.hasOwn(pair, 'previous') || !Object.hasOwn(pair, 'current')) {
      throwCollectionProtocolError('Each updated entry must contain previous and current items.');
    }

    const previousEntry = previous.items.get(pair.previous);
    const currentEntry = current.items.get(pair.current);
    if (!previousEntry || !currentEntry || !Object.is(previousEntry.key, currentEntry.key)) {
      throwCollectionProtocolError('Each updated entry must preserve one existing stable key.');
    }
    if (updatedKeys.has(currentEntry.key)) {
      throwCollectionProtocolError('An update record cannot update the same key more than once.');
    }

    updatedKeys.add(currentEntry.key);
    updated.push({ key: currentEntry.key, previous: pair.previous, current: pair.current });
  }

  for (const replacement of replacements) {
    if (!updatedKeys.has(replacement.key)) {
      throwCollectionProtocolError('A same-key replacement must appear in the updated array.');
    }
  }

  return { kind: 'update', added, removed, updated };
}

function isEmptyViewClass(view) {
  if (typeof view !== 'function' || !view.prototype) { return false; }

  const { render, destroy } = view.prototype;

  return typeof render === 'function' &&
    (destroy ? typeof destroy === 'function' : typeof view.prototype.remove === 'function');
}

function modelAttributesMatcher(Data, predicate) {
  const keys = Object.keys(predicate);
  const length = keys.length;
  const values = Array(length);
  for (let index = 0; index < length; index++) {
    values[index] = predicate[keys[index]];
  }

  return function(view) {
    const model = view.model;
    if (model == null) { return length === 0; }

    for (let index = 0; index < length; index++) {
      const key = keys[index];
      if (!Data.has(model, key) || values[index] !== Data.get(model, key)) { return false; }
    }
    return true;
  };
}

function isClassDefinition(view) {
  return /^class(?:\s|\/[/*])/.test(Function.prototype.toString.call(view));
}

const ClassOptions = [
  'attributes',
  'behaviors',
  'childView',
  'childViewContainer',
  'childViewEventPrefix',
  'childViewEvents',
  'childViewOptions',
  'childViewTriggers',
  'className',
  'collection',
  'collectionEvents',
  'el',
  'emptyView',
  'emptyViewOptions',
  'events',
  'id',
  'model',
  'modelEvents',
  'stateEvents',
  'sortWithCollection',
  'tagName',
  'template',
  'templateContext',
  'triggers',
  'ui',
  'viewComparator',
  'viewFilter'
];

// A view that iterates over a collection
// and renders an individual child view for each model.
const CollectionView = function(options) {
  this.cid = uniqueId(this.cidPrefix);
  this._setOptions(options, ClassOptions);

  this.preinitialize.apply(this, arguments);
  this.mergeOptions(options, ViewOptions);

  this._initViewEvents();

  try {
    this.setElement(this._getEl());

    monitorViewEvents(this);

    this._initState(options);

    this._initChildViewStorage();
    this._initBehaviors();
    this._buildEventProxies();

    this.initialize.apply(this, arguments);

    if (this._isDestroyed || this._isDestroying) { return; }

    this._initStateEvents();

    // Init empty region after initialize to preserve the v4 override boundary.
    this.getEmptyRegion();

    this.delegateEntityEvents();

    this._triggerEventOnBehaviors('initialize', this, options);
  } catch (error) {
    this._rollbackView(error);
  }
};

assignOwn(CollectionView, {
  extend,
  setRenderer,
  setDomApi,
  setEventDelegator,
  setDataApi,
  setStateApi
});

assignOwn(CollectionView.prototype, ViewMixin, {
  cidPrefix: 'mncv',

  // flag for maintaining the sorted order of the collection
  sortWithCollection: true,

  // Internal method to set up the `children` object for storing all of the child views
  // `_children` represents all child views
  // `children` represents only views filtered to be shown
  _initChildViewStorage() {
    this._children = new ChildViewContainer(this.Data);
    this.children = new ChildViewContainer(this.Data);
  },

  // Create a region to show the emptyView
  getEmptyRegion() {
    if (this._isDestroyed && this._emptyRegion) { return this._emptyRegion; }

    const emptyEl = this.container || this.el;

    if (this._emptyRegion && !this._emptyRegion.isDestroyed()) {
      this._emptyRegion._setElement(emptyEl);
      return this._emptyRegion;
    }

    this._emptyRegion = new Region({ el: emptyEl, replaceElement: false });

    this._emptyRegion._parentView = this;

    return this._emptyRegion;
  },

  // Configured the initial events that the collection view binds to.
  _initialEvents() {
    if (this._isRendered || this._dataObserverUnsubscribe) { return; }

    this._dataObserverUnsubscribe = normalizeDisposer(
      this.Data.observeCollection(this.collection, this._onCollectionChange, this),
      'DataApi.observeCollection'
    );
  },

  _onCollectionChange(change) {
    if (this._isDestroying || this._isDestroyed) { return; }

    const previous = this._collectionObservedSnapshot || this._collectionSnapshot;
    const current = buildCollectionSnapshot(this.Data, this.collection, previous.entries);
    const normalized = this._collectionNeedsReset ? { kind: 'reset' } :
      normalizeCollectionChange(change, previous, current);
    const notification = { change: normalized, snapshot: current };

    // Nested notifications normalize against the latest observed source while
    // the committed snapshot advances only after reconciliation succeeds.
    this._collectionObservedSnapshot = current;
    if (this._collectionChangeQueue) {
      this._collectionChangeQueue.push(notification);
      return;
    }

    const queue = this._collectionChangeQueue = [];
    let pending = notification;

    try {
      while (pending) {
        const { change: pendingChange, snapshot } = pending;
        if (pendingChange.kind === 'reorder') {
          this._onCollectionReorder(snapshot);
        } else if (pendingChange.kind === 'reset') {
          this._onCollectionReset(snapshot);
        } else {
          this._onCollectionUpdate(pendingChange, snapshot);
        }
        this._collectionSnapshot = snapshot;
        pending = queue.shift();
      }
      delete this._collectionNeedsReset;
    } catch (error) {
      this._collectionNeedsReset = true;
      throw error;
    } finally {
      delete this._collectionChangeQueue;
      delete this._collectionObservedSnapshot;
    }
  },

  // Internal method. This checks for any changes in the order of the collection.
  // If the index of any view doesn't match, it will re-sort.
  _onCollectionReorder(snapshot) {
    if (this._isDestroying || this._isDestroyed) { return; }

    if (!this.sortWithCollection) {
      return;
    }

    this._setChildrenFromSnapshot(snapshot);
    this._reconcileChildren([]);
  },

  _onCollectionReset(snapshot) {
    if (this._isDestroying || this._isDestroyed) { return; }

    this._destroyChildren();

    this._addChildModels(snapshot.entries.map(entry => entry.item));

    this.sort();
  },

  // Handle collection update model additions and  removals
  _onCollectionUpdate(changes, snapshot) {
    if (this._isDestroying || this._isDestroyed) { return; }

    const updateEntries = changes.updated.map(({ key, previous, current }) => {
      const view = this._children.findByKey(key);
      if (!view) {
        throwCollectionProtocolError(`No child View exists for updated key "${ String(key) }".`);
      }
      return { current, previous, view };
    });
    const replacementViews = [];

    try {
      for (const { current, previous } of updateEntries) {
        if (previous !== current) {
          replacementViews.push(this._createChildView(current));
        }
      }
    } catch (error) {
      disposeAll(
        replacementViews.map(view => () => this._destroyChildView(view)),
        error
      );
    }

    const stagedViews = new Set(replacementViews);
    const removedViews = [];
    const addedViews = [];
    const replacedViews = [];
    const updatedViews = [];
    let replacementIndex = 0;

    try {
      // Remove first since it'll be a shorter array lookup.
      for (const { key } of changes.removed) {
        const view = this._children.findByKey(key);
        if (!view) { continue; }
        try {
          this._removeChild(view);
        } finally {
          if (!this._children.hasView(view)) { removedViews.push(view); }
        }
      }

      for (const { item } of changes.added) {
        const view = this._createChildView(item);
        stagedViews.add(view);
        this._addChild(view);
        stagedViews.delete(view);
        addedViews.push(view);
      }

      for (const { current, previous, view } of updateEntries) {
        if (previous !== current) {
          try {
            this._removeChild(view);
          } finally {
            if (!this._children.hasView(view)) { removedViews.push(view); }
          }
          const replacementView = replacementViews[replacementIndex++];
          this._addChild(replacementView);
          stagedViews.delete(replacementView);
          replacedViews.push(replacementView);
        } else {
          updatedViews.push(view);
        }
      }

      this._detachChildren(removedViews);
      if (this.sortWithCollection) {
        this._setChildrenFromSnapshot(snapshot);
      }
      this._reconcileChildren(
        [...addedViews, ...replacedViews, ...updatedViews],
        updatedViews.length || replacedViews.length || !addedViews.length ? false : addedViews
      );
    } catch (error) {
      disposeAll([
        () => this._removeChildViews(removedViews),
        ...[...stagedViews].map(view => () => this._destroyChildView(view))
      ], error);
    }

    // Destroy removed child views after all of the render is complete
    this._removeChildViews(removedViews);
  },

  _setChildrenFromSnapshot(snapshot) {
    const sourceViews = snapshot.entries
      .map(({ key }) => this._children.findByKey(key))
      .filter(Boolean);
    const sourceViewSet = new Set(sourceViews);
    const manualViews = this._children._views.filter(view => !sourceViewSet.has(view));
    const views = sourceViews.concat(manualViews);
    this._children._set(views, true);
  },

  _reconcileChildren(renderViews, addedViews = false) {
    const canReconcile = this.sort === CollectionView.prototype.sort &&
      this.filter === CollectionView.prototype.filter &&
      this.getComparator === CollectionView.prototype.getComparator &&
      this.getFilter === CollectionView.prototype.getFilter &&
      !this.viewComparator &&
      !this.viewFilter;

    if (!canReconcile) {
      for (const view of renderViews) { view._isRendered = false; }
      this._addedViews = addedViews;
      this._reconcileFallback = true;
      this.sort();
      if (this._reconcileFallback) {
        delete this._reconcileFallback;
        this._renderChildren();
      }
      return;
    }

    this._reconcileRenderViews = renderViews;
    this.sort();
  },

  _renderReconciledChildren(renderViews) {
    const renderViewSet = new Set(renderViews);
    if (this._hasUnrenderedViews) {
      for (const view of this.children) {
        if (!view._isRendered && !renderViewSet.has(view)) {
          renderViews.push(view);
          renderViewSet.add(view);
        }
      }
      delete this._hasUnrenderedViews;
    }
    renderViews = renderViews.filter(view => this.children.hasView(view));
    this.triggerMethod('before:render:children', this, renderViews);
    if (this.isEmpty()) {
      this._showEmptyView();
    } else {
      this._destroyEmptyView();

      const views = this.children._views;
      const documentEl = this.container.ownerDocument;
      const activeElement = documentEl.activeElement;
      const shouldRestoreFocus = activeElement && views.some(view =>
        view.el === activeElement || view.el.contains(activeElement)
      );
      const selection = shouldRestoreFocus &&
        typeof activeElement.selectionStart === 'number' && {
        end: activeElement.selectionEnd,
        start: activeElement.selectionStart,
        direction: activeElement.selectionDirection
      };

      for (const view of renderViews) {
        view._isRendered = false;
        renderView(view);
      }

      const attaching = views.filter(view => view.el.parentNode !== this.container);
      if (attaching.length) {
        this._attachChildren(this._getBuffer(attaching), attaching);
      }

      if (attaching.every(view => view.el.parentNode === this.container)) {
        const attachingSet = new Set(attaching);
        let before = null;
        for (let index = views.length; index--;) {
          const view = views[index];
          if (!attachingSet.has(view) && view.el.nextSibling !== before) {
            this.Dom.moveEl(view.el, this.container, before);
          }
          view._isShown = true;
          before = view.el;
        }
      }

      if (shouldRestoreFocus && activeElement.isConnected &&
          documentEl.activeElement !== activeElement) {
        activeElement.focus({ preventScroll: true });
        if (selection) {
          activeElement.setSelectionRange(selection.start, selection.end, selection.direction);
        }
      }
    }

    this.triggerMethod('render:children', this, renderViews);
  },

  _removeChild(view) {
    this.triggerMethod('before:remove:child', this, view);

    this.children._remove(view);
    this._children._remove(view);

    this.triggerMethod('remove:child', this, view);
  },

  _addChildModels(models) {
    const length = models.length;
    const views = Array(length);
    for (let index = 0; index < length; index++) {
      views[index] = this._addChildModel(models[index]);
    }
    return views;
  },

  _addChildModel(model) {
    const view = this._createChildView(model);

    this._addChild(view);

    return view;
  },

  _createChildView(model) {
    const ChildView = this._getChildView(model);
    const childViewOptions = this._getChildViewOptions(model);
    const view = this.buildChildView(model, ChildView, childViewOptions);

    return view;
  },

  _addChild(view, index) {
    this.triggerMethod('before:add:child', this, view);

    this._setupChildView(view);
    this._children._add(view, index);
    this.children._add(view, index);

    this.triggerMethod('add:child', this, view);
  },

  // Retrieve the `childView` class
  // The `childView` property can be either a view class or a function that
  // returns a view class. If it is a function, it will receive the model that
  // will be passed to the view instance (created from the returned view class)
  _getChildView(child) {
    let childView = this.childView;

    if (!childView) {
      throw new MarionetteError({
        code: 'MN0011',
        name: classErrorName,
        message: 'A "childView" must be specified',
        url: 'marionette.collectionview.html#collectionviews-childview'
      });
    }

    childView = this._getView(childView, child);

    if (!childView) {
      throw new MarionetteError({
        code: 'MN0012',
        name: classErrorName,
        message: '"childView" must be a view class or a function that returns a view class',
        url: 'marionette.collectionview.html#collectionviews-childview'
      });
    }

    return childView;
  },

  // First check if the `view` is a view class (the common case)
  // Then check if it's a function (which we assume that returns a view class)
  _getView(view, child) {
    if (isViewClass(view)) {
      return view;
    } else if (typeof view === 'function') {
      return view.call(this, child);
    }
  },

  _getChildViewOptions(child) {
    if (typeof this.childViewOptions === 'function') {
      return this.childViewOptions(child);
    }

    return this.childViewOptions;
  },

  // Build a `childView` for a model in the collection.
  // Override to customize the build
  buildChildView(child, ChildViewClass, childViewOptions) {
    const options = assignOwn({ model: child }, childViewOptions);
    return new ChildViewClass(options);
  },

  _setupChildView(view) {
    monitorViewEvents(view);

    // We need to listen for if a view is destroyed in a way other
    // than through the CollectionView.
    // If this happens we need to remove the reference to the view
    // since once a view has been destroyed we can not reuse it.
    view.on('destroy', this.removeChildView, this);

    // set up the child view event forwarding
    this._proxyChildViewEvents(view);
  },

  // used by ViewMixin's `_childViewEventHandler`
  _getImmediateChildren() {
    return this.children._views;
  },

  // Handle a previously defined element, which may already be attached.
  setElement(element) {
    if (this._isDestroying || this._isDestroyed) {
      return this;
    }

    const el = this._validateEl(element);
    const wrappedEl = this.Dom.wrapEl && this.Dom.wrapEl(el);

    this.undelegateEvents();
    this.el = el;
    if (this.Dom.wrapEl) {
      this.$el = wrappedEl;
    } else {
      delete this.$el;
    }

    this._isAttached = this._isElAttached();

    this.delegateEvents();

    return this;
  },

  // Render children views.
  render() {
    if (this._isDestroyed) { return this; }
    this.triggerMethod('before:render', this);

    this._destroyChildren();

    if (this.collection) {
      this._collectionSnapshot = buildCollectionSnapshot(this.Data, this.collection, []);
      this._addChildModels(this._collectionSnapshot.entries.map(entry => entry.item));
      this._initialEvents();
    }

    const template = this.getTemplate();

    if (template) {
      this._renderTemplate(template);
      this.bindUIElements();
    }
    this._getChildViewContainer();
    this.sort();

    this._isRendered = true;

    this.triggerMethod('render', this);
    return this;
  },

  // Get a container within the template to add the children within
  _getChildViewContainer() {
    const childViewContainer = getValue(this, 'childViewContainer');
    this.container = childViewContainer ? this.$(childViewContainer)[0] : this.el;

    if (!this.container) {
      throw new MarionetteError({
        code: 'MN0013',
        name: classErrorName,
        message: `The specified "childViewContainer" was not found: ${childViewContainer}`,
        url: 'marionette.collectionview.html#defining-the-childviewcontainer'
      });
    }
  },

  // Sorts the children then filters and renders the results.
  sort() {
    this._sortChildren();

    this.filter();

    return this;
  },

  // Sorts views by viewComparator and sets the children to the new order
  _sortChildren() {
    if (!this._children.length) { return; }

    let viewComparator = this.getComparator();

    if (!viewComparator) { return; }

    // If children are sorted prevent added to end perf
    delete this._addedViews;

    this.triggerMethod('before:sort', this);

    this._children._sort(viewComparator, this);

    this.triggerMethod('sort', this);
  },

  // Sets the view's `viewComparator` and applies the sort if the view is ready.
  // To prevent the render pass `{ preventRender: true }` as the 2nd argument.
  setComparator(comparator, { preventRender } = {}) {
    const comparatorChanged = this.viewComparator !== comparator;
    const shouldSort = comparatorChanged && !preventRender;

    this.viewComparator = comparator;

    if (shouldSort) {
      this.sort();
    }

    return this;
  },

  // Clears the `viewComparator` and follows the same rules for rendering as `setComparator`.
  removeComparator(options) {
    return this.setComparator(null, options);
  },

  // If viewComparator is overridden it will be returned here.
  // Additionally override this function to provide custom
  // viewComparator logic
  getComparator() {
    if (this.viewComparator) { return this.viewComparator; }

    if (!this.sortWithCollection || this.viewComparator === false || !this.collection) {
      return false;
    }

    return this._viewComparator;
  },

  // Default internal view comparator that order the views by
  // the order of the collection
  _viewComparator(view) {
    return this.Data.items(this.collection).indexOf(view.model);
  },

  // This method filters the children views and renders the results
  filter() {
    if (this._isDestroyed) { return this; }

    this._filterChildren();

    this._renderChildren();

    return this;
  },

  _filterChildren() {
    if (!this._children.length) { return; }

    const viewFilter = this._getFilter();

    if (!viewFilter) {
      const shouldReset = this.children.length !== this._children.length;

      this.children._set(this._children._views, shouldReset);

      return;
    }

    // If children are filtered prevent added to end perf
    delete this._addedViews;

    this.triggerMethod('before:filter', this);

    const attachViews = [];
    const detachViews = [];

    const children = this._children._views;
    const length = children.length;
    for (let index = 0; index < length; index++) {
      const view = children[index];
      (viewFilter.call(this, view, index, children) ? attachViews : detachViews).push(view);
    }

    this._detachChildren(detachViews);

    // reset children
    this.children._set(attachViews, true);

    this.triggerMethod('filter', this, attachViews, detachViews);
  },

  // This method returns a function for the viewFilter
  _getFilter() {
    const viewFilter = this.getFilter();

    if (!viewFilter) { return false; }

    if (typeof viewFilter === 'function') {
      return viewFilter;
    }

    // Support filter predicates `{ fooFlag: true }`
    if (typeof viewFilter === 'object' && !Array.isArray(viewFilter)) {
      return modelAttributesMatcher(this.Data, viewFilter);
    }

    // Filter by model attribute
    if (isString(viewFilter)) {
      return view => view.model && this.Data.has(view.model, viewFilter) &&
        this.Data.get(view.model, viewFilter);
    }

    throw new MarionetteError({
      code: 'MN0014',
      name: classErrorName,
      message: '"viewFilter" must be a function, predicate object literal, a string indicating a model attribute, or falsy',
      url: 'marionette.collectionview.html#defining-the-viewfilter'
    });
  },

  // Override this function to provide custom
  // viewFilter logic
  getFilter() {
    return this.viewFilter;
  },

  // Sets the view's `viewFilter` and applies the filter if the view is ready.
  // To prevent the render pass `{ preventRender: true }` as the 2nd argument.
  setFilter(filter, { preventRender } = {}) {
    const filterChanged = this.viewFilter !== filter;
    const shouldRender = filterChanged && !preventRender;

    this.viewFilter = filter;

    if (shouldRender) {
      this.filter();
    }

    return this;
  },

  // Clears the `viewFilter` and follows the same rules for rendering as `setFilter`.
  removeFilter(options) {
    return this.setFilter(null, options);
  },

  _detachChildren(detachingViews) {
    const length = detachingViews.length;
    for (let index = 0; index < length; index++) {
      this._detachChildView(detachingViews[index]);
    }
  },

  _detachChildView(view) {
    const shouldTriggerDetach = view._isAttached && this.monitorViewEvents !== false;
    if (shouldTriggerDetach) {
      view.triggerMethod('before:detach', view);
    }

    this.detachHtml(view);

    if (shouldTriggerDetach) {
      view._isAttached = false;
      view.triggerMethod('detach', view);
    }

    view._isShown = false;
  },

  // Override this method to change how the collectionView detaches a child view
  detachHtml(view) {
    this.Dom.detachEl(view.el);
  },

  _renderChildren() {
    delete this._reconcileFallback;

    if (this._reconcileRenderViews) {
      const renderViews = this._reconcileRenderViews;
      delete this._reconcileRenderViews;
      this._renderReconciledChildren(renderViews);
      return;
    }

    // If there are unrendered views prevent add to end perf
    if (this._hasUnrenderedViews) {
      delete this._addedViews;
      delete this._hasUnrenderedViews;
    }

    const views = this._addedViews || this.children._views;

    this.triggerMethod('before:render:children', this, views);

    if (this.isEmpty()) {
      this._showEmptyView();
    } else {
      this._destroyEmptyView();

      const els = this._getBuffer(views);

      this._attachChildren(els, views);
    }

    delete this._addedViews;

    this.triggerMethod('render:children', this, views);
  },

  // Renders each view and creates a fragment buffer from them
  _getBuffer(views) {
    const elBuffer = this.Dom.createBuffer();

    const length = views.length;
    for (let index = 0; index < length; index++) {
      const view = views[index];
      renderView(view);
      // corresponds that view is shown in a Region or CollectionView
      view._isShown = true;
      this.Dom.appendContents(elBuffer, view.el);
    }

    return elBuffer;
  },

  _attachChildren(els, views) {
    const shouldTriggerAttach = this._isAttached && this.monitorViewEvents !== false;

    views = shouldTriggerAttach ? views : [];

    const beforeAttachLength = views.length;
    for (let index = 0; index < beforeAttachLength; index++) {
      const view = views[index];
      if (view._isAttached) { continue; }
      view.triggerMethod('before:attach', view);
    }

    this.attachHtml(els, this.container);

    const attachLength = views.length;
    for (let index = 0; index < attachLength; index++) {
      const view = views[index];
      if (view._isAttached) { continue; }
      view._isAttached = true;
      view.triggerMethod('attach', view);
    }
  },

  // Override this method to do something other than `.append`.
  // You can attach any HTML at this point including the els.
  attachHtml(els, container) {
    this.Dom.appendContents(container, els);
  },

  isEmpty() {
    return !this.children.length;
  },

  _showEmptyView() {
    const EmptyView = this._getEmptyView();

    if (!EmptyView) {
      return;
    }

    const options = this._getEmptyViewOptions();

    const emptyRegion = this.getEmptyRegion();

    emptyRegion.show(new EmptyView(options));
  },

  // Retrieve the empty view class
  _getEmptyView() {
    const emptyView = this.emptyView;

    if (emptyView == null || emptyView === false) { return; }

    if (isEmptyViewClass(emptyView)) { return emptyView; }

    const isResolver = typeof emptyView === 'function' && !isClassDefinition(emptyView);
    const EmptyView = isResolver ? emptyView.call(this) : undefined;

    if (isResolver && (EmptyView == null || EmptyView === false)) { return; }

    if (isEmptyViewClass(EmptyView)) { return EmptyView; }

    throw new MarionetteError({
      code: 'MN0022',
      name: classErrorName,
      message: '"emptyView" must be a view class or a function that returns a view class',
      url: 'marionette.collectionview.html#collectionviews-emptyview'
    });
  },

  // Remove the emptyView
  _destroyEmptyView() {
    const emptyRegion = this.getEmptyRegion();
    // Only empty if a view is show so the region
    // doesn't detach any other unrelated HTML
    if (emptyRegion.hasView()) {
      emptyRegion.empty();
    }
  },

  _getEmptyViewOptions() {
    const emptyViewOptions = this.emptyViewOptions || this.childViewOptions;

    if (typeof emptyViewOptions === 'function') {
      return emptyViewOptions.call(this);
    }

    return emptyViewOptions;
  },

  swapChildViews(view1, view2) {
    if (!this._children.hasView(view1) || !this._children.hasView(view2)) {
      throw new MarionetteError({
        code: 'MN0015',
        name: classErrorName,
        message: 'Both views must be children of the collection view to swap.',
        url: 'marionette.collectionview.html#swapping-child-views'
      });
    }

    this._children._swap(view1, view2);
    this.Dom.swapEl(view1.el, view2.el);

    // If the views are not filtered the same, refilter
    if (this.children.hasView(view1) !== this.children.hasView(view2)) {
      this.filter();
    } else {
      this.children._swap(view1, view2);
    }

    return this;
  },

  // Render the child's view and add it to the HTML for the collection view at a given index, based on the current sort
  addChildView(view, index, options = {}) {
    if (this._isDestroying || this._isDestroyed) {
      return view;
    }

    if (!view || view._isDestroyed) {
      return view;
    }

    if (view._isShown) {
      throw new MarionetteError({
        code: 'MN0003',
        name: classErrorName,
        message: 'View is already shown in a Region or CollectionView',
        url: 'marionette.region.html#showing-a-view'
      });
    }

    const indexType = typeof index;
    if (index !== null && (indexType === 'object' || indexType === 'function')) {
      options = index;
    }

    // If options has defined index we should use it
    if (options.index != null) {
      index = options.index;
    }

    if (!this._isRendered) {
      this.render();
    }

    this._addChild(view, index);

    if (options.preventRender) {
      this._hasUnrenderedViews = true;
      return view;
    }

    const hasIndex = (typeof index !== 'undefined');
    const isAddedToEnd = !hasIndex || index >= this._children.length;

    // Only cache views if added to the end and there is no unrendered views
    if (isAddedToEnd && !this._hasUnrenderedViews) {
      this._addedViews = [view];
    }

    if (hasIndex) {
      this._renderChildren();
    } else {
      this.sort();
    }

    return view;
  },

  // Detach a view from the children.  Best used when adding a
  // childView from `addChildView`
  detachChildView(view) {
    this.removeChildView(view, { shouldDetach: true });

    return view;
  },

  // Remove the child view and destroy it.  Best used when adding a
  // childView from `addChildView`
  // The options argument is for internal use only
  removeChildView(view, options) {
    if (!view || !this._children.hasView(view)) {
      return view;
    }

    this._removeChildView(view, options);

    this._removeChild(view);

    if (this.isEmpty()) {
      this._showEmptyView();
    }

    return view;
  },

  _removeChildViews(views) {
    const disposers = views.map(view => () => this._removeChildView(view));
    disposeAll(disposers.reverse());
  },

  _removeChildView(view, { shouldDetach } = {}) {
    view.off('destroy', this.removeChildView, this);

    disposeAll([
      () => this.stopListening(view),
      () => shouldDetach ? this._detachChildView(view) : this._destroyChildView(view)
    ]);
  },

  _destroyChildView(view) {
    if (view._isDestroyed) {
      return;
    }

    const shouldDisableEvents = this.monitorViewEvents === false;
    destroyView(view, shouldDisableEvents);
  },

  // called by ViewMixin destroy
  _removeChildren() {
    const emptyRegion = this.getEmptyRegion();
    disposeAll([
      () => { delete this._addedViews; },
      () => emptyRegion.destroy(),
      () => this._destroyChildren()
    ]);
  },

  // Destroy the child views that this collection view is holding on to, if any
  _destroyChildren() {
    if (!this._children.length) {
      return;
    }

    this.triggerMethod('before:destroy:children', this);
    const detach = this.monitorViewEvents === false &&
      (() => this.Dom.detachContents(this.el));

    disposeAll([
      () => {
        this._children._init();
        this.children._init();
      },
      () => this._removeChildViews(this._children._views),
      detach
    ]);

    this.triggerMethod('destroy:children', this);
  }
});


export default CollectionView;
