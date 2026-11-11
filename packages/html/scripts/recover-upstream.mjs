// Offline recovery only. Obtain the documented archive separately; never trust an
// archive's paths or source map contents before verifying the pinned SRI.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {execFileSync} from 'node:child_process';

const [archive, destination] = process.argv.slice(2);
assert.ok(archive && destination, 'Usage: node scripts/recover-upstream.mjs archive.tgz NEW_DIRECTORY');
const manifest = JSON.parse(readFileSync(new URL('../vendor/lit-html-3.3.3/sources.json', import.meta.url)));
const digest = `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`;
assert.equal(digest, manifest.integrity, 'Archive integrity mismatch');
const recovered = new Map();
for (const entry of manifest.recoverableSources) {
  assert.match(entry.file, /^(?:directives\/)?[a-z-]+\.ts$/);
  assert.match(entry.map, /^development\/(?:directives\/)?[a-z-]+\.js\.map$/);
  assert.ok(!recovered.has(entry.file), `Duplicate source: ${entry.file}`);
  const map = JSON.parse(execFileSync('tar', ['-xOf', archive, `package/${entry.map}`], {encoding: 'utf8'}));
  const matches = map.sources.flatMap((source, index) => source === entry.source ? [index] : []);
  assert.equal(matches.length, 1, `Missing or ambiguous source: ${entry.source}`);
  const content = map.sourcesContent[matches[0]];
  assert.equal(typeof content, 'string');
  assert.equal(createHash('sha256').update(content).digest('hex'), entry.sha256, entry.file);
  recovered.set(entry.file, content);
}
for (const [file, hash] of Object.entries(manifest.retainedMetadata)) {
  assert.ok(['LICENSE', 'package.json'].includes(file));
  const content = execFileSync('tar', ['-xOf', archive, `package/${file}`]);
  assert.equal(createHash('sha256').update(content).digest('hex'), hash, file);
  recovered.set(file, content);
}
// Refuse an existing directory; never overwrite a developer's comparison copy.
mkdirSync(destination);
try {
for (const [file, content] of recovered) {
  mkdirSync(dirname(join(destination, file)), {recursive: true});
  writeFileSync(join(destination, file), content, {flag: 'wx'});
}
} catch (error) {
  rmSync(destination, {recursive: true, force: true});
  throw error;
}
console.log(`Recovered ${manifest.recoverableSources.length} verified sources and licensed package metadata.`);
