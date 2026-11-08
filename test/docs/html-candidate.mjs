import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The renderer is independently versioned and not published. Require an explicit
// artifact rather than quietly substituting a registry package or mutable source.
export function htmlCandidate() {
  assert(process.env.MNJS_HTML_TARBALL,
    'Set MNJS_HTML_TARBALL to the verified @mnjs/html candidate tarball');
  const path = resolve(process.env.MNJS_HTML_TARBALL);
  const manifest = JSON.parse(execFileSync('tar', ['-xOf', path, 'package/package.json'], { encoding: 'utf8' }));
  assert.equal(manifest.name, '@mnjs/html');
  assert.equal(manifest.version, '0.1.0-alpha.0');
  assert(manifest.exports['.'] && manifest.exports['./marionette']);
  const bytes = readFileSync(path);
  return { path, name: manifest.name, version: manifest.version,
    file: `mnjs-html-${manifest.version}.tgz`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` };
}
