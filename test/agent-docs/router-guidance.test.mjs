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
  assert(guide.includes('node_modules/@mnjs/router/readme.md'));
  assert(read('docs/packages/router.md').includes(`router-v${router.version}/packages/router`));
  for (const capability of ['URLPattern', 'AbortSignal.any', 'Promise.withResolvers', 'URL.canParse', 'structuredClone']) {
    assert(guide.includes(capability), capability);
  }
  assert.match(guide, /Firefox and WebKit are untested/);
  assert.match(guide, /mountRoutes\(router\).*registers routes but does not activate/);
  assert.match(guide, /Stop retains registrations; destroy\s+unmounts them/);
});

test('consumer entrypoints preserve existing routers and expose companion guidance', () => {
  for (const page of ['docs/agents.md', 'skills/marionette/SKILL.md', 'docs/guides/composition.md']) {
    const content = read(page);
    assert(content.includes('@mnjs/router'), page);
    assert(content.includes('Preserve an existing host router'), page);
  }
});

test('primary routing example uses Router while native navigation stays an alternative', () => {
  const guide = read('docs/guides/routing.md');
  assert.match(guide, /import \{ Router, RouteApplication \} from '@mnjs\/router'/);
  assert(!guide.includes('addEventListener(\'hashchange\''));
  assert(guide.includes('fragment-navigation.md'));
  assert(read('docs/guides/fragment-navigation.md').includes('addEventListener(\'hashchange\''));
  assert(read('test/docs/router-companion.mjs').includes('\'docs/guides/routing.md\''));
});

test('HTML task route prioritizes installed companion docs over the core snapshot', () => {
  const skill = read('skills/marionette/SKILL.md');
  assert.match(skill, /Use @mnjs\/html templates and directives \| `docs\/packages\/html.md`/);
  const guide = read('docs/packages/html.md');
  assert(guide.includes('node_modules/@mnjs/html/guide.md'));
  assert(guide.indexOf('node_modules/@mnjs/html/guide.md') < guide.indexOf('../../packages/html/guide.md'));
  assert.match(guide, /take precedence/);
  assert.match(guide, /source tag matching the installed HTML release/);
});
