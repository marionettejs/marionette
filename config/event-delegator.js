// Event Delegator
//  ---------
import { each, extend } from 'underscore';

// Static setter
export function setEventDelegator(mixin) {
  this.prototype.EventDelegator = extend({}, this.prototype.EventDelegator, mixin);
  return this;
}

export default {

  shouldCapture(eventName) {
    return ['focus', 'blur'].indexOf(eventName) !== -1;
  },

  // this.$el.on(eventName + '.delegateEvents' + this.cid, selector, handler);
  delegate({ eventName, selector, handler, events, rootEl }) {
    const shouldCapture = this.shouldCapture(eventName);

    if (selector) {
      const delegateHandler = function(evt) {
        let node = evt.target;
        for (; node && node !== rootEl; node = node.parentNode) {
          if (Element.prototype.matches.call(node, selector)) {
            evt.delegateTarget = node;
            handler(evt);
          }
        }
      };

      events.push({ eventName, handler: delegateHandler });
      Element.prototype.addEventListener.call(rootEl, eventName, delegateHandler, shouldCapture);

      return;
    }

    events.push({ eventName, handler });
    Element.prototype.addEventListener.call(rootEl, eventName, handler, shouldCapture);
  },

  // this.$el.off('.delegateEvents' + this.cid);
  undelegateAll({ events, rootEl }) {
    if (!rootEl) { return; }

    each(events, ({ eventName, handler }) => {
      const shouldCapture = this.shouldCapture(eventName);
      Element.prototype.removeEventListener.call(rootEl, eventName, handler, shouldCapture);
    });

    events.length = 0;
  }
};
