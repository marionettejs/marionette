// Event Delegator
//  ---------
import MarionetteError from '../modules/error.ts';

// Static setter
export function setEventDelegator(delegator) {
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
  delegate({ eventName, selector, handler, rootEl }) {
    const capture = eventName === 'focus' || eventName === 'blur';
    let eventHandler = handler;

    if (selector) {
      eventHandler = function(evt) {
        let node = evt.target;
        for (; node && node !== rootEl; node = node.parentNode) {
          if (node.nodeType === 1 && node.matches(selector)) {
            evt.delegateTarget = node;
            handler(evt);
            break;
          }
        }
      };
    }

    rootEl.addEventListener(eventName, eventHandler, capture);

    let isRemoved;
    return () => {
      if (isRemoved) { return; }
      isRemoved = true;
      rootEl.removeEventListener(eventName, eventHandler, capture);
    };
  }
};
