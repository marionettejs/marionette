// Error
// -----

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
    const nativeProperties = {};
    const optionProperties = {};

    for (const property of errorProps) {
      const value = error[property];
      if (property in error) {
        nativeProperties[property] = value;
      }
    }

    const optionSource = Object(options);
    for (const property of errorProps) {
      const value = optionSource[property];
      if (property in optionSource) {
        optionProperties[property] = value;
      }
    }

    if (this !== undefined && this !== null) {
      Object.assign(this, nativeProperties, optionProperties);
    }

    this.captureStackTrace(error);

    this.url = this.urlRoot + this.url;
  },

  captureStackTrace(fallbackError) {
    if (typeof Error.captureStackTrace !== 'function') {
      this.stack = fallbackError.stack;
      return;
    }

    Error.captureStackTrace(this, MarionetteError);
  },

  toString() {
    return `${ this.name }: ${ this.message } See: ${ this.url }`;
  }
});

export default MarionetteError;
