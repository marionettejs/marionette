// Behavior
// --------

// A Behavior is an isolated set of DOM /
// user interactions that can be mixed into any View.
// Behaviors allow you to blackbox View specific interactions
// into portable logical chunks, keeping your views simple and your code DRY.

import { extend as _extend, uniqueId, result } from 'underscore';
import extend from '../utils/extend';
import CommonMixin from '../mixins/common';
import DelegateEntityEventsMixin from '../mixins/delegate-entity-events';
import UIMixin from '../mixins/ui';
import ViewEventsMixin from '../mixins/view-events';

const ClassOptions = [
  'collectionEvents',
  'events',
  'modelEvents',
  'triggers',
  'ui'
];

const Behavior = function(options, view) {
  // Setup reference to the view.
  // this comes in handle when a behavior
  // wants to directly talk up the chain
  // to the view.
  this.view = view;


  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);

  this._initViewEvents();
  this.setElement();

  // Construct an internal UI hash using the behaviors UI
  // hash combined and overridden by the view UI hash.
  // This allows the user to use UI hash elements defined
  // in the parent view as well as those defined in the behavior.
  // This order will help the reuse and share of a behavior
  // between multiple views, while letting a view override
  // a selector under an UI key.
  this.ui = _extend({}, result(this, 'ui'), result(view, 'ui'));

  // Proxy view triggers
  this.listenTo(view, 'all', this.triggerMethod);

  this.initialize.apply(this, arguments);
};

Behavior.extend = extend;

// Behavior Methods
// --------------

_extend(Behavior.prototype, CommonMixin, DelegateEntityEventsMixin, UIMixin, ViewEventsMixin, {
  cidPrefix: 'mnb',

  // proxy behavior $ method to the view
  // this is useful for doing jquery DOM lookups
  // scoped to behaviors view.
  $() {
    return this.view.$.apply(this.view, arguments);
  },

  // Stops the behavior from listening to events.
  destroy() {
    this._undelegateViewEvents();

    this.stopListening();

    this.view._removeBehavior(this);

    this._deleteEntityEventHandlers();

    return this;
  },

  setElement() {
    this._undelegateViewEvents();

    this.el = this.view.el;

    this._delegateViewEvents(this.view);

    return this;
  },

  bindUIElements() {
    this._bindUIElements();

    return this;
  },

  unbindUIElements() {
    this._unbindUIElements();

    return this;
  },

  getUI(name) {
    return this._getUI(name);
  },

  // Handle `modelEvents`, and `collectionEvents` configuration
  delegateEntityEvents() {
    this._delegateEntityEvents(this.view.model, this.view.collection);

    return this;
  },

  undelegateEntityEvents() {
    this._undelegateEntityEvents(this.view.model, this.view.collection);

    return this;
  }
});

export default Behavior;
