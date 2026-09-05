// Region
// ------

import { assignOwn } from '../utils/assign-in.js';
import MarionetteError from './error.ts';
import extend from '../utils/extend.ts';
import getValue from '../utils/get-value.ts';
import isString from '../utils/is-string.js';
import uniqueId from '../utils/unique-id.ts';
import disposeAll from '../utils/dispose-all.ts';
import monitorViewEvents from './common/monitor-view-events.ts';
import { renderView, destroyView, isView } from './common/view.ts';
import CommonMixin from '../mixins/common.ts';
import DomApi, { setDomApi } from '../runtime/dom-api.ts';
import { defaultRuntimeId, runtimeId } from '../runtime/runtime-id.js';


import type { DomApi as DomProvider } from '../runtime/dom-api.ts';
import type { SupportedView } from './common/view.ts';
import type { EventSource } from '../mixins/events.ts';
import type { Constructed, Merge, ArgumentsFor, OptionsFor, DefaultOptions } from './object.ts';

export interface RegionOptions {
  el?: string | Element | null;
  parentEl?: Element | Document | null | (() => Element | Document | null | undefined);
  allowMissingEl?: boolean | (() => boolean);
  replaceElement?: boolean | (() => boolean);
}
export interface ShowOptions {
  allowMissingEl?: boolean;
  replaceElement?: boolean;
  [key: string]: unknown;
}
export interface RegionOwner {
  monitorViewEvents?: boolean;
  _proxyChildViewEvents(view: SupportedView): void;
  stopListening(source: EventSource): unknown;
  _removeReferences?: (name: string) => void;
}

type Common = typeof CommonMixin;
import type { RegionFluent } from './common/fluent-methods.ts';

export interface RegionInstance<Options extends object = RegionOptions> extends Common, RegionFluent<{}> {
  cid: string;
  cidPrefix: string;
  options: Options;
  el?: string | Element | null;
  currentView?: SupportedView;
  Dom: Partial<DomProvider>;
  allowMissingEl?: RegionOptions['allowMissingEl'];
  parentEl?: RegionOptions['parentEl'];
  replaceElement: boolean | (() => boolean);
  initialize(options?: Options): void;
  getEl(selector: string): Element | undefined;
  isReplaced(): boolean;
  isSwappingView(): boolean;
  attachHtml(view: SupportedView): void;
  destroyView<Child extends SupportedView>(view: Child): Child;
  removeView(view: SupportedView): void;
  detachView(): SupportedView | undefined;
  detachHtml(): void;
  hasView(): boolean;
  getOwner(): RegionOwner | undefined;
  getName(): string | undefined;
  isDestroyed(): boolean;
}

type RegionResult<Props, Args extends unknown[]> =
  Extract<keyof RegionInstance, keyof Props> extends never ?
    RegionInstance<Merge<DefaultOptions<Props>, OptionsFor<Args>>> & Props :
    Merge<Omit<RegionInstance<Merge<DefaultOptions<Props>, OptionsFor<Args>>>, keyof RegionFluent<{}>>,
      'options' extends keyof Props ? Omit<Props, 'options'> : Props> & RegionFluent<Props>;
export type RegionConstructor<Props extends object = {}, Args extends unknown[] = [options?: RegionOptions], Statics extends object = {}> = {
  new <Provided extends Args = Args>(...args: Provided): Constructed<Props, RegionResult<Props, Provided>>;
  (this: object, ...args: Args): void;
} & Merge<{
  prototype: RegionResult<Props, Args> & Props;
  call(receiver: object, ...args: Args): void;
  apply(receiver: object, args: Args | IArguments): void;
  setDomApi: typeof setDomApi;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: Added extends { constructor: (...args: never[]) => unknown } ? object : (this: object, ...args: never[]) => unknown,
    prototypeProperties?: Added & ThisType<RegionResult<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>>>,
    staticProperties?: AddedStatics & ThisType<RegionConstructor<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>, Merge<Statics, AddedStatics>>>
  ): RegionConstructor<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>, Merge<Statics, AddedStatics>>;
}, Statics>;

