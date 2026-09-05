import { assignOwn } from './utils/assign-in.js';
import extend from './utils/extend.ts';
import monitorViewEvents from './modules/common/monitor-view-events.js';
import Events from './mixins/events.ts';
import TemplateRenderMixin from './mixins/template-render.js';
import MnObjectBase from './modules/object.ts';
import ViewBase from './modules/view.js';
import CollectionViewBase from './modules/collection-view.js';
import BehaviorBase from './modules/behavior.js';
import RegionBase from './modules/region.js';
import ApplicationBase from './modules/application.js';
import Radio, { createRadio } from './modules/radio.js';
import DomApi from './runtime/dom-api.js';
import DataApi from './runtime/data-api.js';
import EventDelegator from './runtime/event-delegator.js';
import StateApi from './runtime/state-api.js';
import MarionetteError from './modules/error.ts';
import { version as VERSION } from './version.js';
import { runtimeId } from './runtime/runtime-id.js';

function copyApi(api) {
  return assignOwn({}, api);
}

const DefaultDataApi = copyApi(DataApi);
const DefaultDomApi = copyApi(DomApi);
const DefaultEventDelegator = copyApi(EventDelegator);
const DefaultStateApi = copyApi(StateApi);

function composeClass(BaseClass, properties) {
  return BaseClass.extend(properties);
}

function setClassReference(Class, name, value) {
  Object.defineProperty(Class.prototype, name, {
    configurable: true,
    value,
    writable: true
  });
}

function setDomApiFor(CollectionView, Region, View, mixin) {
  CollectionView.setDomApi(mixin);
  Region.setDomApi(mixin);
  View.setDomApi(mixin);
}

function setDataApiFor(CollectionView, View, mixin) {
  CollectionView.setDataApi(mixin);
  View.setDataApi(mixin);
}

function setStateApiFor(Application, Behavior, CollectionView, MnObject, View, mixin) {
  Application.setStateApi(mixin);
  Behavior.setStateApi(mixin);
  CollectionView.setStateApi(mixin);
  MnObject.setStateApi(mixin);
  View.setStateApi(mixin);
}

function setRendererFor(CollectionView, View, renderer) {
  CollectionView.setRenderer(renderer);
  View.setRenderer(renderer);
}

function setEventDelegatorFor(Behavior, CollectionView, View, delegator) {
  Behavior.setEventDelegator(delegator);
  CollectionView.setEventDelegator(delegator);
  View.setEventDelegator(delegator);
}

export const Region = RegionBase;
export const View = ViewBase;
export const CollectionView = CollectionViewBase;
export const Behavior = BehaviorBase;
export const MnObject = MnObjectBase;
export const Application = ApplicationBase;

export function setDomApi(mixin) {
  setDomApiFor(CollectionView, Region, View, mixin);
}

export function setDataApi(mixin) {
  setDataApiFor(CollectionView, View, mixin);
}

export function setStateApi(mixin) {
  setStateApiFor(Application, Behavior, CollectionView, MnObject, View, mixin);
}

export function setRenderer(renderer) {
  setRendererFor(CollectionView, View, renderer);
}

export function setEventDelegator(delegator) {
  setEventDelegatorFor(Behavior, CollectionView, View, delegator);
}

export {
  DataApi,
  DomApi,
  Events,
  MarionetteError,
  Radio,
  StateApi,
  VERSION,
  extend,
  monitorViewEvents
};

export default function createMarionette() {
  const Data = copyApi(DefaultDataApi);
  const Dom = copyApi(DefaultDomApi);
  const Delegator = copyApi(DefaultEventDelegator);
  const State = copyApi(DefaultStateApi);
  const runtimeRadio = createRadio();
  const isolatedRuntimeId = {};
  const RuntimeRegion = composeClass(RegionBase, { Dom });
  const RuntimeView = composeClass(ViewBase, {
    Data,
    Dom,
    EventDelegator: Delegator,
    State,
    _renderHtml: TemplateRenderMixin._renderHtml,
    regionClass: RuntimeRegion
  });
  const RuntimeCollectionView = composeClass(CollectionViewBase, {
    Data,
    Dom,
    EventDelegator: Delegator,
    State,
    _renderHtml: TemplateRenderMixin._renderHtml
  });
  const RuntimeBehavior = composeClass(BehaviorBase, {
    EventDelegator: Delegator,
    State
  });
  const RuntimeMnObject = composeClass(MnObjectBase, { Radio: runtimeRadio, State });
  const RuntimeApplication = composeClass(ApplicationBase, {
    Radio: runtimeRadio,
    State,
    regionClass: RuntimeRegion
  });

  setClassReference(RuntimeRegion, runtimeId, isolatedRuntimeId);
  setClassReference(RuntimeView, runtimeId, isolatedRuntimeId);
  setClassReference(RuntimeCollectionView, 'RegionClass', RuntimeRegion);
  setClassReference(RuntimeApplication, runtimeId, isolatedRuntimeId);

  return {
    Application: RuntimeApplication,
    Behavior: RuntimeBehavior,
    CollectionView: RuntimeCollectionView,
    DataApi: Data,
    DomApi: Dom,
    Events,
    MarionetteError,
    MnObject: RuntimeMnObject,
    Radio: runtimeRadio,
    Region: RuntimeRegion,
    StateApi: State,
    VERSION,
    View: RuntimeView,
    extend,
    monitorViewEvents,
    setDataApi(mixin) {
      setDataApiFor(RuntimeCollectionView, RuntimeView, mixin);
    },
    setDomApi(mixin) {
      setDomApiFor(RuntimeCollectionView, RuntimeRegion, RuntimeView, mixin);
    },
    setEventDelegator(delegator) {
      setEventDelegatorFor(RuntimeBehavior, RuntimeCollectionView, RuntimeView, delegator);
    },
    setRenderer(renderer) {
      setRendererFor(RuntimeCollectionView, RuntimeView, renderer);
    },
    setStateApi(mixin) {
      setStateApiFor(
        RuntimeApplication,
        RuntimeBehavior,
        RuntimeCollectionView,
        RuntimeMnObject,
        RuntimeView,
        mixin
      );
    }
  };
}
