/* global Cypress, it, cy, expect */
import { Application, View } from 'marionette';
import { unmount } from '@mnjs/test/cypress';
import { afterMountCleanup } from '../support/cleanup-checks.js';

const probe = Cypress.expose('mnjsProbe');
let cleaned = false;
let observedCleanup = false;

// These deliberately fail under real Cypress. The external smoke driver checks
// the exact error and requires the next test to pass after awaited teardown.
it(`reports the ${probe} command failure`, { defaultCommandTimeout: probe === 'timeout' ? 150 : 4000 }, () => {
  if (probe === 'cleanup') {
    let attempts = 0;
    cy.mount(scope => {
      const view = new View({ template: () => '<p>Owned</p>' });
      scope.defer(() => { attempts++; cleaned = true; throw new Error('mnjs-cleanup-probe'); });
      afterMountCleanup(() => {
        expect(view.isDestroyed()).to.equal(true);
        expect(attempts).to.equal(1);
        observedCleanup = true;
      });
      return view;
    });
    unmount();
    return;
  }
  let app;
  let signal;
  const Feature = Application.extend({ prepareStart(options, context) {
    signal = context.signal;
    if (probe === 'startup') { throw new Error('mnjs-startup-probe'); }
    if (probe === 'cancellation') { setTimeout(() => app.stop(), 20); }
    return new Promise(() => {});
  } });
  cy.mountApplication((region, scope) => {
    app = new Feature({ region });
    scope.defer(async() => { await Promise.resolve(); cleaned = true; });
    afterMountCleanup(() => {
      expect(app.isDestroyed()).to.equal(true);
      expect(cleaned).to.equal(true);
      if (probe !== 'startup') { expect(signal.aborted).to.equal(true); }
      observedCleanup = true;
    });
    return app;
  }, { start: true });
});

it('starts a fresh test after the failure and awaited cleanup', () => {
  expect(cleaned).to.equal(true);
  expect(observedCleanup).to.equal(true);
  cy.get('[data-cy-root]').should('be.empty');
  cy.mount(() => new View({ template: () => '<p>Fresh</p>' }));
  cy.get('p').should('have.text', 'Fresh');
});
