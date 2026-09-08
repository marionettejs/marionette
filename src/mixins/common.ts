import {
  getValue,
  getOption,
  mergeOptions,
  normalizeMethods,
  bindEvents,
  unbindEvents,
  bindRequests,
  unbindRequests
} from '@marionette/utils';
import { Events as EventsMixin } from '@marionette/utils';
import type { EventsContract as Events } from '@marionette/utils';

interface OptionsTarget {
  options?: unknown;
  mergeOptions: (options: unknown, classOptions: readonly unknown[]) => unknown;
}

const CommonMixin = {

  // This is a noop method intended to be overridden
  initialize() {},

  // Imports the "normalizeMethods" to transform hashes of
  // events=>function references/names to a hash of events=>function references
  normalizeMethods,

  _setOptions(this: OptionsTarget, options: unknown, classOptions: readonly unknown[]) {
    this.options = { ...getValue(this, 'options') as object, ...options as object };
    this.mergeOptions(options, classOptions);
  },

  // A handy way to merge passed-in options onto the instance
  mergeOptions,

  // Enable getting options from this or this.options by name.
  getOption,

  // Subscribe this receiver to another entity's events.
  bindEvents,

  // Remove this receiver's subscriptions to another entity's events.
  unbindEvents,

  // Register request handlers with this receiver as their context.
  bindRequests,

  // Remove matching request handlers registered for this receiver.
  unbindRequests,
};

Object.assign(CommonMixin, EventsMixin);

// Event methods are assigned above without replacing the helper methods.
export default CommonMixin as typeof CommonMixin & Events;
