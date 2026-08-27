import proxy from './utils/proxy.js';
import extend from './utils/extend.js';
import { version as VERSION } from './version.js';

import {
  bindEvents as _bindEvents,
  unbindEvents as _unbindEvents
} from './modules/common/bind-events.js';
import {
  bindRequests as _bindRequests,
  unbindRequests as _unbindRequests
} from './modules/common/bind-requests.js';
import _getOption from './modules/common/get-option.js';
import _mergeOptions from './modules/common/merge-options.js';
import monitorViewEvents from './modules/common/monitor-view-events.js';
import _normalizeMethods from './modules/common/normalize-methods.js';
import _triggerMethod from './modules/common/trigger-method.js';

import Events from './mixins/events.js';
import Requests from './mixins/requests.js';

import MnObject from './modules/object.js';
import View from './modules/view.js';
import CollectionView from './modules/collection-view.js';
import Behavior from './modules/behavior.js';
import Region from './modules/region.js';
import Application from './modules/application.js';
import Radio from './modules/radio.js';

import DomApi from './config/dom.js';

import {
  isEnabled,
  setEnabled
} from './config/features.js';

// Utilities

export const bindEvents = proxy(_bindEvents);
export const unbindEvents = proxy(_unbindEvents);
export const bindRequests = proxy(_bindRequests);
export const unbindRequests = proxy(_unbindRequests);
export const mergeOptions = proxy(_mergeOptions);
export const getOption = proxy(_getOption);
export const normalizeMethods = proxy(_normalizeMethods);
export const triggerMethod = proxy(_triggerMethod);


// Configuration

export const setDomApi = function(mixin) {
  CollectionView.setDomApi(mixin);
  Region.setDomApi(mixin);
  View.setDomApi(mixin);
};
export const setRenderer = function(renderer) {
  CollectionView.setRenderer(renderer);
  View.setRenderer(renderer);
};

export const setEventDelegator = function(delegator) {
  Behavior.setEventDelegator(delegator);
  CollectionView.setEventDelegator(delegator);
  View.setEventDelegator(delegator);
};

export {
  View,
  CollectionView,
  MnObject,
  Region,
  Behavior,
  Application,
  Radio,
  isEnabled,
  setEnabled,
  monitorViewEvents,
  Events,
  Requests,
  extend,
  DomApi,
  VERSION,
};
