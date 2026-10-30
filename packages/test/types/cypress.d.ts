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
export type CypressMount<Mounted> = Mounted & { readonly testScope: TestScope };
/** Register awaited lifecycle hooks in the component support file; no commands are registered. */
export declare function setupCypress(): void;
/** Synchronous during the active test/hooks, before automatic teardown; throws outside that lifetime. */
export declare function testScope(): TestScope;
/** Replace the previous mount after its cleanup finishes. Each factory receives the handle's mount scope. */
export declare function mount<View extends SupportedView>(view: View | ((scope: TestScope, testScope: TestScope) => View), options?: MountOptions): Cypress.Chainable<CypressMount<MountedView<View>>>;
/** Choose startup explicitly. start:true waits for ready and rejects cancelled startup. */
export declare function mountApplication<App extends ApplicationInstance<object, unknown>>(factory: (region: RegionInstance, scope: TestScope, testScope: TestScope) => App, options: AppMountOptions): Cypress.Chainable<CypressMount<MountedApplication<App>>>;
/** Queue and await the current mount's teardown. Test fixtures survive until test teardown. */
export declare function unmount(): Cypress.Chainable<void>;
