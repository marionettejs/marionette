import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run in the isolated, installed consumer. Recipes retain their public imports.
const packageRoot = resolve('node_modules/@mnjs/test');
const readme = readFileSync(resolve(packageRoot, 'readme.md'), 'utf8');
const guide = readFileSync(resolve(packageRoot, 'guide.md'), 'utf8');
// Relative documentation links must resolve inside the installed helper, including anchors.
for (const [name, text] of [['readme.md', readme], ['guide.md', guide]]) {
  for (const [, href] of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(href)) {
      if (href.startsWith('https://github.com/marionettejs/marionette/')) {
        const example = href.match(/^https:\/\/github\.com\/marionettejs\/marionette\/(?:blob|tree)\/master\/packages\/test\/examples(?:\/(.*))?$/);
        assert(example, `Unexpected repository-example reference: ${href}`);
        assert(existsSync(resolve(example[1] || '.')), `Missing repository-example path: ${href}`);
      }
      continue;
    }
    const [file, anchor] = href.split('#');
    const destination = resolve(packageRoot, file || name);
    assert(!relative(packageRoot, destination).split(/[\\/]/).includes('..'), `Documentation escaped the installed helper: ${href}`);
    assert(existsSync(destination), `Missing installed documentation: ${href}`);
    if (anchor) {
      const headings = [...readFileSync(destination, 'utf8').matchAll(/^#+ (.+)$/gm)].map(([, title]) =>
        title.toLowerCase().replace(/[^a-z0-9 _-]/g, '').replace(/ /g, '-'));
      assert(headings.includes(anchor), `Missing installed documentation anchor: ${href}`);
    }
  }
}
assert(!/RELEASING|test:helpers:consumer|From the Marionette repository/.test(readme + guide));
function blocks(heading, language, count, level = 2, text = guide) {
  const section = text.split(`${'#'.repeat(level)} ${heading}\n`)[1]?.split(new RegExp(`\\n#{1,${level}} `))[0];
  assert(section, `Missing README section: ${heading}`);
  const found = [...section.matchAll(new RegExp('```' + language + '\\n([\\s\\S]*?)\\n```', 'g'))]
    .map(match => match[1]);
  assert.equal(found.length, count, `Changed consumer recipe count: ${heading}`);
  return found;
}
const neutral = [
  ...blocks('Mount a View', 'js', 1, 3),
  ...blocks('Mount an Application', 'js', 2, 3),
  ...blocks('Own a test\'s resources', 'js', 1, 3)
];
for (const [index, source] of neutral.entries()) {
  const before = [...document.body.childNodes];
  const path = resolve(`readme-neutral-${index}.mjs`);
  writeFileSync(path, source);
  await import(pathToFileURL(path).href);
  assert.deepEqual([...document.body.childNodes], before, `README neutral recipe ${index} leaked DOM`);
}
writeFileSync('readme.spec.js', blocks('Vitest: own mounts per test', 'js', 1)[0]);
writeFileSync('readme-testing-library.spec.js', blocks('Testing Library: query an existing mount', 'js', 1)[0]);
writeFileSync('cypress/readme-commands.ts', blocks('Cypress: register cy.mount once', 'ts', 1)[0]);
const [gallery, spec] = blocks('Playwright: mount named browser stories', 'js', 3);
writeFileSync('guide-playwright.config.mjs', blocks('Playwright configuration', 'js', 1, 3)[0]);
const playwrightConfig = (await import(pathToFileURL(resolve('guide-playwright.config.mjs')).href)).default;
assert.equal(playwrightConfig.testDir, './playwright');
assert.equal(playwrightConfig.use.baseURL, playwrightConfig.webServer.url);
assert.equal(playwrightConfig.webServer.reuseExistingServer, false);
writeFileSync('guide-cypress.config.mjs', blocks('Cypress configuration', 'js', 3, 3)[0]);
const cypressConfig = (await import(pathToFileURL(resolve('guide-cypress.config.mjs')).href)).default;
assert.equal(cypressConfig.component.specPattern, 'cypress/component/**/*.cy.js');
assert.equal(cypressConfig.component.supportFile, 'cypress/support/component.js');
assert.equal(cypressConfig.component.indexHtmlFile, 'cypress/support/component-index.html');
assert(blocks('Cypress configuration', 'html', 1, 3)[0].includes('data-cy-root'));
assert(blocks('Playwright configuration', 'html', 1, 3)[0].includes('src="./gallery.js"'));
writeFileSync('gallery/readme.js', gallery);
writeFileSync('gallery/readme.html', '<!doctype html><title>Guide recipe</title><div id="root"></div><script type="module" src="./readme.js"></script>');
writeFileSync('playwright/readme.spec.js', spec + '\ntest.use({ baseURL: "http://127.0.0.1:4187/gallery/readme.html" });\n');
mkdirSync('test', { recursive: true });
const [config, quickstart] = blocks('Write a test with Vitest', 'js', 2, 2, readme);
writeFileSync('readme-quickstart.config.mjs', config);
writeFileSync('test/readme-quickstart.spec.js', quickstart);
console.log('Four neutral guide recipes passed; Vitest, Playwright and Cypress command declarations extracted for runner/type checks.');
