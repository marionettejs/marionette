/* global it, cy, expect */
import { View } from 'marionette';

// This body succeeds. The adapter's automatic afterEach awaits the failing disposer.
it('reports automatic afterEach cleanup failure', () => {
  cy.mount(scope => {
    const view = new View({ template: () => '<p>Owned by the hook</p>' });
    scope.defer(() => {
      // Mount-local services dispose before their shell is destroyed.
      expect(view.isDestroyed()).to.equal(false);
      throw new Error('mnjs-automatic-afterEach-cleanup-probe');
    });
    return view;
  });
  cy.get('p').should('have.text', 'Owned by the hook');
});

it('is skipped by Cypress after the automatic hook failure', () => {
  throw new Error('Cypress must skip this test after the failed afterEach hook');
});
