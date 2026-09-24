import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cp, mkdtemp, readdir, readFile, realpath, rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Marked } from 'marked';

const require = createRequire(import.meta.url);
const packageRoot = await realpath(dirname(require.resolve('marionette/package.json')));
const manifestPath = await containedWithin(packageRoot,
  resolve(packageRoot, 'docs-manifest.json'), 'Documentation manifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const pkg = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
assert.equal(manifest.packageVersion, pkg.version);
const hash = value => createHash('sha256').update(value).digest('hex');
async function files(root, directory = '') {
  const paths = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const path = [directory, entry.name].filter(Boolean).join('/');
    if (entry.isDirectory()) {
      paths.push(...await files(root, path));
    } else {
      paths.push(path);
    }
  }
  return paths.sort();
}
const entries = [...manifest.pages, ...manifest.assets];
const digest = hash([...entries].sort((a, b) => a.source.localeCompare(b.source, 'en')).map(entry => `${entry.source}\0${entry.sha256}\n`).join(''));
assert.equal(digest, manifest.contentSha256);
async function containedWithin(root, path, label) {
  const base = await realpath(root);
  const target = await realpath(path);
  const local = relative(base, target);
  assert.ok(local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local),
    `${label} escapes its root: ${path}`);
  return target;
}
const contained = path => containedWithin(packageRoot, path, 'Target');
const parser = new Marked();
let linksChecked = 0;
for (const entry of entries) {
  const bytes = await readFile(await contained(resolve(packageRoot, entry.source)));
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
    await assert.doesNotReject(contained(resolve(packageRoot, dirname(entry.source), file)), `${entry.source}: missing packaged target ${href}`);
    linksChecked++;
  }
}
assert.ok(manifest.pages.every(page => page.section !== 'Maintaining Marionette'));
assert.ok(manifest.assets.every(asset => !asset.source.startsWith('benchmarks/')),
  'Maintainer trial evidence must not enter the consumer package');
const maintainerAssets = new Set(['ROADMAP.md', 'test/README.md']);
assert.ok(manifest.assets.every(asset => !maintainerAssets.has(asset.source) && !asset.source.startsWith('test/unit/')),
  'Maintainer planning and test guidance must not enter the consumer package');
assert.ok(manifest.assets.some(asset => asset.source === 'test/fixtures/docs-routing/validate.mjs'),
  'Consumer fixture evidence must be available offline');
const installedSkill = await containedWithin(packageRoot,
  resolve(packageRoot, 'dist/agent-skill'), 'Packaged skill');
const documentedSkill = await containedWithin(packageRoot,
  resolve(packageRoot, 'skills/marionette'), 'Documented skill');
const skillFiles = await files(documentedSkill);
assert.deepEqual(await files(installedSkill), skillFiles,
  'Packaged skill paths differ from the documented canonical snapshot');
for (const path of skillFiles) {
  assert.deepEqual(await readFile(await containedWithin(installedSkill,
    resolve(installedSkill, path), 'Packaged skill file')),
  await readFile(await containedWithin(documentedSkill,
    resolve(documentedSkill, path), 'Documented skill file')), `Packaged skill differs at ${path}`);
}
const skillMetadata = await readFile(resolve(installedSkill, 'agents/openai.yaml'), 'utf8');
assert.match(skillMetadata, /https:\/\/mcp\.marionettejs\.com\/mcp/,
  'Packaged skill must declare the documentation MCP dependency');
const directory = await mkdtemp(resolve(tmpdir(), 'marionette-copied-skill-'));
try {
  await cp(installedSkill, directory, { recursive: true });
  for (const skillRoot of [installedSkill, directory]) {
    const skill = await readFile(resolve(skillRoot, 'SKILL.md'), 'utf8');
    const commands = parser.lexer(skill).filter(token => token.type === 'code' && token.lang === 'sh')
      .flatMap(token => token.text.split('\n'));
    assert.equal(commands.length, 2, 'Exercise both documented lookup commands');
    const modes = new Set();
    for (const command of commands) {
      const [executable, ...tokens] = command.split(/\s+/);
      assert.equal(executable, 'node');
      const substitutions = new Map([
        ['/path/to/skill-directory/scripts/docs.mjs', resolve(skillRoot, 'scripts/docs.mjs')],
        ['/path/to/application', process.cwd()],
      ]);
      const args = tokens.map(token => token.replace(/^(['"])(.*)\1$/, '$2'))
        .map(arg => substitutions.get(arg) ?? arg);
      const output = execFileSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
      if (args.includes('--list')) {
        modes.add('list');
        const result = JSON.parse(output);
        assert.equal(result.sourceRevision, manifest.sourceRevision);
        assert.deepEqual(result.pages.map(page => page.source), manifest.pages.map(page => page.source));
      } else {
        modes.add('page');
        assert.deepEqual(args.slice(-2), ['--page', 'docs/agents.md']);
        const headerEnd = output.indexOf('\n');
        const result = JSON.parse(output.slice(0, headerEnd));
        assert.equal(result.sourceRevision, manifest.sourceRevision);
        assert.equal(result.source, 'docs/agents.md');
        const page = await readFile(resolve(packageRoot, result.source), 'utf8');
        assert.equal(output.slice(headerEnd + 1), `${page}\n`);
      }
    }
    assert.deepEqual([...modes].sort(), ['list', 'page']);
  }
  const result = execFileSync(process.execPath, [resolve(directory, 'scripts/docs.mjs'), '--package-root', packageRoot, '--list'], { encoding: 'utf8' });
  assert.ok(result.includes(manifest.sourceRevision));
  assert.ok(result.includes('docs/agents.md'));
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log(`Verified installed documentation hashes, ${linksChecked} relative links, and portable skill lookup.`);
