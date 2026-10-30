/* global before, beforeEach, after, it, cy, expect */
import { View } from 'marionette';
import { createRadio } from '@mnjs/radio';
import { testScope, unmount } from '@mnjs/test/cypress';
import { afterMountCleanup } from '../support/cleanup-checks.js';

let fixtureReleased = false;
const radio = createRadio();
let hookFixtures;

before(() => { expect(() => testScope()).to.throw('active component test'); });
beforeEach(() => {
  hookFixtures = testScope();
  hookFixtures.reply(radio, 'fixture', 'from-before-each', 'ready');
});
after(() => { expect(() => testScope()).to.throw('active component test'); });

it('keeps test fixtures across remounts and closes services before their shell', () => {
  const fixtures = testScope();
  expect(fixtures).to.equal(hookFixtures);
  let local;
  let first;
  const events = [];
  const Shell = View.extend({
    template: () => '<p>Shell</p>',
    onDestroy() { events.push('shell'); }
  });
  fixtures.reply(radio, 'fixture', 'value', 'test');
  fixtures.defer(() => { fixtureReleased = true; });
  afterMountCleanup(() => {
    expect(fixtureReleased).to.equal(true);
    expect(radio.request('fixture', 'value')).to.equal(undefined);
    expect(radio.request('fixture', 'from-before-each')).to.equal(undefined);
  });
  cy.mount((scope, testFixtures) => {
    local = scope;
    expect(testFixtures).to.equal(fixtures);
    return new Shell();
  }).then(mounted => {
    first = mounted;
    expect(mounted.scope).to.equal(local);
    expect(mounted.testScope).to.equal(fixtures);
    mounted.scope.defer(async() => {
      expect(mounted.view.isDestroyed()).to.equal(false);
      await Promise.resolve();
      events.push('service');
    });
  });
  cy.mount(() => new View({ template: () => '<p>Replacement</p>' })).then(() => {
    expect(first.view.isDestroyed()).to.equal(true);
    expect(events).to.deep.equal(['service', 'shell']);
    expect(fixtureReleased).to.equal(false);
    expect(radio.request('fixture', 'value')).to.equal('test');
  });
  unmount().then(() => {
    expect(radio.request('fixture', 'from-before-each')).to.equal('ready');
    expect(radio.request('fixture', 'value')).to.equal('test');
    expect(fixtureReleased).to.equal(false);
  });
});

it('starts the next test with fresh fixture ownership', () => {
  expect(fixtureReleased).to.equal(true);
  expect(radio.request('fixture', 'value')).to.equal(undefined);
  const scope = testScope();
  scope.reply(radio.channel('fixture'), 'value', 'next');
  expect(radio.request('fixture', 'value')).to.equal('next');
});
