import { isString, isFunction, result, each } from 'underscore';
import { isEnabled } from '../config/features';
import EventDelegator from '../config/event-delegator';

const delegateEventSplitter = /^(\S+)\s*(.*)$/;

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
    const uiBindings = this._getUIBindings();
    this._delegateEvents(uiBindings);
    this._delegateTriggers(uiBindings, view);
  },

  _delegateEvents(uiBindings) {
    if (!this.events) { return; }

    each(result(this, 'events'), (handler, key) => {
      if (!isFunction(handler)) {
        handler = this[handler];
      }
      if (!handler) { return; }
      this._delegate(handler.bind(this), this.normalizeUIString(key, uiBindings));
    });
  },

  _delegateTriggers(uiBindings, view) {
    if (!this.triggers) { return; }

    each(result(this, 'triggers'), (value, key) => {
      this._delegate(buildViewTrigger(view, value), this.normalizeUIString(key, uiBindings));
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
