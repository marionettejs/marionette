import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bridgeConsumerFixtureTransition } from '../../scripts/performance/bridge-consumer-fixture-transition.mjs';

const fromRevision = 'cbb5cf51f81b78c74238111372eb9b7148b081b3b0d30a91baf0ef613724b134';
const toRevision = '3bfbbe21dbbec92e38439bc94df54c58c68c5c39ac554f961179e3b0f1c33f58';
const relocations = {
  runtimeArtifacts: [
    { from: 'dist/backbone.cjs', to: 'packages/adapters/dist/backbone.cjs' },
    { from: 'dist/backbone.js', to: 'packages/adapters/dist/backbone.js' },
    { from: 'dist/jquery-dom-api.cjs', to: 'packages/adapters/dist/dom/jquery.cjs' },
    { from: 'dist/jquery-dom-api.js', to: 'packages/adapters/dist/dom/jquery.js' },
  ],
  productionGraphs: [
    { from: './backbone', to: '@marionette/adapters/backbone' },
    { from: './jquery-dom-api', to: '@marionette/adapters/dom/jquery' },
  ],
};

function report(fixtureRevision) {
  return {
    consumerBundles: {
      status: 'reporting',
      fixtureVersion: 'v1',
      fixtureRevision,
      compression: { algorithm: 'brotli', quality: 11 },
      toolchain: { rollup: '4.63.0' },
      peerExternalImports: ['backbone', 'jquery'],
      artifacts: [{ id: 'root-only:esm' }],
      violations: [],
    },
  };
}

describe('consumer fixture relocation transition', () => {
  test('bridges only the audited adapter relocation for exact-base comparison', () => {
    const base = report(fromRevision);
    const current = report(toRevision);
    const bridged = bridgeConsumerFixtureTransition(base, current, { relocations });

    assert.equal(bridged.consumerBundles.fixtureRevision, fromRevision);
    assert.equal(current.consumerBundles.fixtureRevision, toRevision);
  });

  test('fails closed for any report or relocation drift', () => {
    const base = report(fromRevision);
    const current = report(toRevision);

    current.consumerBundles.artifacts.push({ id: 'unexpected:esm' });
    assert.throws(
      () => bridgeConsumerFixtureTransition(base, current, { relocations }),
      /does not match the audited adapter relocation/
    );
  });
});
