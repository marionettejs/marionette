// Collection View
// ---------------

import { getValue, MarionetteError, uniqueId } from '@marionette/utils';
import extend from '../utils/extend.ts';
import { renderView, destroyView, isViewClass } from './common/view.ts';
import monitorViewEvents from './common/monitor-view-events.ts';
import ChildViewContainer from './child-view-container.ts';
import Region from './region.ts';
import ViewMixin, { ViewOptions } from '../mixins/view.ts';
import { setDomApi } from '../runtime/dom-api.ts';
import { setEventDelegator } from '../runtime/event-delegator.ts';
import { setRenderer } from '../runtime/renderer.ts';
import { setDataApi } from '../runtime/data-api.ts';
import { setStateApi } from '../runtime/state-api.ts';

import type { ChildViewContainer as Children, ContainerChild } from './child-view-container.ts';
import type { ViewFluent } from './common/chainable-methods.ts';
import type { ViewMixinHost } from '../mixins/view.ts';
import type { ViewConfiguration, ViewInstance } from './view.ts';
import type { SupportedView } from './common/view.ts';
import type { RegionInstance, RegionInternals } from './region.ts';
import type { RegionClass } from './common/build-region.ts';
import type { DataApi as DataProvider } from '../runtime/data-api.ts';
import type { DomApi } from '../runtime/dom-api.ts';
import type { Constructed, Merge, ArgumentsFor, DefaultOptions, OptionsFor, StateFor, SuppliedState } from './object.ts';

export type CollectionChild = SupportedView & ContainerChild;
type ChildClass<Child extends SupportedView = CollectionChild> = new(...args: never[]) => Child;
type MissingChild = null | undefined | false | 0 | 0n | '';
type Comparator<Child, Receiver> = string | ((this: Receiver, left: Child, right: Child) => number) |
  ((this: Receiver, view: Child) => unknown);
type Filter<Child, Receiver> = string | Record<string, unknown> |
  ((this: Receiver, view: Child, index: number, children: Child[]) => unknown) | MissingChild;
export interface ChildRenderOptions {
  preventRender?: boolean;
  index?: number | null;
}

export interface CollectionViewConfiguration<Child extends CollectionChild = CollectionChild, Model = never>
  extends Omit<ViewConfiguration, 'regions' | 'regionClass'> {
  childView?: ChildClass<Child> | ((model: Model) => ChildClass<Child>);
  childViewContainer?: string | (() => string);
  childViewOptions?: object | ((model: Model) => object | null | undefined);
  emptyView?: ChildClass<SupportedView> | (() => ChildClass<SupportedView> | null | undefined | false) | null | false;
  emptyViewOptions?: object | (() => object | null | undefined);
  RegionClass?: RegionClass;
  sortWithCollection?: boolean;
  viewComparator?: Comparator<Child, CollectionViewInstance<Child>> | MissingChild;
  viewFilter?: Filter<Child, CollectionViewInstance<Child>>;
}

// CollectionView composes ViewMixin, not View's RegionsMixin. Select only the
// common visual surface; Region ownership and child operations are declared below.
type VisualMethods<Query extends ArrayLike<Element>> = Pick<ViewInstance<ViewConfiguration, unknown, Query>,
  'cid' | 'cidPrefix' | 'el' | 'tagName' | 'id' | 'className' | 'attributes' |
  'events' | 'triggers' | 'ui' | 'behaviors' | 'childViewEvents' | 'childViewTriggers' |
  'childViewEventPrefix' | 'modelEvents' | 'collectionEvents' | 'stateEvents' |
  'state' | 'template' | 'templateContext' | 'Dom' | 'Data' | 'State' | 'EventDelegator' |
  '_renderHtml' | 'monitorViewEvents' |
  'getOption' | 'mergeOptions' | 'normalizeMethods' | 'bindEvents' | 'unbindEvents' |
  'bindRequests' | 'unbindRequests' | 'on' | 'off' | 'once' | 'listenTo' | 'listenToOnce' |
  'stopListening' | 'trigger' | 'triggerMethod' | 'normalizeUIString' | 'normalizeUIKeys' |
  'normalizeUIValues' | 'getTemplate' | 'serializeData' | 'serializeModel' | 'serializeCollection' |
  'mixinTemplateContext' | 'attachElContent' | '_removeBehavior' | '_getImmediateChildren'>;

