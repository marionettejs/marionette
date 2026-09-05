// View
// ----

import { assignOwn } from '../utils/assign-in.js';
import eachOwn from '../utils/each-own.js';
import MarionetteError from './error.ts';
import extend from '../utils/extend.ts';
import getValue from '../utils/get-value.ts';
import uniqueId from '../utils/unique-id.ts';
import disposeAll from '../utils/dispose-all.ts';
import monitorViewEvents from './common/monitor-view-events.ts';
import buildRegion from './common/build-region.ts';
import ViewMixin, { ViewOptions } from '../mixins/view.ts';
import Region from './region.ts';
import { setEventDelegator } from '../runtime/event-delegator.ts';
import { setRenderer } from '../runtime/renderer.ts';
import { setDomApi } from '../runtime/dom-api.ts';
import { setDataApi } from '../runtime/data-api.ts';
import { setStateApi } from '../runtime/state-api.ts';
import { runtimeId } from '../runtime/runtime-id.js';

import type { ViewMixinHost } from '../mixins/view.ts';
import type { DOMEvents, DOMTriggers } from '../mixins/view-events.ts';
import type { UISelectors, UIBindings } from '../mixins/ui.ts';
import type { BehaviorDefinitions, BehaviorInstance } from '../mixins/behaviors.ts';
import type { EventCallback } from '../mixins/events.ts';
import type CommonMixin from '../mixins/common.ts';
import type { DomApi } from '../runtime/dom-api.ts';
import type { DataApi } from '../runtime/data-api.ts';
import type { StateApi } from '../runtime/state-api.ts';
import type { EventDelegator } from '../runtime/event-delegator.ts';
import type { Renderer } from '../runtime/renderer.ts';
import type { SupportedView } from './common/view.ts';
import type { RegionInstance, RegionInternals, ShowOptions } from './region.ts';
import type { RegionDefinition, RegionClass } from './common/build-region.ts';
import type { Constructed, Merge, ArgumentsFor, DefaultOptions, OptionsFor, StateFor, SuppliedState } from './object.ts';

export interface ViewConfiguration {
  el?: Element | (() => Element);
  tagName?: string | (() => string);
  id?: string | (() => string);
  className?: string | (() => string);
  attributes?: Record<string, unknown> | (() => Record<string, unknown>);
  model?: unknown;
  collection?: unknown;
  events?: DOMEvents | (() => DOMEvents);
  triggers?: DOMTriggers | (() => DOMTriggers);
  ui?: UIBindings;
  behaviors?: BehaviorDefinitions | (() => BehaviorDefinitions);
  regions?: Record<string, RegionDefinition> | (() => Record<string, RegionDefinition>);
  regionClass?: RegionClass;
  childViewEvents?: Record<string, EventCallback | string> | (() => Record<string, EventCallback | string>);
  childViewTriggers?: Record<string, string> | (() => Record<string, string>);
  childViewEventPrefix?: string | false | (() => string | false);
  modelEvents?: unknown;
  collectionEvents?: unknown;
  stateEvents?: unknown;
  state?: unknown;
  template?: unknown;
  templateContext?: object | (() => object);
}

type Common = typeof CommonMixin;
import type { ViewFluent } from './common/fluent-methods.ts';

