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

function assertReleasePresentation(version, instructions, manifest) {
  if (version.includes('-')) {return;}
  assert.doesNotMatch(instructions,
    /plugin marketplace add marionettejs\/marionette --ref master/,
    'Stable installation instructions must not follow master');
  assert.doesNotMatch(instructions,
    /follows Marionette's protected `master` branch only until a release tag contains the plugin/,
    'Stable installation instructions must not retain transitional release wording');
  assert.match(instructions,
    new RegExp(`plugin marketplace add marionettejs/marionette --ref v${version.replaceAll('.', '\\.')}(?![0-9A-Za-z-])`),
    'Stable installation instructions must use the matching release tag');
  assert.doesNotMatch(JSON.stringify(manifest), /\b(?:beta|prerelease)\b/i,
    'Stable plugin presentation must not contain prerelease labeling');
  const baseVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.doesNotMatch(instructions, new RegExp(`${baseVersion}-[0-9A-Za-z]`),
    'Stable plugin instructions must not retain prerelease examples for that version');
}

async function files(root, directory = '') {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
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

  assertReleasePresentation(packageManifest.version,
    await readFile(resolve(repository, 'docs/agent-tools.md'), 'utf8'), manifest);
});

test('stable plugin releases require immutable non-transitional installation guidance', async() => {
  const current = await readFile(resolve(repository, 'docs/agent-tools.md'), 'utf8');
  const manifest = await json(resolve(pluginRoot, 'plugin.json'));
  assert.throws(() => assertReleasePresentation('5.0.0', current, manifest),
    /Stable installation instructions/);
  const stable = current
    .replace('--ref master', '--ref v5.0.0')
    .replaceAll('5.0.0-beta.5', '5.0.0')
    .replace(
      /The checked-in command follows Marionette's protected `master` branch only until a\nrelease tag contains the plugin\.[\s\S]*?that pin deliberately\./,
      'The repository marketplace is pinned to this immutable Marionette release tag.',
    );
  assert.throws(() => assertReleasePresentation('5.0.0', stable, manifest),
    /Stable plugin presentation/);
  assert.throws(() => assertReleasePresentation('5.0.0',
    stable.replace('--ref v5.0.0', '--ref v5.0.0-beta.5'),
    { ...manifest, version: '5.0.0' }), /matching release tag/);
  assert.doesNotThrow(() => assertReleasePresentation('5.0.0', stable,
    { ...manifest, version: '5.0.0' }));
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
