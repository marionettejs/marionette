// ViewMixin
//  ---------

import { extend, result } from 'underscore';
import BehaviorsMixin from './behaviors';
import CommonMixin from './common';
import DelegateEntityEventsMixin from './delegate-entity-events';
import TemplateRenderMixin from './template-render';
import UIMixin from './ui';
import ViewEvents from './view-events';
import { isEnabled } from '../config/features';
import DomApi from '../config/dom';


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

  // Create an element from the `id`, `className` and `tagName` properties.
  _getEl() {
    if (!this.el) {
      const el = this.Dom.createElement(result(this, 'tagName'));
      const attrs = extend({}, result(this, 'attributes'));
      if (this.id) {attrs.id = result(this, 'id');}
      if (this.className) {attrs.class = result(this, 'className');}
      this.Dom.setAttributes(el, attrs);
      return el;
    }

    return result(this, 'el');
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

  // Handle `modelEvents`, and `collectionEvents` configuration
  delegateEntityEvents() {
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

    this.triggerMethod('before:destroy', this, options);
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
    this._childViewEvents = this.normalizeMethods(result(this, 'childViewEvents'));
    this._childViewTriggers = result(this, 'childViewTriggers');
    this._eventPrefix = this._getEventPrefix();
  },

  _getEventPrefix() {
    const defaultPrefix = isEnabled('childViewEventPrefix') ? 'childview' : false;
    const prefix = result(this, 'childViewEventPrefix', defaultPrefix);

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

extend(ViewMixin, BehaviorsMixin, CommonMixin, DelegateEntityEventsMixin, TemplateRenderMixin, UIMixin, ViewEvents);

export default ViewMixin;
