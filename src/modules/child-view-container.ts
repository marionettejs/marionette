import MarionetteError from './error.ts';
import DataApi, {type DataApi as DataApiContract} from '../runtime/data-api.ts';

export interface ContainerChild {
  cid: PropertyKey;
  model?: unknown;
}

type ContainerData = Pick<DataApiContract, 'key' | 'get' | 'has'>;
type Callback<Child, Result, Context = void> = (this: Context, view: Child, index: number) => Result;
type Reducer<Child, Result, Context = void> = (this: Context, result: Result, view: Child, index: number) => Result;
type MethodKeys<Child> = {
  [Key in keyof Child]-?: Child[Key] extends (...args: never[]) => unknown ?
    [Child] extends [ThisParameterType<Child[Key]>] ? Key :
      void extends ThisParameterType<Child[Key]> ? Key : never : never
}[keyof Child] & string;
type Method<Child, Key extends keyof Child> = Extract<Child[Key], (...args: never[]) => unknown>;
type Comparator<Child, Context = void> = (this: Context, left: Child, right: Child) => number;
type Criterion<Child, Context = void> = (this: Context, view: Child) => unknown;

export interface ChildViewContainer<Child extends ContainerChild = ContainerChild> extends Iterable<Child> {
  Data: ContainerData;
  length: number;
  [Symbol.iterator](): ArrayIterator<Child>;
  each(callback: Callback<Child, unknown>): this;
  each<Context>(callback: Callback<Child, unknown, Context>, context: Context): this;
  map<Result>(callback: Callback<Child, Result>): Result[];
  map<Result, Context>(callback: Callback<Child, Result, Context>, context: Context): Result[];
  reduce(callback: Reducer<Child, Child>): Child;
  reduce<Result>(callback: Reducer<Child, Result>, initialValue: Result): Result;
  reduce<Result, Context>(callback: Reducer<Child, Result, Context>, initialValue: Result, context: Context): Result;
  find(predicate: Callback<Child, unknown>): Child | undefined;
  find<Context>(predicate: Callback<Child, unknown, Context>, context: Context): Child | undefined;
  filter(predicate: Callback<Child, unknown>): Child[];
  filter<Context>(predicate: Callback<Child, unknown, Context>, context: Context): Child[];
  reject(predicate: Callback<Child, unknown>): Child[];
  reject<Context>(predicate: Callback<Child, unknown, Context>, context: Context): Child[];
  every(predicate: Callback<Child, unknown>): boolean;
  every<Context>(predicate: Callback<Child, unknown, Context>, context: Context): boolean;
  some(predicate: Callback<Child, unknown>): boolean;
  some<Context>(predicate: Callback<Child, unknown, Context>, context: Context): boolean;
  contains(view: unknown): boolean;
  invoke<Key extends MethodKeys<Child>>(methodName: Key, ...args: Parameters<Method<Child, Key>>): ReturnType<Method<Child, Key>>[];
  toArray(): Child[];
  first(count?: undefined): Child | undefined;
  first(count: number): Child[];
  first(count: number | undefined): Child | Child[] | undefined;
  initial(count?: number): Child[];
  rest(count?: number): Child[];
  last(count?: undefined): Child | undefined;
  last(count: number): Child[];
  last(count: number | undefined): Child | Child[] | undefined;
  without(...excludedViews: unknown[]): Child[];
  isEmpty(): boolean;
  pluck<Key extends keyof Child>(key: Key): Child[Key][];
  pluck(key: PropertyKey): unknown[];
  partition(predicate: Callback<Child, unknown>): [Child[], Child[]];
  partition<Context>(predicate: Callback<Child, unknown, Context>, context: Context): [Child[], Child[]];
  findByModel(model: unknown): Child | undefined;
  findByKey(key: unknown): Child | undefined;
  findByIndex(index: number): Child | undefined;
  findIndexByView(view: unknown): number;
  findByCid(cid: PropertyKey): Child | undefined;
  hasView(view: Pick<ContainerChild, 'cid'>): boolean;