export interface CollectionViewInstance<Child extends CollectionChild = CollectionChild,
  Options extends object = CollectionViewConfiguration<Child>, State = unknown, Source = unknown,
  Query extends ArrayLike<Element> = ArrayLike<Element>> extends VisualMethods<Query>, ViewFluent<{}> {
  options: Options;
  model?: unknown;
  collection?: Source;
  children: Children<Child>;
  childView?: CollectionViewConfiguration<Child>['childView'];
  childViewOptions?: CollectionViewConfiguration<Child>['childViewOptions'];
  emptyView?: CollectionViewConfiguration<Child>['emptyView'];
  emptyViewOptions?: CollectionViewConfiguration<Child>['emptyViewOptions'];
  childViewContainer?: CollectionViewConfiguration['childViewContainer'];
  RegionClass?: RegionClass;
  sortWithCollection: boolean;
  viewComparator?: Comparator<Child, CollectionViewInstance<Child, Options, State, Source, Query>> | MissingChild;
  viewFilter?: Filter<Child, CollectionViewInstance<Child, Options, State, Source, Query>>;
  preinitialize(options?: Options): void;
  initialize(options?: Options): void;
  createState(options?: Options): unknown;
  getState(): State;
  $(selector: string): Query;
  getUI(name: string): Query | undefined;
  isDestroyed(): boolean;
  isRendered(): boolean;
  isAttached(): boolean;
  getEmptyRegion(): RegionInstance;
  sort<Receiver extends this>(this: Receiver): Receiver;
  getComparator(): Comparator<Child, CollectionViewInstance<Child, Options, State, Source, Query>> | false;
  setComparator<Receiver extends this>(
    this: Receiver, comparator: (this: Receiver, left: Child, right: Child) => number, options?: ChildRenderOptions
  ): Receiver;
  setComparator<Receiver extends this>(
    this: Receiver, comparator: (this: Receiver, view: Child) => unknown, options?: ChildRenderOptions
  ): Receiver;
  setComparator<Receiver extends this>(
    this: Receiver, comparator: Comparator<Child, Receiver> | MissingChild, options?: ChildRenderOptions
  ): Receiver;
  removeComparator<Receiver extends this>(this: Receiver, options?: ChildRenderOptions): Receiver;
  filter<Receiver extends this>(this: Receiver): Receiver;
  getFilter(): Filter<Child, CollectionViewInstance<Child, Options, State, Source, Query>>;
  setFilter<Receiver extends this>(this: Receiver, filter: Filter<Child, Receiver>, options?: ChildRenderOptions): Receiver;
  removeFilter<Receiver extends this>(this: Receiver, options?: ChildRenderOptions): Receiver;
  buildChildView<Class extends ChildClass<Child>>(model: unknown, ChildViewClass: Class, options?: object | null): InstanceType<Class>;
  detachHtml(view: Child): void;
  attachHtml(els: Element | DocumentFragment, container: Element): void;
  isEmpty(): boolean;
  swapChildViews<Receiver extends this>(this: Receiver, view1: Child, view2: Child): Receiver;
  addChildView<Added extends Child | MissingChild>(view: Added, index?: number | null | ChildRenderOptions, options?: ChildRenderOptions): Added;
  detachChildView<Removed extends Child | MissingChild>(view: Removed): Removed;
  removeChildView<Removed extends Child | MissingChild>(view: Removed, options?: {shouldDetach?: boolean}): Removed;
}

type SourceFor<Config> = Config extends {collection: infer Source} ? Source : unknown;
type ChildFrom<Value> = Value extends new(...args: never[]) => infer Child ?
  Child extends CollectionChild ? Child : CollectionChild :
  Value extends (...args: never[]) => infer Class ? Class extends new(...args: never[]) => infer Child ?
    Child extends CollectionChild ? Child : CollectionChild : CollectionChild : CollectionChild;
type ChildFor<Config> = Config extends {childView: infer Value} ? ChildFrom<Value> : CollectionChild;
// _setOptions copies only the listed properties and skips undefined values.
// Prototype composition has no constructor-supplied properties yet.
type CopiedOptions<Previous, Options> = {
  [Key in keyof Options & typeof ClassOptions[number]]: Exclude<Options[Key], undefined> |
    (undefined extends Options[Key] ? Key extends keyof Previous ? Previous[Key] : undefined : never);
};
type ConfiguredProps<Props, Supplied> = Merge<Props, CopiedOptions<Merge<CollectionViewInstance, Props>, Supplied>>;
type Result<Props, Args extends unknown[], State, Query extends ArrayLike<Element>,
  Supplied extends object = OptionsFor<Args>> =
  Extract<keyof CollectionViewInstance, keyof ConfiguredProps<Props, Supplied>> extends never ?
  CollectionViewInstance<ChildFor<ConfiguredProps<Props, Supplied>>,
    Merge<DefaultOptions<Props>, OptionsFor<Args>>, State,
    SourceFor<ConfiguredProps<Props, Supplied>>, Query> & ConfiguredProps<Props, Supplied> : Merge<
  Omit<CollectionViewInstance<ChildFor<ConfiguredProps<Props, Supplied>>,
    Merge<DefaultOptions<Props>, OptionsFor<Args>>, State,
    SourceFor<ConfiguredProps<Props, Supplied>>, Query>, keyof ViewFluent<{}>>,
  Extract<'options' | 'el', keyof ConfiguredProps<Props, Supplied>> extends never ?
    ConfiguredProps<Props, Supplied> : Omit<ConfiguredProps<Props, Supplied>, 'options' | 'el'>