export interface RegionInternals extends RegionInstance {
  [runtimeId]: object;
  _initEl?: string | Element | null;
  $el?: unknown;
  _isReplaced: boolean;
  _isSwappingView: boolean;
  _isDestroying?: boolean;
  _isDestroyed: boolean;
  _parentView?: RegionOwner;
  _name?: string;
  _validateEl(el: unknown): void;
  _setEl(el: RegionInstance['el']): void;
  _setElement(el: RegionInstance['el']): this;
  _ensureElement(options?: ShowOptions): boolean;
  _getView(view: SupportedView, options?: ShowOptions): SupportedView;
  _setupChildView(view: SupportedView): void;
  _proxyChildViewEvents(view: SupportedView): void;
  _shouldDisableMonitoring(): boolean | undefined;
  _isElAttached(): boolean;
  _attachView(view: SupportedView, options?: ShowOptions): void;
  _replaceEl(view: SupportedView): void;
  _restoreEl(): void;
  _empty(view: SupportedView, shouldDestroy?: boolean): void;
  _stopChildViewEvents(view: SupportedView): void;
  _detachView(view: SupportedView): void;
}

const classErrorName = 'RegionError';
const destroyTeardown = new WeakMap<RegionInternals, 'empty' | 'reset'>();

function consumeDestroyTeardown(region: RegionInternals, operation: 'empty' | 'reset') {
  if (destroyTeardown.get(region) !== operation) { return false; }

  destroyTeardown.delete(region);
  return true;
}

function canMutateRegion(region: RegionInternals) {
  return !region._isDestroying && !region._isDestroyed;
}

function emptyRegion(region: RegionInternals, options: ShowOptions = { allowMissingEl: true }) {
  const view = region.currentView;

  // If there is no view in the region we should only detach current html
  if (!view) {
    if (region._ensureElement(options)) {
      region.detachHtml();
    }
    return region;
  }

  region._empty(view, true);
  return region;
}

const RegionClassOptions = [
  'allowMissingEl',
  'parentEl',
  'replaceElement'
];

const Region = function(this: RegionInternals, options?: RegionOptions) {
  this._setOptions(options, RegionClassOptions);

  this.cid = uniqueId(this.cidPrefix);

  // getOption necessary because options.el may be passed as undefined
  this._initEl = this.el = this.getOption('el') as RegionInstance['el'];
  this._validateEl(this.el);

  (this.initialize as Function).apply(this, arguments);
};

(Region as Function & { extend?: typeof extend }).extend = extend;
(Region as Function & { setDomApi?: typeof setDomApi }).setDomApi = setDomApi;

// Region Methods
// --------------