  _views: Child[];
  _viewsByCid: Record<PropertyKey, Child | undefined>;
  _indexByModel: Map<unknown, Child>;
  _keyByView: Map<Child, unknown>;
  _init(): void;
  _add(view: Child, index?: number): void;
  _addViewIndexes(view: Child): void;
  _sort(comparator: string): Child[];
  _sort(comparator: Comparator<Child>): Child[];
  _sort(comparator: Criterion<Child>): Child[];
  _sort<Context>(comparator: Comparator<Child, Context>, context: Context): Child[];
  _sort<Context>(comparator: Criterion<Child, Context>, context: Context): Child[];
  _sort<Context>(comparator: string | Criterion<Child, Context> | Comparator<Child, Context>, context?: Context): Child[];
  _sortBy(comparator: (this: void, view: Child) => unknown): Child[];
  _sortBy<Context>(comparator: (this: Context, view: Child) => unknown, context: Context): Child[];
  _set(views: Child[], shouldReset?: boolean): void;
  _swap(view1: Child, view2: Child): void;
  _remove(view: Child): void;
  _updateLength(): void;
}

interface ContainerConstructor {
  new<Child extends ContainerChild = ContainerChild>(dataApi?: ContainerData): ChildViewContainer<Child>;
  prototype: ChildViewContainer;
}

const classErrorName = 'CollectionViewError';

function createIndex<Child extends ContainerChild>(): Record<PropertyKey, Child | undefined> {
  return Object.create(null);
}

// Provide a container to store, retrieve and
// shut down child views.
const Container = function(this: ChildViewContainer, dataApi: ContainerData = DataApi) {
  this.Data = dataApi;
  this._init();
} as unknown as ContainerConstructor;

function assertFunction(callback: unknown) {
  if (typeof callback !== 'function') {
    throw new MarionetteError({
      code: 'MN0024',
      name: classErrorName,
      message: 'ChildViewContainer callback must be a function.'
    });
  }
}

function assertCount(count: number) {
  if (!Number.isInteger(count) || count < 0) {
    throw new MarionetteError({
      code: 'MN0024',
      name: classErrorName,
      message: 'ChildViewContainer count must be a nonnegative integer.'
    });
  }

  return count;
}

// Configured providers remain opaque; their supported model is a runtime contract.
function stringComparator(Data: ContainerData, comparator: string, view: ContainerChild): unknown {
  return view.model && Data.has(view.model as never, comparator) ?
    Data.get(view.model as never, comparator as never) : undefined;
}

function compareCriteria(left: {criteria: unknown; index: number}, right: {criteria: unknown; index: number}) {
  const leftCriteria = left.criteria;
  const rightCriteria = right.criteria;

  // Relational comparison deliberately retains JavaScript coercion of dynamic criteria.
  if (leftCriteria !== rightCriteria) {
    if ((leftCriteria as number) > (rightCriteria as number) || leftCriteria === undefined) { return 1; }
    if ((leftCriteria as number) < (rightCriteria as number) || rightCriteria === undefined) { return -1; }
  }

  return left.index - right.index;
}

