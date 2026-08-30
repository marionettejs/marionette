import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/utils.md');
const distPath = resolve(__dirname, 'dist');
const docs = await readFile(docsPath, 'utf8');

await rm(distPath, { force: true, recursive: true });
await mkdir(distPath, { recursive: true });

async function importExample(id) {
  // Keep the fixture's ownership markers from being counted as documentation markers.
  const marker = `<!${'--'} executable-example: ${id} --${'>'}`;
  const markerIndex = docs.indexOf(marker);

  assert.notEqual(markerIndex, -1, `Missing ${marker}`);

  const afterMarker = docs.slice(markerIndex + marker.length);
  const match = afterMarker.match(/```javascript\n([\s\S]*?)\n```/);

  assert.ok(match, `Missing JavaScript block after ${marker}`);

  const outputPath = resolve(distPath, `${id}.mjs`);
  await writeFile(outputPath, match[1]);

  return import(pathToFileURL(outputPath));
}

// <!-- executable-example: utils-owned-extend -->
const extendExample = await importExample('utils-owned-extend');

assert.ok(extendExample.service instanceof extendExample.Service);
assert.equal(extendExample.service.label(), 'special:api');
assert.equal(extendExample.SpecialService.kind, 'special');
assert.equal(extendExample.SpecialService.extend, extendExample.extend);

// <!-- executable-example: utils-target-first-proxies -->
const proxyExample = await importExample('utils-target-first-proxies');

assert.equal(proxyExample.optionValue, false);
assert.equal(proxyExample.target.selected, 'copied');
assert.equal(proxyExample.target.ignored, undefined);
assert.notEqual(proxyExample.normalized, proxyExample.normalizedInput);
assert.equal(proxyExample.normalized.status, proxyExample.target.onStatus);
assert.equal(proxyExample.triggerResult, 'READY');
assert.deepEqual(proxyExample.target.utilityCalls, [
  'method:ready',
  'event:ready',
]);
assert.deepEqual(proxyExample.target.messages, ['before-cleanup']);
assert.deepEqual(proxyExample.unrelatedMessages, [
  'before-cleanup',
  'after-cleanup',
]);
assert.equal(proxyExample.ownerReply, 'before-cleanup');
assert.equal(proxyExample.ownerReplyAfterCleanup, undefined);
assert.equal(proxyExample.unrelatedReplyAfterCleanup, 'other');

const packageJson = JSON.parse(
  await readFile(
    resolve(__dirname, 'node_modules/marionette/package.json'),
    'utf8',
  ),
);
assert.equal(proxyExample.VERSION, packageJson.version);

proxyExample.Radio.reset();
