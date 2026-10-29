/// <reference types="cypress" />
import type { ApplicationInstance, RegionInstance, SupportedView } from 'marionette';
import type { ApplicationMountOptions, MountedApplication, MountedView, TestScope, ViewMountOptions } from './index.js';

export interface MountOptions extends Omit<ViewMountOptions, 'container' | 'attachTo' | 'document'> {
  log?: boolean;
}
export interface AppMountOptions extends Omit<ApplicationMountOptions, 'container' | 'attachTo' | 'document' | 'start'> {
  start: boolean;
  log?: boolean;
}
/** Register awaited lifecycle hooks in the component support file; no commands are registered. */
export declare function setupCypress(): void;
/** Replace the previous mount after its cleanup finishes. The factory runs inside the Cypress queue. */
export declare function mount<View extends SupportedView>(view: View | ((scope: TestScope) => View), options?: MountOptions): Cypress.Chainable<MountedView<View>>;
/** Choose startup explicitly. start:true waits for ready and rejects cancelled startup. */
export declare function mountApplication<App extends ApplicationInstance<object, unknown>>(factory: (region: RegionInstance, scope: TestScope) => App, options: AppMountOptions): Cypress.Chainable<MountedApplication<App>>;
/** Queue and await teardown of the current mount and project resources. */
export declare function unmount(): Cypress.Chainable<void>;