function sortByCriteria<Child, Context>(views: Child[], comparator: (this: Context, view: Child) => unknown, context: Context) {
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

  each<Child extends ContainerChild, Context, Receiver extends ChildViewContainer<Child>>(
    this: Receiver,
    callback: Callback<Child, unknown, Context>, context?: Context
  ): Receiver {
    assertFunction(callback);

    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      callback.call(context as Context, this._views[index], index);
    }

    return this;
  },

  map<Child extends ContainerChild, Result, Context>(
    this: ChildViewContainer<Child>,
    callback: Callback<Child, Result, Context>, context?: Context
  ): Result[] {
    assertFunction(callback);

    const length = this._views.length;
    const results: Result[] = Array(length);
    for (let index = 0; index < length; index++) {
      results[index] = callback.call(context as Context, this._views[index], index);
    }

    return results;
  },

  reduce<Child extends ContainerChild, Result, Context>(
    this: ChildViewContainer<Child>,
    callback: Reducer<Child, Result, Context>, initialValue?: Result, context?: Context
  ): Result {
    assertFunction(callback);

    const length = this._views.length;
    const hasInitialValue = arguments.length > 1;
    let index = 0;
    // Public overloads correlate the accumulator with the supplied initial value,
    // or with Child when that argument is omitted. The runtime distinguishes arity.
    let accumulator = initialValue as Result;

    if (!hasInitialValue) {
      if (!length) {
        throw new MarionetteError({
          code: 'MN0024',
          name: classErrorName,
          message: 'Reduce of empty ChildViewContainer with no initial value.'
        });
      }

      accumulator = this._views[index++] as unknown as Result;
    }

    for (; index < length; index++) {
      accumulator = callback.call(context as Context, accumulator, this._views[index], index);
    }

    return accumulator;
  },

  find<Child extends ContainerChild, Context>(
    this: ChildViewContainer<Child>,
    predicate: Callback<Child, unknown, Context>, context?: Context
  ): Child | undefined {
    assertFunction(predicate);

    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      if (predicate.call(context as Context, view, index)) {
        return view;
      }
    }
  },

  filter<Child extends ContainerChild, Context>(
    this: ChildViewContainer<Child>,
    predicate: Callback<Child, unknown, Context>, context?: Context
  ): Child[] {
    assertFunction(predicate);

    const results = [];
    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      if (predicate.call(context as Context, view, index)) {
        results.push(view);
      }
    }

    return results;
  },

  reject<Child extends ContainerChild, Context>(
    this: ChildViewContainer<Child>,
    predicate: Callback<Child, unknown, Context>, context?: Context
  ): Child[] {
    assertFunction(predicate);

    const results = [];
    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      if (!predicate.call(context as Context, view, index)) {
        results.push(view);
      }
    }

    return results;
  },

  every<Child extends ContainerChild, Context>(
    this: ChildViewContainer<Child>,
    predicate: Callback<Child, unknown, Context>, context?: Context
  ): boolean {
    assertFunction(predicate);

    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      if (!predicate.call(context as Context, this._views[index], index)) {
        return false;
      }
    }

    return true;
  },

  some<Child extends ContainerChild, Context>(
    this: ChildViewContainer<Child>,
    predicate: Callback<Child, unknown, Context>, context?: Context
  ): boolean {
    assertFunction(predicate);

    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      if (predicate.call(context as Context, this._views[index], index)) {
        return true;
      }
    }

    return false;
  },

  contains<Child extends ContainerChild>(this: ChildViewContainer<Child>, view: unknown): boolean {
    return this._views.indexOf(view as Child) !== -1;
  },

  invoke<Child extends ContainerChild, Key extends MethodKeys<Child>>(
    this: ChildViewContainer<Child>,
    methodName: Key,
    ...args: Parameters<Method<Child, Key>>
  ): ReturnType<Method<Child, Key>>[] {
    if (typeof methodName !== 'string') {
      throw new MarionetteError({
        code: 'MN0024',
        name: classErrorName,
        message: 'ChildViewContainer method name must be a string.'
      });
    }

    const length = this._views.length;
    const results: ReturnType<Method<Child, Key>>[] = Array(length);
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

      results[index] = (method as (this: Child, ...args: Parameters<Method<Child, Key>>) => ReturnType<Method<Child, Key>>).apply(view, args);
    }

    return results;
  },

  toArray<Child extends ContainerChild>(this: ChildViewContainer<Child>): Child[] {
    return this._views.slice();
  },

  first<Child extends ContainerChild>(this: ChildViewContainer<Child>, count?: number): Child | Child[] | undefined {
    if (count === undefined) {
      return this._views[0];
    }

    return this._views.slice(0, assertCount(count));
  },

  initial<Child extends ContainerChild>(this: ChildViewContainer<Child>, count = 1): Child[] {
    const end = Math.max(this._views.length - assertCount(count), 0);
    return this._views.slice(0, end);
  },

  rest<Child extends ContainerChild>(this: ChildViewContainer<Child>, count = 1): Child[] {
    return this._views.slice(assertCount(count));
  },

  last<Child extends ContainerChild>(this: ChildViewContainer<Child>, count?: number): Child | Child[] | undefined {
    if (count === undefined) {
      return this._views[this._views.length - 1];
    }

    const start = Math.max(this._views.length - assertCount(count), 0);
    return this._views.slice(start);
  },

  without<Child extends ContainerChild>(this: ChildViewContainer<Child>, ...excludedViews: unknown[]): Child[] {
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

  isEmpty(this: ChildViewContainer): boolean {
    return this._views.length === 0;
  },

  pluck<Child extends ContainerChild, Key extends PropertyKey>(
    this: ChildViewContainer<Child>, key: Key
  ): (Key extends keyof Child ? Child[Key] : unknown)[] {
    const length = this._views.length;
    const results: (Key extends keyof Child ? Child[Key] : unknown)[] = Array(length);
    for (let index = 0; index < length; index++) {
      results[index] = (this._views[index] as Record<PropertyKey, unknown>)[key] as Key extends keyof Child ? Child[Key] : unknown;
    }

    return results;
  },

  partition<Child extends ContainerChild, Context>(
    this: ChildViewContainer<Child>,
    predicate: Callback<Child, unknown, Context>, context?: Context
  ): [Child[], Child[]] {
    assertFunction(predicate);

    const matching: Child[] = [];
    const rejected: Child[] = [];
    const length = this._views.length;
    for (let index = 0; index < length; index++) {
      const view = this._views[index];
      (predicate.call(context as Context, view, index) ? matching : rejected).push(view);
    }

    return [matching, rejected];
  },

  // Initializes an empty container
  _init(this: ChildViewContainer): void {
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
  _add<Child extends ContainerChild>(this: ChildViewContainer<Child>, view: Child, index = this._views.length): void {
    this._addViewIndexes(view);

    // add to end by default
    if (index === this._views.length) {
      this._views.push(view);
    } else {
      this._views.splice(index, 0, view);
    }

    this._updateLength();
  },

  _addViewIndexes<Child extends ContainerChild>(this: ChildViewContainer<Child>, view: Child): void {
    // store the view
    this._viewsByCid[view.cid] = view;

    // index it by model
    if (view.model) {
      const key = this.Data.key(view.model as never);
      this._indexByModel.set(key, view);
      this._keyByView.set(view, key);
    }
  },

  // Sort (mutate) and return the array of the child views.
  _sort<Child extends ContainerChild, Context>(
    this: ChildViewContainer<Child>,
    comparator: string | Criterion<Child, Context> | Comparator<Child, Context>, context?: Context
  ): Child[] {
    if (typeof comparator === 'string') {
      return this._sortBy(view => stringComparator(this.Data, comparator, view));
    }

    if (comparator.length === 1) {
      return this._sortBy(comparator as (this: Context, view: Child) => unknown, context as Context);
    }

    return this._views.sort((comparator as Comparator<Child, Context>).bind(context as Context));
  },

  // Makes `sortBy` mutate the array to match `this._views.sort`
  _sortBy<Child extends ContainerChild, Context>(
    this: ChildViewContainer<Child>,
    comparator: (this: Context, view: Child) => unknown, context?: Context
  ): Child[] {
    const sortedViews = sortByCriteria(this._views, comparator, context as Context);

    this._set(sortedViews);

    return sortedViews;
  },

  // Replace array contents without overwriting the reference.
  // Should not add/remove views
  _set<Child extends ContainerChild>(this: ChildViewContainer<Child>, views: Child[], shouldReset?: boolean): void {
    if (views !== this._views) {
      this._views.length = 0;
      this._views.push.apply(this._views, views);
    }

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
  _swap<Child extends ContainerChild>(this: ChildViewContainer<Child>, view1: Child, view2: Child): void {
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
  findByModel<Child extends ContainerChild>(this: ChildViewContainer<Child>, model: unknown): Child | undefined {
    return this._indexByModel.get(this.Data.key(model as never));
  },

  findByKey<Child extends ContainerChild>(this: ChildViewContainer<Child>, key: unknown): Child | undefined {
    return this._indexByModel.get(key);
  },

  // Find a view by index.
  findByIndex<Child extends ContainerChild>(this: ChildViewContainer<Child>, index: number): Child | undefined {
    return this._views[index];
  },

  // Find the index of a view instance
  findIndexByView<Child extends ContainerChild>(this: ChildViewContainer<Child>, view: unknown): number {
    return this._views.indexOf(view as Child);
  },

  // Retrieve a view by its `cid` directly
  findByCid<Child extends ContainerChild>(this: ChildViewContainer<Child>, cid: PropertyKey): Child | undefined {
    return this._viewsByCid[cid];
  },

  hasView<Child extends ContainerChild>(this: ChildViewContainer<Child>, view: Pick<ContainerChild, 'cid'>): boolean {
    return this.findByCid(view.cid) === view;
  },

  // Remove a view and clean up index references.
  _remove<Child extends ContainerChild>(this: ChildViewContainer<Child>, view: Child): void {
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
  _updateLength(this: ChildViewContainer): void {
    this.length = this._views.length;
  }
// Check the installed methods against their public contracts. first/last use
// the union implementation signature; their overload cases are checked by consumers.
} satisfies Omit<ChildViewContainer, 'Data' | 'length' | '_views' | '_viewsByCid' | '_indexByModel' | '_keyByView' | typeof Symbol.iterator | 'first' | 'last'> & {
  first: (...args: Parameters<ChildViewContainer['first']>) => ReturnType<ChildViewContainer['first']>;
  last: (...args: Parameters<ChildViewContainer['last']>) => ReturnType<ChildViewContainer['last']>;
});

Container.prototype[Symbol.iterator] = function<Child extends ContainerChild>(this: ChildViewContainer<Child>): ArrayIterator<Child> {
  return this._views[Symbol.iterator]();
};

export default Container;
