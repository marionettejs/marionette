import { Region } from 'marionette';
import type { ApplicationInstance, ApplicationStartOptions, RegionConstructor, RegionInstance,
  ShowOptions, SupportedView } from 'marionette';
import { createOwner } from './owner.ts';
import { MountError } from './errors.ts';
import type { TestScope } from './scope.ts';
export { createTestScope } from './scope.ts';
export { MountError } from './errors.ts';
export type { Cleanup, Cleanable, Destroyable, ReplyChannel, ReplyRadio, TestScope } from './scope.ts';

export interface MountOptions {
  /** Existing host is borrowed. Only the newly appended slot is removed. */
  container?: Element;
  /** Defaults to the chosen document's body. null creates a detached host. */
  attachTo?: Element | null;
  document?: Document;
  /** Replace the slot with each View root; useful for direct-child layout. */
  replaceElement?: boolean;
  /** Use the matching runtime's Region for isolated Marionette instances. */
  regionClass?: RegionConstructor;
}

export interface MountedRegion {
  /** Mount-local resources finish before the Region/Application and helper DOM. */
  readonly scope: TestScope;
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
  /** Defaults to true. false leaves startup to the caller and resolves ready false. */
  start?: boolean;
  startOptions?: Omit<ApplicationStartOptions, 'region'> & { region?: never };
}
export interface MountedApplication<App> extends MountedRegion {
  readonly app: App;
  /** Initial start only: true means started, false means skipped/cancelled; failure rejects. */
  readonly ready: Promise<boolean>;
}

function createRegionMount(options: MountOptions) {
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
    region = new RegionClass({ el: slot, ...(options.replaceElement === undefined ? {} : { replaceElement: options.replaceElement }) });
  } catch (error) {
    // A throwing constructor has not returned an object whose lifecycle we own.
    removeDOM();
    throw error;
  }
  let begin: (() => void) | undefined;
  let release = () => { region.destroy(); };
  const scope = createOwner(() => begin?.());
  scope.defer(removeDOM);
  // Keep dependent core teardown in one callback: a core failure must not retry it.
  scope.defer(() => release());
  const mounted: MountedRegion = {
    scope, container, slot, region,
    get el() { return region.currentView?.el; },
    cleanup: scope.cleanup
  };
  return {
    mounted,
    setLifecycle(dispose: () => void, cancel?: () => void) { release = dispose; begin = cancel; }
  };
}

/**
 * Own a fresh Region, every View it adopts, and the helper-created fixture DOM.
 * @param {MountOptions} options Fixture placement and Region configuration.
 * @returns {MountedRegion} The owned Region handle and its complete cleanup.
 */
export function mountRegion(options: MountOptions = {}): MountedRegion {
  return createRegionMount(options).mounted;
}

export type ViewFactory<View extends SupportedView> = (scope: TestScope) => View;

// Ownership of a caller View transfers after successful show; a factory's View
// is owned when this Region adopts it. Never destroy a foreign owner's View.
export function mountView<View extends SupportedView>(view: View | ViewFactory<View>, options: ViewMountOptions = {}): MountedView<View> {
  const owner = createRegionMount(options);
  const mounted = owner.mounted;
  const region = mounted.region;
  let resolved: View | undefined;
  try {
    resolved = typeof view === 'function' ? view(mounted.scope) : view;
    region.show(resolved, options.showOptions);
    return Object.assign(mounted, { view: resolved });
  } catch (error) {
    if (typeof view !== 'function' && region.currentView === resolved) {
      // Relinquish an adopted caller View through the public ownership operation.
      // If detachment itself fails, report it; do not blindly destroy that View.
      owner.setLifecycle(() => { region.detachView(); region.destroy(); });
    }
    throw new MountError(error, mounted.cleanup());
  }
}

// A factory returns a fully constructed, fresh Application and transfers ownership.
export function mountApplication<App extends ApplicationInstance<object, unknown>>(
  createApplication: (region: RegionInstance, scope: TestScope) => App, options: ApplicationMountOptions = {}
): MountedApplication<App> {
  const owner = createRegionMount(options);
  const mounted = owner.mounted;
  const region = mounted.region;
  try {
    const app = createApplication(region, mounted.scope);
    let preparing = options.start !== false;
    let interrupted = false;
    owner.setLifecycle(() => {
      if (interrupted) { return; }
      app.destroy();
      region.destroy();
    }, () => {
      if (preparing && !app.isRunning()) {
        // stop() also releases prepared UI. This is the documented pending-start
        // exception to service-before-shell cleanup, not a cancellation-only API.
        try { app.stop(); } catch (error) { interrupted = true; throw error; }
      }
    });
    const ready = options.start === false ? Promise.resolve(false) : app.start({ ...options.startOptions, region });
    ready.then(() => { preparing = false; }, () => { preparing = false; });
    return Object.assign(mounted, { app, ready });
  } catch (error) {
    // A factory that throws before returning owns its unknown partial Application;
    // this owner can still release its known Region and registered resources.
    throw new MountError(error, mounted.cleanup());
  }
}
