import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pluginRoot = resolve(repository, 'plugins/marionette');
const canonicalSkill = resolve(repository, 'skills/marionette');
const pluginSkill = resolve(pluginRoot, 'skills/marionette');

const json = async path => JSON.parse(await readFile(path, 'utf8'));

async function files(root, directory = '') {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    if (entry.name === '.DS_Store') { continue; }
    const path = [directory, entry.name].filter(Boolean).join('/');
    if (entry.isDirectory()) {
      paths.push(...await files(root, path));
    } else {
      paths.push(path);
    }
  }
  return paths.sort();
}

test('Marionette plugin bundles its skill and documentation MCP', async() => {
  const manifest = await json(resolve(pluginRoot, 'plugin.json'));
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.name, 'marionette');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.extensions['com.openai'].interface.developerName, 'Marionette.js');
  assert.deepEqual(manifest.extensions['com.openai'].interface.capabilities, ['Read']);

  const mcp = await json(resolve(pluginRoot, 'mcp.json'));
  assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  assert.deepEqual(mcp.mcpServers['marionette-docs'], {
    type: 'streamable-http',
    url: 'https://mcp.marionettejs.com/mcp',
  });

  const canonicalFiles = await files(canonicalSkill);
  assert.deepEqual(await files(pluginSkill), ['SKILL.md', 'agents/openai.yaml', 'scripts/locate.mjs']);

  const resources = await json(resolve(repository, 'docs-site/resources.json'));
  assert.deepEqual(
    resources.filter(path => path.startsWith('skills/marionette/')).sort(),
    canonicalFiles.map(path => `skills/marionette/${path}`),
    'Documentation resources must include the complete canonical skill tree',
  );

  const navigation = await json(resolve(repository, 'docs-site/navigation.json'));
  assert.ok(navigation.some(page => new URL(manifest.homepage).pathname === `/${page.route}/`),
    'Plugin homepage must resolve to a published documentation route');
});

test('plugin branding ships square icons and preserves the Marionette artwork', async() => {
  const manifest = await json(resolve(pluginRoot, 'plugin.json'));
  const presentation = manifest.extensions['com.openai'].interface;
  // Public plugin listing metadata, separate from skill agents/openai.yaml:
  // https://developers.openai.com/plugins/deploy/submission#listing-metadata
  assert.ok(presentation.shortDescription.length <= 30);
  const path = presentation.logo;
  assert.match(path, /^\.\/assets\/[^/]+\.svg$/, 'Logo must be bundled under assets');
  assert.equal(presentation.composerIcon, path, 'Both surfaces use the same artwork');
  const svg = await readFile(resolve(pluginRoot, path), 'utf8');
  assert.ok(Buffer.byteLength(svg) <= 5 * 1024 * 1024);
  const root = new JSDOM(svg, { contentType: 'image/svg+xml' }).window.document.documentElement;
  const original = new JSDOM(await readFile(resolve(repository, 'marionette-mark.svg'), 'utf8'), {
    contentType: 'image/svg+xml',
  }).window.document.documentElement;
  const dimension = name => {
    assert.ok(root.hasAttribute(name), `SVG must declare ${name}`);
    return Number(root.getAttribute(name));
  };
  const width = dimension('width');
  assert.ok(Number.isFinite(width) && width >= 48);
  assert.equal(width, dimension('height'), 'Icon must be square');
  const viewBox = root.getAttribute('viewBox').split(/\s+/).map(Number);
  const originalBox = original.getAttribute('viewBox').split(/\s+/).map(Number);
  assert.equal(viewBox.length, 4);
  assert.ok(viewBox.every(Number.isFinite));
  assert.equal(viewBox[2], viewBox[3], 'Use a square canvas');
  assert.ok(viewBox[2] >= originalBox[2] && viewBox[3] >= originalBox[3], 'Keep the original canvas visible');
  assert.deepEqual([viewBox[0] + viewBox[2] / 2, viewBox[1] + viewBox[3] / 2],
    [originalBox[0] + originalBox[2] / 2, originalBox[1] + originalBox[3] / 2], 'Center the original canvas');
  const artwork = element => [...element.querySelectorAll('path')].map(node => ({
    d: node.getAttribute('d'), fill: node.getAttribute('fill'),
  }));
  assert.ok(artwork(original).length > 0);
  assert.deepEqual(artwork(root), artwork(original), 'Keep the original paths and crimson colors');
  const tile = root.querySelector('rect');
  assert.ok(tile, 'Include a light tile for dark themes');
  assert.ok(['#fff', '#ffffff', 'white'].includes(tile.getAttribute('fill').toLowerCase()));
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => Number(tile.getAttribute(name) || 0)), viewBox,
    'Tile must cover the canvas');
  assert.ok([...root.children].indexOf(tile) < [...root.children].indexOf(root.querySelector('path')),
    'Draw the light tile before the artwork');
});

