// Region
// ------

import { assignOwn } from '../utils/assign-in.js';
import eachOwn from '../utils/each-own.js';
import MarionetteError from '../utils/error.js';
import extend from '../utils/extend.js';
import getValue from '../utils/get-value.js';
import isString from '../utils/is-string.js';
import uniqueId from '../utils/unique-id.js';
import monitorViewEvents from './common/monitor-view-events.js';
import { renderView, destroyView, isView } from './common/view.js';
import CommonMixin from '../mixins/common.js';
import ViewMixin from '../mixins/view.js';
import DomApi, { setDomApi } from '../runtime/dom-api.js';
import { setEventDelegator } from '../runtime/event-delegator.js';
import { setRenderer } from '../runtime/renderer.js';

const classErrorName = 'RegionError';

function setRegion(regions, definition, name) {
  Object.defineProperty(regions, name, {
    configurable: true,
    enumerable: true,
    value: definition,
    writable: true
  });
  return regions;
}

function getOwnRegion(regions, name) {
  try {
    return Object.getOwnPropertyDescriptor(regions, name)?.value;
  } catch {
    // Required operations report MN0020; optional lookups return undefined.
  }
}

function getRequiredRegion(region, name) {
  if (region) { return region; }

  const type = typeof name;
  const label = name === null || type !== 'object' && type !== 'function' ?
    ` "${String(name)}"` : '';

  throw new MarionetteError({
    code: 'MN0020',
    name: classErrorName,
    message: `Region${label} does not exist.`
  });
}

const RegionClassOptions = [
  'allowMissingEl',
  'parentEl',
  'replaceElement'
];

const Region = function(options) {
  this._setOptions(options, RegionClassOptions);

  this.cid = uniqueId(this.cidPrefix);

  // getOption necessary because options.el may be passed as undefined
  this._initEl = this.el = this.getOption('el');
  this._validateEl(this.el);

  this.initialize.apply(this, arguments);
};

Region.extend = extend;
Region.setDomApi = setDomApi;

// Region Methods
// --------------

