import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use the prepared source archive (or an explicit override), never an implicit
// registry substitution. Record its exact bytes separately from the core release.
export function htmlCandidate() {
  const source = JSON.parse(readFileSync(new URL('../../packages/html/package.json', import.meta.url), 'utf8'));
  const path = resolve(process.env.MNJS_HTML_TARBALL || fileURLToPath(new URL(`../../packages/html/artifacts/mnjs-html-${source.version}.tgz`, import.meta.url)));
  const manifest = JSON.parse(execFileSync('tar', ['-xOf', path, 'package/package.json'], { encoding: 'utf8' }));
  assert.equal(manifest.name, '@mnjs/html');
  assert.equal(manifest.version, source.version);
  assert(manifest.exports['.'] && manifest.exports['./marionette']);
  const bytes = readFileSync(path);
  return { path, name: manifest.name, version: manifest.version,
    file: `mnjs-html-${manifest.version}.tgz`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` };
}