> & ViewFluent<ConfiguredProps<Props, Supplied>>;
export type CollectionViewConstructor<Props extends object = {}, Args extends unknown[] = [options?: CollectionViewConfiguration],
  State = unknown, Statics extends object = {}, Query extends ArrayLike<Element> = ArrayLike<Element>> = {
  new<Provided extends Args = Args>(...args: Provided): Constructed<Props, Result<Props, Provided, SuppliedState<Provided[0], State>, Query>>;
  (this: object, ...args: Args): void;
} & Merge<{
  prototype: Result<Props, Args, State, Query>;
  call(receiver: object, ...args: Args): void;
  apply(receiver: object, args: Args | IArguments): void;
  setRenderer: typeof setRenderer;
  setDomApi: typeof setDomApi;
  setEventDelegator: typeof setEventDelegator;
  setDataApi: typeof setDataApi;
  setStateApi: typeof setStateApi;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: Added extends { constructor: (...args: never[]) => unknown } ? object : (this: object, ...args: never[]) => unknown,
    prototypeProperties?: Added & ThisType<Result<Merge<Props, Added>,
      ArgumentsFor<Merge<Props, Added>, Args>, StateFor<Merge<Props, Added>>, Query, {}>>,
    staticProperties?: AddedStatics & ThisType<CollectionViewConstructor<Merge<Props, Added>,
      ArgumentsFor<Merge<Props, Added>, Args>, StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>, Query>>
  ): CollectionViewConstructor<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>,
    StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>, Query>;
}, Statics>;

interface SnapshotEntry {model: unknown; key: unknown;}
interface Snapshot {
  entries: SnapshotEntry[];
  models: Map<unknown, SnapshotEntry>;
}
interface Replacement {key: unknown; previous: unknown; current: unknown;}
interface Update {kind: 'update'; added: SnapshotEntry[]; removed: SnapshotEntry[]; updated: Replacement[];}
type Change = {kind: 'reset'} | {kind: 'reorder'} | Update;
interface Notification {change: Change; snapshot: Snapshot;}
type RawChange = {kind: 'reset' | 'reorder'} | {
  kind: 'update'; added: unknown[]; removed: unknown[];
  updated: Array<{previous: unknown; current: unknown}>;
};

type CollectionViewInternals = CollectionViewInstance & ViewMixinHost & {
  Data: DataProvider;
  Dom: DomApi;
  container: Element;
  _children: Children<CollectionChild>;
  _emptyRegion?: RegionInternals;
  _collectionSnapshot: Snapshot;
  _collectionObservedSnapshot?: Snapshot;
  _collectionChangeQueue?: Notification[];
  _initChildViewStorage(): void;
  _initialEvents(): void;
  _onCollectionChange(change: unknown): void;
  _onCollectionReorder(snapshot: Snapshot): void;
  _onCollectionReset(snapshot: Snapshot): void;
  _onCollectionUpdate(changes: Update, snapshot: Snapshot): void;
  _setChildrenFromSnapshot(snapshot: Snapshot): void;
  _removeChild(view: CollectionChild): void;
  _addChildModels(models: unknown[]): CollectionChild[];
  _addChildModel(model: unknown): CollectionChild;
  _createChildView(model: unknown): CollectionChild;
  _addChild(view: CollectionChild, index?: number | null): void;
  _getChildView(model: unknown): ChildClass;
  _getView(view: NonNullable<CollectionViewConfiguration['childView']>, model: unknown): ChildClass;
  _getChildViewOptions(model: unknown): object | null | undefined;
  _setupChildView(view: CollectionChild): void;
  _getImmediateChildren(): CollectionChild[];
  _getChildViewContainer(): void;
  _sortChildren(): void;
  _viewComparator(view: CollectionChild): number;
  _filterChildren(): void;
  _getFilter(): ((view: CollectionChild, index: number, children: CollectionChild[]) => unknown) | false;
  _detachChildren(views: CollectionChild[]): void;
  _detachChildView(view: CollectionChild): void;
  _renderChildren(): void;
  _getBuffer(views: CollectionChild[]): DocumentFragment;
  _attachChildren(els: Element | DocumentFragment, views: CollectionChild[]): void;
  _showEmptyView(): void;
  _getEmptyView(): ChildClass<SupportedView> | null | false | undefined;
  _getEmptyViewOptions(): object | null | undefined;
  _destroyEmptyView(): void;
  _removeChildViews(views: CollectionChild[]): void;
  _removeChildView(view: CollectionChild, options?: {shouldDetach?: boolean}): void;
  _destroyChildView(view: CollectionChild): void;
  _destroyChildren(): void;
  _getEl(): Element;
  _isElAttached(): boolean;
};

const classErrorName = 'CollectionViewError';

function sameValueZero(left: unknown, right: unknown) {
  // Keep this aligned with @marionette/data's stable-key equality.
  return left === right || Object.is(left, right);
}

