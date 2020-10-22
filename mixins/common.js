import { extend, result } from 'underscore';

import EventsMixin from './events';
import RequestsMixin from './requests';
import getOption from '../modules/common/get-option';
import mergeOptions from '../modules/common/merge-options';
import normalizeMethods from '../modules/common/normalize-methods';
import triggerMethod from '../modules/common/trigger-method';
import {
  bindEvents,
  unbindEvents
} from '../modules/common/bind-events';
import {
  bindRequests,
  unbindRequests
} from '../modules/common/bind-requests';

const CommonMixin = {

  // This is a noop method intended to be overridden
  initialize() {},

  // Imports the "normalizeMethods" to transform hashes of
  // events=>function references/names to a hash of events=>function references
  normalizeMethods,

  _setOptions(options, classOptions) {
    this.options = extend({}, result(this, 'options'), options);
    this.mergeOptions(options, classOptions);
  },

  // A handy way to merge passed-in options onto the instance
  mergeOptions,

  // Enable getting options from this or this.options by name.
  getOption,

  // Enable binding view's events from another entity.
  bindEvents,

  // Enable unbinding view's events from another entity.
  unbindEvents,

  // Enable binding view's requests.
  bindRequests,

  // Enable unbinding view's requests.
  unbindRequests,

  triggerMethod
};

extend(CommonMixin, EventsMixin, RequestsMixin);

export default CommonMixin;