assignOwn(Region.prototype, CommonMixin, {
  Dom: DomApi,

  cidPrefix: 'mnr',
  replaceElement: false,
  _isReplaced: false,
  _isSwappingView: false,

  _validateEl(this: RegionInternals, el: unknown) {
    if (!el || isString(el) || (el as Node).nodeType === 1) { return; }

    throw new MarionetteError({
      code: 'MN0002',
      name: classErrorName,
      message: 'Region "el" must be a selector string or DOM element.',
      url: 'marionette.region.html#additional-options'
    });
  },

  // Displays a view instance inside of the region. If necessary handles calling the `render`
  // method for you. Reads content directly from the `el` attribute.
  show(this: RegionInternals, view: SupportedView, options?: ShowOptions) {
    if (!canMutateRegion(this)) { return this; }

    if (!this._ensureElement(options)) {
      return;
    }

    view = this._getView(view, options);

    if (view === this.currentView) { return this; }

    if (view._isShown) {
      throw new MarionetteError({
        code: 'MN0003',
        name: classErrorName,
        message: 'View is already shown in a Region or CollectionView',
        url: 'marionette.region.html#showing-a-view'
      });
    }

    this._isSwappingView = !!this.currentView;

    this.triggerMethod('before:show', this, view, options);

    // Assume an attached view is already in the region for pre-existing DOM
    if (this.currentView || !view._isAttached) {
      this.empty(options);
    }

    this._setupChildView(view);

    this.currentView = view;

    renderView(view);

    this._attachView(view, options);

    this.triggerMethod('show', this, view, options);

    this._isSwappingView = false;

    return this;
  },

  _setEl(this: RegionInternals, el: RegionInstance['el']) {
    this._validateEl(el);

    if (el !== null && typeof el === 'object') {
      this.el = el;
      return;
    }

    if (!el) {
      throw new MarionetteError({
        code: 'MN0004',
        name: classErrorName,
        message: 'An "el" must be specified for a region.',
        url: 'marionette.region.html#additional-options'
      });
    }

    this.el = this.getEl(el);
  },

  // Set the `el` of the region and move any current view to the new `el`.
  _setElement(this: RegionInternals, el: RegionInstance['el']) {
    if (el === this.el) { return this; }

    const shouldReplace = this._isReplaced;

    this._restoreEl();

    this._setEl(el);

    if (this.currentView) {
      const view = this.currentView;

      if (shouldReplace) {
        this._replaceEl(view);
      } else {
        this.attachHtml(view);
      }
    }

    return this;
  },

  _setupChildView(this: RegionInternals, view: SupportedView) {
    monitorViewEvents(view);

    this._proxyChildViewEvents(view);

    // We need to listen for if a view is destroyed in a way other than through the region.
    // If this happens we need to remove the reference to the currentView since once a view
    // has been destroyed we can not reuse it.
    view.on('destroy', this._empty, this);
  },

  _proxyChildViewEvents(this: RegionInternals, view: SupportedView) {
    const parentView = this._parentView;

    if (!parentView) { return; }

    parentView._proxyChildViewEvents(view);
  },

  // If the regions parent view is not monitoring its attach/detach events
  _shouldDisableMonitoring(this: RegionInternals) {
    return this._parentView && this._parentView.monitorViewEvents === false;
  },

  _isElAttached(this: RegionInternals) {
    const documentEl = this.Dom.getDocumentEl!(this.el as Element);
    return !!documentEl && this.Dom.hasEl!(documentEl, this.el as Element);
  },

  _attachView(this: RegionInternals, view: SupportedView, { replaceElement }: ShowOptions = {}) {
    const shouldTriggerAttach = !view._isAttached && this._isElAttached() && !this._shouldDisableMonitoring();
    const shouldReplaceEl = typeof replaceElement === 'undefined' ? !!getValue(this, 'replaceElement') : !!replaceElement;

    if (shouldTriggerAttach) {
      view.triggerMethod('before:attach', view);
    }

    if (shouldReplaceEl) {
      this._replaceEl(view);
    } else {
      this.attachHtml(view);
    }

    if (shouldTriggerAttach) {
      view._isAttached = true;
      view.triggerMethod('attach', view);
    }

    // Corresponds that view is shown in a marionette Region or CollectionView
    view._isShown = true;
  },

  _ensureElement(this: RegionInternals, options: ShowOptions = {}) {
    this._setEl(this.el);

    if (!this.el) {
      const allowMissingEl = typeof options.allowMissingEl === 'undefined' ? !!getValue(this, 'allowMissingEl') : !!options.allowMissingEl;

      if (allowMissingEl) {
        return false;
      } else {
        throw new MarionetteError({
          code: 'MN0005',
          name: classErrorName,
          message: `An "el" must exist in DOM for this region ${this.cid}`,
          url: 'marionette.region.html#additional-options'
        });
      }
    }
    return true;
  },

  _getView(this: RegionInternals, view: SupportedView) {
    if (!isView(view)) {
      throw new MarionetteError({
        code: 'MN0006',
        name: classErrorName,
        message: 'The value passed to show must be a View-like instance. Construct the View before calling show.',
        url: 'marionette.region.html#showing-a-view'
      });
    }

    if (view._isDestroyed) {
      throw new MarionetteError({
        code: 'MN0007',
        name: classErrorName,
        message: `View (cid: "${view.cid}") has already been destroyed and cannot be used.`,
        url: 'marionette.region.html#showing-a-view'
      });
    }

    return view;
  },

  // Override this method to change how the region finds the DOM element that it manages. Return
  // a native DOM element resolved within a provided parent el or the document if none exists.
  getEl(this: RegionInternals, el: string) {
    const context = getValue(this, 'parentEl');

    return this.Dom.findEl!((context || document) as Element | Document, el)[0];
  },

  _replaceEl(this: RegionInternals, view: SupportedView) {
    // Always restore the el to ensure the regions el is present before replacing
    this._restoreEl();

    view.on('before:destroy', this._restoreEl, this);

    this.Dom.replaceEl!(view.el, this.el as Element);

    this._isReplaced = true;
  },

  // Restore the region's element in the DOM.
  _restoreEl(this: RegionInternals) {
    // There is nothing to replace
    if (!this._isReplaced) {
      return;
    }

    const view = this.currentView;

    if (!view) {
      return;
    }

    this._detachView(view);

    this._isReplaced = false;
  },

  // Check to see if the region's el was replaced.
  isReplaced(this: RegionInternals) {
    return !!this._isReplaced;
  },

  // Check to see if a view is being swapped by another
  isSwappingView(this: RegionInternals) {
    return !!this._isSwappingView;
  },

  // Override this method to change how the new view is appended to the element
  // the region manages.
  attachHtml(this: RegionInternals, view: SupportedView) {
    this.Dom.appendContents!(this.el as Element, view.el);
  },

  // Destroy the current view, if there is one. If there is no current view,
  // it will detach any html inside the region's `el`.
  empty(this: RegionInternals, options: ShowOptions = { allowMissingEl: true }) {
    if (!canMutateRegion(this) && !consumeDestroyTeardown(this, 'empty')) { return this; }

    return emptyRegion(this, options);
  },

  _empty(this: RegionInternals, view: SupportedView, shouldDestroy?: boolean) {
    view.off('destroy', this._empty, this);
    this.triggerMethod('before:empty', this, view);

    this._restoreEl();

    delete this.currentView;

    if (!view._isDestroyed) {
      if (shouldDestroy) {
        this.removeView(view);
      } else {
        this._detachView(view);
      }
      view._isShown = false;
      this._stopChildViewEvents(view);
    }

    this.triggerMethod('empty', this, view);
  },

  _stopChildViewEvents(this: RegionInternals, view: SupportedView) {
    const parentView = this._parentView;

    if (!parentView) { return; }

    this._parentView!.stopListening(view);
  },

  // Non-Marionette safe view.destroy
  destroyView<Child extends SupportedView>(this: RegionInternals, view: Child) {
    if (view._isDestroyed) {
      return view;
    }

    destroyView(view, this._shouldDisableMonitoring());
    return view;
  },

  // Override this method to determine what happens when the view
  // is removed from the region when the view is not being detached
  removeView(this: RegionInternals, view: SupportedView) {
    this.destroyView(view);
  },

  // Empties the Region without destroying the view
  // Returns the detached view
  detachView(this: RegionInternals) {
    if (!canMutateRegion(this)) { return; }

    const view = this.currentView;

    if (!view) {
      return;
    }

    this._empty(view);

    return view;
  },

  _detachView(this: RegionInternals, view: SupportedView) {
    const shouldTriggerDetach = view._isAttached && !this._shouldDisableMonitoring();
    const shouldRestoreEl = this._isReplaced;
    if (shouldTriggerDetach) {
      view.triggerMethod('before:detach', view);
    }

    if (shouldRestoreEl) {
      this.Dom.replaceEl!(this.el as Element, view.el);
    } else {
      this.detachHtml();
    }

    if (shouldTriggerDetach) {
      view._isAttached = false;
      view.triggerMethod('detach', view);
    }
  },

  // Override this method to change how the region detaches current content
  detachHtml(this: RegionInternals) {
    this.Dom.detachContents!(this.el as Element);
  },

  // Checks whether a view is currently present within the region. Returns `true` if there is
  // and `false` if no view is present.
  hasView(this: RegionInternals) {
    return !!this.currentView;
  },

  // Returns the View that currently owns this Region, if any.
  getOwner(this: RegionInternals) {
    return this._parentView;
  },

  // Returns this Region's name within its owner, if any.
  getName(this: RegionInternals) {
    return this._name;
  },

  // Reset the region by destroying any existing view and restoring its initial element.
  // The next time a view is shown, the region will re-query the DOM for its `el`.
  reset(this: RegionInternals, options?: ShowOptions) {
    let authorized = false;
    if (!canMutateRegion(this)) {
      authorized = consumeDestroyTeardown(this, 'reset');
      if (!authorized) { return this; }
    }

    if (authorized) {
      destroyTeardown.set(this, 'empty');
    }
    try {
      this.empty(options);
    } finally {
      if (authorized && destroyTeardown.get(this) === 'empty') {
        destroyTeardown.delete(this);
      }
    }
    this.el = this._initEl;

    delete this.$el;
    return this;
  },

  _isDestroyed: false,

  isDestroyed(this: RegionInternals) {
    return this._isDestroyed;
  },

  // Destroy the region, remove any child view
  // and remove the region from any associated view
  destroy(this: RegionInternals, options?: ShowOptions) {
    if (this._isDestroyed || this._isDestroying) { return this; }
    this._isDestroying = true;
    try {
      this.triggerMethod('before:destroy', this, options);
    } catch (error) {
      delete this._isDestroying;
      throw error;
    }
    this._isDestroyed = true;

    const currentView = this.currentView;
    let isReset: boolean | undefined;
    destroyTeardown.set(this, 'reset');
    disposeAll([
      () => this.stopListening(),
      () => this.triggerMethod('destroy', this, options),
      () => {
        destroyTeardown.delete(this);
        if (isReset || currentView && currentView !== this.currentView) {
          const parentView = this._parentView;
          const name = this._name;
          delete this._parentView;
          delete this._name;
          if (parentView && name !== undefined) {
            parentView._removeReferences!(name);
          }
        }
      },
      () => {
        this.reset(options);
        isReset = true;
      }
    ]);

    return this;
  }
});

Object.defineProperty(Region.prototype, runtimeId, { value: defaultRuntimeId });

// Common methods and the checked prototype body establish this constructor.
export default Region as unknown as RegionConstructor;