function throwCollectionProtocolError(message: string): never {
  throw new MarionetteError({
    code: 'MN0039',
    name: classErrorName,
    message,
    url: 'data.api.html#collection-observations'
  });
}

function buildCollectionSnapshot(Data: DataProvider, collection: unknown, previous: SnapshotEntry[]): Snapshot {
  const models = Data.models(collection as never);
  const previousKeys = new Map(previous.map(entry => [entry.model, entry.key]));
  const keys = new Set<unknown>();
  const modelEntries = new Map<unknown, SnapshotEntry>();
  const snapshot: SnapshotEntry[] = Array(models.length);

  for (let index = 0; index < models.length; index++) {
    const model: unknown = models[index];
    const key = Data.key(model as never);

    if (key == null) {
      throwCollectionProtocolError(`DataApi.key() returned a missing key for model at index ${ index }.`);
    }
    if (keys.has(key)) {
      throwCollectionProtocolError(`DataApi.key() returned duplicate key "${ String(key) }".`);
    }
    if (previousKeys.has(model) && !sameValueZero(previousKeys.get(model), key)) {
      throwCollectionProtocolError('DataApi.key() changed while a model remained in the CollectionView.');
    }

    const entry = { model, key };
    snapshot[index] = entry;
    keys.add(key);
    modelEntries.set(model, entry);
  }

  return { entries: snapshot, models: modelEntries };
}

function normalizeCollectionChange(change: RawChange, previous: Snapshot, current: Snapshot): Change {
  if (change.kind !== 'update') { return change; }

  const added = new Set(change.added);
  const removed = new Set(change.removed);
  return {
    kind: 'update',
    added: current.entries.filter(entry => added.has(entry.model)),
    removed: previous.entries.filter(entry => removed.has(entry.model)),
    updated: change.updated.map(pair => ({
      key: current.models.get(pair.current)!.key,
      previous: pair.previous,
      current: pair.current
    }))
  };
}

function modelAttributesMatcher(Data: DataProvider, predicate: Record<string, unknown>) {
  const keys = Object.keys(predicate);
  const length = keys.length;
  const values: unknown[] = Array(length);
  for (let index = 0; index < length; index++) {
    values[index] = predicate[keys[index]];
  }

  return function(view: CollectionChild) {
    const model = view.model;
    if (model == null) { return length === 0; }

    for (let index = 0; index < length; index++) {
      const key = keys[index];
      if (!Data.has(model as never, key) || values[index] !== Data.get(model as never, key as never)) { return false; }
    }
    return true;
  };
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
] as const;

// A view that iterates over a collection
// and renders an individual child view for each model.
const CollectionView = function(this: CollectionViewInternals, options?: CollectionViewConfiguration) {
  this.cid = uniqueId(this.cidPrefix);
  this._setOptions(options, ClassOptions);

  (this.preinitialize as {apply(receiver: object, args: IArguments): unknown}).apply(this, arguments);
  this.mergeOptions(options, ViewOptions);

  this._initViewEvents();

  this.el = this._getEl();
  this._isAttached = this._isElAttached();
  this.delegateEvents();
  if (this._isAttached && this.monitorViewEvents !== false) {
    this.Dom.notifyAttach?.(this.el);
  }

  monitorViewEvents(this);

  this._initState(options);

  this._initChildViewStorage();
  this._initBehaviors();
  this._buildEventProxies();

  (this.initialize as {apply(receiver: object, args: IArguments): unknown}).apply(this, arguments);

  if (this._isDestroyed || this._isDestroying) { return; }

  this._initStateEvents();

  // Init empty region after initialize to preserve the v4 override boundary.
  this.getEmptyRegion();

  this.delegateEntityEvents();

  this._triggerEventOnBehaviors('initialize', this, options);
};

Object.assign(CollectionView, {
  extend,
  setRenderer,
  setDomApi,
  setEventDelegator,
  setDataApi,
  setStateApi
});

