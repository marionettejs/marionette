// Event Delegator
//  ---------
import MarionetteError from '../modules/error.ts';

export interface DelegatedEvent extends Event {
  delegateTarget?: Element;
}

export interface DelegateOptions {
  eventName: string;
  selector: string;
  handler: (...args: unknown[]) => unknown;
  rootEl: Element;
}

export interface EventDelegator {
  delegate: (options: DelegateOptions) => () => void;
}

export interface NativeDelegateOptions {
  eventName: string;
  selector?: string | null;
  handler: (this: void, event: DelegatedEvent) => unknown;
  rootEl: Element;
}

interface DelegatorClass {
  prototype: object;
}

// Static setter
export function setEventDelegator<Receiver extends DelegatorClass, Adapter extends EventDelegator>(
  this: Receiver, delegator: Adapter
): Receiver;
export function setEventDelegator<Receiver extends DelegatorClass>(
  this: Receiver, delegator: EventDelegator | null | undefined
): Receiver {
  if (!delegator || typeof delegator.delegate !== 'function') {
    throw new MarionetteError({
      code: 'MN0036',
      name: 'EventDelegatorError',
      message: 'EventDelegator must provide a delegate method.',
      url: 'dom.interactions.html#eventdelegator-adapter'
    });
  }

  Object.defineProperty(this.prototype, 'EventDelegator', {
    configurable: true,
    enumerable: true,
    value: delegator,
    writable: false
  });
  return this;
}

export default {
  // Delegate a matching event from the root element.
  delegate({ eventName, selector, handler, rootEl }: NativeDelegateOptions) {
    const capture = eventName === 'focus' || eventName === 'blur';
    let eventHandler = handler;

    if (selector) {
      eventHandler = function(evt) {
        let node = evt.target as Node | null;
        for (; node && node !== rootEl; node = node.parentNode) {
          if (node.nodeType === 1 && (node as Element).matches(selector)) {
            evt.delegateTarget = node as Element;
            handler(evt);
            break;
          }
        }
      };
    }

    rootEl.addEventListener(eventName, eventHandler, capture);

    let isRemoved: boolean | undefined;
    return () => {
      if (isRemoved) { return; }
      isRemoved = true;
      rootEl.removeEventListener(eventName, eventHandler, capture);
    };
  }
} satisfies EventDelegator;
