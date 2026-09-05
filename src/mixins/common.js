import { assignOwn } from '../utils/assign-in.js';
import getValue from '../utils/get-value.js';
import EventsMixin from './events.ts';
import getOption from '../modules/common/get-option.js';
import mergeOptions from '../modules/common/merge-options.js';
import normalizeMethods from '../modules/common/normalize-methods.ts';
import {
  bindEvents,
  unbindEvents
} from '../modules/common/bind-events.ts';
import {
  bindRequests,
  unbindRequests
} from '../modules/common/bind-requests.ts';

const CommonMixin = {

  // This is a noop method intended to be overridden
  initialize() {},

  // Imports the "normalizeMethods" to transform hashes of
  // events=>function references/names to a hash of events=>function references
  normalizeMethods,

  _setOptions(options, classOptions) {
    this.options = assignOwn({}, getValue(this, 'options'), options);
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
};

assignOwn(CommonMixin, EventsMixin);

export default CommonMixin;
