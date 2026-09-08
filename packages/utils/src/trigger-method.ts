// Trigger Method
// --------------

import getOption from './get-option.ts';
import type { EventCallback } from './events.ts';

interface TriggerTarget {
  trigger: EventCallback;
}

// Match the first word character and each word character following a colon.
const splitter = /(^|:)(\w)/gi;

// Cache the method name for each distinct event string.
const methodCache: Record<string, string | undefined> = Object.create(null);

// take the event section ("section1:section2:section3")
// and turn it in to uppercase name onSection1Section2Section3
function getEventName(match: string, prefix: string, eventName: string) {
  return eventName.toUpperCase();
}

const getOnMethodName = function(event: string) {
  if (!methodCache[event]) {
    methodCache[event] = 'on' + event.replace(splitter, getEventName);
  }

  return methodCache[event];
};

// Trigger an event and/or a corresponding method name. Examples:
//
// `this.triggerMethod("foo")` calls a callable "onFoo" option/method, then
// triggers "foo". A synchronous method exception prevents the event.
//
// `this.triggerMethod("foo:bar")` similarly calls "onFooBar" before the event.
// It returns the method result without awaiting it.
export default function triggerMethod(this: TriggerTarget, event: string, ...args: unknown[]): unknown {
  // get the method name from the event name
  const methodName = getOnMethodName(event);
  const method = getOption.call(this, methodName);
  let result: unknown;

  // call the onMethodName if it exists
  if (typeof method === 'function') {
    // pass all args, except the event name
    result = method.apply(this, args);
  }

  // trigger the event
  (this.trigger as Function).apply(this, arguments);

  return result;
}
