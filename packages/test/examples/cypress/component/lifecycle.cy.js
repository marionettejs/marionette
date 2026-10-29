/* global describe, it, cy, expect */
import { Application, View } from 'marionette';
import { withQueries } from '@mnjs/test/testing-library';
import { afterMountCleanup } from '../support/cleanup-checks.js';

const Card = View.extend({ template: () => '<h1>Ready</h1>' });
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

describe('Marionette lifecycle in the real Cypress queue', () => {
  it('keeps Testing Library queries live on the Cypress-owned mount', () => {
    cy.mount(() => new Card()).then(original => {
      const mounted = withQueries(original);
      expect(mounted).to.equal(original);
      expect(mounted.getByRole('heading', { name: 'Ready' })).to.equal(mounted.el.firstElementChild);
      const replacement = new View({ template: () => '<h1>Updated</h1>' });
      mounted.region.show(replacement);
      expect(mounted.el).to.equal(replacement.el);
      expect(mounted.queryByRole('heading', { name: 'Ready' })).to.equal(null);
      expect(mounted.getByRole('heading', { name: 'Updated' })).to.equal(replacement.el.firstElementChild);
      afterMountCleanup(() => {
        expect(mounted.region.isDestroyed()).to.equal(true);
        expect(mounted.queryByRole('heading')).to.equal(null);
      });
    });
  });

  it('awaits readiness and asynchronous after-test resource cleanup', () => {
    let released = false;
    const Feature = Application.extend({
      async prepareStart() { await delay(30); },
      onStart() { this.showView(new Card()); }
    });
    cy.mountApplication((region, scope) => {
      scope.defer(async() => { await delay(20); released = true; });
      const app = new Feature({ region });
      afterMountCleanup(() => {
        expect(app.isDestroyed()).to.equal(true);
        expect(released).to.equal(true);
      });
      return app;
    }, { start: true }).then(async mounted => {
      expect(await mounted.ready).to.equal(true);
      expect(mounted.app.isRunning()).to.equal(true);
      expect(mounted.el.parentElement).to.equal(mounted.container);
    });
    cy.get('h1').should('have.text', 'Ready');
  });

  it('leaves startup to the caller when start is false', () => {
    const Feature = Application.extend({ onStart() { this.showView(new Card()); } });
    cy.mountApplication(region => new Feature({ region }), { start: false }).then(async mounted => {
      expect(await mounted.ready).to.equal(false);
      expect(mounted.app.isRunning()).to.equal(false);
      await mounted.app.start();
      expect(mounted.app.isRunning()).to.equal(true);
    });
    cy.get('h1').should('have.text', 'Ready');
  });

  it('waits for replacement cleanup before constructing the next View', () => {
    let released = false;
    let previous;
    cy.mount(scope => {
      scope.defer(async() => { await delay(20); released = true; });
      return new Card();
    }).then(mounted => { previous = mounted; });
    cy.mount(() => {
      expect(released).to.equal(true);
      expect(previous.view.isDestroyed()).to.equal(true);
      return new Card();
    });
    cy.get('h1').should('have.length', 1);
  });

  it('honors a raised command timeout for slow readiness', { defaultCommandTimeout: 8000 }, () => {
    const Feature = Application.extend({
      async prepareStart() { await delay(4200); },
      onStart() { this.showView(new Card()); }
    });
    cy.mountApplication(region => new Feature({ region }), { start: true });
    cy.get('h1').should('have.text', 'Ready');
  });
});
