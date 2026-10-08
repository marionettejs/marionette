import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { marked } from 'marked';
import { textFromHeading } from '../../scripts/docs/headings.mjs';

const root = resolve(import.meta.dirname, '../..');
const entrypoints = ['AGENTS.md', 'CONTRIBUTING.md', 'ROADMAP.md', 'test/README.md', 'readme.md'];

test('repository entrypoint links resolve without requiring the full documentation corpus', async() => {
  for (const source of [...entrypoints, 'docs-site/README.md']) {
    const markdown = await readFile(resolve(root, source), 'utf8');
    const links = [];
    await Promise.all(marked.walkTokens(marked.lexer(markdown), token => {
      if ((token.type === 'link' || token.type === 'image') && !/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(token.href)) {
        links.push(token.href);
      }
    }));
    for (const link of links) {
      const [path, fragment] = link.split('#');
      const destination = path ? resolve(root, dirname(source), decodeURIComponent(path)) : resolve(root, source);
      const contents = await readFile(destination, 'utf8').catch(error => {
        assert.fail(`${source}: ${link} does not resolve: ${error.code}`);
      });
      if (fragment && destination.endsWith('.md')) {
        const anchors = new Set();
        const counts = new Map();
        await Promise.all(marked.walkTokens(marked.lexer(contents), token => {
          if (token.type !== 'heading') { return; }
          const name = textFromHeading(marked.parseInline(token.text))
            .toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-');
          const count = counts.get(name) || 0;
          counts.set(name, count + 1);
          anchors.add(count ? `${name}-${count}` : name);
        }));
        assert(anchors.has(decodeURIComponent(fragment)), `${source}: ${link} has no matching heading`);
      }
    }
  }
});

test('repository and consumer entrypoints expose their appropriate guidance and real commands', async() => {
  const agent = await readFile(resolve(root, 'AGENTS.md'), 'utf8');
  const readme = await readFile(resolve(root, 'readme.md'), 'utf8');
  assert.match(agent, /\[consumer guidance\]\(docs\/agents\.md\)/);
  assert.match(agent, /\[test guide\]\(test\/README\.md\)/);
  assert.match(readme, /\[agent entrypoint\]\(docs\/agents\.md\)/);
  assert.match(readme, /\[Consumer tooling\]\(docs\/tooling\.md\)/);
  const { scripts } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  for (const source of entrypoints) {
    const markdown = await readFile(resolve(root, source), 'utf8');
    for (const [, command] of markdown.matchAll(/npm run ([\w:-]+)/g)) {
      assert(Object.hasOwn(scripts, command), `${source}: npm run ${command} is not a package script`);
    }
  }
});

test('README installation pins match the Marionette package version', async() => {
  const markdown = await readFile(resolve(root, 'readme.md'), 'utf8');
  const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const commands = marked.lexer(markdown)
    .filter(token => token.type === 'code' && token.lang === 'sh')
    .flatMap(token => [...token.text.replace(/\\\r?\n/g, ' ').matchAll(/^\s*npm\s+(?:install|i)\s+(.+)$/gm)]
      .map(([, command]) => command));
  const specs = commands.flatMap(command => command.match(/"[^"]*"|'[^']*'|\S+/g) || [])
    .map(spec => spec.replace(/^(['"])(.*)\1$/, '$2'))
    .map(spec => spec.match(/^(marionette|@mnjs\/[\w-]+)(?:@(.*))?$/))
    .filter(Boolean);
  assert(specs.length, 'README must include Marionette installation commands');
  for (const [, name, pinned] of specs) {
    assert.equal(pinned, version, `${name} must install the exact version described by this README`);
  }
});
