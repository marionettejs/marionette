import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const json = async path => JSON.parse(await readFile(resolve(repository, path), 'utf8'));

function localLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map(([, href]) => href).filter(href => !/^[a-z]+:/i.test(href));
}

function checkDiscoveryCoverage(markdown, navigation) {
  const linked = localLinks(markdown).map(href => href.split('#')[0]);
  const pages = navigation.filter(page => page.source.startsWith('docs/') && !page.source.startsWith('docs/maintainers/'))
    .map(page => page.source);
  assert.equal(new Set(linked).size, linked.length, 'llms discovery repeats a local target');
  assert.deepEqual([...linked].sort(), [...pages].sort(), 'llms discovery must expose every consumer navigation page');
  return linked;
}

test('llms discovery covers the consumer navigation and resolves its local targets', async() => {
  const navigation = await json('docs-site/navigation.json');
  const markdown = await readFile(resolve(repository, 'llms.txt'), 'utf8');
  for (const href of checkDiscoveryCoverage(markdown, navigation)) {
    assert.equal((await stat(resolve(repository, href))).isFile(), true, `Missing discovery target: ${href}`);
  }
});

test('discovery validation rejects an omitted consumer page', async() => {
  const navigation = await json('docs-site/navigation.json');
  const markdown = await readFile(resolve(repository, 'llms.txt'), 'utf8');
  const consumer = navigation.find(page => page.source === 'docs/api/application.md');
  assert.ok(consumer);
  const omitted = markdown.split('\n').filter(line => !line.includes(`](${consumer.source})`)).join('\n');
  assert.throws(() => checkDiscoveryCoverage(omitted, navigation), /every consumer navigation page/);
});

test('agent and distributed skill guidance expose the candidate MCP request identity', async() => {
  const paths = ['docs/agents.md', 'skills/marionette/SKILL.md', 'plugins/marionette/skills/marionette/SKILL.md'];
  for (const path of paths) {
    const markdown = await readFile(resolve(repository, path), 'utf8');
    const hosted = markdown.slice(markdown.indexOf('## Optional hosted'));
    const namedFields = new Set([...hosted.matchAll(/`([^`]+)`/g)].map(([, field]) => field));
    // A candidate catalog requires both identity arguments on tools. Checking
    // their documented names catches the reviewed version-only instruction.
    for (const field of ['requestIdentity', 'version', 'sourceRevision']) {
      assert.ok(namedFields.has(field), `${path} omits candidate MCP argument/catalog field ${field}`);
    }
    assert.match(hosted, /candidate[\s\S]*sourceRevision/, `${path} must connect candidate calls to their revision argument`);
  }
});
