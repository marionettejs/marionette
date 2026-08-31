// ViewMixin
//  ---------

import { assignOwn } from '../utils/assign-in.js';
import MarionetteError from '../utils/error.js';
import getValue from '../utils/get-value.js';
import isString from '../utils/is-string.js';
import BehaviorsMixin from './behaviors.js';
import CommonMixin from './common.js';
import DelegateEntityEventsMixin from './delegate-entity-events.js';
import TemplateRenderMixin from './template-render.js';
import UIMixin from './ui.js';
import ViewEvents from './view-events.js';
import { isEnabled } from '../runtime/features.js';
import DomApi from '../runtime/dom-api.js';

const classErrorName = 'ViewError';

function isJQueryCollection(el) {
  return el != null && typeof el === 'object' &&
    typeof el.jquery === 'string' && typeof el.get === 'function';
}

export const ViewOptions = [
  'attributes',
  'className',
  'collection',
  'el',
  'events',
  'id',
  'model',
  'tagName'
];

// MixinOptions
// - attributes
// - behaviors
// - childViewEventPrefix
// - childViewEvents
// - childViewTriggers
// - className
// - collection
// - collectionEvents
// - el
// - events
// - id
// - model
// - modelEvents
// - tagName
// - triggers
// - ui


const ViewMixin = {
  tagName: 'div',

  // This is a noop method intended to be overridden
  preinitialize() {},

  Dom: DomApi,

  _validateEl(el) {
    const stringEl = isString(el);
    if (!stringEl && !isJQueryCollection(el)) { return el; }

    const migration = stringEl ?
      `Resolve selector strings at the call site, e.g. \`document.querySelector('${el}')\`.` :
      'Unwrap jQuery collections at the call site, e.g. `wrappedEl[0]`.';

    throw new MarionetteError({
      code: 'MN0001',
      name: classErrorName,
      message: `View "el" must be a DOM element. ${migration} (Region still accepts selector strings.)`,
      url: 'marionette.view.html#specifying-an-el'
    });
  },

  // Create an element from the `id`, `className` and `tagName` properties.
  _getEl() {
    const elOption = getValue(this, 'el');

    if (!elOption) {
      const el = this.Dom.createElement(getValue(this, 'tagName'));
      const attrs = assignOwn({}, getValue(this, 'attributes'));
      if (this.id) {attrs.id = getValue(this, 'id');}
      if (this.className) {attrs.class = getValue(this, 'className');}
      this.Dom.setAttributes(el, attrs);
      return el;
    }

    return elOption;
  },

  $(selector) {
    return this.Dom.findEl(this.el, selector)
  },

  _isElAttached() {
    return !!this.el && this.Dom.hasEl(this.Dom.getDocumentEl(this.el), this.el);
  },

  supportsRenderLifecycle: true,
  supportsDestroyLifecycle: true,

  _isDestroyed: false,

  isDestroyed() {
    return !!this._isDestroyed;
  },

  _isRendered: false,

  isRendered() {
    return !!this._isRendered;
  },

  _isAttached: false,

  isAttached() {
    return !!this._isAttached;
  },

  delegateEvents(events) {
    if (this._isDestroying || this._isDestroyed) { return this; }

    this.undelegateEvents();
    this._buildEventProxies();
    this._delegateViewEvents(this, events);
    this._setBehaviorElements();

    return this;
  },

  undelegateEvents() {
    if (this._isDestroyed || this._isDestroying) { return this; }

    this._undelegateViewEvents();
    this._undelegateBehaviorViewEvents();

    return this;
  },

  // Handle `modelEvents`, and `collectionEvents` configuration
  delegateEntityEvents() {
    if (this._isDestroyed || this._isDestroying) { return this; }

    this._delegateEntityEvents(this.model, this.collection);

    // bind each behaviors model and collection events
    this._delegateBehaviorEntityEvents();

    return this;
  },

  // Handle unbinding `modelEvents`, and `collectionEvents` configuration
  undelegateEntityEvents() {
    this._undelegateEntityEvents(this.model, this.collection);

    // unbind each behaviors model and collection events
    this._undelegateBehaviorEntityEvents();

    return this;
  },

  // Handle destroying the view and its children.
  destroy(options) {
    if (this._isDestroyed || this._isDestroying) { return this; }
    this._isDestroying = true;
    const shouldTriggerDetach = this._isAttached && !this._disableDetachEvents;

    try {
      this.triggerMethod('before:destroy', this, options);
    } catch (error) {
      delete this._isDestroying;
      throw error;
    }
    if (shouldTriggerDetach) {
      this.triggerMethod('before:detach', this);
    }

    // unbind UI elements
    this.unbindUIElements();
    this._undelegateViewEvents();

    // remove the view from the DOM
    this.Dom.detachEl(this.el);

    if (shouldTriggerDetach) {
      this._isAttached = false;
      this.triggerMethod('detach', this);
    }

    // remove children after the remove to prevent extra paints
    this._removeChildren();

    this._isDestroyed = true;
    this._isRendered = false;

    // Destroy behaviors after _isDestroyed flag
    this._destroyBehaviors(options);

    this._deleteEntityEventHandlers();

    this.triggerMethod('destroy', this, options);
    this._triggerEventOnBehaviors('destroy', this, options);

    this.stopListening();

    return this;
  },

  // This method binds the elements specified in the "ui" hash
  bindUIElements() {
    if (this._isDestroyed || this._isDestroying) { return this; }

    this._bindUIElements();
    this._bindBehaviorUIElements();

    return this;
  },

  // This method unbinds the elements specified in the "ui" hash
  unbindUIElements() {
    this._unbindUIElements();
    this._unbindBehaviorUIElements();

    return this;
  },

  getUI(name) {
    return this._getUI(name);
  },

  // Cache `childViewEvents` and `childViewTriggers`
  _buildEventProxies() {
    this._childViewEvents = this.normalizeMethods(getValue(this, 'childViewEvents'));
    this._childViewTriggers = getValue(this, 'childViewTriggers');
    this._eventPrefix = this._getEventPrefix();
  },

  _getEventPrefix() {
    const defaultPrefix = isEnabled('childViewEventPrefix') ? 'childview' : false;
    const prefix = getValue(this, 'childViewEventPrefix', defaultPrefix);

    return (prefix === false) ? prefix : prefix + ':';
  },

  _proxyChildViewEvents(view) {
    if (this._childViewEvents || this._childViewTriggers || this._eventPrefix) {
      this.listenTo(view, 'all', this._childViewEventHandler);
    }
  },

  _childViewEventHandler(eventName, ...args) {
    const childViewEvents = this._childViewEvents;

    // call collectionView childViewEvent if defined
    if (childViewEvents && childViewEvents[eventName]) {
      childViewEvents[eventName].apply(this, args);
    }

    // use the parent view's proxyEvent handlers
    const childViewTriggers = this._childViewTriggers;

    // Call the event with the proxy name on the parent layout
    if (childViewTriggers && childViewTriggers[eventName]) {
      this.triggerMethod(childViewTriggers[eventName], ...args);
    }

    if (this._eventPrefix) {
      this.triggerMethod(this._eventPrefix + eventName, ...args);
    }
  }
};

assignOwn(ViewMixin, BehaviorsMixin, CommonMixin, DelegateEntityEventsMixin, TemplateRenderMixin, UIMixin, ViewEvents);

export default ViewMixin;
