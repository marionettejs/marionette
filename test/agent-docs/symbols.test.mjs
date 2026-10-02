import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { generateInventory } from '../../scripts/api-contracts/inventory.mjs';
import { documentSections, isConsumerPage } from '../../scripts/docs/sections.mjs';
import { symbolIndex } from '../../scripts/docs/symbols.mjs';
import { findSymbols, validateSymbolIndex } from '../../skills/marionette/scripts/symbols.mjs';

const root = resolve(import.meta.dirname, '../..');
const readJson = file => JSON.parse(readFileSync(resolve(root, file), 'utf8'));

test('reviewed property, grouped, inherited and provider routes lead to their authoritative sections', () => {
  const semantics = readJson('config/api-contracts/semantics.json');
  const inventory = generateInventory(root, semantics);
  const files = new Map(readJson('docs-site/navigation.json').filter(isConsumerPage)
    .map(page => [page.source, { content: readFileSync(resolve(root, page.source)) }]));
  const sections = [...files].flatMap(([source, file]) => documentSections(source, file.content.toString('utf8')));
  const index = symbolIndex(inventory, semantics, sections);
  validateSymbolIndex(index, new Set(sections.map(section => section.id)));
  for (const [query, location] of [
    ['View.modelEvents', 'docs/api/shared/view-bindings.md#data-bindings'],
    ['Application.viewEvents', 'docs/api/application.md#view-events'],
    ['View.getUI', 'docs/api/shared/view-bindings.md#ui-bindings'],
    ['Behavior.getUI', 'docs/api/behavior.md#dom-interaction-and-ui'],
    ['View.ui', 'docs/api/shared/view-bindings.md#ui-bindings'],
    ['View.regions', 'docs/api/view.md#named-regions'],
    ['CollectionView.setComparator', 'docs/api/collection-view.md#sorting'],
    ['CollectionView.setFilter', 'docs/api/collection-view.md#filtering'],
    ['Application.getView', 'docs/api/application.md#root-view-and-region'],
    ['Application.isRunning', 'docs/api/application.md#lifecycle-methods-and-results'],
    ['Application.isDestroyed', 'docs/api/application.md#lifecycle-methods-and-results'],
    ['Application.restart', 'docs/api/application.md#lifecycle-methods-and-results'],
    ['ViewInstance.getUI', 'docs/api/shared/view-bindings.md#ui-bindings'],
    ['DataApiContract.subscribe', 'docs/api/providers/data.md#dataapi'],
    ['EventDelegator.delegate', 'docs/api/providers/dom.md#eventdelegator'],
  ]) {
    const result = findSymbols(index, sections, files, query);
    const match = result.matches[0];
    assert.equal(match.primarySections[0], location, query);
    assert(match.primarySections.every(id => typeof id === 'string'), 'primary routes use section IDs without expanding metadata');
    assert(!match.sections.some(section => section.id === location), 'mentions must not repeat authored primary sections');
    assert(Object.values(result.contracts).some(contract => contract.sections.includes(location)));
    const [name, member] = query.split('.');
    const entry = inventory.entrypoints.flatMap(value => value.exports).find(value => value.name === name);
    assert.equal(match.signature, (entry.instance || entry.members)[member], query);
    for (const id of match.contracts) {
      assert.deepEqual(result.contracts[id], index.contracts[id], 'all contract references and diagnostics survive lookup');
    }
  }
  const routed = findSymbols(index, sections, files, 'View.modelEvents');
  assert(routed.matches[0].contracts.includes('view'));
  assert(routed.matches[0].contracts.includes('sync-failure-boundary'));
  assert(routed.contracts.view.sections.includes('docs/api/view.md#rendering-and-status'));
  const unclassified = findSymbols(index, sections, files, 'View.cid').matches[0];
  assert.deepEqual(unclassified.primarySections, [], 'broad references must not claim a precise reviewed route');
  assert(unclassified.contracts.length > 0, 'general guidance remains accessible for unclassified members');
  assert.deepEqual(findSymbols(index, sections, files, 'View.unknownProperty').matches, []);
  const view = index.symbols.find(value => value.name === 'View');
  assert(view.contracts.includes('view') && view.contracts.includes('sync-failure-boundary'));
  assert(index.contracts.view.sections.includes('docs/api/view.md#rendering-and-status'), 'complete export evidence remains indexed');
});

test('property declaration mentions exclude event fragments and Markdown link text', () => {
  const source = 'docs/declarations.md';
  const content = '# Declarations\n\n## Links\n[`viewEvents:`](#declaration)\n\n## Events\n`before:destroy`, `render:children`, `change:name`.\n\n## Declaration\n`viewEvents: { submit: "save" }`\n\n## Before\n`before:destroy`\n';
  const files = new Map([[source, { content: Buffer.from(content) }]]);
  const sections = documentSections(source, content);
  const properties = Object.fromEntries(['viewEvents', 'destroy', 'render', 'children', 'change', 'name']
    .map(name => [name, { signature: 'unknown', contracts: ['declarations'], primarySections: [] }]));
  const index = { schemaVersion: 2, contracts: { declarations: { sections: [sections[0].id], diagnostics: [] } },
    symbols: [{ entrypoint: 'marionette', name: 'Owner', kind: 'value', signature: 'Owner',
      contracts: ['declarations'], instance: properties }] };
  assert.deepEqual(findSymbols(index, sections, files, 'Owner.viewEvents').matches[0].sections.map(value => value.heading),
    ['Declaration']);
  for (const member of ['destroy', 'render', 'children', 'change', 'name']) {
    assert.deepEqual(findSymbols(index, sections, files, `Owner.${member}`).matches[0].sections, [], member);
  }
});

test('symbol schema rejects missing, unknown and unrelated primary section metadata', () => {
  const index = { schemaVersion: 2, contracts: { owner: { sections: ['docs/owner.md#owner'], diagnostics: [] } },
    symbols: [{ entrypoint: 'marionette', name: 'Owner', kind: 'value', signature: 'Owner', contracts: ['owner'],
      instance: { property: { signature: 'string', contracts: ['owner'], primarySections: [] } } }] };
  const sections = new Set(['docs/owner.md#owner', 'docs/owner.md#unrelated']);
  assert.doesNotThrow(() => validateSymbolIndex(index, sections));
  assert.throws(() => validateSymbolIndex({ ...index, schemaVersion: 1 }, sections),
    /Unsupported documentation symbol index/);
  for (const value of [undefined, 'docs/owner.md#owner', ['docs/owner.md#missing'], ['docs/owner.md#unrelated']]) {
    index.symbols[0].instance.property.primarySections = value;
    assert.throws(() => validateSymbolIndex(index, sections), /Invalid documentation symbol index/);
  }
});
