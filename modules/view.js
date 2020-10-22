// View
// ---------

import { extend as _extend, uniqueId, reduce } from 'underscore';
import extend from '../utils/extend';
import monitorViewEvents from './common/monitor-view-events';
import ViewMixin from '../mixins/view';
import RegionsMixin from '../mixins/regions';
import { setDomApi } from '../config/dom';
import { setEventDelegator } from '../config/event-delegator';
import { setRenderer } from '../config/renderer';

const ClassOptions = [
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
  this._setOptions(options, ClassOptions);

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

_extend(View, { extend, setRenderer, setDomApi, setEventDelegator });

_extend(View.prototype, ViewMixin, RegionsMixin, {
  cidPrefix: 'mnv',

  setElement(element) {
    this._undelegateViewEvents();
    this.el = element;
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
    return reduce(this._regions, childReducer, []);
  }
});

export default View;
