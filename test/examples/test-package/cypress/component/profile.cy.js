/* global describe, it, cy, expect */
import { ProfileForm } from '../../fixtures.js';

describe('Marionette form through a supported component harness', () => {
  it('owns one native mount and supports deliberate Region replacement', () => {
    cy.mountMarionette(() => new ProfileForm()).then(mounted => {
      expect(mounted.view.isAttached()).to.equal(true);
      expect(mounted.container.matches('[data-cy-root]')).to.equal(true);
      const next = new ProfileForm();
      mounted.region.show(next);
      expect(mounted.view.isDestroyed()).to.equal(true);
      expect(mounted.region.isDestroyed()).to.equal(false);
      expect(mounted.region.currentView).to.equal(next);
      expect(next.isAttached()).to.equal(true);
      expect(mounted.container.childElementCount).to.equal(1);
      expect(mounted.container.querySelectorAll('form')).to.have.length(1);
    });
  });
  it('validates and saves through real DOM interaction', () => {
    cy.mountMarionette(() => new ProfileForm());
    cy.contains('button', 'Save profile').click();
    cy.get('[role=alert]').should('contain.text', 'Enter a name');
    cy.get('input[name=name]').type('Ada');
    cy.get('input[name=email]').type('ada@example.test');
    cy.contains('button', 'Save profile').click();
    cy.get('[role=status]').should('have.text', 'Profile saved.');
  });
});
