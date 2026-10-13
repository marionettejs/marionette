/* global afterEach, Cypress, cy */
import { getContainerEl, setupHooks } from '@cypress/mount-utils';
import { mountView } from '@mnjs/test';

let mounted;
async function cleanup() {
  await mounted?.cleanup();
  mounted = undefined;
}

Cypress.on('run:start', () => {
  if (Cypress.testingType !== 'component') { return; }
  Cypress.on('test:before:run:async', async() => {
    await cleanup();
    getContainerEl().replaceChildren();
  });
});
afterEach(cleanup);

// Cypress owns the container; the helper owns the View, Region and appended slot.
Cypress.Commands.add('mountMarionette', createView => cy.then(async() => {
  await cleanup();
  mounted = mountView(createView(), { container: getContainerEl() });
  return mounted;
}));

// setupHooks' callback is synchronous; async disposal stays in the awaited hooks.
setupHooks();
