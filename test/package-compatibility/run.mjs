import assert from 'node:assert/strict';
import { prepareArtifacts } from '../../scripts/agent-benchmark/harness.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { optionalPackageMinimumVersion, optionalPackagePeerRange, releasePackages } from '../../scripts/release/packages.mjs';

const { values } = parseArgs({ options: { 'artifact-dir': { type: 'string' } } });
const root = resolve(import.meta.dirname, '../..');
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run npm run test:package-compatibility after npm run build');
const temporary = mkdtempSync(join(tmpdir(), 'mnjs-package-compatibility-'));
const npm = (args, cwd = root) => execFileSync(process.execPath, [npmCli, ...args], {
  cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 10 * 1024 * 1024,
});
const json = file => JSON.parse(readFileSync(file, 'utf8'));
try {
  const artifacts = join(temporary, 'artifacts');
  mkdirSync(artifacts);
  const supplied = values['artifact-dir'] && await prepareArtifacts({
    manifestPath: resolve(values['artifact-dir'], 'release-evidence.json'), output: artifacts,
  });
  const packages = new Map(releasePackages.map(configuration => {
    const manifest = json(join(root, configuration.directory, 'package.json'));
    const entry = supplied && supplied.packages.find(item => item.id === configuration.id);
    const packed = entry ? { filename: entry.tarball.file, integrity: entry.tarball.integrity } : JSON.parse(npm([
      'pack', join(root, configuration.id === 'core' ? '.package' : configuration.directory),
      '--ignore-scripts', '--json', '--pack-destination', artifacts]))[0];
    if (entry) { assert.equal(entry.version, manifest.version); }
    return [configuration.id, { ...configuration, version: manifest.version, archive: join(artifacts, packed.filename), integrity: packed.integrity }];
  }));
  const standalone = join(temporary, 'standalone');
  mkdirSync(standalone);
  writeFileSync(join(standalone, 'package.json'), JSON.stringify({ name: 'standalone-data', private: true, type: 'module' }));
  npm(['install', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund',
    '--registry=https://registry.npmjs.org/', '--fetch-retries=0', '--fetch-timeout=20000', packages.get('data').archive], standalone);
  npm(['ls', '--all'], standalone);
  cpSync(join(import.meta.dirname, 'standalone.mjs'), join(standalone, 'standalone.mjs'));
  execFileSync(process.execPath, ['standalone.mjs'], { cwd: standalone, stdio: 'inherit', timeout: 120000 });
  const standaloneTypes = `import { Model, Collection } from '@mnjs/data';
const model = new Model({ id: 1, label: 'test' });
const label: string | undefined = model.get('label');
const collection = new Collection([model]);
collection.add(model);
`;
  for (const extension of ['mts', 'cts']) { writeFileSync(join(standalone, `consumer.${extension}`), standaloneTypes); }
  writeFileSync(join(standalone, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: false, noEmit: true, types: [],
  }, files: ['consumer.mts', 'consumer.cts'] }));
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: standalone, stdio: 'inherit', timeout: 120000 });
  console.log('Passed standalone Data: strict install auto-supplies Utils peer, ESM/CJS runtime and types, no core.');
  const incompatible = join(temporary, 'below-minimum');
  mkdirSync(incompatible);
  writeFileSync(join(incompatible, 'package.json'), JSON.stringify({ name: 'below-minimum', private: true }));
  const rejected = spawnSync(process.execPath, [npmCli, 'install', '--ignore-scripts', '--strict-peer-deps',
    '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org/', '--fetch-retries=0', '--fetch-timeout=20000',
    'marionette@5.0.0', '@mnjs/utils@5.0.0', '@mnjs/radio@5.0.0', packages.get('data').archive, packages.get('adapters').archive],
  { cwd: incompatible, encoding: 'utf8', timeout: 180000 });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /ERESOLVE/);
  assert.match(rejected.stderr, /\^5\.0\.1/);
  console.log('Strict peer installation rejects the unsupported 5.0.0 graph.');
  for (const lane of ['minimum', 'candidate']) {
    const consumer = join(temporary, lane);
    mkdirSync(consumer);
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: `compatibility-${lane}`, private: true, type: 'module' }));
    const selected = ['core', 'utils', 'radio'].map(id => lane === 'minimum' ?
      `${packages.get(id).name}@${optionalPackageMinimumVersion}` : packages.get(id).archive);
    npm(['install', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund',
      '--registry=https://registry.npmjs.org/', '--fetch-retries=0', '--fetch-timeout=20000',
      ...selected, packages.get('data').archive, packages.get('adapters').archive,
      'backbone@1.6.1', 'jquery@4.0.0', 'morphdom@2.7.8', 'lit-html@3.3.3', 'xstate@5.33.4',
      '@types/backbone@1.4.23', '@types/jquery@4.0.1'], consumer);
    const require = createRequire(join(consumer, 'package.json'));
    const lock = json(join(consumer, 'package-lock.json'));
    for (const [id, entry] of packages) {
      const expected = lane === 'minimum' && ['core', 'utils', 'radio'].includes(id) ? optionalPackageMinimumVersion : entry.version;
      const installed = lock.packages[`node_modules/${entry.name}`];
      assert.equal(installed.version, expected, `${lane} ${entry.name} version`);
      if (lane === 'minimum' && ['core', 'utils', 'radio'].includes(id)) {
        assert.ok(installed.resolved.startsWith('https://registry.npmjs.org/'), `${entry.name} must come from npm`);
        assert.ok(installed.integrity, `${entry.name} registry integrity`);
      } else {
        assert.equal(installed.integrity, entry.integrity, `${entry.name} exact candidate bytes`);
      }
    }
    assert.equal(require('@mnjs/adapters/package.json').peerDependencies.marionette, optionalPackagePeerRange);
    assert.equal(require('@mnjs/data/package.json').peerDependencies['@mnjs/utils'], optionalPackagePeerRange);
    const utils = require.resolve('@mnjs/utils');
    for (const name of ['marionette', '@mnjs/radio', '@mnjs/data']) {
      const dependency = createRequire(require.resolve(`${name}/package.json`));
      assert.equal(dependency.resolve('@mnjs/utils'), utils, `${lane} ${name} shares Utils`);
    }
    assert.equal(Object.keys(lock.packages).filter(path => path.endsWith('node_modules/@mnjs/utils')).length, 1);
    npm(['ls', '--all'], consumer); // Reject unresolved/invalid peers rather than masking them with legacy-peer-deps.
    cpSync(join(root, 'test/fixtures/data-package-esm/validate.mjs'), join(consumer, 'data.mjs'));
    cpSync(join(root, 'test/fixtures/data-package-cjs/validate.cjs'), join(consumer, 'data.cjs'));
    // This consumer deliberately installs every adapter peer. Reuse the real
    // interop probes, not the standalone fixture's absent-peer isolation wrapper.
    const backboneProbes = ['validate-esm-backbone-first.mjs', 'validate-esm-adapter-first.mjs',
      'validate-cjs-backbone-first.cjs', 'validate-cjs-adapter-first.cjs'];
    mkdirSync(join(consumer, 'backbone'));
    for (const file of ['assert-adapter.cjs', ...backboneProbes]) {
      cpSync(join(root, 'test/fixtures/backbone-adapter', file), join(consumer, 'backbone', file));
    }
    cpSync(join(root, 'test/fixtures/dom-adapters-package/integration.mjs'), join(consumer, 'integration.mjs'));
    cpSync(join(import.meta.dirname, 'runtime.mjs'), join(consumer, 'runtime.mjs'));
    for (const file of ['data.mjs', 'data.cjs', ...backboneProbes.map(probe => `backbone/${probe}`)]) {
      execFileSync(process.execPath, [file], { cwd: consumer, stdio: 'inherit', timeout: 120000 });
    }
    for (const format of ['esm', 'cjs']) {
      execFileSync(process.execPath, ['runtime.mjs', format, join(root, 'node_modules/jsdom/lib/api.js')], { cwd: consumer, stdio: 'inherit', timeout: 120000 });
    }
    for (const file of ['providers.mts', 'providers.cts']) {
      cpSync(join(root, 'test/types', file), join(consumer, file));
    }
    const adapterTypes = `import { View, MnObject } from 'marionette';
import BackboneApi from '@mnjs/adapters/backbone';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';
import MorphdomDomApi from '@mnjs/adapters/dom/morphdom';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import createActorApi from '@mnjs/adapters/xstate';
View.setDataApi(BackboneApi);
MnObject.setStateApi(BackboneApi);
View.setDomApi(JQueryDomApi);
View.setDomApi(MorphdomDomApi);
View.setDomApi(LitDomApi);
MnObject.setStateApi(createActorApi({ snapshotEvent: 'changed' }));\n`;
    for (const extension of ['mts', 'cts']) { writeFileSync(join(consumer, `adapters.${extension}`), adapterTypes); }
    writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: false, noEmit: true,
      types: [],
    }, files: ['providers.mts', 'providers.cts', 'adapters.mts', 'adapters.cts'] }));
    execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: consumer, stdio: 'inherit', timeout: 120000 });
    console.log(`Passed ${lane}: Data/Adapters ${packages.get('data').version}, core/Utils/Radio ${require('marionette/package.json').version}; ESM, CJS, provider types, shared Utils, all five adapters.`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
