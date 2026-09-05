import EventDelegator from '../runtime/event-delegator.ts';
import MarionetteError from '../modules/error.ts';
import disposeAll from '../utils/dispose-all.ts';
import { resolveMethod } from '../modules/common/normalize-methods.ts';
import eachOwn from '../utils/each-own.js';
import getValue from '../utils/get-value.ts';
import isString from '../utils/is-string.js';

import type { EventCallback } from './events.ts';
import type { EventDelegator as Delegator, DelegateOptions } from '../runtime/event-delegator.ts';
import type { UISelectors } from './ui.ts';

export type DOMEvents = Record<string, EventCallback | string>;
export interface TriggerOptions { event: string; preventDefault?: boolean; stopPropagation?: boolean }
export type TriggerDefinition = string | TriggerOptions;
export type DOMTriggers = Record<string, TriggerDefinition>;
export interface TriggerTarget {
  triggerMethod(event: string, ...args: unknown[]): unknown;
}

type Delegates = Array<EventCallback | string>;
export interface ViewEventsHost extends TriggerTarget {
  el: Element;
  events?: DOMEvents | (() => DOMEvents);
  triggers?: DOMTriggers | (() => DOMTriggers);
  EventDelegator: Delegator;
  _domEvents: Array<() => void>;
  _getUIBindings(): UISelectors | undefined;
  normalizeUIString(value: string, bindings?: UISelectors): string;
  _delegateEvents(delegates: Delegates, bindings: UISelectors | undefined, events?: DOMEvents): void;
  _delegateTriggers(delegates: Delegates, bindings: UISelectors | undefined, view: TriggerTarget): void;
  _delegate(handler: EventCallback, key: string): void;
}

const delegateEventSplitter = /^(\S+)\s*(.*)$/;

// Internal method to create an event handler for a given `triggerDef` like
// 'click:foo'
function buildViewTrigger(view: TriggerTarget, triggerDef: TriggerDefinition) {
  if (isString(triggerDef)) {
    triggerDef = { event: triggerDef as string };
  }

  const eventName = (triggerDef as TriggerOptions).event;

  const shouldPreventDefault = (triggerDef as TriggerOptions).preventDefault !== false;
  const shouldStopPropagation = (triggerDef as TriggerOptions).stopPropagation !== false;

  return function(event: Pick<Event, 'preventDefault' | 'stopPropagation'>, ...args: unknown[]) {
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

  _initViewEvents(this: Pick<ViewEventsHost, '_domEvents'>) {
    this._domEvents = [];
  },

  _undelegateViewEvents(this: Pick<ViewEventsHost, '_domEvents'>) {
    disposeAll(this._domEvents.splice(0));
  },

  _delegateViewEvents(this: ViewEventsHost, view: TriggerTarget = this, events?: DOMEvents) {
    if (!events && !this.events && !this.triggers) { return; }

    const uiBindings = this._getUIBindings();
    const delegates: Delegates = [];
    this._delegateEvents(delegates, uiBindings, events);
    this._delegateTriggers(delegates, uiBindings, view);
    try {
      for (let index = 0; index < delegates.length; index += 2) {
        this._delegate(delegates[index] as EventCallback, delegates[index + 1] as string);
      }
    } catch (error) {
      disposeAll(this._domEvents.splice(0), error);
    }
  },

  _delegateEvents(this: ViewEventsHost, delegates: Delegates, uiBindings: UISelectors | undefined, events?: DOMEvents) {
    const eventMap = events || getValue(this, 'events');
    if (!eventMap) { return; }

    eachOwn(eventMap, (handler: unknown, key: string) => {
      handler = resolveMethod(this, handler, key);
      delegates.push((handler as EventCallback).bind(this), this.normalizeUIString(key, uiBindings));
    });
  },

  _delegateTriggers(this: ViewEventsHost, delegates: Delegates, uiBindings: UISelectors | undefined, view: TriggerTarget) {
    if (!this.triggers) { return; }

    eachOwn(getValue(this, 'triggers'), (value: TriggerDefinition, key: string) => {
      delegates.push(buildViewTrigger(view, value), this.normalizeUIString(key, uiBindings));
    });
  },

  _delegate(this: ViewEventsHost, handler: EventCallback, key: string) {
    const match = key.match(delegateEventSplitter)!;
    const cleanup = this.EventDelegator.delegate({
      eventName: match[1],
      selector: match[2],
      handler,
      rootEl: this.el
    } as DelegateOptions);

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