export interface ViewInstance<Options extends object = ViewConfiguration, State = unknown,
  Query extends ArrayLike<Element> = ArrayLike<Element>, Wrapped = unknown> extends Common, ViewFluent<{}> {
  cid: string;
  cidPrefix: string;
  options: Options;
  el: Element;
  $el?: Wrapped;
  tagName: string | (() => string);
  id?: ViewConfiguration['id'];
  className?: ViewConfiguration['className'];
  attributes?: ViewConfiguration['attributes'];
  model?: unknown;
  collection?: unknown;
  events?: ViewConfiguration['events'];
  triggers?: ViewConfiguration['triggers'];
  ui?: UIBindings | Record<string, Query>;
  behaviors?: ViewConfiguration['behaviors'];
  regions: Record<string, RegionDefinition> | (() => Record<string, RegionDefinition>);
  regionClass: RegionClass;
  childViewEvents?: ViewConfiguration['childViewEvents'];
  childViewTriggers?: ViewConfiguration['childViewTriggers'];
  childViewEventPrefix?: ViewConfiguration['childViewEventPrefix'];
  modelEvents?: unknown;
  collectionEvents?: unknown;
  stateEvents?: unknown;
  state?: unknown;
  template?: unknown;
  templateContext?: ViewConfiguration['templateContext'];
  Dom: Partial<DomApi<Query, Wrapped>>;
  Data: Partial<DataApi>;
  State: Partial<StateApi<never>>;
  EventDelegator: EventDelegator;
  _renderHtml?: Renderer<never, never, never>;
  monitorViewEvents?: boolean;
  supportsRenderLifecycle: boolean;
  supportsDestroyLifecycle: boolean;
  preinitialize(options?: Options): void;
  initialize(options?: Options): void;
  createState(options?: Options): unknown;
  getState(): State;
  $(selector: string): Query;
  isDestroyed(): boolean;
  isRendered(): boolean;
  isAttached(): boolean;
  _removeBehavior(behavior: BehaviorInstance): void;
  getUI(name: string): Query | undefined;
  normalizeUIString(value: string, bindings?: UISelectors): string;
  normalizeUIKeys<Value>(hash: Record<string, Value> | null | undefined, bindings?: UISelectors): Record<string, Value>;
  normalizeUIValues<Hash extends object>(hash: Hash, property?: string, bindings?: UISelectors): Hash;
  getTemplate(): unknown;
  serializeData(): unknown;
  serializeModel(): unknown;
  serializeCollection(): unknown[];
  mixinTemplateContext(data: unknown): unknown;
  attachElContent(html: unknown): void;
  addRegion(name: string, definition: RegionDefinition): RegionInstance;
  addRegions(regions?: Record<string, RegionDefinition> | null): Record<string, RegionInstance> | undefined;
  removeRegion(name: string): RegionInstance;
  removeRegions(): Record<string, RegionInstance>;
  emptyRegions(): Record<string, RegionInstance>;
  hasRegion(name: string): boolean;
  getRegion(name: string): RegionInstance | undefined;
  getRegions(): Record<string, RegionInstance>;
  showChildView<Child extends SupportedView>(name: string, view: Child, options?: ShowOptions): Child;
  detachChildView(name: string): SupportedView | undefined;
  getChildView(name: string): SupportedView | undefined;
}

type ViewResult<Props, Args extends unknown[], State, Query extends ArrayLike<Element>, Wrapped> =
  Extract<keyof ViewInstance, keyof Props> extends never ?
    ViewInstance<Merge<DefaultOptions<Props>, OptionsFor<Args>>, State, Query, Wrapped> & Props :
    Merge<Omit<ViewInstance<Merge<DefaultOptions<Props>, OptionsFor<Args>>, State, Query, Wrapped>, keyof ViewFluent<{}>>,
      'options' extends keyof Props ? Omit<Props, 'options'> : Props> & ViewFluent<Props>;
export type ViewConstructor<Props extends object = {}, Args extends unknown[] = [options?: ViewConfiguration],
  State = unknown, Statics extends object = {}, Query extends ArrayLike<Element> = ArrayLike<Element>, Wrapped = unknown> = {
  new <Provided extends Args = Args>(...args: Provided): Constructed<Props, ViewResult<Props, Provided, SuppliedState<Provided[0], State>, Query, Wrapped>>;
  (this: object, ...args: Args): void;
} & Merge<{
  prototype: ViewResult<Props, Args, State, Query, Wrapped>;
  call(receiver: object, ...args: Args): void;
  apply(receiver: object, args: Args | IArguments): void;
  setRenderer: typeof setRenderer;
  setDomApi: typeof setDomApi;
  setEventDelegator: typeof setEventDelegator;
  setDataApi: typeof setDataApi;
  setStateApi: typeof setStateApi;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: Added extends { constructor: (...args: never[]) => unknown } ? object : (this: object, ...args: never[]) => unknown,
    prototypeProperties?: Added & ThisType<ViewResult<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>,
      StateFor<Merge<Props, Added>>, Query, Wrapped>>,
    staticProperties?: AddedStatics & ThisType<ViewConstructor<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>,
      StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>, Query, Wrapped>>
  ): ViewConstructor<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>,
    StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>, Query, Wrapped>;
}, Statics>;

