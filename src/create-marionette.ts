import { assignOwn } from './utils/assign-in.js';
import extend from './utils/extend.ts';
import monitorViewEvents from './modules/common/monitor-view-events.ts';
import Events from './mixins/events.ts';
import TemplateRenderMixin from './mixins/template-render.ts';
import MnObjectBase from './modules/object.ts';
import ViewBase from './modules/view.ts';
import CollectionViewBase from './modules/collection-view.ts';
import BehaviorBase from './modules/behavior.ts';
import RegionBase from './modules/region.ts';
import ApplicationBase from './modules/application.ts';
import Radio, { createRadio } from './modules/radio.ts';
import DomApi from './runtime/dom-api.ts';
import DataApi from './runtime/data-api.ts';
import EventDelegator from './runtime/event-delegator.ts';
import StateApi from './runtime/state-api.ts';
import MarionetteError from './modules/error.ts';
import { version as VERSION } from './version.js';
import { runtimeId } from './runtime/runtime-id.js';

import type { DomApi as DomContract } from './runtime/dom-api.ts';
import type { DataApi as DataContract } from './runtime/data-api.ts';
import type { StateApi as StateContract } from './runtime/state-api.ts';
import type { EventDelegator as Delegator } from './runtime/event-delegator.ts';
import type { Renderer } from './runtime/renderer.ts';

type Overlay<Contract, Mixin extends object = object> = Mixin & Partial<Contract> |
  null | boolean | number | bigint | string | symbol | undefined;
interface ExtendableClass {
  prototype: object;
  extend(properties: object): unknown;
}
interface DomClass {
  prototype: object;
  setDomApi: typeof ViewBase.setDomApi;
}
interface DataClass {
  prototype: { Data: Partial<DataContract> };
  setDataApi: typeof ViewBase.setDataApi;
}
interface StateClass {
  prototype: { State: Partial<StateContract<never>> };
  setStateApi: typeof MnObjectBase.setStateApi;
}
interface RendererClass {
  prototype: object;
  setRenderer: typeof ViewBase.setRenderer;
}
interface DelegatorClass {
  prototype: object;
  setEventDelegator: typeof ViewBase.setEventDelegator;
}

function copyApi<Api extends object>(api: Api): Api {
  return assignOwn({}, api);
}

const DefaultDataApi = copyApi(DataApi);
const DefaultDomApi = copyApi(DomApi);
const DefaultEventDelegator = copyApi(EventDelegator);
const DefaultStateApi = copyApi(StateApi);

function composeClass<Class extends ExtendableClass>(BaseClass: Class, properties: Partial<Class['prototype']>): Class {
  return BaseClass.extend(properties) as Class;
}

function setClassReference(Class: { prototype: object }, name: PropertyKey, value: unknown) {
  Object.defineProperty(Class.prototype, name, {
    configurable: true,
    value,
    writable: true
  });
}

function setDomApiFor(CollectionView: DomClass, Region: DomClass, View: DomClass, mixin: Overlay<DomContract>) {
  CollectionView.setDomApi(mixin);
  Region.setDomApi(mixin);
  View.setDomApi(mixin);
}

function setDataApiFor(CollectionView: DataClass, View: DataClass, mixin: Overlay<DataContract>) {
  CollectionView.setDataApi(mixin);
  View.setDataApi(mixin);
}

function setStateApiFor(Application: StateClass, Behavior: StateClass, CollectionView: StateClass, MnObject: StateClass, View: StateClass, mixin: Overlay<StateContract<never>>) {
  Application.setStateApi(mixin);
  Behavior.setStateApi(mixin);
  CollectionView.setStateApi(mixin);
  MnObject.setStateApi(mixin);
  View.setStateApi(mixin);
}

function setRendererFor(CollectionView: RendererClass, View: RendererClass, renderer: Renderer<never, never, never> | undefined) {
  CollectionView.setRenderer(renderer);
  View.setRenderer(renderer);
}

function setEventDelegatorFor(Behavior: DelegatorClass, CollectionView: DelegatorClass, View: DelegatorClass, delegator: Delegator) {
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

export function setDomApi<Mixin extends object>(mixin?: Overlay<DomContract, Mixin>) {
  setDomApiFor(CollectionView, Region, View, mixin);
}

export function setDataApi<Mixin extends object>(mixin?: Overlay<DataContract, Mixin>) {
  setDataApiFor(CollectionView, View, mixin);
}

export function setStateApi<Mixin extends object>(mixin?: Overlay<StateContract<never>, Mixin>) {
  setStateApiFor(Application, Behavior, CollectionView, MnObject, View, mixin);
}

export function setRenderer(renderer?: Renderer<never, never, never>) {
  setRendererFor(CollectionView, View, renderer);
}

export function setEventDelegator<Adapter extends Delegator>(delegator: Adapter) {
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
    setDataApi<Mixin extends object>(mixin?: Overlay<DataContract, Mixin>) {
      setDataApiFor(RuntimeCollectionView, RuntimeView, mixin);
    },
    setDomApi<Mixin extends object>(mixin?: Overlay<DomContract, Mixin>) {
      setDomApiFor(RuntimeCollectionView, RuntimeRegion, RuntimeView, mixin);
    },
    setEventDelegator<Adapter extends Delegator>(delegator: Adapter) {
      setEventDelegatorFor(RuntimeBehavior, RuntimeCollectionView, RuntimeView, delegator);
    },
    setRenderer(renderer?: Renderer<never, never, never>) {
      setRendererFor(RuntimeCollectionView, RuntimeView, renderer);
    },
    setStateApi<Mixin extends object>(mixin?: Overlay<StateContract<never>, Mixin>) {
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
