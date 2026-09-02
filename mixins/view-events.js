import EventDelegator from '../runtime/event-delegator.js';
import MarionetteError from '../utils/error.js';
import { resolveMethod } from '../modules/common/normalize-methods.js';
import eachOwn from '../utils/each-own.js';
import getValue from '../utils/get-value.js';
import isString from '../utils/is-string.js';

const delegateEventSplitter = /^(\S+)\s*(.*)$/;

// Internal method to create an event handler for a given `triggerDef` like
// 'click:foo'
function buildViewTrigger(view, triggerDef) {
  if (isString(triggerDef)) {
    triggerDef = { event: triggerDef };
  }

  const eventName = triggerDef.event;

  const shouldPreventDefault = triggerDef.preventDefault !== false;
  const shouldStopPropagation = triggerDef.stopPropagation !== false;

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
    let firstError;
    const cleanups = this._domEvents.splice(0);

    for (let index = cleanups.length - 1; index >= 0; index--) {
      try {
        cleanups[index]();
      } catch (error) {
        firstError ||= error;
      }
    }

    if (firstError) { throw firstError; }
  },

  _rollbackViewEvents() {
    try {
      this._undelegateViewEvents();
    } catch {
      // Preserve the construction or registration error after all cleanups run.
    }
  },

  _delegateViewEvents(view = this, events) {
    if (!events && !this.events && !this.triggers) { return; }

    const uiBindings = this._getUIBindings();
    const delegates = [];
    this._delegateEvents(delegates, uiBindings, events);
    this._delegateTriggers(delegates, uiBindings, view);
    try {
      for (let index = 0; index < delegates.length; index += 2) {
        this._delegate(delegates[index], delegates[index + 1]);
      }
    } catch (error) {
      this._rollbackViewEvents();
      throw error;
    }
  },

  _delegateEvents(delegates, uiBindings, events) {
    const eventMap = events || getValue(this, 'events');
    if (!eventMap) { return; }

    eachOwn(eventMap, (handler, key) => {
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
    const cleanup = this.EventDelegator.delegate({
      eventName: match[1],
      selector: match[2],
      handler,
      rootEl: this.el
    });

    if (typeof cleanup !== 'function') {
      throw new MarionetteError({
        code: 'MN0036',
        name: 'EventDelegatorError',
        message: 'EventDelegator.delegate must return a cleanup function.',
        url: 'dom.interactions.html#eventdelegator-adapter'
      });
    }

    this._domEvents.push(cleanup);
  }
};