type RegionMap = Record<string, RegionInternals>;
type RegionDefinitions = Record<string, RegionDefinition>;
type ViewInternals = ViewInstance & ViewMixinHost & {
  [runtimeId]: object;
  regions: RegionDefinitions;
  _regions: RegionMap;
  _initRegions(): void;
  _reInitRegions(): void;
  _addRegions(regions: RegionDefinitions): RegionMap;
  _addRegion(region: RegionInternals, name: string): void;
  _removeRegion(region: RegionInternals, name: string): void;
  _removeReferences(name: string): void;
  _getRegions(): RegionMap;
  _isElAttached(): boolean;
  _validateEl(element: Element): Element;
  _getEl(): Element;
  _rollbackView(error: unknown): void;
};

const classErrorName = 'RegionError';

function assertRegionName(name: string) {
  if (typeof name === 'string' && name.length > 0) { return; }

  throw new MarionetteError({
    code: 'MN0032',
    name: classErrorName,
    message: 'A Region name must be a non-empty string.'
  });
}

function setRegion<Value>(regions: Record<string, Value>, definition: Value, name: string) {
  assertRegionName(name);

  Object.defineProperty(regions, name, {
    configurable: true,
    enumerable: true,
    value: definition,
    writable: true
  });
  return regions;
}

function getOwnRegion(regions: RegionMap, name: string): RegionInternals | undefined {
  assertRegionName(name);
  return Object.getOwnPropertyDescriptor(regions, name)?.value;
}

function getRequiredRegion(region: RegionInstance | undefined, name: string) {
  if (region) { return region; }

  throw new MarionetteError({
    code: 'MN0020',
    name: classErrorName,
    message: `Region "${name}" does not exist.`
  });
}

function getRegionForChild(view: ViewInternals, name: string) {
  assertRegionName(name);

  if (!view._isRendered) {
    view.render();
  }
  return getRequiredRegion(view.getRegion(name), name);
}

function throwRegionRegistrationConflict(message: string) {
  throw new MarionetteError({
    code: 'MN0030',
    name: classErrorName,
    message
  });
}

function isSameRegionRegistration(view: ViewInternals, region: RegionInternals, name: string) {
  return region._parentView === view && region._name === name &&
    getOwnRegion(view._regions, name) === region;
}

function assertRegionCanRegister(view: ViewInternals, region: RegionInternals, name: string) {
  if (isSameRegionRegistration(view, region, name)) { return; }

  if (region._parentView !== undefined) {
    throwRegionRegistrationConflict('A Region instance cannot be registered with more than one owner or name.');
  }

  if (region._isDestroying || region._isDestroyed) {
    throwRegionRegistrationConflict('A destroying or destroyed Region cannot be registered.');
  }

  if (getOwnRegion(view._regions, name)) {
    throwRegionRegistrationConflict(`Region name "${name}" is already registered.`);
  }
}

function assertRegionDefinitionsCanRegister(view: ViewInternals, definitions: RegionDefinitions) {
  const seenRegions = new Set();

  eachOwn(definitions, (definition: RegionDefinition, name: string) => {
    if (!(definition instanceof Region)) {
      if (getOwnRegion(view._regions, name)) {
        throwRegionRegistrationConflict(`Region name "${name}" is already registered.`);
      }
      return;
    }

    if (seenRegions.has(definition)) {
      throwRegionRegistrationConflict('A Region instance cannot be registered under more than one name.');
    }

    seenRegions.add(definition);
    assertRegionCanRegister(view, definition as RegionInternals, name);
  });
}

// MixinOptions
// - regions
// - regionClass

