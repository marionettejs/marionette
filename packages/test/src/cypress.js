/* global Cypress, cy, beforeEach, afterEach */
import { getContainerEl, setupHooks } from '@cypress/mount-utils';
import { createMountSession } from './session.ts';
import { withErrorMessages } from './scope.ts';

const session = createMountSession();
let configured = false;

// Explicit support-file setup: imports register neither commands nor test hooks.
export function setupCypress() {
  if (Cypress.testingType !== 'component') { throw new Error('@mnjs/test/cypress requires Cypress component testing.'); }
  if (configured) { return; }
  setupHooks(); // Its callback is not awaited, so cleanup belongs to Mocha hooks.
  beforeEach(() => session.cleanup());
  afterEach(() => session.cleanup());
  configured = true;
}

function runMount(create, options) {
  return cy.then({ log: false }, async() => {
    if (!configured) { throw new Error('Call setupCypress() in the component support file before mounting.'); }
    const mountOptions = { replaceElement: true, ...options, container: getContainerEl() };
    const context = await session.replace(mountOptions);
    try {
      const mounted = create(context, mountOptions);
      if (mounted.ready && options.start && !await mounted.ready) { throw new Error('Mounted Application startup was cancelled.'); }
      if (options.log !== false) {
        Cypress.log({ name: 'mount', message: 'Marionette', consoleProps: () => mounted });
      }
      return mounted;
    } catch (error) {
      // Teardown can interrupt pending readiness without entering the command queue.
      try { await context.cleanup(); } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], withErrorMessages('Mount and cleanup failed.', [error, cleanupError]), { cause: cleanupError });
      }
      throw error;
    }
  });
}

export function mount(view, options = {}) {
  return runMount((context, mountOptions) => context.mountView(typeof view === 'function' ? view(context.scope) : view, mountOptions), options);
}

export function mountApplication(factory, options) {
  if (typeof options?.start !== 'boolean') { throw new Error('mountApplication requires an explicit { start: true } or { start: false }.'); }
  return runMount((context, mountOptions) => context.mountApplication(region => factory(region, context.scope), mountOptions), options);
}

export function unmount() {
  return cy.then({ log: false }, () => session.cleanup());
}
