import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = join(root, 'vendor/lit-html-3.3.3');
const manifest = JSON.parse(readFileSync(join(vendor, 'test/manifest.json')));
const sources = JSON.parse(readFileSync(join(vendor, 'sources.json')));
assert.equal(manifest.ref, sources.package);
const expected = ['LICENSE', 'package.json', 'sources.json', 'test/manifest.json'];
for (const entry of manifest.files) {
  assert.match(entry.file, /^[a-z_-]+\.ts$/);
  const path = `test/${entry.file}`;
  assert.ok(!expected.includes(path), `Duplicate fixture: ${path}`);
  expected.push(path);
  const bytes = readFileSync(join(vendor, path));
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(sha, entry.gitBlobSha, `Upstream Git blob mismatch: ${path}`);
}
function files(directory, prefix = '') {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = `${prefix}${entry.name}`;
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${path}`);
    return entry.isDirectory() ? files(join(directory, entry.name), `${path}/`) : [path];
  });
}
assert.deepEqual(files(vendor).sort(), expected.sort(), 'Unexpected or missing vendored files');
assert.deepEqual(Object.keys(sources.retainedMetadata).sort(), ['LICENSE', 'package.json']);
for (const [file, hash] of Object.entries(sources.retainedMetadata)) {
  assert.equal(createHash('sha256').update(readFileSync(join(vendor, file))).digest('hex'), hash, file);
}
// This local ESM helper is type-erased, not a separate pristine upstream file.
const original = readFileSync(join(vendor, 'test/testing-utils.ts'), 'utf8');
assert.equal(readFileSync(join(root, 'test/upstream-markers.mjs'), 'utf8'),
  original.replaceAll(': string', ''), 'Derived marker helper drifted from its upstream fixture');
console.log(`Verified ${manifest.files.length} pristine upstream fixtures, metadata, file set and derived helper.`);
