import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { documentSections } from '../../scripts/docs/sections.mjs';

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

test('agent and distributed skills route to the canonical candidate MCP request identity', async() => {
  const tooling = await readFile(resolve(repository, 'docs/tooling.md'), 'utf8');
  const hostedSection = documentSections('docs/tooling.md', tooling)
    .find(section => section.heading === 'Hosted documentation MCP');
  assert.ok(hostedSection, 'Hosted guidance must have a real tooling heading');
  const hosted = tooling.slice(hostedSection.start, hostedSection.end);
  const namedFields = new Set([...hosted.matchAll(/`([^`]+)`/g)].map(([, field]) => field));
  // Candidate tools require both identity arguments. The protocol belongs to
  // the setup page; entrypoints only need a resolvable route to that protocol.
  for (const field of ['requestIdentity', 'version', 'sourceRevision']) {
    assert.ok(namedFields.has(field), `Hosted guidance omits MCP argument/catalog field ${field}`);
  }
  assert.match(hosted, /candidate[\s\S]*sourceRevision/);
  const paths = ['docs/agents.md', 'skills/marionette/SKILL.md', 'plugins/marionette/skills/marionette/SKILL.md'];
  for (const path of paths) {
    const markdown = await readFile(resolve(repository, path), 'utf8');
    const href = path === 'docs/agents.md' ?
      localLinks(markdown).find(value => value === 'tooling.md#hosted-documentation-mcp') :
      [...markdown.matchAll(/`([^`]+)`/g)].map(([, value]) => value)
        .find(value => value === 'docs/tooling.md#hosted-documentation-mcp');
    assert.ok(href, `${path} must route to hosted identity guidance`);
    const [source, fragment] = href.split('#');
    const target = resolve(repository, path === 'docs/agents.md' ? dirname(path) : '', source);
    assert.equal(target, resolve(repository, 'docs/tooling.md'));
    assert.equal(fragment, 'hosted-documentation-mcp');
  }
});
