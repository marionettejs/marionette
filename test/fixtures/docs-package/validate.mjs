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
const discovery = await readFile(resolve(packageRoot, 'llms.txt'), 'utf8');
const discoveryLinks = [];
parser.walkTokens(parser.lexer(discovery), token => {
  if (token.type === 'link') { discoveryLinks.push(token.href); }
});
assert.ok(discoveryLinks.includes('docs/quick-start.md'));
assert.ok(discoveryLinks.includes('docs/agents.md'));
for (const href of discoveryLinks) {
  await contained(resolve(packageRoot, href));
}
assert.ok(!(await files(packageRoot)).some(path => path.startsWith('config/api-contracts/') ||
  path.startsWith('scripts/')), 'Build tooling and contract inventories must not be packed');
assert.ok(manifest.assets.every(asset => !asset.source.startsWith('config/api-contracts/') &&
  !asset.source.startsWith('scripts/api-contracts/')),
'Build contract data must not obscure consumer guide searches');
assert.ok(manifest.pages.every(page => page.section !== 'Maintaining Marionette'));
assert.ok(manifest.assets.every(asset => !asset.source.startsWith('benchmarks/')),
  'Maintainer trial evidence must not enter the consumer package');
const maintainerAssets = new Set(['ROADMAP.md', 'test/README.md']);
assert.ok(manifest.assets.every(asset => !maintainerAssets.has(asset.source) && !asset.source.startsWith('test/unit/')),
  'Maintainer planning and test guidance must not enter the consumer package');
assert.ok(entries.every(entry => !/^(?:planning|test|benchmarks)\//.test(entry.source)),
  'Maintainer evidence and test fixtures must not enter the consumer package');
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
const directory = await mkdtemp(resolve(tmpdir(), 'marionette-copied-skill-'));
try {
  await cp(installedSkill, directory, { recursive: true });
  const guide = await readFile(resolve(packageRoot, 'docs/agents.md'), 'utf8');
  const commands = parser.lexer(guide).filter(token => token.type === 'code' && token.lang === 'sh')
    .flatMap(token => token.text.split('\n')).filter(line => line.startsWith('node <skill>/'));
  assert.ok(commands.length, 'The installed guide supplies an executable lookup command');
  const documentedArgs = commands.map(command => command.match(/'[^']*'|\S+/g)
    .slice(2).map(token => token.replace(/^'|'$/g, '')));
  for (const skillRoot of [documentedSkill, installedSkill, directory]) {
    const helper = resolve(skillRoot, 'scripts/docs.mjs');
    const lookup = args => execFileSync(process.execPath, [helper, ...args], { cwd: process.cwd(), encoding: 'utf8' });
    const modes = new Set();
    for (const args of [...documentedArgs, ['--list'], ['--search', 'prepareStart'],
      ['--page', 'docs/api/application.md'], ['--symbol', 'Application.prepareStart']]) {
      const output = lookup(args);
      if (args.includes('--list')) {
        modes.add('list');
        const result = JSON.parse(output);
        assert.equal(result.sourceRevision, manifest.sourceRevision);
        assert.ok(result.pages.some(page => page.source === 'docs/agents.md'));
      } else if (args.includes('--search')) {
        modes.add('search');
        const result = JSON.parse(output);
        assert.equal(result.contentSha256, manifest.contentSha256);
        const section = result.results.find(match => match.source === 'docs/api/application.md');
        assert.ok(section, 'Search discovers the current Application reference');
        const excerpt = lookup(['--section', section.id]);
        const headerEnd = excerpt.indexOf('\n');
        assert.equal(JSON.parse(excerpt.slice(0, headerEnd)).contentSha256, manifest.contentSha256);
        const page = await readFile(resolve(packageRoot, section.source), 'utf8');
        assert.equal(excerpt.slice(headerEnd + 1), `${page.slice(section.start, section.end)}\n`);
      } else if (args.includes('--symbol')) {
        modes.add('symbol');
        const result = JSON.parse(output);
        assert.equal(result.contentSha256, manifest.contentSha256);
        assert.equal(result.query, 'Application.prepareStart');
        assert.ok(result.matches.length);
      } else {
        const section = args.includes('--section');
        modes.add(section ? 'section' : 'page');
        const headerEnd = output.indexOf('\n');
        const result = JSON.parse(output.slice(0, headerEnd));
        assert.equal(result.sourceRevision, manifest.sourceRevision);
        const page = await readFile(resolve(packageRoot, result.source), 'utf8');
        if (section) {
          assert.equal(result.id, args.at(-1));
          assert.equal(output.slice(headerEnd + 1), `${page.slice(result.start, result.end)}\n`);
        } else {
          assert.equal(result.source, args.at(-1));
          assert.equal(output.slice(headerEnd + 1), `${page}\n`);
        }
      }
    }
    assert.deepEqual([...modes].sort(), ['list', 'page', 'search', 'section', 'symbol']);
    assert.equal(JSON.parse(lookup(['--diagnostic', 'MN0003'])).diagnostic.code, 'MN0003');
    const result = JSON.parse(lookup(['--package-root', packageRoot, '--list']));
    assert.equal(result.contentSha256, manifest.contentSha256);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log(`Verified installed documentation hashes, ${linksChecked} relative links, and portable skill lookup.`);
