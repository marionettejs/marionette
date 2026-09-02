import extend from './utils/extend.js';
import { version as VERSION } from './version.js';

import monitorViewEvents from './modules/common/monitor-view-events.js';

import Events from './mixins/events.js';

import MnObject from './modules/object.js';
import View from './modules/view.js';
import CollectionView from './modules/collection-view.js';
import Behavior from './modules/behavior.js';
import Region from './modules/region.js';
import Application from './modules/application.js';
import Radio from './modules/radio.js';
import State from './modules/state.js';

import DomApi from './runtime/dom-api.js';
import DataApi from './runtime/data-api.js';
import MarionetteError from './utils/error.js';

// Configuration

export const setDomApi = function(mixin) {
  CollectionView.setDomApi(mixin);
  Region.setDomApi(mixin);
  View.setDomApi(mixin);
};
export const setDataApi = function(mixin) {
  CollectionView.setDataApi(mixin);
  View.setDataApi(mixin);
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
  State,
  monitorViewEvents,
  Events,
  extend,
  DomApi,
  DataApi,
  MarionetteError,
  VERSION,
};
