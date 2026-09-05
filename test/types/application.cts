import Application, {type ApplicationInstance, type LifecycleContext} from '../tmp/typed-core/src/modules/application.js';
import View from '../tmp/typed-core/src/modules/view.js';
import Region, {type RegionInstance} from '../tmp/typed-core/src/modules/region.js';
import type {SupportedView} from '../tmp/typed-core/src/modules/common/view.js';

const Child = Application.extend({
  initialize(options: {label: string}) { this.options.label.toUpperCase(); },
  createState() {return {ready: false};},
  async onBeforeStart(application: ApplicationInstance<object, unknown>, options: unknown, context: LifecycleContext) {
    const signal: AbortSignal = context.signal;
    if (signal.aborted) {return;}
    application.isRunning();
    this.getState().ready = true;
  },
  onStart() {this.getState().ready = true;},
  label() {return this.options.label;}
}, {role: 'child'});
const child = new Child({label: 'Editor'});
const ready: boolean = child.getState().ready;
const label: string = child.label();
const staticRole: string = Child.role;
// @ts-expect-error Explicit initializer options are required.
new Child();
// @ts-expect-error The inferred initializer option is a string.
new Child({label: false});
// @ts-expect-error The inferred state does not have an unrelated property.
child.getState().missing;

const root = new Application({region: '#application', channelName: 'application'});
const sameChild: typeof child = root.addChildApp('editor', child);
const children: Record<string, ApplicationInstance<object, unknown>> = root.getChildApps();
const missing: ApplicationInstance<object, unknown> | undefined = root.getChildApp('missing');
const childName: string | undefined = child.getName();
// @ts-expect-error getChildApps returns a name-keyed object, not an array.
const childList: ApplicationInstance[] = root.getChildApps();
// @ts-expect-error A missing child returns undefined.
const requiredChild: ApplicationInstance<object, unknown> = root.getChildApp('missing');
// @ts-expect-error Applications own Applications, not Views.
root.addChildApp('view', new View());

const view = new View();
const sameView: typeof view = root.showView(view, {replaceElement: true});
const maybeView: SupportedView | undefined = root.getView();
const maybeRegion: RegionInstance | undefined = root.getRegion();
// @ts-expect-error The application may have no configured root Region.
const requiredRegion: RegionInstance = root.getRegion();
// @ts-expect-error A root view may not have been shown or may have been emptied.
const requiredView: SupportedView = root.getView();
// @ts-expect-error Showing a root view is synchronous and returns that view.
const asynchronousView: Promise<typeof view> = root.showView(view);

const borrowedRegion = new Region({el: '#borrowed'});
const borrower = new Application({region: borrowedRegion});
const customRegion = Region.extend({replaceElement: true});
new Application({regionClass: customRegion, region: {el: '#custom'}});
const borrowedState = {count: 1};
const stateOwner = new Child({label: 'Borrowed', state: borrowedState});
const count: number = stateOwner.getState().count;
// @ts-expect-error A supplied state replaces the factory state.
stateOwner.getState().ready;

async function lifecycle() {
  const started: boolean = await root.start({source: 'example'});
  const stopped: boolean = await root.stop();
  const restarted: boolean = await root.restart();
  const removed: ApplicationInstance<object, unknown> | undefined = await root.removeChildApp('editor');
  const destroyed: boolean = await root.destroy();
  // @ts-expect-error Application destroy is asynchronous, unlike View and MnObject.
  const synchronous: boolean = root.destroy();
  // @ts-expect-error Application destroy resolves readiness status, not its receiver.
  const returnedApplication: ApplicationInstance = await root.destroy();
}

root.getChannel()?.reply('status', () => root.isRunning());
const channelName: string | undefined = root.getChannel()?.channelName;
root.Radio.channel('shared').on('change', (value: number) => value.toFixed());
// @ts-expect-error Channel access is optional without channelName configuration.
root.getChannel().request('status');

class NativeApplication extends Application {
  async onBeforeStart(application: this, options: unknown, {signal}: LifecycleContext) {
    if (!signal.aborted) {application.isRunning();}
  }
  async start(options?: unknown) { return super.start(options); }
}
const native: Promise<boolean> = new NativeApplication().start();
