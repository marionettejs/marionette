// Development-only reproduction of the package-owned binding adaptation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const require = createRequire(new URL('package.json', root));
const readJSON = url => JSON.parse(readFileSync(url, 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const adaptation = readJSON(new URL('scripts/bindings-adaptation.json', root));
assert.equal(adaptation.schemaVersion, 1);
const candidate = readJSON(new URL('package.json', root));
const lock = readJSON(new URL('package-lock.json', root));
assert.equal(candidate.devDependencies['@formkit/react'], adaptation.reference.version);
assert.equal(candidate.dependencies.react, undefined, 'React must not become a runtime dependency');
assert.equal(candidate.dependencies['@formkit/react'], undefined, 'The React reference is development-only');
const locked = lock.packages['node_modules/@formkit/react'];
assert.equal(locked.version, adaptation.reference.version);
assert.equal(locked.resolved, adaptation.reference.resolved);
assert.equal(locked.integrity, adaptation.reference.integrity);
const referenceManifestPath = require.resolve('@formkit/react/package.json');
const referenceManifest = readJSON(referenceManifestPath);
assert.equal(referenceManifest.name, adaptation.reference.package);
assert.equal(referenceManifest.version, adaptation.reference.version);
assert.equal(adaptation.reference.entry, 'dist/index.mjs');
const published = readFileSync(join(dirname(referenceManifestPath), adaptation.reference.entry), 'utf8');
assert.equal(sha256(published), adaptation.reference.fileSHA256, 'Published reference bytes differ');
const start = published.indexOf(adaptation.reference.startMarker);
assert.ok(start >= 0 && published.indexOf(adaptation.reference.startMarker, start + 1) === -1, 'Reference start must be unique');
const end = published.indexOf(adaptation.reference.endMarker, start);
assert.ok(end > start && published.indexOf(adaptation.reference.endMarker, end + 1) === -1, 'Reference end must be unique');
const reference = published.slice(start, end);
assert.equal(sha256(reference), adaptation.reference.sliceSHA256);
const lines = reference.match(/[^\n]*\n|[^\n]+$/g) ?? [];
let previousEnd = 0;
for (const hunk of adaptation.hunks) {
  assert.ok(Number.isInteger(hunk.at) && hunk.at >= previousEnd && hunk.at + hunk.remove.length <= lines.length, 'Invalid adaptation range');
  assert.deepEqual(lines.slice(hunk.at, hunk.at + hunk.remove.length), hunk.remove, 'Adaptation reference mismatch');
  previousEnd = hunk.at + hunk.remove.length;
}
for (const hunk of [...adaptation.hunks].reverse()) { lines.splice(hunk.at, hunk.remove.length, ...hunk.insert); }
const generated = lines.join('');
assert.equal(sha256(generated), adaptation.target.sha256, 'Generated adaptation hash differs');
assert.equal(lines.length, adaptation.target.lineCount);
assert.equal(adaptation.target.path, 'src/runtime/upstream-bindings.mjs');
const target = new URL(adaptation.target.path, root);
const args = process.argv.slice(2);
assert.ok(args.length <= 1 && (!args.length || ['--check', '--stdout', '--write'].includes(args[0])), 'Use --check, --stdout or --write');
const mode = args[0] ?? '--check';
if (mode === '--stdout') {
  process.stdout.write(generated);
} else {
  if (mode === '--write') { writeFileSync(target, generated); }
  assert.equal(readFileSync(target, 'utf8'), generated, 'Package binding differs from the recorded adaptation');
  console.log(JSON.stringify({ passed: true, reference: referenceManifest.name, version: referenceManifest.version, referenceSHA256: sha256(published), target: adaptation.target.path, targetSHA256: sha256(generated), packageRoot: fileURLToPath(root), mode }));
}
