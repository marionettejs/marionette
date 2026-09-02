// Behavior
// --------

// A Behavior is an isolated set of DOM /
// user interactions that can be mixed into any View.
// Behaviors allow you to blackbox View specific interactions
// into portable logical chunks, keeping your views simple and your code DRY.

import { assignOwn } from '../utils/assign-in.js';
import extend from '../utils/extend.js';
import getValue from '../utils/get-value.js';
import uniqueId from '../utils/unique-id.js';
import CommonMixin from '../mixins/common.js';
import DelegateEntityEventsMixin from '../mixins/delegate-entity-events.js';
import StateMixin from '../mixins/state.js';
import UIMixin from '../mixins/ui.js';
import ViewEventsMixin from '../mixins/view-events.js';
import { setEventDelegator } from '../runtime/event-delegator.js';

const ClassOptions = [
  'collectionEvents',
  'events',
  'modelEvents',
  'stateEvents',
  'triggers',
  'ui'
];

const Behavior = function(options, view) {
  // Setup reference to the view.
  // this comes in handy when a behavior
  // wants to directly talk up the chain
  // to the view.
  this.view = view;

  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);

  this._initViewEvents();
  this.el = view.el;
  if (view.$el) {
    this.$el = view.$el;
  }
  this._initState(options);

  try {
    // Construct an internal UI hash using the behaviors UI
    // hash combined and overridden by the view UI hash.
    // This allows the user to use UI hash elements defined
    // in the parent view as well as those defined in the behavior.
    // This order will help the reuse and share of a behavior
    // between multiple views, while letting a view override
    // a selector under an UI key.
    this.ui = assignOwn({}, getValue(this, 'ui'), getValue(view, 'ui'));

    // Proxy view triggers
    this.listenTo(view, 'all', this.triggerMethod);

    this.initialize.apply(this, arguments);

    this._initStateEvents();
    this._syncElement();
  } catch (error) {
    this._destroyState();
    throw error;
  }
};

assignOwn(Behavior, { extend, setEventDelegator });

// Behavior Methods
// --------------

assignOwn(Behavior.prototype, CommonMixin, DelegateEntityEventsMixin, StateMixin, UIMixin, ViewEventsMixin, {
  cidPrefix: 'mnb',

  // proxy behavior $ method to the view
  // this performs a configured DOM lookup scoped to the behavior's view.
  $() {
    return this.view.$.apply(this.view, arguments);
  },

  // Stops the behavior from listening to events.
  destroy() {
    this._isDestroyed = true;
    this._undelegateViewEvents();
    this._destroyState();

    this.stopListening();

    this.view._removeBehavior(this);

    this._deleteEntityEventHandlers();

    return this;
  },

  _syncElement() {
    this._undelegateViewEvents();

    this.el = this.view.el;
    if (this.view.$el) {
      this.$el = this.view.$el;
    } else {
      delete this.$el;
    }

    this._delegateViewEvents(this.view);

    return this;
  },

  bindUIElements() {
    if (this.view._isDestroying || this.view._isDestroyed) { return this; }

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
    if (this.view._isDestroying || this.view._isDestroyed) { return this; }

    this._delegateEntityEvents(this.view.model, this.view.collection, this.view.Data);

    return this;
  },

  undelegateEntityEvents() {
    this._undelegateEntityEvents(this.view.model, this.view.collection);

    return this;
  }
});

export default Behavior;
