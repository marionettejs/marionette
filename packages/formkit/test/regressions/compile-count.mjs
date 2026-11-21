// Count-only guard: instrument a temporary bundle, never the runtime source.
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {rollup} from 'rollup';
import {setupProjectionDom, settle} from './dom.mjs';
const dom = setupProjectionDom(), host = document.querySelector('main');
const temporaryRoot = fileURLToPath(new URL('../tmp/', import.meta.url));
await mkdir(temporaryRoot, {recursive: true});
const directory = await mkdtemp(join(temporaryRoot, 'compile-guard-'));
const entry = fileURLToPath(new URL(process.env.FORMKIT_COMPILE_ENTRY ?? '../../src/index.mjs', import.meta.url));
let counts = {compiles: 0, outlets: 0}, active;
const results = [];
let instrumentedModules = 0;
globalThis.__formkitLayoutCompileProbe = () => {counts.compiles++;};
globalThis.__formkitLayoutOutletProbe = () => {counts.outlets++;};
try {
  const bundle = join(directory, 'runtime.mjs');
  const output = await rollup({input: entry, external: id => id === 'marionette' || id.startsWith('@formkit/'), plugins: [{name: 'count-layout-compiles', transform(source, id) {
    if (!id.endsWith('/schema-layout.mjs')) {return null;}
    instrumentedModules++;
    const compileImport = /import\s*\{\s*compile\s*\}\s*from\s*['"]@formkit\/core['"];?/;
    assert.equal(compileImport.test(source), true, 'diagnostic must instrument the real compiler import');
    source = source.replace(compileImport, 'import {compile as __guardCompile} from \'@formkit/core\';\nconst compile=(...args)=>{globalThis.__formkitLayoutCompileProbe();return __guardCompile(...args);};');
    const update = /const update\s*=\s*\(\{\s*locals:\s*scope\s*=\s*locals\s*\}\s*=\s*\{\s*\}\)\s*=>\s*\{/;
    assert.equal(update.test(source), true, 'diagnostic must instrument the existing outlet update');
    source = source.replace(update, match => match + 'globalThis.__formkitLayoutOutletProbe();');
    return {code: source, map: null};
  }}]});
  try {await output.write({file: bundle, format: 'es'});} finally {await output.close();}
  assert.equal(instrumentedModules, 1, 'the real layout module must be instrumented exactly once');
  const {mount} = await import(pathToFileURL(bundle).href), {getNode} = await import('@formkit/core');
  const sizes = (process.env.FORMKIT_COMPILE_SIZES ?? '200,800').split(',').map(Number);
  for (const n of sizes) {
    for (const mode of ['schema', 'fields']) {
      const nodes = [], destroyed = new Set(), capture = node => {nodes.push(node); node.on('destroyed', () => destroyed.add(node));};
      const fields = Array.from({length: n}, (_, i) => ({name: 'f' + i, label: 'Field ' + i, validation: 'required', validationVisibility: 'live'}));
      const schema = fields.map(field => ({$formkit: 'text', ...field})), values = Object.fromEntries(fields.map(field => [field.name, 'Initial']));
      counts = {compiles: 0, outlets: 0};
      active = mount({host, ...(mode === 'schema' ? {schema} : {fields}), values, plugins: [capture], config: {delay: 0}, formProps: {actions: false}});
      await active.node.settled; await settle(); const cold = {...counts}, node = active.node.at('f0'), input = host.querySelector('input[name=f0]');
      counts = {compiles: 0, outlets: 0}; input.value = 'Edited'; input.dispatchEvent(new Event('input', {bubbles: true})); await active.node.settled; await settle();
      const typing = {...counts}; results.push({n, mode, cold, typing}); console.log(JSON.stringify(results.at(-1)));
      assert.equal(typing.compiles, 0, 'a stable mounted schema must not recompile identity expressions on input');
      assert.equal(typing.outlets, mode === 'schema' ? n : 0, 'the original outlet updates must still execute');
      assert.equal(active.node.at('f0') === node, true); assert.equal(host.querySelector('input[name=f0]') === input, true); assert.equal(node.value, 'Edited');
      counts = {compiles: 0, outlets: 0}; active.updateData({revision: 2}); await settle(); assert.equal(counts.compiles, 0, 'data refresh evaluates existing compiled expressions');
      const ids = nodes.map(item => item.props.id); active.destroy(); active = undefined; await settle();
      assert.equal(nodes.length, destroyed.size); assert.equal(host.childElementCount, 0); for (const id of ids) {assert.equal(getNode(id), undefined);}
    }
  }
  console.log(JSON.stringify({passed: true, instrumentedModules, scope: 'Operation counts, no duration threshold; original compiler and every outlet update still execute.', results}));
} finally {
  active?.destroy(); dom.window.close(); delete globalThis.__formkitLayoutCompileProbe; delete globalThis.__formkitLayoutOutletProbe; await rm(directory, {recursive: true, force: true});
}
