/* global Cypress, cy, beforeEach, afterEach */
import { getContainerEl, setupHooks } from '@cypress/mount-utils';
import { createMountSession } from './session.ts';
import { isMountError, withErrorMessages } from './errors.ts';
import { createTestScope } from './scope.ts';

const session = createMountSession();
let configured = false;
let activeTest = false;
let fixtures;
let testCompletion;

function currentTestScope() {
  if (!configured) { throw new Error('Call setupCypress() in the component support file before using testScope().'); }
  if (!activeTest) { throw new Error('testScope() requires an active component test or per-test hook before automatic teardown begins.'); }
  return fixtures;
}

function cleanupTest() {
  activeTest = false;
  if (!testCompletion) {
    const pending = Promise.withResolvers();
    testCompletion = pending.promise;
    const ownedFixtures = fixtures;
    // Start cancellation synchronously; fixtures outlive every mount in the test.
    const mountCleanup = session.cleanup();
    (async() => {
      const errors = [];
      try { await mountCleanup; } catch (error) { errors.push(error); }
      try { await ownedFixtures?.cleanup(); } catch (error) { errors.push(error); }
      if (errors.length === 1) { throw errors[0]; }
      if (errors.length) { throw new AggregateError(errors, withErrorMessages('Test mounts and fixtures failed to clean up.', errors)); }
    })().then(pending.resolve, pending.reject);
  }
  return testCompletion;
}

// Explicit support-file setup: imports register neither commands nor test hooks.
export function setupCypress() {
  if (Cypress.testingType !== 'component') { throw new Error('@mnjs/test/cypress requires Cypress component testing.'); }
  if (configured) { return; }
  setupHooks(); // Container restrictions only; owned cleanup belongs to Mocha hooks.
  beforeEach(async() => {
    await cleanupTest();
    fixtures = createTestScope();
    testCompletion = undefined;
    activeTest = true;
  });
  afterEach(cleanupTest);
  configured = true;
}

function runMount(create, options) {
  return cy.then({ log: false }, async() => {
    if (!configured) { throw new Error('Call setupCypress() in the component support file before mounting.'); }
    const ownedFixtures = currentTestScope();
    const mountOptions = { replaceElement: true, ...options, container: getContainerEl() };
    const context = await session.replace(mountOptions);
    try {
      const mounted = create(context, mountOptions, ownedFixtures);
      Object.assign(mounted, { testScope: ownedFixtures });
      if (mounted.ready && options.start && !await mounted.ready) { throw new Error('Mounted Application startup was cancelled.'); }
      if (options.log !== false) {
        Cypress.log({ name: 'mount', message: 'Marionette', consoleProps: () => mounted });
      }
      return mounted;
    } catch (cause) {
      let error = cause;
      if (isMountError(error)) {
        try { await error.cleanup; error = error.cause; } catch (failure) { error = failure; }
      }
      // Teardown can interrupt pending readiness without entering the command queue.
      try { await context.cleanup(); } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], withErrorMessages('Mount and cleanup failed.', [error, cleanupError]), { cause: cleanupError });
      }
      throw error;
    }
  });
}

export function mount(view, options = {}) {
  return runMount((context, mountOptions, ownedFixtures) => context.mountView(typeof view === 'function' ? scope => view(scope, ownedFixtures) : view, mountOptions), options);
}

export function mountApplication(factory, options) {
  if (typeof options?.start !== 'boolean') { throw new Error('mountApplication requires an explicit { start: true } or { start: false }.'); }
  return runMount((context, mountOptions, ownedFixtures) => context.mountApplication((region, scope) => factory(region, scope, ownedFixtures), mountOptions), options);
}

export function unmount() {
  return cy.then({ log: false }, () => session.cleanup());
}

// Fixtures survive remounts and are available synchronously during the active test.
export function testScope() {
  return currentTestScope();
}
