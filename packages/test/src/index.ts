import { Region } from 'marionette';
import type { ApplicationInstance, ApplicationStartOptions, RegionConstructor, RegionInstance,
  ShowOptions, SupportedView } from 'marionette';
import { createTestScope } from './scope.ts';
export { createTestScope } from './scope.ts';
export type { Cleanup, Cleanable, TestScope } from './scope.ts';

export interface MountOptions {
  /** Existing host is borrowed. Only the newly appended slot is removed. */
  container?: Element;
  /** Defaults to the chosen document's body. null creates a detached host. */
  attachTo?: Element | null;
  document?: Document;
  /** Use the matching runtime's Region for isolated Marionette instances. */
  regionClass?: RegionConstructor;
}

export interface MountedRegion {
  container: Element;
  slot: HTMLElement;
  region: RegionInstance;
  /** Current root, including a replacement shown through the Region. */
  readonly el: Element | undefined;
  cleanup(): Promise<void>;
}

export interface ViewMountOptions extends MountOptions {
  showOptions?: ShowOptions;
}
export interface MountedView<View extends SupportedView> extends MountedRegion {
  view: View;
}

export interface ApplicationMountOptions extends MountOptions {
  startOptions?: Omit<ApplicationStartOptions, 'region'> & { region?: never };
}
export interface MountedApplication<App> extends MountedRegion {
  app: App;
  /** Initial start only: true means started, false means cancelled; failure rejects. */
  ready: Promise<boolean>;
}

function mountRegion(options: MountOptions) {
  const doc = options.container?.ownerDocument ?? options.attachTo?.ownerDocument ?? options.document ?? document;
  const container = options.container ?? doc.createElement('div');
  const slot = doc.createElement('div');
  container.appendChild(slot);
  if (!options.container) { (options.attachTo === undefined ? doc.body : options.attachTo)?.appendChild(container); }
  const RegionClass = options.regionClass ?? Region;
  const region = new RegionClass({ el: slot });
  const scope = createTestScope();
  scope.defer(() => {
    slot.remove();
    if (!options.container) { container.remove(); }
  });
  const mounted: MountedRegion = {
    container,
    slot,
    region,
    get el() { return region.currentView?.el; },
    cleanup: scope.cleanup
  };
  return { mounted, scope };
}

// Supplying a View transfers ownership to the new Region, just like Region.show.
export function mountView<View extends SupportedView>(view: View, options: ViewMountOptions = {}): MountedView<View> {
  const { mounted, scope } = mountRegion(options);
  scope.defer(() => { mounted.region.destroy(); });
  mounted.region.show(view, options.showOptions);
  return Object.assign(mounted, { view });
}

// A factory gives this mount ownership of a fresh, unstarted Application.
export function mountApplication<App extends ApplicationInstance<object, unknown>>(
  createApplication: (region: RegionInstance) => App, options: ApplicationMountOptions = {}
): MountedApplication<App> {
  const { mounted, scope } = mountRegion(options);
  const app = createApplication(mounted.region);
  // These are dependent teardown steps: a core failure aborts this group.
  scope.defer(() => { app.destroy(); mounted.region.destroy(); });
  const ready = app.start({ ...options.startOptions, region: mounted.region });
  return Object.assign(mounted, { app, ready });
}
