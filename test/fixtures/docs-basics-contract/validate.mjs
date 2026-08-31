import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/basics.md');
const markdown = await readFile(docsPath, 'utf8');
const distDir = resolve(__dirname, 'dist');
const examplePath = resolve(distDir, 'class-configuration.mjs');
const marker = '<!-- executable-example: basics-class-configuration -->';

assert.equal(markdown.split(marker).length - 1, 1, 'expected one basics configuration marker');

const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(codeFence, 'expected a JavaScript fence immediately after the basics marker');

await mkdir(distDir, { recursive: true });
await writeFile(examplePath, codeFence[1], 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

try {
  const {
    cancelCalls,
    classNameBeforeRender,
    defaultCalls,
    overrideCalls,
    templateContext,
    templateData,
    view,
  } = await import(pathToFileURL(examplePath));

  assert.equal(view.optionsResolutionCount, 1, 'class options must resolve once during construction');
  assert.equal(view.classNameResolutionCount, 1, 'className must resolve while creating the element');
  assert.equal(view.getOption('tone'), 'urgent', 'constructor options must override class defaults');
  assert.equal(classNameBeforeRender, 'notice-urgent', 'className must resolve before the first render');
  assert.equal(view.getOption('enabled'), false, 'false must remain an intentional constructor override');
  assert.equal(view.getOption('count'), 0, 'zero must remain an intentional constructor override');
  assert.equal(view.getOption('label'), null, 'null must remain an intentional constructor override');
  assert.equal(templateContext, undefined, 'template must not receive the view as its context');
  assert.deepEqual(templateData, {}, 'template must receive serialized data');
  assert.equal(overrideCalls, 1, 'the constructor trigger map must replace the class trigger map');
  assert.equal(defaultCalls, 0, 'the replaced class trigger must not remain active');
  assert.equal(cancelCalls, 0, 'a class-only trigger must not be merged into the constructor map');
  assert.deepEqual(
    Object.keys(view.getOption('triggers')),
    ['click .save'],
    'the active trigger map must come from the constructor',
  );

  view.destroy();
  assert.equal(view.isDestroyed(), true, 'destroy must cleanly release the view');
} finally {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