const RegionsMixin = {
  regionClass: Region,

  // Internal method to initialize the regions that have been defined in a
  // `regions` attribute on this View.
  _initRegions(this: ViewInternals) {

    // init regions hash
    this.regions = this.regions || {};
    this._regions = Object.create(null);

    this.addRegions(getValue(this, 'regions') as RegionDefinitions | undefined);
  },

  // Internal method to re-initialize all of the regions by updating
  // the `el` that they point to
  _reInitRegions(this: ViewInternals) {
    eachOwn(this._regions, (region: RegionInternals) => region.reset());
  },

  // Add a single region, by name, to the View
  addRegion(this: ViewInternals, name: string, definition: RegionDefinition) {
    const regions = setRegion({}, definition, name);
    return this.addRegions(regions)![name];
  },

  // Add multiple regions as a {name: definition, name2: def2} object literal
  addRegions(this: ViewInternals, regions?: RegionDefinitions | null) {
    // If there's nothing to add, stop here.
    if (regions == null || Object.keys(regions).length === 0) {
      return;
    }

    eachOwn(regions, (_: RegionDefinition, name: string) => assertRegionName(name));

    // Normalize region selectors hash to allow
    // a user to use the @ui. syntax.
    regions = this.normalizeUIValues(regions, 'el');

    assertRegionDefinitionsCanRegister(this, regions);

    // Add the regions definitions to the regions property
    const allRegions = {};
    eachOwn(this.regions, (definition: RegionDefinition, name: string) => setRegion(allRegions, definition, name));
    eachOwn(regions, (definition: RegionDefinition, name: string) => setRegion(allRegions, definition, name));
    this.regions = allRegions;

    return this._addRegions(regions);
  },

  // internal method to build and add regions
  _addRegions(this: ViewInternals, regionDefinitions: RegionDefinitions) {
    const defaults = {
      [runtimeId]: this[runtimeId],
      regionClass: this.regionClass,
      parentEl: () => getValue(this, 'el') as Element
    };

    const regions: RegionMap = {};
    try {
      eachOwn(regionDefinitions, (definition: RegionDefinition, name: string) => {
        const region = buildRegion(definition, defaults);
        this._addRegion(region, name);
        setRegion(regions, region, name);
      });
    } catch (error) {
      eachOwn(regionDefinitions, (definition: RegionDefinition, name: string) => {
        if (!getOwnRegion(this._regions, name)) {
          delete this.regions[name];
        }
      });
      throw error;
    }
    return regions;
  },

  _addRegion(this: ViewInternals, region: RegionInternals, name: string) {
    // Repeating the completed identity is safe even during teardown: this path does not mutate.
    if (isSameRegionRegistration(this, region, name)) { return; }

    assertRegionCanRegister(this, region, name);

    this.triggerMethod('before:add:region', this, name, region);

    // A lifecycle hook may adopt the Region or occupy the name reentrantly.
    if (isSameRegionRegistration(this, region, name)) { return; }

    try {
      assertRegionCanRegister(this, region, name);
    } catch (error) {
      if (!getOwnRegion(this._regions, name)) {
        delete this.regions[name];
      }
      throw error;
    }

    region._parentView = this;
    region._name = name;

    this._regions[name] = region;

    this.triggerMethod('add:region', this, name, region);
  },

  // Remove a single region from the View, by name
  removeRegion(this: ViewInternals, name: string) {
    const region = getRequiredRegion(getOwnRegion(this._regions, name), name);

    this._removeRegion(region as RegionInternals, name);

    return region;
  },

  // Remove all regions from the View
  removeRegions(this: ViewInternals) {
    const regions = this._getRegions();
    const cleanups: Array<() => void> = [];

    eachOwn(regions, (region: RegionInternals, name: string) => {
      cleanups.push(() => this._removeRegion(region as RegionInternals, name));
    });
    disposeAll(cleanups.reverse());

    return regions;
  },

  _removeRegion(this: ViewInternals, region: RegionInternals, name: string) {
    this.triggerMethod('before:remove:region', this, name, region);

    region.destroy();

    this.triggerMethod('remove:region', this, name, region);
  },

  // Called in a region's destroy
  _removeReferences(this: ViewInternals, name: string) {
    delete this.regions[name];
    delete this._regions[name];
  },

  // Empty all regions in the region manager, but
  // leave them attached
  emptyRegions(this: ViewInternals) {
    if (!this._isRendered) {
      this.render();
    }
    const regions = this.getRegions();
    eachOwn(regions, (region: RegionInternals) => region.empty());
    return regions;
  },

  // Checks to see if view contains region
  // Accepts the region name
  // hasRegion('main')
  hasRegion(this: ViewInternals, name: string) {
    return !!getOwnRegion(this._regions, name);
  },

  // Provides access to regions
  // Accepts the region name
  // getRegion('main')
  getRegion(this: ViewInternals, name: string) {
    return getOwnRegion(this._regions, name);
  },

  _getRegions(this: ViewInternals) {
    const regions: RegionMap = {};
    eachOwn(this._regions, (region: RegionInternals, name: string) => setRegion(regions, region, name));
    return regions;
  },

  // Get all regions
  getRegions(this: ViewInternals) {
    return this._getRegions();
  },

  showChildView(this: ViewInternals, name: string, view: SupportedView, options?: ShowOptions) {
    const region = getRegionForChild(this, name);
    region.show(view, options);
    return view;
  },

  detachChildView(this: ViewInternals, name: string) {
    return getRegionForChild(this, name).detachView();
  },

  getChildView(this: ViewInternals, name: string) {
    return getRegionForChild(this, name).currentView;
  }

};

