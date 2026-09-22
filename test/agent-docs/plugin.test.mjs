import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pluginRoot = resolve(repository, 'plugins/marionette');
const canonicalSkill = resolve(repository, 'skills/marionette');
const pluginSkill = resolve(pluginRoot, 'skills/marionette');

const json = async path => JSON.parse(await readFile(path, 'utf8'));

test('Marionette plugin bundles its skill and documentation MCP', async() => {
  const manifest = await json(resolve(pluginRoot, '.codex-plugin/plugin.json'));
  assert.equal(manifest.name, 'marionette');
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.equal(manifest.interface.developerName, 'Marionette.js');

  const mcp = await json(resolve(pluginRoot, '.mcp.json'));
  assert.deepEqual(mcp.mcpServers['marionette-docs'], {
    type: 'http',
    url: 'https://mcp.marionettejs.com/mcp',
  });

  for (const path of ['SKILL.md', 'agents/openai.yaml', 'scripts/docs.mjs']) {
    assert.deepEqual(
      await readFile(resolve(pluginSkill, path)),
      await readFile(resolve(canonicalSkill, path)),
      `Plugin skill differs from canonical ${path}`,
    );
  }
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
