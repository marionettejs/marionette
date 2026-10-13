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
  readonly container: Element;
  readonly slot: HTMLElement;
  readonly region: RegionInstance;
  /** Current root, including a replacement shown through the Region. */
  readonly el: Element | undefined;
  cleanup(): Promise<void>;
}

export interface ViewMountOptions extends MountOptions {
  showOptions?: ShowOptions;
}
export interface MountedView<View extends SupportedView> extends MountedRegion {
  readonly view: View;
}

export interface ApplicationMountOptions extends MountOptions {
  startOptions?: Omit<ApplicationStartOptions, 'region'> & { region?: never };
}
export interface MountedApplication<App> extends MountedRegion {
  readonly app: App;
  /** Initial start only: true means started, false means cancelled; failure rejects. */
  readonly ready: Promise<boolean>;
}

function mountRegion(options: MountOptions) {
  const { container: suppliedContainer, attachTo, document: suppliedDocument } = options;
  const RegionClass = options.regionClass ?? Region;
  const doc = suppliedContainer?.ownerDocument ?? attachTo?.ownerDocument ?? suppliedDocument ?? document;
  const container = suppliedContainer ?? doc.createElement('div');
  const slot = doc.createElement('div');
  function removeDOM() {
    slot.remove();
    if (!suppliedContainer) { container.remove(); }
  }
  let region: RegionInstance;
  try {
    container.appendChild(slot);
    if (!suppliedContainer) { (attachTo === undefined ? doc.body : attachTo)?.appendChild(container); }
    region = new RegionClass({ el: slot });
  } catch (error) { removeDOM(); throw error; }
  const scope = createTestScope();
  scope.defer(removeDOM);
  const mounted: MountedRegion = {
    container,
    slot,
    region,
    get el() { return region.currentView?.el; },
    cleanup: scope.cleanup
  };
  return { mounted, scope, region, removeDOM };
}

// Supplying a View transfers ownership to the new Region, just like Region.show.
export function mountView<View extends SupportedView>(view: View, options: ViewMountOptions = {}): MountedView<View> {
  const { mounted, scope, region, removeDOM } = mountRegion(options);
  scope.defer(() => { region.destroy(); });
  try { region.show(view, options.showOptions); } catch (error) { removeDOM(); throw error; }
  return Object.assign(mounted, { view });
}

// A factory gives this mount ownership of a fresh, unstarted Application.
export function mountApplication<App extends ApplicationInstance<object, unknown>>(
  createApplication: (region: RegionInstance) => App, options: ApplicationMountOptions = {}
): MountedApplication<App> {
  const { mounted, scope, region, removeDOM } = mountRegion(options);
  try {
    const app = createApplication(region);
    // These are dependent teardown steps: a core failure aborts this group.
    scope.defer(() => { app.destroy(); region.destroy(); });
    const ready = app.start({ ...options.startOptions, region });
    return Object.assign(mounted, { app, ready });
  } catch (error) { removeDOM(); throw error; }
}
