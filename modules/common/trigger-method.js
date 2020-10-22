// Trigger Method
// --------------

import { isFunction } from 'underscore';
import getOption from './get-option';

// split the event name on the ":"
const splitter = /(^|:)(\w)/gi;

// Only calc getOnMethodName once
const methodCache = {};

// take the event section ("section1:section2:section3")
// and turn it in to uppercase name onSection1Section2Section3
function getEventName(match, prefix, eventName) {
  return eventName.toUpperCase();
}

const getOnMethodName = function(event) {
  if (!methodCache[event]) {
    methodCache[event] = 'on' + event.replace(splitter, getEventName);
  }

  return methodCache[event];
};

// Trigger an event and/or a corresponding method name. Examples:
//
// `this.triggerMethod("foo")` will trigger the "foo" event and
// call the "onFoo" method.
//
// `this.triggerMethod("foo:bar")` will trigger the "foo:bar" event and
// call the "onFooBar" method.
export default function triggerMethod(event, ...args) {
  // get the method name from the event name
  const methodName = getOnMethodName(event);
  const method = getOption.call(this, methodName);
  let result;

  // call the onMethodName if it exists
  if (isFunction(method)) {
    // pass all args, except the event name
    result = method.apply(this, args);
  }

  // trigger the event
  this.trigger.apply(this, arguments);

  return result;
}
