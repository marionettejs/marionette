import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cp, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Marked } from 'marked';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('marionette/package.json'));
const docsRoot = await realpath(resolve(packageRoot, 'dist/docs'));
const docsLocal = relative(await realpath(packageRoot), docsRoot);
assert.ok(docsLocal !== '..' && !docsLocal.startsWith(`..${sep}`) && !isAbsolute(docsLocal),
  'Documentation root escapes its package');
const manifest = JSON.parse(await readFile(resolve(docsRoot, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
assert.equal(manifest.packageVersion, pkg.version);
const hash = value => createHash('sha256').update(value).digest('hex');
const entries = [...manifest.pages, ...manifest.assets];
const digest = hash([...entries].sort((a, b) => a.source.localeCompare(b.source, 'en')).map(entry => `${entry.source}\0${entry.sha256}\n`).join(''));
assert.equal(digest, manifest.contentSha256);
async function contained(path) {
  const base = await realpath(docsRoot);
  const target = await realpath(path);
  const local = relative(base, target);
  assert.ok(local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local), `Target escapes packaged docs: ${path}`);
  return target;
}
const parser = new Marked();
let linksChecked = 0;
for (const entry of entries) {
  const bytes = await readFile(await contained(resolve(docsRoot, entry.source)));
  assert.equal(hash(bytes), entry.sha256, entry.source);
  if (!entry.source.endsWith('.md')) {continue;}
  const hrefs = [];
  parser.walkTokens(parser.lexer(bytes.toString()), token => {
    if (token.type === 'link' || token.type === 'image') {hrefs.push(token.href);}
  });
  for (const href of hrefs) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) {continue;}
    let file;
    assert.doesNotThrow(() => { file = decodeURIComponent(href.split('#')[0].split('?')[0]); }, `${entry.source}: invalid URL ${href}`);
    if (!file) {continue;}
    await assert.doesNotReject(contained(resolve(docsRoot, dirname(entry.source), file)), `${entry.source}: missing packaged target ${href}`);
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