test('repository marketplace exposes the Marionette plugin', async() => {
  const marketplace = await json(resolve(repository, '.agents/plugins/marketplace.json'));
  assert.equal(marketplace.name, 'marionettejs');
  assert.deepEqual(marketplace.plugins, [{
    name: 'marionette',
    source: { source: 'local', path: './plugins/marionette' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Developer Tools',
  }]);
});

test('Claude Code and Cursor marketplace manifests share the portable plugin', async() => {
  const portable = await json(resolve(pluginRoot, 'plugin.json'));
  const claude = await json(resolve(pluginRoot, '.claude-plugin/plugin.json'));
  assert.equal(claude.name, portable.name);
  assert.equal(claude.version, portable.version, 'Plugin manifests share their independent version');
  assert.equal(claude.description, portable.description);
  assert.equal(claude.author.name, portable.author.name);

  const claudeMcp = await json(resolve(pluginRoot, '.mcp.json'));
  const portableMcp = await json(resolve(pluginRoot, 'mcp.json'));
  assert.deepEqual(claudeMcp.mcpServers['marionette-docs'], {
    type: 'http',
    url: portableMcp.mcpServers['marionette-docs'].url,
  });

  const expectedMarketplace = {
    name: 'marionettejs',
    owner: { name: portable.author.name },
    plugins: [{
      name: portable.name,
      source: './plugins/marionette',
      description: portable.description,
    }],
  };
  for (const path of ['.claude-plugin/marketplace.json', '.cursor-plugin/marketplace.json']) {
    assert.deepEqual(await json(resolve(repository, path)), expectedMarketplace,
      `${path} must point to the shared plugin`);
  }
});

test('plugin loader selects installed guidance without importing application code', async t => {
  const { mkdtemp, mkdir, rm, writeFile, symlink } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');
  const root = await mkdtemp(resolve(tmpdir(), 'marionette-plugin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const app = resolve(root, 'app');
  const store = resolve(root, 'store/marionette');
  await mkdir(resolve(app, 'src/feature'), { recursive: true });
  await mkdir(resolve(app, 'node_modules'), { recursive: true });
  await mkdir(resolve(store, 'skills/marionette'), { recursive: true });
  await writeFile(resolve(store, 'package.json'), JSON.stringify({ name: 'marionette', version: '5.0.0-rc.2', main: 'explode.js' }));
  await writeFile(resolve(store, 'explode.js'), 'throw new Error("must not import");');
  await writeFile(resolve(store, 'skills/marionette/SKILL.md'), 'Instructions from installed release');
  await symlink(store, resolve(app, 'node_modules/marionette'), 'dir');
  const run = (...args) => spawnSync(process.execPath, [resolve(pluginSkill, 'scripts/locate.mjs'), ...args], {
    cwd: resolve(app, 'src/feature'), encoding: 'utf8',
  });
  const installed = run();
  assert.equal(installed.status, 0, installed.stderr);
  const selected = JSON.parse(installed.stdout).packages[0];
  assert.equal(selected.packageVersion, '5.0.0-rc.2');
  assert.equal(await readFile(selected.skillPath, 'utf8'), 'Instructions from installed release');
  assert.deepEqual(JSON.parse(run('--package-root', store).stdout).packages, [selected]);
  const legacy = resolve(app, 'node_modules/backbone.marionette');
  await mkdir(legacy);
  await writeFile(resolve(legacy, 'package.json'), JSON.stringify({ name: 'backbone.marionette', version: '4.1.3' }));
  assert.deepEqual(JSON.parse(run().stdout).packages.map(item => item.packageName).sort(), ['backbone.marionette', 'marionette']);
  await rm(resolve(app, 'node_modules/marionette'));
  const v4 = JSON.parse(run().stdout).packages[0];
  assert.equal(v4.packageName, 'backbone.marionette');
  assert.match(v4.guidance, /v4 contracts/);
  assert.equal(v4.skillPath, undefined);
  await writeFile(resolve(legacy, 'package.json'), JSON.stringify({ name: 'backbone.marionette', version: '3.5.1' }));
  assert.match(JSON.parse(run().stdout).packages[0].guidance, /3.5.1/);
  assert.doesNotMatch(JSON.parse(run().stdout).packages[0].guidance, /Use the installed v4 contracts/);
  await rm(legacy, { recursive: true });
  assert.deepEqual(JSON.parse(run().stdout).packages, []);
  await rm(resolve(store, 'skills'), { recursive: true });
  assert.match(JSON.parse(run('--package-root', store).stdout).packages[0].guidance, /No packaged skill/);
  assert.equal(run('--unknown', store).status, 1);
});
