import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { access, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Marked } from 'marked';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('marionette/package.json'));
const docsRoot = resolve(packageRoot, 'dist/docs');
const manifest = JSON.parse(await readFile(resolve(docsRoot, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
assert.equal(manifest.packageVersion, pkg.version);
const hash = value => createHash('sha256').update(value).digest('hex');
const entries = [...manifest.pages, ...manifest.assets];
const digest = hash([...entries].sort((a, b) => a.source.localeCompare(b.source, 'en')).map(entry => `${entry.source}\0${entry.sha256}\n`).join(''));
assert.equal(digest, manifest.contentSha256);
const parser = new Marked();
let linksChecked = 0;
for (const entry of entries) {
  const bytes = await readFile(resolve(docsRoot, entry.source));
  assert.equal(hash(bytes), entry.sha256, entry.source);
  if (!entry.source.endsWith('.md')) {continue;}
  const hrefs = [];
  parser.walkTokens(parser.lexer(bytes.toString()), token => {
    if (token.type === 'link' || token.type === 'image') {hrefs.push(token.href);}
  });
  for (const href of hrefs) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) {continue;}
    const file = decodeURIComponent(href.split('#')[0].split('?')[0]);
    if (!file) {continue;}
    await assert.doesNotReject(access(resolve(docsRoot, dirname(entry.source), file)), `${entry.source}: missing packaged target ${href}`);
    linksChecked++;
  }
}
assert.ok(manifest.pages.every(page => page.section !== 'Maintaining Marionette'));
assert.ok(manifest.assets.every(asset => !asset.source.startsWith('benchmarks/docs/')),
  'Maintainer trial evidence must not enter the consumer package');
assert.ok(manifest.assets.some(asset => asset.source === 'test/fixtures/docs-routing/validate.mjs'),
  'Consumer fixture evidence must be available offline');
const installedSkill = resolve(packageRoot, 'dist/agent-skill');
const directory = await mkdtemp(resolve(tmpdir(), 'marionette-copied-skill-'));
try {
  await cp(installedSkill, directory, { recursive: true });
  const result = execFileSync(process.execPath, [resolve(directory, 'scripts/docs.mjs'), '--package-root', packageRoot, '--list'], { encoding: 'utf8' });
  assert.ok(result.includes(manifest.sourceRevision));
  assert.ok(result.includes('docs/agents.md'));
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log(`Verified installed documentation hashes, ${linksChecked} relative links, and portable skill lookup.`);
