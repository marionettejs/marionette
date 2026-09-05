import * as Marionette from '../tmp/typed-core/src/index.js';
import {createMarionette, type ApplicationInstance, type LifecycleContext,
  type BehaviorHost, type ViewInstance, type RegionOptions, type CollectionChild,
  type DomApiContract, type StateApiContract, type EventDelegator, type Renderer,
  type Channel, type MnObjectInstance, type ViewConstructor} from '../tmp/typed-core/src/index.js';

const runtime = createMarionette();
const other = createMarionette();
const version: string = Marionette.VERSION;
const isolatedVersion: string = runtime.VERSION;
// @ts-expect-error An isolated facade does not recursively expose the factory.
runtime.createMarionette();
// @ts-expect-error The root does not export an extra EventDelegator runtime value.
Marionette.EventDelegator;

const Detail = runtime.View.extend({
  initialize(options: {label: string}) {this.options.label.toUpperCase();},
  label() {return this.options.label;}
});
const detail = new Detail({label: 'Details'});
const detailLabel: string = detail.label();
const regionOptions: RegionOptions = {el: '#details'};
const region = new runtime.Region(regionOptions);
const sameDetail: typeof detail = region.destroyView(detail);
const App = runtime.Application.extend({
  channelName: 'application',
  createState() {return {ready: false};},
  async onBeforeStart(app: ApplicationInstance<object, unknown>, options: unknown, context: LifecycleContext) {
    if (!context.signal.aborted) {this.getState().ready = true;}
  }
});
const app = new App({region});
const started: Promise<boolean> = app.start();
const ready: boolean = app.getState().ready;
const shown: typeof detail = app.showView(detail);
const child = new other.Application();
// The type system intentionally does not brand runtime ownership; registration checks it at runtime.
const adopted: typeof child = app.addChildApp('child', child);

const behaviorHost: BehaviorHost = new runtime.View();
const behavior = new runtime.Behavior(undefined, behaviorHost);
const query: ArrayLike<Element> = behavior.$('button');
const collection = new runtime.CollectionView({childView: runtime.View});
const rendered: typeof collection = collection.render();
const containerChild: CollectionChild | undefined = collection.children.findByIndex(0);
// @ts-expect-error CollectionView does not acquire View's named-region manager.
collection.addRegion('main', '#main');
const object: MnObjectInstance = new runtime.MnObject();
const channel: Channel = runtime.Radio.channel('application');
const foreignEvents: Marionette.EventSource = Object.assign({}, runtime.Events);
channel.listenTo(foreignEvents, 'change', (value: number) => value.toFixed());

const dom: Partial<DomApiContract> = {findEl(root, selector) {return root.querySelectorAll(selector);}};
const assignedDom: void = runtime.setDomApi({...dom, metadata: 'test'});
const globalDom: void = Marionette.setDomApi({...dom, metadata: 'test'});
runtime.setDomApi({findEl: undefined});
const state: StateApiContract<{value: number}> = {
  subscribe(source, name, callback) {callback(source.value); return () => {};}
};
runtime.setStateApi(state);
Marionette.setStateApi(state);
runtime.setDataApi({models(source: readonly {id: number}[]) {return source;}, metadata: true});
const renderer: Renderer<ViewInstance, string, {title: string}, string> = function(template, data) {
  return template + data.title + this.el.tagName;
};
runtime.setRenderer(renderer);
runtime.setRenderer();
const delegator: EventDelegator = {delegate({rootEl, eventName, handler}) {
  const callback = (event: Event) => handler(event);
  rootEl.addEventListener(eventName, callback);
  return () => rootEl.removeEventListener(eventName, callback);
}};
runtime.setEventDelegator(delegator);
Marionette.setEventDelegator(delegator);
// @ts-expect-error Registration requires a callable delegation method with cleanup.
runtime.setEventDelegator({delegate() {return 1;}});
// @ts-expect-error EventDelegator cannot be cleared with undefined.
runtime.setEventDelegator(undefined);
// @ts-expect-error A DOM overlay must preserve the findEl method shape.
runtime.setDomApi({findEl: 'query'});
// @ts-expect-error State registration must return subscription cleanup.
runtime.setStateApi({subscribe() {return false;}});
// @ts-expect-error Renderer registration expects a callable renderer.
runtime.setRenderer('renderer');
// @ts-expect-error Global registration does not promise a class or facade receiver return.
const fluentRuntime: typeof runtime = runtime.setDomApi(dom);
const provider = new runtime.MnObject().State;
if (provider.subscribe) {
  // @ts-expect-error A present mutable provider still does not correlate a current source.
  provider.subscribe({value: 1}, 'change', () => {});
}
for (const ignored of [undefined,null,false,true,0,1,0n,1n,'','ignored',Symbol()] as const) {
  runtime.setDomApi(ignored);
  runtime.setDataApi(ignored);
  runtime.setStateApi(ignored);
}
// An explicitly configured base can name its canonical class/query contract through the root.
const NativeView = runtime.View as ViewConstructor<{}, [options?: {el?: Element}], unknown, {}, NodeListOf<Element>>;
const first: Element | null = new NativeView().$('button').item(0);

const fragment: DocumentFragment = runtime.DomApi.createBuffer();
const nativeMatches: NodeListOf<Element> = runtime.DomApi.findEl(fragment, 'button');
const model = {id: 'example'};
const nativeModel: typeof model = runtime.DataApi.serialize(model);
const nativeModels: readonly [typeof model] = runtime.DataApi.models([model] as const);
class NativeViewClass extends runtime.View {
  render() {return super.render();}
}
const nativeView: NativeViewClass = new NativeViewClass({el: document.createElement('main')}).render();