assignOwn(Region.prototype, CommonMixin, {
  Dom: DomApi,

  cidPrefix: 'mnr',
  replaceElement: false,
  _isReplaced: false,
  _isSwappingView: false,

  _validateEl(el) {
    if (!el || isString(el) || el.nodeType === 1) { return; }

    throw new MarionetteError({
      code: 'MN0002',
      name: classErrorName,
      message: 'Region "el" must be a selector string or DOM element.',
      url: 'marionette.region.html#additional-options'
    });
  },

  // Displays a view instance inside of the region. If necessary handles calling the `render`
  // method for you. Reads content directly from the `el` attribute.
  show(view, options) {
    if (this._isDestroyed) {
      throw new MarionetteError({
        code: 'MN0028',
        name: classErrorName,
        message: 'A destroyed Region cannot show a View.',
      });
    }

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

  _setEl(el) {
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
  _setElement(el) {
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

  _setupChildView(view) {
    monitorViewEvents(view);

    this._proxyChildViewEvents(view);

    // We need to listen for if a view is destroyed in a way other than through the region.
    // If this happens we need to remove the reference to the currentView since once a view
    // has been destroyed we can not reuse it.
    view.on('destroy', this._empty, this);
  },

  _proxyChildViewEvents(view) {
    const parentView = this._parentView;

    if (!parentView) { return; }

    parentView._proxyChildViewEvents(view);
  },

  // If the regions parent view is not monitoring its attach/detach events
  _shouldDisableMonitoring() {
    return this._parentView && this._parentView.monitorViewEvents === false;
  },

  _isElAttached() {
    return this.Dom.hasEl(this.Dom.getDocumentEl(this.el), this.el);
  },

  _attachView(view, { replaceElement } = {}) {
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

  _ensureElement(options = {}) {
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

  _getView(view) {
    if (!view) {
      throw new MarionetteError({
        code: 'MN0006',
        name: classErrorName,
        message: 'The view passed is undefined and therefore invalid. You must pass a view instance to show.',
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

    if (isView(view)) {
      return view;
    }

    const viewOptions = this._getViewOptions(view);

    return new View(viewOptions);
  },

  // This allows for a template or a static string to be
  // used as a template
  _getViewOptions(viewOptions) {
    if (typeof viewOptions === 'function') {
      return { template: viewOptions };
    }

    if (viewOptions !== null && typeof viewOptions === 'object') {
      return viewOptions;
    }

    const template = function() { return viewOptions; };

    return { template };
  },

  // Override this method to change how the region finds the DOM element that it manages. Return
  // a jQuery selector object scoped to a provided parent el or the document if none exists.
  getEl(el) {
    const context = getValue(this, 'parentEl');

    return this.Dom.findEl(context || document, el)[0];
  },

  _replaceEl(view) {
    // Always restore the el to ensure the regions el is present before replacing
    this._restoreEl();

    view.on('before:destroy', this._restoreEl, this);

    this.Dom.replaceEl(view.el, this.el);

    this._isReplaced = true;
  },

  // Restore the region's element in the DOM.
  _restoreEl() {
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
  isReplaced() {
    return !!this._isReplaced;
  },

  // Check to see if a view is being swapped by another
  isSwappingView() {
    return !!this._isSwappingView;
  },

  // Override this method to change how the new view is appended to the `$el` that the
  // region is managing
  attachHtml(view) {
    this.Dom.appendContents(this.el, view.el);
  },

  // Destroy the current view, if there is one. If there is no current view,
  // it will detach any html inside the region's `el`.
  empty(options = { allowMissingEl: true }) {
    const view = this.currentView;

    // If there is no view in the region we should only detach current html
    if (!view) {
      if (this._ensureElement(options)) {
        this.detachHtml();
      }
      return this;
    }

    this._empty(view, true);
    return this;
  },

  _empty(view, shouldDestroy) {
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

  _stopChildViewEvents(view) {
    const parentView = this._parentView;

    if (!parentView) { return; }

    this._parentView.stopListening(view);
  },

  // Non-Marionette safe view.destroy
  destroyView(view) {
    if (view._isDestroyed) {
      return view;
    }

    destroyView(view, this._shouldDisableMonitoring());
    return view;
  },

  // Override this method to determine what happens when the view
  // is removed from the region when the view is not being detached
  removeView(view) {
    this.destroyView(view);
  },

  // Empties the Region without destroying the view
  // Returns the detached view
  detachView() {
    const view = this.currentView;

    if (!view) {
      return;
    }

    this._empty(view);

    return view;
  },

  _detachView(view) {
    const shouldTriggerDetach = view._isAttached && !this._shouldDisableMonitoring();
    const shouldRestoreEl = this._isReplaced;
    if (shouldTriggerDetach) {
      view.triggerMethod('before:detach', view);
    }

    if (shouldRestoreEl) {
      this.Dom.replaceEl(this.el, view.el);
    } else {
      this.detachHtml();
    }

    if (shouldTriggerDetach) {
      view._isAttached = false;
      view.triggerMethod('detach', view);
    }
  },

  // Override this method to change how the region detaches current content
  detachHtml() {
    this.Dom.detachContents(this.el);
  },

  // Checks whether a view is currently present within the region. Returns `true` if there is
  // and `false` if no view is present.
  hasView() {
    return !!this.currentView;
  },

  // Reset the region by destroying any existing view and clearing out the cached `$el`.
  // The next time a view is shown via this region, the region will re-query the DOM for
  // the region's `el`.
  reset(options) {
    this.empty(options);

    this.el = this._initEl;

    delete this.$el;
    return this;
  },

  _isDestroyed: false,

  isDestroyed() {
    return this._isDestroyed;
  },

  // Destroy the region, remove any child view
  // and remove the region from any associated view
  destroy(options) {
    if (this._isDestroyed || this._isDestroying) { return this; }
    this._isDestroying = true;
    try {
      this.triggerMethod('before:destroy', this, options);
    } catch (error) {
      delete this._isDestroying;
      throw error;
    }
    this._isDestroyed = true;

    // reset remains valid here because it completes this destruction lifecycle.
    this.reset(options);

    if (this._name) {
      this._parentView._removeReferences(this._name);
    }
    delete this._parentView;
    delete this._name;

    this.triggerMethod('destroy', this, options);
    this.stopListening();

    return this;
  }
});

// return the region instance from the definition
function buildRegion(definition, defaults) {
  if (definition instanceof Region) {
    return definition;
  }

  if (isString(definition)) {
    return buildRegionFromObject(defaults, { el: definition });
  }

  if (typeof definition === 'function') {
    return buildRegionFromObject(defaults, { regionClass: definition });
  }

  if (definition !== null && typeof definition === 'object') {
    return buildRegionFromObject(defaults, definition);
  }

  throw new MarionetteError({
    code: 'MN0008',
    message: 'Improper region configuration type.',
    url: 'marionette.region.html#defining-regions'
  });
}

function buildRegionFromObject(defaults, definition) {
  const options = assignOwn({}, defaults, definition);

  const RegionClass = options.regionClass

  delete options.regionClass;

  return new RegionClass(options);
}

// MixinOptions
// - regions
// - regionClass

const RegionsMixin = {
  regionClass: Region,

  // Internal method to initialize the regions that have been defined in a
  // `regions` attribute on this View.
  _initRegions() {

    // init regions hash
    this.regions = this.regions || {};
    this._regions = Object.create(null);

    this.addRegions(getValue(this, 'regions'));
  },

  // Internal method to re-initialize all of the regions by updating
  // the `el` that they point to
  _reInitRegions() {
    eachOwn(this._regions, region => region.reset());
  },

  // Add a single region, by name, to the View
  addRegion(name, definition) {
    const regions = setRegion({}, definition, name);
    return this.addRegions(regions)[name];
  },

  // Add multiple regions as a {name: definition, name2: def2} object literal
  addRegions(regions) {
    // If there's nothing to add, stop here.
    if (regions == null || Object.keys(regions).length === 0) {
      return;
    }

    // Normalize region selectors hash to allow
    // a user to use the @ui. syntax.
    regions = this.normalizeUIValues(regions, 'el');

    // Add the regions definitions to the regions property
    const allRegions = {};
    eachOwn(this.regions, (definition, name) => setRegion(allRegions, definition, name));
    eachOwn(regions, (definition, name) => setRegion(allRegions, definition, name));
    this.regions = allRegions;

    return this._addRegions(regions);
  },

  // internal method to build and add regions
  _addRegions(regionDefinitions) {
    const defaults = {
      regionClass: this.regionClass,
      parentEl: () => getValue(this, 'el')
    };

    const regions = {};
    eachOwn(regionDefinitions, (definition, name) => {
      const region = buildRegion(definition, defaults);
      setRegion(regions, region, name);
      this._addRegion(region, name);
    });
    return regions;
  },

  _addRegion(region, name) {
    this.triggerMethod('before:add:region', this, name, region);

    region._parentView = this;
    region._name = name;

    this._regions[name] = region;

    this.triggerMethod('add:region', this, name, region);
  },

  // Remove a single region from the View, by name
  removeRegion(name) {
    const region = getRequiredRegion(getOwnRegion(this._regions, name), name);

    this._removeRegion(region, name);

    return region;
  },

  // Remove all regions from the View
  removeRegions() {
    const regions = this._getRegions();

    eachOwn(this._regions, (region, name) => this._removeRegion(region, name));

    return regions;
  },

  _removeRegion(region, name) {
    this.triggerMethod('before:remove:region', this, name, region);

    region.destroy();

    this.triggerMethod('remove:region', this, name, region);
  },

  // Called in a region's destroy
  _removeReferences(name) {
    delete this.regions[name];
    delete this._regions[name];
  },

  // Empty all regions in the region manager, but
  // leave them attached
  emptyRegions() {
    const regions = this.getRegions();
    eachOwn(regions, region => region.empty());
    return regions;
  },

  // Checks to see if view contains region
  // Accepts the region name
  // hasRegion('main')
  hasRegion(name) {
    return !!this.getRegion(name);
  },

  // Provides access to regions
  // Accepts the region name
  // getRegion('main')
  getRegion(name) {
    if (!this._isRendered) {
      this.render();
    }
    return getOwnRegion(this._regions, name);
  },

  _getRegions() {
    const regions = {};
    eachOwn(this._regions, (region, name) => setRegion(regions, region, name));
    return regions;
  },

  // Get all regions
  getRegions() {
    if (!this._isRendered) {
      this.render();
    }
    return this._getRegions();
  },

  showChildView(name, view, options) {
    const region = getRequiredRegion(this.getRegion(name), name);
    region.show(view, options);
    return view;
  },

  detachChildView(name) {
    return getRequiredRegion(this.getRegion(name), name).detachView();
  },

  getChildView(name) {
    return getRequiredRegion(this.getRegion(name), name).currentView;
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
  'tagName',
  'template',
  'templateContext',
  'triggers',
  'ui'
];

// Used by _getImmediateChildren
function childReducer(children, region) {
  if (region.currentView) {
    children.push(region.currentView);
  }

  return children;
}

// The standard view. Includes view events, automatic rendering
// templates, nested views, and more.
const View = function(options) {
  this.cid = uniqueId(this.cidPrefix);
  this._setOptions(options, ViewClassOptions);

  this.preinitialize.apply(this, arguments);

  this._initViewEvents();
  this.setElement(this._getEl());

  monitorViewEvents(this);

  this._initBehaviors();
  this._initRegions();
  this._buildEventProxies();

  this.initialize.apply(this, arguments);

  this.delegateEntityEvents();

  this._triggerEventOnBehaviors('initialize', this, options);
};

assignOwn(View, { extend, setRenderer, setDomApi, setEventDelegator });

assignOwn(View.prototype, ViewMixin, RegionsMixin, {
  cidPrefix: 'mnv',

  setElement(element) {
    this._undelegateViewEvents();
    this.el = this._validateEl(element);
    this._setBehaviorElements();

    this._isRendered = this.Dom.hasContents(this.el);
    this._isAttached = this._isElAttached();

    if (this._isRendered) {
      this.bindUIElements();
    }

    this._delegateViewEvents();

    return this;
  },

  // If a template is available, renders it into the view's `el`
  // Re-inits regions and binds UI.
  render() {
    const template = this.getTemplate();

    if (template === false || this._isDestroyed) { return this; }

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
  _removeChildren() {
    this.removeRegions();
  },

  _getImmediateChildren() {
    const children = [];
    eachOwn(this._regions, region => childReducer(children, region));
    return children;
  }
});

export { buildRegion, Region, View };
