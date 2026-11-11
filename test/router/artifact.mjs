import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';
import { documentSections } from '../../scripts/docs/sections.mjs';

const root = resolve(import.meta.dirname, '../..');
const sourceManifest = JSON.parse(readFileSync(resolve(root, 'packages/router/package.json')));
const notice = readFileSync(resolve(root, 'license.txt'));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function candidateOutput(sourceRoot, output) {
  const canonical = path => {
    try { return realpathSync(path); } catch (error) {
      if (error.code !== 'ENOENT') { throw error; }
      return resolve(canonical(dirname(path)), basename(path));
    }
  };
  const source = canonical(resolve(sourceRoot));
  const destination = canonical(resolve(output));
  assert.ok(destination !== source && !destination.startsWith(`${source}${sep}`), 'Keep candidate artifacts outside the source checkout');
  return destination;
}

export function validatePreparationReceipt(receipt, archive, verificationCommit) {
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.publishableManifest, true);
  assert.equal(receipt.sourceDirty, false);
  assert.match(receipt.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(receipt.sourceCommit, verificationCommit, 'Archive preparation and verifier source commits differ');
  for (const field of ['sha256', 'bytes', 'name', 'version', 'licenseSha256', 'browserModuleSha256']) {
    assert.equal(receipt.archive[field], archive[field], `Preparation receipt ${field} differs from archive`);
  }
  return receipt.sourceCommit;
}

export function validateRouterPackage(manifest, license) {
  assert.equal(manifest.name, '@mnjs/router');
  assert.equal(manifest.version, sourceManifest.version);
  assert.equal(manifest.private, undefined, 'Public candidates must omit the private flag');
  assert.deepEqual(manifest.publishConfig, { access: 'public', registry: 'https://registry.npmjs.org/' });
  assert.equal(manifest.license, 'MIT');
  assert.deepEqual(Buffer.from(license), notice, 'Preserve the exact Marionette license notice');
  assert.deepEqual(manifest.dependencies, { '@mnjs/utils': '^5.0.1' });
  assert.deepEqual(manifest.peerDependencies, { marionette: '^5.0.1' });
}

export function inspectRouterArchive(archive, expectedHash) {
  const bytes = readFileSync(archive);
  const hash = sha256(bytes);
  assert.match(expectedHash, /^[a-f0-9]{64}$/, 'Supply the recorded SHA256');
  assert.equal(hash, expectedHash, 'Router archive SHA256 mismatch');
  const members = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
  const allowed = new Set(['dist', 'examples', 'package.json', 'readme.md', 'DESIGN.md', 'PROVENANCE.md', 'license.txt']);
  for (const member of members) {
    assert.ok(member.startsWith('package/') && !member.split('/').includes('..'), `Unexpected archive path ${member}`);
    assert.ok(allowed.has(member.split('/')[1]), `Unexpected router payload ${member}`);
  }
  const read = path => execFileSync('tar', ['-xOf', archive, `package/${path}`]);
  const manifest = JSON.parse(read('package.json'));
  const license = read('license.txt');
  validateRouterPackage(manifest, license);
  const entries = [manifest.exports['.'].import.default, manifest.exports['.'].require.default,
    manifest.exports['.'].import.types, manifest.exports['.'].require.types];
  entries.push('readme.md', 'DESIGN.md', 'PROVENANCE.md', 'examples/desk/README.md',
    'examples/desk/desk.mjs', 'examples/catalog/README.md', 'examples/catalog/catalog.mjs');
  for (const entry of entries) { assert.ok(members.includes(`package/${entry.replace(/^\.\//, '')}`), `Missing entry ${entry}`); }
  return { file: archive, sha256: hash, bytes: bytes.length, name: manifest.name, version: manifest.version,
    publishableManifest: true, licenseSha256: sha256(license), files: members.map(path => path.slice('package/'.length)),
    browserModuleSha256: sha256(read('dist/index.js')) };
}

export function verifyRouterDocumentation(directory) {
  const files = [];
  const walk = path => {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const file = resolve(path, item.name);
      if (item.isDirectory()) { walk(file); } else if (file.endsWith('.md')) { files.push(file); }
    }
  };
  walk(directory);
  let links = 0;
  for (const file of files) {
    const references = [];
    // This visitor is synchronous; no async token handlers are registered.
    marked.walkTokens(marked.lexer(readFileSync(file, 'utf8')), token => {
      if (token.type === 'link' || token.type === 'image') { references.push(token.href); }
    });
    for (const reference of references) {
      if (/^https?:|^mailto:/i.test(reference)) { continue; }
      const url = new URL(reference, pathToFileURL(file));
      assert.equal(url.protocol, 'file:', `Unsupported documentation link ${reference}`);
      const target = fileURLToPath(url);
      const path = relative(directory, target);
      assert.ok(path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path), `Link escapes installed router: ${reference}`);
      assert.ok(statSync(target).isFile(), `Missing documentation target ${reference}`);
      if (url.hash) {
        const sections = documentSections('', readFileSync(target, 'utf8'));
        assert.ok(sections.some(section => section.id === `#${decodeURIComponent(url.hash.slice(1))}`), `Missing anchor ${reference}`);
      }
      links++;
    }
  }
  return { pages: files.length, relativeLinks: links };
}

export function routerArtifactPath(path) {
  return resolve(process.env.MARIONETTE_ROUTER_PACKAGE_DIRECTORY ?? resolve(root, 'packages/router'), path);
}

export function verifyRouterBrowserReport(results, inventory) {
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.policy, 'initial-chromium');
  const observed = [];
  const visit = suites => {
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests) {
          assert.equal(test.projectName, 'router-chromium');
          assert.equal(test.status, 'expected');
          assert.equal(test.expectedStatus, 'passed');
          assert.deepEqual(test.results.map(result => result.status), ['passed']);
          observed.push({ file: spec.file, title: spec.title });
        }
      }
      visit(suite.suites ?? []);
    }
  };
  visit(results.suites);
  const sorted = entries => entries.map(entry => JSON.stringify([entry.file, entry.title])).sort();
  assert.ok(inventory.tests.length > 0);
  assert.deepEqual(sorted(observed), sorted(inventory.tests));
  assert.deepEqual(results.errors, [], 'Browser report errors must be an empty array');
  assert.equal(results.stats.expected, observed.length);
  assert.equal(results.stats.skipped + results.stats.flaky + results.stats.unexpected, 0);
  const version = results.config.metadata.routerBrowserVersion;
  assert.ok(typeof version === 'string' && version.length > 0, 'Record the actual Chromium executable version');
  return { policy: 'initial-chromium', ...results.stats, version };
}
