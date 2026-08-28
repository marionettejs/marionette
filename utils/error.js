// Error
// -----

import { extend as _extend, pick } from 'underscore';
import extend from './extend.js';
import {version} from '../version.js';

const errorProps = ['code', 'description', 'fileName', 'lineNumber', 'name', 'message', 'number', 'url'];

const MarionetteError = extend.call(Error, {
  urlRoot: `http://marionettejs.com/docs/v${version}/`,

  url: '',

  // Long-form on purpose: method shorthand produces a non-constructor function,
  // which makes `new MarionetteError(...)` throw at runtime.
  // eslint-disable-next-line object-shorthand
  constructor: function(options) {
    const error = Error.call(this, options.message);
    _extend(this, pick(error, errorProps), pick(options, errorProps));

    if (typeof Error.captureStackTrace === 'function') {
      this.captureStackTrace();
    } else {
      this.stack = error.stack;
    }

    this.url = this.urlRoot + this.url;
  },

  captureStackTrace() {
    Error.captureStackTrace(this, MarionetteError);
  },

  toString() {
    return `${ this.name }: ${ this.message } See: ${ this.url }`;
  }
});

export default MarionetteError;
