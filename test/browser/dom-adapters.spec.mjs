import assert from 'node:assert/strict';
import { request } from 'node:http';
import { test } from './fixtures.mjs';

const contracts = [
  'morphdom: composes with a preselected jQuery DomApi',
  'morphdom: replaces initial contents, preserves root and survivor, and commits synchronously',
  'morphdom: destroys Region children before parent rendering',
  'morphdom: preserves its root through detach/reattach and destroy',
  'lit-html: composes with a preselected jQuery DomApi',
  'lit-html: replaces initial contents, preserves root and survivor, and commits synchronously',
  'lit-html: destroys Region children before parent rendering',
  'lit-html: preserves its root through detach/reattach and destroy',
  'lit-html: connects and disconnects directives through Region attachment',
  'lit-html: cleanup runs when a terminal destroy handler throws',
  'lit-html: repeated installation and subclass installation retain public method behavior',
  'lit-html: disconnected elements can be adopted by a new View without stale Lit parts',
  'lit-html: destroy releases subscriptions after the first content render throws',
  'lit-html: a reentrant destroy does not release directives before the outer destroy commits',
  'native: undefined template output renders empty initially and clears previous contents',
  'jquery: undefined template output renders empty initially and clears previous contents',
  'morphdom: undefined template output renders empty initially and clears previous contents',
  'lit-html: undefined template output renders empty initially and clears previous contents',
  'lit-html: View releases subscriptions across detach, reattach, and destruction',
  'lit-html: descendants follow View detach and reattach',
  'lit-html: CollectionView releases subscriptions across detach, reattach, and destruction',
  'lit-html: descendants follow CollectionView detach and reattach',
  'lit-html: a View can adopt contents rendered directly by the DOM adapter',
  'lit-html: monitoring opt-out leaves connection notifications to the application'
];

test('DOM contract registry matches the named browser cases', async({ page }) => {
  const actual = await page.evaluate(async() => {
    const { domAdapterContracts } = await import('/contracts.js');
    return domAdapterContracts.map(({ name }) => name);
  });
  assert.deepEqual(actual, contracts);
});

for (const name of contracts) {
  test(name, async({ page }) => {
    await page.evaluate(async contractName => {
      const { domAdapterContracts } = await import('/contracts.js');
      const contract = domAdapterContracts.find(entry => entry.name === contractName);
      if (!contract) { throw new Error(`Missing DOM adapter contract: ${contractName}`); }
      contract.run();
    }, name);
  });
}

test('asset server rejects paths outside its explicit asset map', async({ candidateServer }) => {
  const { hostname, port } = new URL(candidateServer);
  const status = await new Promise((done, reject) => {
    request({ hostname, port, path: '/lit/../../package.json' }, response => {
      response.resume();
      done(response.statusCode);
    }).on('error', reject).end();
  });
  assert.equal(status, 404);
});
