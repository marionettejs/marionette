import { isObject, noop } from 'underscore';

import { isEnabled } from '../config/features';

const deprecate = function(message, test) {
  if (isObject(message)) {
    message = (
      message.prev + ' is going to be removed in the future. ' +
      'Please use ' + message.next + ' instead.' +
      (message.url ? ' See: ' + message.url : '')
    );
  }

  if (!isEnabled('DEV_MODE')) {
    return;
  }

  if ((test === undefined || !test) && !deprecate._cache[message]) {
    deprecate._warn('Deprecation warning: ' + message);
    deprecate._cache[message] = true;
  }
};

/* istanbul ignore next: can't clear console */
deprecate._console = typeof console !== 'undefined' ? console : {};
deprecate._warn = function() {
  const warn = deprecate._console.warn || deprecate._console.log || noop;
  return warn.apply(deprecate._console, arguments);
};
deprecate._cache = {};

export default deprecate;