Object.assign(CollectionView.prototype, ViewMixin, {
  cidPrefix: 'mncv',

  // flag for maintaining the sorted order of the collection
  sortWithCollection: true,

  // Internal method to set up the `children` object for storing all of the child views
  // `_children` represents all child views
  // `children` represents only views filtered to be shown
  _initChildViewStorage(this: CollectionViewInternals) {
    this._children = new ChildViewContainer(this.Data);
    this.children = new ChildViewContainer(this.Data);
  },

  // Create a region to show the emptyView
  getEmptyRegion(this: CollectionViewInternals) {
    if (this._isDestroyed && this._emptyRegion) { return this._emptyRegion; }

    const emptyEl = this.container || this.el;

    if (this._emptyRegion && !this._emptyRegion.isDestroyed()) {
      this._emptyRegion._setElement(emptyEl);
      return this._emptyRegion;
    }

    const RegionClass = this.RegionClass || Region;
    this._emptyRegion = new RegionClass({ el: emptyEl, replaceElement: false } as never) as RegionInternals;

    this._emptyRegion._parentView = this;

    return this._emptyRegion;
  },

  // Configured the initial events that the collection view binds to.
  _initialEvents(this: CollectionViewInternals) {
    if (this._isRendered || this._dataObserverCleanup) { return; }

    this._dataObserverCleanup = this.Data.observeCollection(this.collection as never, this._onCollectionChange, this);
  },

  _onCollectionChange(this: CollectionViewInternals, change: unknown) {
    if (this._isDestroying || this._isDestroyed) { return; }

    const previous = this._collectionObservedSnapshot || this._collectionSnapshot;
    const current = buildCollectionSnapshot(this.Data, this.collection, previous.entries);
    const normalized = normalizeCollectionChange(change as RawChange, previous, current);
    const notification = { change: normalized, snapshot: current };

    // Nested notifications normalize against the latest observed source while
    // the committed snapshot advances only after reconciliation succeeds.
    this._collectionObservedSnapshot = current;
    if (this._collectionChangeQueue) {
      this._collectionChangeQueue.push(notification);
      return;
    }

    const queue: Notification[] = this._collectionChangeQueue = [];
    let pending: Notification | undefined = notification;

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
    } finally {
      delete this._collectionChangeQueue;
      delete this._collectionObservedSnapshot;
    }
  },

  // Internal method. This checks for any changes in the order of the collection.
  // If the index of any view doesn't match, it will re-sort.
  _onCollectionReorder(this: CollectionViewInternals, snapshot: Snapshot) {
    if (this._isDestroying || this._isDestroyed) { return; }

    if (!this.sortWithCollection) {
      return;
    }

    this._setChildrenFromSnapshot(snapshot);
    this.sort();
  },

  _onCollectionReset(this: CollectionViewInternals, snapshot: Snapshot) {
    if (this._isDestroying || this._isDestroyed) { return; }

    this._destroyChildren();

    this._addChildModels(snapshot.entries.map(entry => entry.model));

    this.sort();
  },

  // Handle collection update model additions and  removals
  _onCollectionUpdate(this: CollectionViewInternals, changes: Update, snapshot: Snapshot) {
    if (this._isDestroying || this._isDestroyed) { return; }

    const updateEntries = changes.updated.map(({ key, previous, current }) => {
      const view = this._children.findByKey(key);
      if (!view) {
        throwCollectionProtocolError(`No child View exists for updated key "${ String(key) }".`);
      }
      return { current, previous, view };
    });
    const replacementViews = updateEntries
      .filter(({ current, previous }) => current !== previous)
      .map(({ current }) => this._createChildView(current));
    const removedViews: CollectionChild[] = [];
    const updatedViews: CollectionChild[] = [];
    let replacementIndex = 0;

    // Remove first since it'll be a shorter array lookup.
    for (const { key } of changes.removed) {
      const view = this._children.findByKey(key);
      if (!view) { continue; }
      this._removeChild(view);
      removedViews.push(view);
    }

    for (const { model } of changes.added) {
      const view = this._createChildView(model);
      this._addChild(view);
    }

    for (const { current, previous, view } of updateEntries) {
      if (previous !== current) {
        const childIndex = this._children.findIndexByView(view);
        this._removeChild(view);
        removedViews.push(view);
        const replacementView = replacementViews[replacementIndex++];
        this._addChild(replacementView, childIndex);
      } else {
        updatedViews.push(view);
      }
    }

    this._detachChildren(removedViews);
    if (this.sortWithCollection) {
      this._setChildrenFromSnapshot(snapshot);
    }
    for (const view of updatedViews) { view._isRendered = false; }
    this.sort();

    // Destroy removed child views after all of the render is complete
    this._removeChildViews(removedViews);
  },

  _setChildrenFromSnapshot(this: CollectionViewInternals, snapshot: Snapshot) {
    const sourceViews = snapshot.entries
      .map(({ key }) => this._children.findByKey(key))
      .filter(Boolean) as CollectionChild[];
    const sourceViewSet = new Set(sourceViews);
    const manualViews = this._children._views.filter(view => !sourceViewSet.has(view));
    const views = sourceViews.concat(manualViews);
    this._children._set(views);
  },

  _removeChild(this: CollectionViewInternals, view: CollectionChild) {
    this.triggerMethod('before:remove:child', this, view);

    this.children._remove(view);
    this._children._remove(view);

    this.triggerMethod('remove:child', this, view);
  },

  _addChildModels(this: CollectionViewInternals, models: unknown[]) {
    const length = models.length;
    const views: CollectionChild[] = Array(length);
    for (let index = 0; index < length; index++) {
      views[index] = this._addChildModel(models[index]);
    }
    return views;
  },

  _addChildModel(this: CollectionViewInternals, model: unknown) {
    const view = this._createChildView(model);

    this._addChild(view);

    return view;
  },

  _createChildView(this: CollectionViewInternals, model: unknown) {
    const ChildView = this._getChildView(model);
    const childViewOptions = this._getChildViewOptions(model);
    const view = this.buildChildView(model, ChildView, childViewOptions);

    return view;
  },

  _addChild(this: CollectionViewInternals, view: CollectionChild, index?: number | null) {
    this.triggerMethod('before:add:child', this, view);

    this._setupChildView(view);
    this._children._add(view, index as number | undefined);
    this.children._add(view, index as number | undefined);

    this.triggerMethod('add:child', this, view);
  },

  // Retrieve the `childView` class
  // The `childView` property can be either a view class or a function that
  // returns a view class. If it is a function, it will receive the model that
  // will be passed to the view instance (created from the returned view class)
  _getChildView(this: CollectionViewInternals, child: unknown) {
    const childView = this.childView;

    if (!childView) {
      throw new MarionetteError({
        code: 'MN0011',
        name: classErrorName,
        message: 'A "childView" must be specified',
        url: 'marionette.collectionview.html#collectionviews-childview'
      });
    }

    return this._getView(childView, child);
  },

  // First check if the `view` is a view class (the common case)
  // Then check if it's a function (which we assume that returns a view class)
  _getView(this: CollectionViewInternals, view: NonNullable<CollectionViewConfiguration['childView']>, child: unknown) {
    if (isViewClass(view)) {
      return view as ChildClass;
    }
    return (view as (this: CollectionViewInternals, model: unknown) => ChildClass).call(this, child);
  },

  _getChildViewOptions(this: CollectionViewInternals, child: unknown) {
    if (typeof this.childViewOptions === 'function') {
      return this.childViewOptions(child as never);
    }

    return this.childViewOptions;
  },

  // Build a `childView` for a model in the collection.
  // Override to customize the build
  buildChildView(this: CollectionViewInternals, child: unknown, ChildViewClass: ChildClass, childViewOptions?: object | null) {
    const options = childViewOptions == null ?
      { model: child } : { model: child, ...childViewOptions as object };
    return new (ChildViewClass as new(options: object) => CollectionChild)(options);
  },

  _setupChildView(this: CollectionViewInternals, view: CollectionChild) {
    // We need to listen for if a view is destroyed in a way other
    // than through the CollectionView.
    // If this happens we need to remove the reference to the view
    // since once a view has been destroyed we can not reuse it.
    view.on('destroy', this.removeChildView, this);

    // set up the child view event forwarding
    this._proxyChildViewEvents(view);
  },

  // used by ViewMixin's `_childViewEventHandler`
  _getImmediateChildren(this: CollectionViewInternals) {
    return this.children._views;
  },

  // Render children views.
  render(this: CollectionViewInternals) {
    if (this._isDestroyed) { return this; }
    this.triggerMethod('before:render', this);

    this._destroyChildren();

    if (this.collection != null) {
      this._collectionSnapshot = buildCollectionSnapshot(this.Data, this.collection, []);
      this._addChildModels(this._collectionSnapshot.entries.map(entry => entry.model));
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
  _getChildViewContainer(this: CollectionViewInternals) {
    const childViewContainer = getValue(this, 'childViewContainer');
    this.container = childViewContainer ? this.$(childViewContainer as string)[0] : this.el;

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
  sort(this: CollectionViewInternals) {
    this._sortChildren();

    this.filter();

    return this;
  },

  // Sorts views by viewComparator and sets the children to the new order
  _sortChildren(this: CollectionViewInternals) {
    if (!this._children.length) { return; }

    let viewComparator = this.getComparator();

    if (!viewComparator) { return; }

    this.triggerMethod('before:sort', this);

    if (viewComparator === defaultViewComparator && this._children.length) {
      const indexByModel = new Map<unknown, number>();
      const models = this.Data.models(this.collection as never);
      for (let index = 0; index < models.length; index++) {
        indexByModel.set(models[index], index);
      }
      viewComparator = (view: CollectionChild) => indexByModel.get(view.model) ?? -1;
    }

    this._children._sort(viewComparator, this);

    this.triggerMethod('sort', this);
  },

  // Sets the view's `viewComparator` and applies the sort if the view is ready.
  // To prevent the render pass `{ preventRender: true }` as the 2nd argument.
  setComparator(this: CollectionViewInternals, comparator: Comparator<CollectionChild, CollectionViewInstance> | MissingChild, { preventRender }: ChildRenderOptions = {}) {
    const comparatorChanged = this.viewComparator !== comparator;
    const shouldSort = comparatorChanged && !preventRender;

    this.viewComparator = comparator;

    if (shouldSort) {
      this.sort();
    }

    return this;
  },

  // Clears the `viewComparator` and follows the same rules for rendering as `setComparator`.
  removeComparator(this: CollectionViewInternals, options?: ChildRenderOptions) {
    return this.setComparator(null, options);
  },

  // If viewComparator is overridden it will be returned here.
  // Additionally override this function to provide custom
  // viewComparator logic
  getComparator(this: CollectionViewInternals) {
    if (this.viewComparator) { return this.viewComparator; }

    if (!this.sortWithCollection || this.viewComparator === false || this.collection == null) {
      return false;
    }

    return this._viewComparator;
  },

  // Default internal view comparator that order the views by
  // the order of the collection
  _viewComparator(this: CollectionViewInternals, view: CollectionChild) {
    return this.Data.models(this.collection as never).indexOf(view.model);
  },

  // This method filters the children views and renders the results
  filter(this: CollectionViewInternals) {
    if (this._isDestroyed) { return this; }

    this._filterChildren();

    this._renderChildren();

    return this;
  },

  _filterChildren(this: CollectionViewInternals) {
    if (!this._children.length) { return; }

    const viewFilter = this._getFilter();

    if (!viewFilter) {
      const shouldReset = this.children.length !== this._children.length;

      this.children._set(this._children._views, shouldReset);

      return;
    }

    this.triggerMethod('before:filter', this);

    const attachViews: CollectionChild[] = [];
    const detachViews: CollectionChild[] = [];

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
  _getFilter(this: CollectionViewInternals) {
    const viewFilter = this.getFilter();

    if (!viewFilter) { return false; }

    if (typeof viewFilter === 'function') {
      return viewFilter;
    }

    // Filter by model attribute.
    if (typeof viewFilter === 'string') {
      return (view: CollectionChild) => view.model != null && this.Data.has(view.model as never, viewFilter as string) &&
        this.Data.get(view.model as never, viewFilter as never);
    }

    return modelAttributesMatcher(this.Data, viewFilter);
  },

  // Override this function to provide custom
  // viewFilter logic
  getFilter(this: CollectionViewInternals) {
    return this.viewFilter;
  },

  // Sets the view's `viewFilter` and applies the filter if the view is ready.
  // To prevent the render pass `{ preventRender: true }` as the 2nd argument.
  setFilter(this: CollectionViewInternals, filter: Filter<CollectionChild, CollectionViewInstance>, { preventRender }: ChildRenderOptions = {}) {
    const filterChanged = this.viewFilter !== filter;
    const shouldRender = filterChanged && !preventRender;

    this.viewFilter = filter;

    if (shouldRender) {
      this.filter();
    }

    return this;
  },

  // Clears the `viewFilter` and follows the same rules for rendering as `setFilter`.
  removeFilter(this: CollectionViewInternals, options?: ChildRenderOptions) {
    return this.setFilter(null, options);
  },

  _detachChildren(this: CollectionViewInternals, detachingViews: CollectionChild[]) {
    const length = detachingViews.length;
    for (let index = 0; index < length; index++) {
      this._detachChildView(detachingViews[index]);
    }
  },

  _detachChildView(this: CollectionViewInternals, view: CollectionChild) {
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
  detachHtml(this: CollectionViewInternals, view: CollectionChild) {
    this.Dom.detachEl(view.el);
  },

  // Render visible children, attach new elements, and keep survivors in place.
  _renderChildren(this: CollectionViewInternals) {
    const views = this.children._views;
    this.triggerMethod('before:render:children', this, views);
    if (this.isEmpty()) {
      this._showEmptyView();
    } else {
      this._destroyEmptyView();

      const documentEl = this.container.ownerDocument;
      const activeElement = documentEl.activeElement as HTMLInputElement | null;
      const shouldRestoreFocus = activeElement && views.some(view =>
        view.el === activeElement || view.el.contains(activeElement)
      );
      const selection = shouldRestoreFocus &&
        typeof activeElement.selectionStart === 'number' && {
        end: activeElement.selectionEnd,
        start: activeElement.selectionStart,
        direction: activeElement.selectionDirection
      };

      for (const view of views) { renderView(view); }

      const attaching = views.filter(view => !view._isShown || view.el.parentNode !== this.container);
      if (attaching.length) {
        this._attachChildren(this._getBuffer(attaching), attaching);
      }

      // A buffer containing every child is already in order. Custom attachHtml
      // implementations that use another parent manage their own placement.
      if (attaching.length !== views.length &&
          attaching.every(view => view.el.parentNode === this.container)) {
        const childEls = new Set<Node>(views.map(view => view.el));
        let next = this.container.firstChild;
        for (const view of views) {
          while (next && !childEls.has(next)) { next = next.nextSibling; }
          if (view.el !== next) {
            this.Dom.moveEl(view.el, this.container, next);
          }
          next = view.el.nextSibling;
        }
      }

      if (shouldRestoreFocus && activeElement.isConnected &&
          documentEl.activeElement !== activeElement) {
        activeElement.focus({ preventScroll: true });
        if (selection) {
          activeElement.setSelectionRange(selection.start, selection.end,
            selection.direction as NonNullable<HTMLInputElement['selectionDirection']> | undefined);
        }
      }
    }

    this.triggerMethod('render:children', this, views);
  },

  // Creates a fragment buffer from the children being attached
  _getBuffer(this: CollectionViewInternals, views: CollectionChild[]) {
    const elBuffer = this.Dom.createBuffer();

    const length = views.length;
    for (let index = 0; index < length; index++) {
      const view = views[index];
      // corresponds that view is shown in a Region or CollectionView
      view._isShown = true;
      this.Dom.appendContents(elBuffer, view.el);
    }

    return elBuffer;
  },

  _attachChildren(this: CollectionViewInternals, els: Element | DocumentFragment, views: CollectionChild[]) {
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
  attachHtml(this: CollectionViewInternals, els: Element | DocumentFragment, container: Element) {
    this.Dom.appendContents(container, els);
  },

  isEmpty(this: CollectionViewInternals) {
    return !this.children.length;
  },

  _showEmptyView(this: CollectionViewInternals) {
    const EmptyView = this._getEmptyView();

    if (!EmptyView) {
      return;
    }

    const options = this._getEmptyViewOptions();

    const emptyRegion = this.getEmptyRegion();

    emptyRegion.show(new (EmptyView as new(options: object | null | undefined) => SupportedView)(options));
  },

  // Retrieve the empty view class
  _getEmptyView(this: CollectionViewInternals) {
    const emptyView = this.emptyView;

    if (emptyView == null || emptyView === false) { return; }

    if (isViewClass(emptyView)) { return emptyView as ChildClass<SupportedView>; }

    return (emptyView as () => ChildClass<SupportedView> | null | false | undefined).call(this);
  },

  // Remove the emptyView
  _destroyEmptyView(this: CollectionViewInternals) {
    const emptyRegion = this.getEmptyRegion();
    // Only empty if a view is show so the region
    // doesn't detach any other unrelated HTML
    if (emptyRegion.hasView()) {
      emptyRegion.empty();
    }
  },

  _getEmptyViewOptions(this: CollectionViewInternals) {
    const emptyViewOptions = this.emptyViewOptions || this.childViewOptions;

    if (typeof emptyViewOptions === 'function') {
      return emptyViewOptions.call(this);
    }

    return emptyViewOptions;
  },

  swapChildViews(this: CollectionViewInternals, view1: CollectionChild, view2: CollectionChild) {
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
  addChildView(this: CollectionViewInternals, view: CollectionChild | MissingChild, index?: number | null | ChildRenderOptions, options: ChildRenderOptions = {}) {
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
      options = index as ChildRenderOptions;
    }

    // If options has defined index we should use it
    if (options.index != null) {
      index = options.index;
    }

    if (!this._isRendered) {
      this.render();
    }

    this._addChild(view, index as number | null | undefined);

    if (options.preventRender) {
      return view;
    }

    if (typeof index !== 'undefined') {
      this._renderChildren();
    } else {
      this.sort();
    }

    return view;
  },

  // Detach a view from the children.  Best used when adding a
  // childView from `addChildView`
  detachChildView(this: CollectionViewInternals, view: CollectionChild | MissingChild) {
    this.removeChildView(view, { shouldDetach: true });

    return view;
  },

  // Remove the child view and destroy it.  Best used when adding a
  // childView from `addChildView`
  // The options argument is for internal use only
  removeChildView(this: CollectionViewInternals, view: CollectionChild | MissingChild, options?: {shouldDetach?: boolean}) {
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

  _removeChildViews(this: CollectionViewInternals, views: CollectionChild[]) {
    for (const view of views) { this._removeChildView(view); }
  },

  _removeChildView(this: CollectionViewInternals, view: CollectionChild, { shouldDetach }: {shouldDetach?: boolean} = {}) {
    view.off('destroy', this.removeChildView, this);
    shouldDetach ? this._detachChildView(view) : this._destroyChildView(view);
    this.stopListening(view);
  },

  _destroyChildView(this: CollectionViewInternals, view: CollectionChild) {
    if (view._isDestroyed) {
      return;
    }

    const shouldDisableEvents = this.monitorViewEvents === false;
    destroyView(view, shouldDisableEvents);
  },

  // called by ViewMixin destroy
  _removeChildren(this: CollectionViewInternals) {
    const emptyRegion = this.getEmptyRegion();
    this._destroyChildren();
    emptyRegion.destroy();
  },

  // Destroy the child views that this collection view is holding on to, if any
  _destroyChildren(this: CollectionViewInternals) {
    if (!this._children.length) {
      return;
    }

    this.triggerMethod('before:destroy:children', this);
    if (this.monitorViewEvents === false) { this.Dom.detachContents(this.el); }
    this._removeChildViews(this._children._views);
    this._children._init();
    this.children._init();

    this.triggerMethod('destroy:children', this);
  }
});

// Prototype overrides must not be mistaken for the built-in comparator.
const defaultViewComparator = CollectionView.prototype._viewComparator;

export default CollectionView as unknown as CollectionViewConstructor;
