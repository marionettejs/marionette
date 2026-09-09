// Consumer prose is rendered from reviewed semantic profiles, never inferred
// from method names or maintained as a second handwritten API table.
export function generateReference(inventory, semantics) {
  const contracts = new Map(semantics.contracts.map(contract => [contract.id, contract]));
  const profile = id => {
    const value = contracts.get(id);
    if (!value) { throw new Error(`Missing compact reference contract: ${id}`); }
    return value;
  };
  const cell = value => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
  const guide = id => {
    const { file, heading } = profile(id).docs[0];
    const path = file.startsWith('docs/') ? `./${file.slice(5)}` : `../${file}`;
    return `[${heading}](${path})`;
  };
  const sections = [
    '# Compact framework reference',
    'Generated from the reviewed public contract inventory by `npm run check:api-contracts -- --write`. Read this with the documentation shipped by the installed package. Source-only additions may be absent from the published beta. The linked guides own complete examples and argument details.',
    '## Choose an owner',
    'Use plain functions or classes when you do not need Marionette lifecycle, events, or ownership. MnObject is an optional evented, destroyable convenience; Application adds an active asynchronous lifecycle. Application is never a Region-renderable object.',
    '| Owner | Ownership | Guide |\n| --- | --- | --- |\n' + [
      ['MnObject', 'object'], ['View', 'view'], ['Region', 'region'],
      ['CollectionView', 'collection-view'], ['Behavior', 'behavior'],
      ['Application', 'application-composition']
    ].map(([name, id]) => `| ${name} | ${cell(profile(id).ownership)} | ${guide(id)} |`).join('\n'),
    '## Lifecycle and cancellation',
    ...['sync-failure-boundary', 'application-lifecycle', 'application-composition']
      .map(id => `${profile(id).result} ${profile(id).timing} ${profile(id).destruction} ${guide(id)}.`),
    'Application readiness cancellation prevents stale framework completion. Application code must also respect the readiness signal before committing its own asynchronous side effects. Completion hooks are synchronous notifications. Use the [routing recipe](./routing.md) for cooperative cancellation and late-result checks.',
    '## Rendering, lookup, and child identity',
    ...['view', 'view-regions', 'collection-view', 'manual-children', 'root-attributes']
      .map(id => `${profile(id).mutation} ${profile(id).repetition} ${guide(id)}.`),
    '## State sources and domain data',
    'StateApi governs an owner’s state-source observation and disposal. DataApi governs model reads, serialization, ordered collection snapshots, and structural observation. Configure each capability explicitly before constructing its consumers. `getState()` returns the exact source; call that source’s own mutation API.',
    ...['provider.static-consumers', 'provider.native-consumers', 'provider.backbone-consumers',
      'provider.actor-consumers', 'provider.custom-state-consumers']
      .map(id => `${profile(id).result} ${profile(id).ownership} ${profile(id).destruction} ${guide(id)}.`),
    '## Events, communication, and cleanup',
    ...['dom-events', 'events', 'owner-trigger-method', 'radio', 'requests']
      .map(id => `${profile(id).result} ${profile(id).ownership} ${guide(id)}.`),
    'Own external timers, DOM listeners, and widgets in the lifecycle that actually contains their use. Release render-scoped work before replacement and owner-scoped work on destruction. See [resource lifetimes](./view.lifecycle.md), [Behavior composition](./marionette.behavior.md), and [safe rendering](./security.md). No resource registry or extension-hook API is implied.',
    '## Runtime imports and optional integrations',
    '| Entrypoint | Runtime exports |\n| --- | --- |\n' + inventory.entrypoints.map(entry =>
      `| \`${entry.name}\` | ${entry.exports.filter(value => value.kind === 'value')
        .map(value => `\`${value.name}\``).join(', ')} |`).join('\n'),
    `${profile('runtime-isolation').ownership} ${profile('runtime-isolation').mutation} ${guide('runtime-isolation')}.`,
    'Type-only exports live in the same package declarations. Core, utils, Radio, data, and adapters release together; keep their versions aligned. ESM is the canonical application path. See [installation](./installation.md), [TypeScript](./typescript.md), and the [migration procedure](../upgradeGuide.md).',
    'Development tooling is separate: ' + inventory.toolingEntrypoints.map(entry => `\`${entry.name}\``).join(', ') + '. The [consumer lint guide](./consumer-lint.md) states availability and supported analysis. No validator, hierarchy inspector, or test-helper package is currently promised.',
    '## Diagnostics and verification',
    'Match a framework invariant by its stable diagnostic code, not message prose. The [diagnostic catalog](./diagnostic-catalog.md) defines the active codes and supported remedies.',
    '| Code | Invariant |\n| --- | --- |\n' + inventory.diagnostics.map(({ code, slug }) =>
      `| \`${code}\` | ${cell(slug)} |`).join('\n'),
    'Use public return values, DOM state, child identity, events, and externally counted subscriptions to prove behavior. Test focus and editable state in a real browser; test cancellation with held readiness and late results. A generated contract record proves consistency, not behavior or agent effectiveness.',
    'Canonical examples and counterexamples: [class choice](./classes.md), [integration choice](./choosing-integrations.md), [Region composition](./marionette.region.md), [state ownership](./marionette.state.md), [forms](./forms-and-accessibility.md), and [routing](./routing.md). The [consumer guide](./agents.md) explains the workflow; the [API index](./public-api.md) locates detailed references.'
  ];
  return `${sections.join('\n\n')}\n`;
}
