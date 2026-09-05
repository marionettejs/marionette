import MnObject from '../tmp/typed-core/src/modules/object.js';
import defaultState, { setStateApi, type StateApi } from '../tmp/typed-core/src/runtime/state-api.js';
import defaultData, { setDataApi, type DataApi } from '../tmp/typed-core/src/runtime/data-api.js';
import type { DataApi as NativeData, StateApi as NativeState, Model, Collection } from '../../packages/data/types/index.js';
import type createActorApi from '../../packages/adapters/types/xstate.mjs';
import type createReduxDataApi from '../../packages/adapters/types/redux.mjs';

const Worker = MnObject.extend({ createState() { return { ready: false }; } });
const source = { label: 'Example' };
const borrowed = new Worker({ state: source });
const borrowedLabel: string = borrowed.getState().label;
const ownedReady: boolean = new Worker().getState().ready;
const nullSource: null = new Worker({ state: null }).getState();
const readyProvider = {
  subscribe(value: { ready: boolean }) { value.ready.valueOf(); return () => {}; },
  disposeOwned(value: { ready: boolean }) { value.ready.valueOf(); }
};
const configured: typeof Worker = Worker.setStateApi(readyProvider);
Worker.setStateApi({ disposeOwned(value: { label: string }) { value.label.toUpperCase(); } });
Worker.setStateApi({ note: 'provider metadata' });
Worker.setStateApi(Object.assign(() => {}, { subscribe: readyProvider.subscribe }));
for (const empty of [undefined, null, false, true, 0, 1, 0n, 1n, '', 'ignored', Symbol()] as const) {
  Worker.setStateApi(empty);
}
Worker.setStateApi();
// @ts-expect-error Registration does not turn a narrow provider into a universal one.
const universal: StateApi<unknown> = readyProvider;
if (borrowed.State.subscribe) {
  // @ts-expect-error A present method still has an opaque source contract.
  borrowed.State.subscribe(borrowed.getState(), 'change', () => {});
}
// @ts-expect-error The same boundary applies to owned state.
new Worker().State.subscribe?.({ ready: false }, 'change', () => {});
// @ts-expect-error Subscriptions must return cleanup functions.
Worker.setStateApi({ subscribe() { return 3; } });
// @ts-expect-error Owned disposal is callable.
Worker.setStateApi({ disposeOwned: true });

const DataClass = { prototype: { Data: defaultData }, setDataApi, label: 'data class' };
const sameDataClass: typeof DataClass = DataClass.setDataApi({ key(value: { id: number }) { return value.id; } });
DataClass.setDataApi({ metadata: true });
DataClass.setDataApi();
for (const empty of [undefined, null, false, true, 0, 1, 0n, 1n, '', 'ignored', Symbol()] as const) {
  DataClass.setDataApi(empty);
}
// @ts-expect-error Ordered snapshots must be arrays.
DataClass.setDataApi({ models() { return 'not an array'; } });
// @ts-expect-error has returns boolean.
DataClass.setDataApi({ has() { return 1; } });
// @ts-expect-error Collection subscriptions return cleanup functions.
DataClass.setDataApi({ observeCollection() { return null; } });

// Concrete optional adapters remain typed independently from registration.
declare const nativeState: typeof NativeState;
declare const nativeData: typeof NativeData;
declare const actor: ReturnType<typeof createActorApi>;
declare const redux: ReturnType<typeof createReduxDataApi<{ rows: { id: number }[] }, { id: number }, number>>;
Worker.setStateApi(nativeState);
Worker.setStateApi(actor);
DataClass.setDataApi(nativeData);
DataClass.setDataApi(actor);
DataClass.setDataApi(redux);
setStateApi.call(Worker, nativeState);
setDataApi.call(DataClass, nativeData);
declare const nativeModel: Model<{ name: string }>;
declare const nativeCollection: Collection<typeof nativeModel>;
const models: typeof nativeModel[] = nativeData.models(nativeCollection);
const name: string | undefined = nativeModel.get('name');
// @ts-expect-error The direct adapter keeps its concrete collection contract.
nativeData.models({ unrelated: true });
declare const dataSlot: Partial<DataApi>;
if (dataSlot.models) {
  // @ts-expect-error A present method still does not promise a source/model mapping.
  dataSlot.models(nativeCollection);
}

// The defaults keep their own direct identity and property-lookup contracts.
const sameSource: typeof source = defaultData.key(source);
const serialized: typeof source = defaultData.serialize(source);
const plainModels = [source];
const sameModels: typeof plainModels = defaultData.models(plainModels);
const tuple = [source] as const;
const sameTuple: typeof tuple = defaultData.models(tuple);
// @ts-expect-error Default collection snapshots are ordered arrays.
defaultData.models({});
const value: unknown = defaultData.get(source, 'label');
const absent: boolean = defaultData.has(null, 'label');
const primitive: unknown = defaultData.get('name', 0);
const key = { toString() { return 'label'; } };
const coerced: unknown = defaultData.get(source, key);
const cleanup: () => void = defaultData.observeCollection([], () => {}, {});
defaultState.subscribe(source, 'change', () => {});
const entity = { on() {}, off() {} };
const unsubscribe: () => void = defaultData.subscribe(entity, 'change', () => {}, {});
// @ts-expect-error Opaque property values are not invented from model keys.
const wrong: string = defaultData.get(source, 'label');

// Explicit undefined overlays may remove a configured capability.
Worker.setStateApi({ subscribe: undefined });
const optionalSubscribe: StateApi<never>['subscribe'] | undefined = borrowed.State.subscribe;
// @ts-expect-error A mutable slot need not retain the default subscription method.
const requiredSubscribe: StateApi<never>['subscribe'] = borrowed.State.subscribe;
// @ts-expect-error Object.hasOwn does not accept a nullish model.
defaultData.get(null, 'label');
// @ts-expect-error Undefined is nullish as well.
defaultData.get(undefined, 'label');
// @ts-expect-error The default structural observer supports only arrays.
defaultData.observeCollection({});
defaultData.subscribe(entity, 'count', (count: number) => count.toFixed());
// @ts-expect-error The default subscriber requires an event source.
defaultData.subscribe(null, 'count', () => {});
// @ts-expect-error Undefined is not an event source.
defaultData.subscribe(undefined, 'count', () => {});
