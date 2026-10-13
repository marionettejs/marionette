/* global describe, it, cy, expect */
import { ProfileForm } from '../../fixtures.js';

describe('Marionette form through a supported component harness', () => {
  it('destroys the preceding View when mounting twice in one test', () => {
    let first;
    cy.mountMarionette(() => new ProfileForm()).then(mounted => { first = mounted; });
    cy.mountMarionette(() => new ProfileForm()).then(mounted => {
      expect(first.view.isDestroyed()).to.equal(true);
      expect(first.region.isDestroyed()).to.equal(true);
      expect(mounted.view.isAttached()).to.equal(true);
      expect(mounted.container.matches('[data-cy-root]')).to.equal(true);
      expect(first.container).to.equal(mounted.container);
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
  it('exposes instances and cleans the preceding mount', () => {
    cy.mountMarionette(() => new ProfileForm()).then(mounted => {
      expect(mounted.view.isAttached()).to.equal(true);
      expect(mounted.region.currentView).to.equal(mounted.view);
      expect(mounted.container.querySelectorAll('form')).to.have.length(1);
    });
  });
});
