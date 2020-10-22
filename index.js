import proxy from './utils/proxy.js';
import extend from './utils/extend';
import { version as VERSION } from './version';

import {
  bindEvents as _bindEvents,
  unbindEvents as _unbindEvents
} from './modules/common/bind-events.js';
import {
  bindRequests as _bindRequests,
  unbindRequests as _unbindRequests
} from './modules/common/bind-requests';
import _getOption from './modules/common/get-option';
import _mergeOptions from './modules/common/merge-options';
import monitorViewEvents from './modules/common/monitor-view-events';
import _normalizeMethods from './modules/common/normalize-methods';
import _triggerMethod from './modules/common/trigger-method';

import Events from './mixins/events';
import Requests from './mixins/requests';

import MnObject from './modules/object';
import View from './modules/view';
import CollectionView from './modules/collection-view';
import Behavior from './modules/behavior';
import Region from './modules/region';
import Application from './modules/application';
import Radio from './modules/radio';

import DomApi from './config/dom';

import {
  isEnabled,
  setEnabled
} from './config/features';

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