// View
// ---------

const ViewClassOptions = [
  'attributes',
  'behaviors',
  'childViewEventPrefix',
  'childViewEvents',
  'childViewTriggers',
  'className',
  'collection',
  'collectionEvents',
  'el',
  'events',
  'id',
  'model',
  'modelEvents',
  'regionClass',
  'regions',
  'stateEvents',
  'tagName',
  'template',
  'templateContext',
  'triggers',
  'ui'
];

// Used by _getImmediateChildren
function childReducer(children: SupportedView[], region: RegionInternals) {
  if (region.currentView) {
    children.push(region.currentView);
  }

  return children;
}

// The standard view. Includes view events, automatic rendering
// templates, nested views, and more.
const View = function(this: ViewInternals, options?: ViewConfiguration) {
  this.cid = uniqueId(this.cidPrefix);
  this._setOptions(options, ViewClassOptions);

  (this.preinitialize as Function).apply(this, arguments);
  this.mergeOptions(options, ViewOptions);

  this._initViewEvents();

  try {
    this.setElement(this._getEl());

    monitorViewEvents(this);

    this._initState(options);

    this._initBehaviors();
    this._initRegions();
    this._buildEventProxies();

    (this.initialize as Function).apply(this, arguments);

    if (this._isDestroyed || this._isDestroying) { return; }

    this._initStateEvents();
    this.delegateEntityEvents();

    this._triggerEventOnBehaviors('initialize', this, options);
  } catch (error) {
    this._rollbackView(error);
  }
};

assignOwn(View, { extend, setRenderer, setDomApi, setEventDelegator, setDataApi, setStateApi });

assignOwn(View.prototype, ViewMixin, RegionsMixin, {
  cidPrefix: 'mnv',

  setElement(this: ViewInternals, element: Element) {
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

    this._isRendered = this.Dom.hasContents!(this.el);
    this._isAttached = this._isElAttached();

    if (this._isRendered) {
      this.bindUIElements();
    }

    this.delegateEvents();

    return this;
  },

  // If a template is available, renders it into the view's `el`
  // Re-inits regions and binds UI.
  render(this: ViewInternals) {
    if (this._isDestroyed) { return this; }

    const template = this.getTemplate();

    if (template === false) { return this; }

    this.triggerMethod('before:render', this);

    // If this is not the first render call, then we need to
    // re-initialize the `el` for each region
    if (this._isRendered) {
      this._reInitRegions();
    }

    this._renderTemplate(template);
    this.bindUIElements();

    this._isRendered = true;
    this.triggerMethod('render', this);

    return this;
  },

  // called by ViewMixin destroy
  _removeChildren(this: ViewInternals) {
    this.removeRegions();
  },

  _getImmediateChildren(this: ViewInternals) {
    const children: SupportedView[] = [];
    eachOwn(this._regions, (region: RegionInternals) => childReducer(children, region));
    return children;
  }
});

export default View as unknown as ViewConstructor;
