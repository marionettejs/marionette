/* global it, cy, expect */
import { View } from 'marionette';

// This body succeeds. The adapter's automatic afterEach awaits the failing disposer.
it('reports automatic afterEach cleanup failure', () => {
  cy.mount(scope => {
    const view = new View({ template: () => '<p>Owned by the hook</p>' });
    scope.defer(() => {
      expect(view.isDestroyed()).to.equal(true);
      throw new Error('mnjs-automatic-afterEach-cleanup-probe');
    });
    return view;
  });
  cy.get('p').should('have.text', 'Owned by the hook');
});

it('is skipped by Cypress after the automatic hook failure', () => {
  throw new Error('Cypress must skip this test after the failed afterEach hook');
});
