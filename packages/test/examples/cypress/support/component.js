/* global afterEach, Cypress */
import { getContainerEl, setupHooks } from '@cypress/mount-utils';
import { mountView } from '@mnjs/test';

let mounted;
afterEach(() => {
  const previous = mounted;
  mounted = undefined;
  return previous?.cleanup();
});

// Cypress owns the container; the helper owns the View, Region and appended slot.
Cypress.Commands.add('mountMarionette', createView => {
  if (mounted) { throw new Error('Call mountMarionette only once per test; use the returned Region to replace its View.'); }
  mounted = mountView(createView(), { container: getContainerEl() });
  return mounted;
});

// Component-test command restrictions; the single afterEach above owns disposal.
setupHooks();
