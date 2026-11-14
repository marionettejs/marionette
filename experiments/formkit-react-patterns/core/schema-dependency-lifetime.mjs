// Public-behavior regressions; run explicitly so the established acceptance inventory stays fixed.
import assert from 'node:assert/strict';
const root = process.env.FORMKIT_FIXTURE_ROOT ?? new URL('./', import.meta.url).href;
const {setupProjectionDom, settle, mountProjectionReference} = await import(new URL('schema-projection-reference.mjs', root));
const dom = setupProjectionDom(), host = document.querySelector('main');
const arm = process.argv[2] ?? 'experiment';
const {createNode, getNode} = await import('@formkit/core');
const {defaultConfig} = await import(arm === 'vue' ? '@formkit/vue' : arm === 'react' ? '@formkit/react' : new URL('index.mjs', root));
const options = defaultConfig({config: {delay: 0}}), external = [], checks = [];
let api, serial = 0;
function source(value = 'Same', id = 'dependency-source-' + serial++) {
  const node = createNode({plugins: options.plugins, config: options.config, name: id, value, props: {id, type: 'text'}});
  external.push(node);
  return node;
}
async function close() {
  const ids = api.nodes.map(node => node.props.id);
  api.destroy(); await settle();
  assert.equal(api.counts().created, api.counts().destroyed);
  assert.equal(host.childElementCount, 0);
  for (const id of ids) {assert.equal(getNode(id), undefined);}
  api = undefined;
}
try {
  const a = source(), b = source(), c = source('Third');
  let calls = 0;
  const probe = context => {calls++; return context?.value ?? 'missing';};
  const state = (target, stable, shown = true) => ({target: target.props.id, stable: stable.props.id, shown, probe});
  const schema = [
    {if: '$shown', then: {$el: 'output', attrs: {id: 'first'}, children: '$probe($get($target))'}},
    {$el: 'output', attrs: {id: 'second'}, children: '$probe($get($stable))'}
  ];
  api = await mountProjectionReference(arm, host, schema, state(a, a));
  await api.update(state(b, a));
  await a.input('Still shared', false); await settle();
  if (arm === 'react') {await api.update(state(b, a));}
  assert.equal(host.querySelector('#second').textContent, 'Still shared');
  assert.equal(host.querySelector('#first').textContent, 'Same');
  await api.update(state(b, b, false));
  calls = 0; await a.input('Obsolete', false); await settle();
  if (arm === 'experiment') {assert.equal(calls, 0, 'retired target must not reevaluate remaining expressions');}
  await b.input('Active', false); await settle();
  if (arm === 'react') {await api.update(state(b, b, false));}
  assert.equal(host.querySelector('#second').textContent, 'Active');
  assert.equal(host.querySelector('#first'), null);
  checks.push('shared binding remains subscribed until last consumer leaves');
  await close();

  const projected = [{$formkit: 'text', name: 'kept', label: '$probe($get($target))'}];
  await a.input('Equal', false); await b.input('Equal', false);
  api = await mountProjectionReference(arm, host, projected, state(a, a));
  const kept = api.node.at('kept'), input = host.querySelector('input');
  await api.update(state(b, b));
  assert.equal(api.node.at('kept'), kept); assert.equal(host.querySelector('input'), input);
  calls = 0; await a.input('Old projection', false); await settle();
  if (arm === 'experiment') {assert.equal(calls, 0, 'equal projected fields still release old reads');}
  await b.input('New projection', false); await settle();
  if (arm === 'react') {await api.update(state(b, b));}
  assert.equal(host.querySelector('label').textContent, 'New projection');
  checks.push('equal projection retains Core and DOM while changing dependencies');
  await close();

  // React 2.5 requires an explicit schema-data refresh for external $get changes.
  // Vue and this adapter subscribe automatically; pending-event counts are adapter-specific.
  if (arm === 'experiment') {
    const {mount} = await import(new URL('index.mjs', root));
    let raw, recorded = 0;
    const record = context => {recorded++; return context?.value ?? 'missing';};
    const data = target => ({target: target.props.id, record});
    raw = mount({host, schema: [{$el: 'output', children: '$record($get($target))'}], data: data(a), config: {delay: 0}, formProps: {actions: false}});
    await settle();
    a.input('Queued old', false); raw.updateData(data(b));
    recorded = 0; await settle();
    assert.equal(recorded, 0, 'queued obsolete invalidation is discarded');
    a.input('Old plus active', false); raw.updateData(data(a)); b.input('Old new', false); a.input('Current pending', false);
    await settle(); assert.equal(host.querySelector('output').textContent, 'Current pending');
    raw.updateData(data(b)); recorded = 0;
    await Promise.resolve().then(() => a.input('Async obsolete', false)); await settle();
    assert.equal(recorded, 0);
    const activeId = b.props.id;
    b.destroy(); const replacement = source('Recreated', activeId); await settle();
    assert.equal(host.querySelector('output').textContent, 'Recreated');
    await replacement.input('Replacement active', false); await settle();
    assert.equal(host.querySelector('output').textContent, 'Replacement active');
    const lateId = 'dependency-late'; raw.updateData({target: lateId, record}); await settle();
    assert.equal(host.querySelector('output').textContent, 'missing');
    const late = source('Late', lateId); await settle();
    assert.equal(host.querySelector('output').textContent, 'Late');
    late.input('Queued teardown', false); raw.destroy(); recorded = 0;
    await Promise.resolve().then(() => late.input('After teardown', false)); await settle();
    assert.equal(recorded, 0); assert.equal(host.childElementCount, 0);
    checks.push('pending, async obsolete, destroyed/recreated, late-registration and teardown callbacks');

    let keyCalls = 0;
    const keyFor = context => {keyCalls++; return context?.value;};
    const rows = values => ({rows: values.map(node => ({id: node.props.id})), keyFor});
    raw = mount({host, schema: [{$el: 'output', for: ['row', '$rows'], key: '$keyFor($get($row.id))', children: '$row.id'}], data: rows([a, c]), formProps: {actions: false}});
    await settle(); const retained = host.querySelectorAll('output')[1];
    raw.updateData(rows([c, replacement])); await settle();
    assert.equal(host.querySelector('output'), retained);
    keyCalls = 0; await a.input('Retired loop key', false); await settle();
    assert.equal(keyCalls, 0);
    await c.input('Changed loop key', false); await settle();
    assert.ok(keyCalls > 0);
    raw.destroy(); await settle();
    checks.push('loop key dependencies prune removed rows and retain active siblings');

    // Layout outlet lookup and field projection own independent reads of identity.
    await a.input('identity', false); await replacement.input('identity', false);
    let identities = 0;
    const identity = context => {identities++; return context?.value;};
    const identityData = target => ({target: target.props.id, identity});
    raw = mount({host, schema: [{$formkit: 'text', name: '$identity($get($target))', key: '$identity($get($target))'}], data: identityData(a), formProps: {actions: false}});
    await settle(); const first = raw.node.at('identity'), firstInput = host.querySelector('input');
    raw.updateData(identityData(replacement)); await settle();
    assert.equal(raw.node.at('identity'), first); assert.equal(host.querySelector('input'), firstInput);
    identities = 0; await a.input('obsolete-identity', false); await settle();
    assert.equal(identities, 0);
    await replacement.input('changed-identity', false); await settle();
    assert.notEqual(raw.node.at('changed-identity'), first); assert.equal(first.context == null, true);
    assert.notEqual(host.querySelector('input'), firstInput);
    raw.destroy(); await settle();
    checks.push('owned outlet identity shares dependency semantics with field projection');

    const attrSchema = title => [{$el: 'output', attrs: {title}, children: '$record($get($target))'}];
    raw = mount({host, schema: attrSchema('Before'), data: data(c), formProps: {actions: false}});
    await settle();
    raw.setSchema(attrSchema('After')); await settle();
    const replaced = host.querySelector('output');
    await c.input('After schema replacement', false); await settle();
    assert.equal(replaced.textContent, 'After schema replacement'); assert.equal(replaced.title, 'After');
    raw.destroy(); await settle();
    checks.push('schema replacement retains active notifications');

    // Imperative factory reads are controller-owned, outside compiler evaluation.
    // A cached context must keep notifying refresh even if refresh does not call get again.
    let getter, factories = 0, disposed = 0;
    const components = {Cached: ({host: container, schemaData}) => {
      factories++; getter = schemaData.get;
      const context = getter(c.props.id), element = document.createElement('output');
      container.append(element);
      const refresh = () => {element.textContent = context.value;}; refresh();
      return {refresh, update() {}, destroy() {disposed++;}};
    }};
    raw = mount({host, schema: [{$cmp: 'Cached', for: ['row', '$rows'], key: '$row', props: {key: '$row'}}], data: {rows: ['one']}, components, formProps: {actions: false}});
    await settle(); await c.input('Cached factory update', false); await settle();
    assert.equal(host.querySelector('output').textContent, 'Cached factory update');
    raw.updateData({rows: ['one']}); await settle(); assert.equal(factories, 1);
    raw.destroy(); await settle(); assert.equal(disposed, 1);
    assert.equal(await Promise.resolve().then(() => getter(c.props.id)), null);
    checks.push('imperative cached factory reads retain controller lifetime and close on destroy');

  }
  console.log(JSON.stringify({arm, passed: true, checks}));
} finally {
  api?.destroy();
  for (const node of external) {if (node.context) {node.destroy();}}
  dom.window.close();
}
