import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('routing guidance links the released companion without broadening browser support', () => {
  const guide = read('docs/guides/routing.md');
  const router = JSON.parse(read('packages/router/package.json'));
  const html = JSON.parse(read('packages/html/package.json'));
  assert(guide.includes(`@mnjs/router@${router.version}`));
  assert(guide.includes(`@mnjs/html@${html.version}`));
  assert(guide.includes(`router-v${router.version}/packages/router/readme.md`));
  for (const capability of ['URLPattern', 'AbortSignal.any', 'Promise.withResolvers', 'URL.canParse', 'structuredClone']) {
    assert(guide.includes(capability), capability);
  }
  assert.match(guide, /Firefox and WebKit are untested/);
  assert.match(guide, /mountRoutes\(router\).*registers routes but does not activate/);
  assert.match(guide, /Stop retains registrations; destroy\nunmounts them/);
});

test('consumer entrypoints preserve existing routers and expose companion guidance', () => {
  for (const page of ['docs/agents.md', 'skills/marionette/SKILL.md', 'docs/guides/composition.md']) {
    const content = read(page);
    assert(content.includes('@mnjs/router'), page);
    assert(content.includes('Preserve an existing host router'), page);
  }
});
