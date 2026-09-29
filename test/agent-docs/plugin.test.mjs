import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

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
  const packageManifest = await json(resolve(repository, 'package.json'));
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.name, 'marionette');
  assert.equal(manifest.version, packageManifest.version,
    'Plugin and Marionette releases must use the same version');
  assert.equal(manifest.extensions['com.openai'].interface.developerName, 'Marionette.js');
  assert.deepEqual(manifest.extensions['com.openai'].interface.capabilities, ['Read']);

  const mcp = await json(resolve(pluginRoot, 'mcp.json'));
  assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  assert.deepEqual(mcp.mcpServers['marionette-docs'], {
    type: 'streamable-http',
    url: 'https://mcp.marionettejs.com/mcp',
  });

  const canonicalFiles = await files(canonicalSkill);
  assert.deepEqual(await files(pluginSkill), canonicalFiles,
    'Plugin skill paths differ from the canonical skill');
  for (const path of canonicalFiles) {
    assert.deepEqual(
      await readFile(resolve(pluginSkill, path)),
      await readFile(resolve(canonicalSkill, path)),
      `Plugin skill differs from canonical ${path}`,
    );
  }

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

test('Claude Code, Cursor, and Copilot marketplaces share the portable plugin', async() => {
  const packageManifest = await json(resolve(repository, 'package.json'));
  const portable = await json(resolve(pluginRoot, 'plugin.json'));
  const claude = await json(resolve(pluginRoot, '.claude-plugin/plugin.json'));
  assert.equal(claude.name, portable.name);
  assert.equal(claude.version, packageManifest.version,
    'Claude Code plugin and Marionette releases must use the same version');
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
