import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('routing guidance links the released companion and recorded browser coverage', () => {
  const guide = read('docs/guides/routing.md');
  const companions = JSON.parse(read('test/docs/companion-versions.json'));
  for (const version of Object.values(companions)) { assert.match(version, /^\d+\.\d+\.\d+$/); }
  const evidence = read('docs/packages/router.md').split('## Published example verification')[1];
  assert(guide.includes('../packages/router.md#published-example-verification'));
  for (const [name, version] of Object.entries(companions)) {
    assert(evidence.includes(`${name}@${version}`));
  }
  assert(guide.includes('node_modules/@mnjs/router/readme.md'));
  assert(read('docs/packages/router.md').includes(`router-v${companions['@mnjs/router']}/packages/router`));
  for (const capability of ['URLPattern', 'AbortSignal.any', 'Promise.withResolvers', 'URL.canParse', 'structuredClone']) {
    assert(guide.includes(capability), capability);
  }
  assert.match(guide, /Chromium, Firefox and Playwright WebKit/);
  assert(guide.includes('../packages/router.md#browser-coverage'));
  assert.match(guide, /mountRoutes\(router\).*registers routes but does not activate/);
  assert.match(guide, /Stop retains registrations; destroy\s+unmounts them/);
});

test('consumer Router docs describe versions rather than temporary release preparation', () => {
  const page = read('docs/packages/router.md');
  assert(page.includes('tag matching the installed release'));
  assert(page.includes('read the installed'));
  assert.doesNotMatch(page.split('## Read the installed contract first')[0], /\d+\.\d+\.\d+/);
  assert(page.includes('pre-v1 package'));
  for (const path of ['docs/packages/router.md', 'docs/packages/adapters.md']) {
    assert.doesNotMatch(read(path), /being prepared|preparation includes|work in progress/i);
  }
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
