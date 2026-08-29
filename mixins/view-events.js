import { isEnabled } from '../config/features.js';
import EventDelegator from '../config/event-delegator.js';
import { resolveMethod } from '../modules/common/normalize-methods.js';
import getValue from '../utils/get-value.js';
import isString from '../utils/is-string.js';

const delegateEventSplitter = /^(\S+)\s*(.*)$/;

function eachOwn(object, iteratee) {
  if (object == null) { return; }

  const keys = Object.keys(object);
  for (const key of keys) {
    iteratee(object[key], key);
  }
}

// Internal method to create an event handler for a given `triggerDef` like
// 'click:foo'
function buildViewTrigger(view, triggerDef) {
  if (isString(triggerDef)) {
    triggerDef = {event: triggerDef};
  }

  const eventName = triggerDef.event;

  let shouldPreventDefault = !!triggerDef.preventDefault;

  if (isEnabled('triggersPreventDefault')) {
    shouldPreventDefault = triggerDef.preventDefault !== false;
  }

  let shouldStopPropagation = !!triggerDef.stopPropagation;

  if (isEnabled('triggersStopPropagation')) {
    shouldStopPropagation = triggerDef.stopPropagation !== false;
  }

  return function(event, ...args) {
    if (shouldPreventDefault) {
      event.preventDefault();
    }

    if (shouldStopPropagation) {
      event.stopPropagation();
    }

    view.triggerMethod(eventName, view, event, ...args);
  };
}

export default {

  EventDelegator,

  _initViewEvents() {
    this._domEvents = [];
  },

  _undelegateViewEvents() {
    this.EventDelegator.undelegateAll({
      events: this._domEvents,
      rootEl: this.el
    });
  },

  _delegateViewEvents(view = this) {
    if (!this.events && !this.triggers) { return; }

    const uiBindings = this._getUIBindings();
    const delegates = [];
    this._delegateEvents(delegates, uiBindings);
    this._delegateTriggers(delegates, uiBindings, view);
    for (let index = 0; index < delegates.length; index += 2) {
      this._delegate(delegates[index], delegates[index + 1]);
    }
  },

  _delegateEvents(delegates, uiBindings) {
    if (!this.events) { return; }

    eachOwn(getValue(this, 'events'), (handler, key) => {
      handler = resolveMethod(this, handler, key);
      delegates.push(handler.bind(this), this.normalizeUIString(key, uiBindings));
    });
  },

  _delegateTriggers(delegates, uiBindings, view) {
    if (!this.triggers) { return; }

    eachOwn(getValue(this, 'triggers'), (value, key) => {
      delegates.push(buildViewTrigger(view, value), this.normalizeUIString(key, uiBindings));
    });
  },

  _delegate(handler, key) {
    const match = key.match(delegateEventSplitter);
    this.EventDelegator.delegate({
      eventName: match[1],
      selector: match[2],
      handler,
      events: this._domEvents,
      rootEl: this.el
    });
  }
};
