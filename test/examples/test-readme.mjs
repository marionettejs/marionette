import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run in the isolated, installed consumer. Recipes retain their public imports.
const readme = readFileSync('node_modules/@mnjs/test/readme.md', 'utf8');
function blocks(heading, language, count) {
  const section = readme.split(`## ${heading}\n`)[1]?.split('\n## ')[0];
  assert(section, `Missing README section: ${heading}`);
  const found = [...section.matchAll(new RegExp('```' + language + '\\n([\\s\\S]*?)\\n```', 'g'))]
    .map(match => match[1]);
  assert.equal(found.length, count, `Changed README recipe count: ${heading}`);
  return found;
}
const neutral = [
  ...blocks('Mount a View', 'js', 1),
  ...blocks('Mount an Application', 'js', 2),
  ...blocks('Own a test\'s resources', 'js', 1)
];
for (const [index, source] of neutral.entries()) {
  const before = [...document.body.childNodes];
  const path = resolve(`readme-neutral-${index}.mjs`);
  writeFileSync(path, source);
  await import(pathToFileURL(path).href);
  assert.deepEqual([...document.body.childNodes], before, `README neutral recipe ${index} leaked DOM`);
}
writeFileSync('readme.spec.js', blocks('Vitest: own mounts per test', 'js', 1)[0]);
writeFileSync('cypress/readme-commands.ts', blocks('Cypress: register cy.mount once', 'ts', 1)[0]);
const [gallery, spec] = blocks('Playwright: mount named browser stories', 'js', 2);
writeFileSync('gallery/readme.js', gallery);
writeFileSync('gallery/readme.html', '<!doctype html><title>Guide recipe</title><div id="root"></div><script type="module" src="./readme.js"></script>');
writeFileSync('playwright/readme.spec.js', spec + '\ntest.use({ baseURL: "http://127.0.0.1:4187/gallery/readme.html" });\n');
console.log('Four neutral guide recipes passed; Vitest, Playwright and Cypress command declarations extracted for runner/type checks.');
