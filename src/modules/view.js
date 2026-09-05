// View
// ----

import { assignOwn } from '../utils/assign-in.js';
import eachOwn from '../utils/each-own.js';
import MarionetteError from './error.ts';
import extend from '../utils/extend.ts';
import getValue from '../utils/get-value.ts';
import uniqueId from '../utils/unique-id.ts';
import disposeAll from '../utils/dispose-all.ts';
import monitorViewEvents from './common/monitor-view-events.js';
import buildRegion from './common/build-region.js';
import ViewMixin, { ViewOptions } from '../mixins/view.js';
import Region from './region.js';
import { setEventDelegator } from '../runtime/event-delegator.ts';
import { setRenderer } from '../runtime/renderer.ts';
import { setDomApi } from '../runtime/dom-api.ts';
import { setDataApi } from '../runtime/data-api.ts';
import { setStateApi } from '../runtime/state-api.ts';
import { runtimeId } from '../runtime/runtime-id.js';

const classErrorName = 'RegionError';

function assertRegionName(name) {
  if (typeof name === 'string' && name.length > 0) { return; }

  throw new MarionetteError({
    code: 'MN0032',
    name: classErrorName,
    message: 'A Region name must be a non-empty string.'
  });
}

function setRegion(regions, definition, name) {
  assertRegionName(name);

  Object.defineProperty(regions, name, {
    configurable: true,
    enumerable: true,
    value: definition,
    writable: true
  });
  return regions;
}

function getOwnRegion(regions, name) {
  assertRegionName(name);
  return Object.getOwnPropertyDescriptor(regions, name)?.value;
}

function getRequiredRegion(region, name) {
  if (region) { return region; }

  throw new MarionetteError({
    code: 'MN0020',
    name: classErrorName,
    message: `Region "${name}" does not exist.`
  });
}

function getRegionForChild(view, name) {
  assertRegionName(name);

  if (!view._isRendered) {
    view.render();
  }
  return getRequiredRegion(view.getRegion(name), name);
}

function throwRegionRegistrationConflict(message) {
  throw new MarionetteError({
    code: 'MN0030',
    name: classErrorName,
    message
  });
}

function isSameRegionRegistration(view, region, name) {
  return region._parentView === view && region._name === name &&
    getOwnRegion(view._regions, name) === region;
}

function assertRegionCanRegister(view, region, name) {
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

function assertRegionDefinitionsCanRegister(view, definitions) {
  const seenRegions = new Set();

  eachOwn(definitions, (definition, name) => {
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
    assertRegionCanRegister(view, definition, name);
  });
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

    eachOwn(regions, (_, name) => assertRegionName(name));

    // Normalize region selectors hash to allow
    // a user to use the @ui. syntax.
    regions = this.normalizeUIValues(regions, 'el');

    assertRegionDefinitionsCanRegister(this, regions);

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
      [runtimeId]: this[runtimeId],
      regionClass: this.regionClass,
      parentEl: () => getValue(this, 'el')
    };

    const regions = {};
    try {
      eachOwn(regionDefinitions, (definition, name) => {
        const region = buildRegion(definition, defaults);
        this._addRegion(region, name);
        setRegion(regions, region, name);
      });
    } catch (error) {
      eachOwn(regionDefinitions, (definition, name) => {
        if (!getOwnRegion(this._regions, name)) {
          delete this.regions[name];
        }
      });
      throw error;
    }
    return regions;
  },

  _addRegion(region, name) {
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
  removeRegion(name) {
    const region = getRequiredRegion(getOwnRegion(this._regions, name), name);

    this._removeRegion(region, name);

    return region;
  },

  // Remove all regions from the View
  removeRegions() {
    const regions = this._getRegions();
    const cleanups = [];

    eachOwn(regions, (region, name) => {
      cleanups.push(() => this._removeRegion(region, name));
    });
    disposeAll(cleanups.reverse());

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
    if (!this._isRendered) {
      this.render();
    }
    const regions = this.getRegions();
    eachOwn(regions, region => region.empty());
    return regions;
  },

  // Checks to see if view contains region
  // Accepts the region name
  // hasRegion('main')
  hasRegion(name) {
    return !!getOwnRegion(this._regions, name);
  },

  // Provides access to regions
  // Accepts the region name
  // getRegion('main')
  getRegion(name) {
    return getOwnRegion(this._regions, name);
  },

  _getRegions() {
    const regions = {};
    eachOwn(this._regions, (region, name) => setRegion(regions, region, name));
    return regions;
  },

  // Get all regions
  getRegions() {
    return this._getRegions();
  },

  showChildView(name, view, options) {
    const region = getRegionForChild(this, name);
    region.show(view, options);
    return view;
  },

  detachChildView(name) {
    return getRegionForChild(this, name).detachView();
  },

  getChildView(name) {
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
  this.mergeOptions(options, ViewOptions);

  this._initViewEvents();

  try {
    this.setElement(this._getEl());

    monitorViewEvents(this);

    this._initState(options);

    this._initBehaviors();
    this._initRegions();
    this._buildEventProxies();

    this.initialize.apply(this, arguments);

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

    this._isRendered = this.Dom.hasContents(this.el);
    this._isAttached = this._isElAttached();

    if (this._isRendered) {
      this.bindUIElements();
    }

    this.delegateEvents();

    return this;
  },

  // If a template is available, renders it into the view's `el`
  // Re-inits regions and binds UI.
  render() {
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
  _removeChildren() {
    this.removeRegions();
  },

  _getImmediateChildren() {
    const children = [];
    eachOwn(this._regions, region => childReducer(children, region));
    return children;
  }
});

export default View;
