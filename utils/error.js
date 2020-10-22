// Error
// -----

import { extend as _extend, pick } from 'underscore';
import extend from './extend';
import {version} from '../version';

const errorProps = ['description', 'fileName', 'lineNumber', 'name', 'message', 'number', 'url'];

const MarionetteError = extend.call(Error, {
  urlRoot: `http://marionettejs.com/docs/v${version}/`,

  url: '',

  constructor(options) {
    const error = Error.call(this, options.message);
    _extend(this, pick(error, errorProps), pick(options, errorProps));

    if (Error.captureStackTrace) {
      this.captureStackTrace();
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
