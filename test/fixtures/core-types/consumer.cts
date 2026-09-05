import {
  Application, Behavior, CollectionView, DataApi, DomApi, Events,
  MarionetteError, MnObject, Radio, Region, StateApi, VERSION, View,
  createMarionette, extend, monitorViewEvents, setDataApi, setDomApi,
  setEventDelegator, setRenderer, setStateApi,
} from 'marionette';
import type { LifecycleContext, ViewInstance, ApplicationInstance, MarionetteErrorInstance } from 'marionette';
import { DataApi as NativeDataApi, StateApi as NativeStateApi, Model, Collection } from '@marionette/data';
import BackboneApi from '@marionette/adapters/backbone';
import Backbone from 'backbone';


const version: string = VERSION;
const Item = View.extend({
  template: false,
  initialize(options: { label: string }) { options.label.toUpperCase(); },
  label(): string { return this.options.label; },
});
const item = new Item({ label: 'Example' });
item.render();
const label: string = item.label();
const view: ViewInstance<object> = item;
const region = new Region({ el: document.createElement('main') });
region.show(view);
const behavior = new Behavior({}, item);
behavior.destroy();
const list = new CollectionView({ childView: Item });
list.addChildView(item);
const found = list.children.findByCid(item.cid);
if (found) { found.label().toUpperCase(); }
const app: ApplicationInstance = new Application();
const completion: Promise<boolean> = app.destroy();
const App = Application.extend({
  onBeforeStart(owner: ApplicationInstance, options: unknown, context: LifecycleContext) {
    context.signal.throwIfAborted();
  },
});
new App().start();
const ObjectClass = MnObject.extend({ describe(): string { return 'Example'; } });
const description: string = new ObjectClass().describe();
const isolated = createMarionette();
new isolated.Application().start();
new isolated.View({ template: false }).render();
const error: MarionetteErrorInstance = new MarionetteError('Example');
const channel = Radio.channel('example');
channel.reply('count', () => 1);
channel.request('count');
const emitter = Object.assign({}, Events);
emitter.on('change', () => {});
monitorViewEvents(item);
setDataApi({});
setDomApi({});
setStateApi({});
setRenderer(function() {});
setEventDelegator({ delegate() { return () => {}; } });
void [version, label, behavior, completion, description, error, DataApi, DomApi, StateApi, extend];

// @ts-expect-error required initializer options are retained
new Item();
// @ts-expect-error initializer values remain checked
new Item({ label: 1 });
// @ts-expect-error instance methods cannot be invented
item.missingMethod();
// @ts-expect-error Application destruction is asynchronous
const synchronous: ApplicationInstance = app.destroy();
// @ts-expect-error child lookup can be absent
list.children.findByCid('missing').label();
// @ts-expect-error an isolated facade does not contain another factory
isolated.createMarionette();

// Optional packages compose through their installed public declarations.
const nativeModel = new Model({ id: 1, label: 'Native' });
const nativeCollection = new Collection([nativeModel]);
const nativeState = new Model({ selected: false });
const subscriptionContext = { labels: [] as string[] };
function recordNativeLabel(this: typeof subscriptionContext, changed: typeof nativeModel, value: string) {
  this.labels.push(value);
  changed.get('label')?.toUpperCase();
}
const stopNativeData: () => void = NativeDataApi.subscribe(nativeModel, 'change:label', recordNativeLabel, subscriptionContext);
const stopNativeState: () => void = NativeStateApi.subscribe(nativeState, 'change:selected',
  (changed: typeof nativeState, selected: boolean) => changed.set('selected', selected), subscriptionContext);
setDataApi(NativeDataApi);
setStateApi(NativeStateApi);
isolated.setDataApi(NativeDataApi);
isolated.setStateApi(NativeStateApi);
const NativeItem = View.extend({
  template: false,
  initialize(options: { model: typeof nativeModel }) { options.model.get('label'); },
  label(): string | undefined { return this.options.model.get('label'); },
});
const nativeItem = new NativeItem({ model: nativeModel });
const nativeLabel: string | undefined = nativeItem.label();
const nativeList = new CollectionView({ collection: nativeCollection, childView: NativeItem });
const nativeFirst: typeof nativeModel | undefined = nativeList.collection.at(0);
const isolatedNativeItem = new isolated.View({ model: nativeModel, state: nativeState, template: false });
const selected: boolean | undefined = isolatedNativeItem.getState().get('selected');
const isolatedNativeList = new isolated.CollectionView({ collection: nativeCollection, childView: isolated.View });
const isolatedFirst: typeof nativeModel | undefined = isolatedNativeList.collection.at(0);
stopNativeData();
stopNativeState();

const backboneModel = new Backbone.Model({ id: 2, label: 'Backbone' });
const backboneCollection = new Backbone.Collection([backboneModel]);
function recordBackboneLabel(this: typeof subscriptionContext, changed: Backbone.Model, value: string) {
  this.labels.push(value);
  changed.has('label');
}
const stopBackbone: () => void = BackboneApi.subscribe(backboneModel, { 'change:label': recordBackboneLabel }, subscriptionContext);
setDataApi(BackboneApi);
setStateApi(BackboneApi);
isolated.setDataApi(BackboneApi);
isolated.setStateApi(BackboneApi);
const backboneItem = new View({ model: backboneModel, state: backboneModel, template: false });
const backboneList = new CollectionView({ collection: backboneCollection, childView: View });
const backboneFirst: Backbone.Model | undefined = backboneList.collection.at(0);
new isolated.View({ model: backboneModel, state: backboneModel, template: false });
new isolated.CollectionView({ collection: backboneCollection, childView: isolated.View });
stopBackbone();
// @ts-expect-error Native subscriptions need an on/off source.
NativeDataApi.subscribe({}, 'change', recordNativeLabel);
// @ts-expect-error String Backbone subscriptions need a callable handler.
BackboneApi.subscribe(backboneModel, 'change:label', 123);
// @ts-expect-error Native model attribute inference remains available through the view's options.
const invalidLabel: number = nativeItem.options.model.get('label');
