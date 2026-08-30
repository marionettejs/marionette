import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/common.md');
const markdown = await readFile(docsPath, 'utf8');
const distDir = resolve(__dirname, 'dist');

async function importExample(id) {
  const marker = '<!-- ' + 'executable-example: ' + id + ' -->';
  assert.equal(markdown.split(marker).length - 1, 1, `expected one ${id} marker`);

  const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
  const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);
  assert.ok(codeFence, `expected a JavaScript fence immediately after ${id}`);

  const examplePath = resolve(distDir, `${id}.mjs`);
  await writeFile(examplePath, codeFence[1], 'utf8');
  return import(pathToFileURL(examplePath));
}

await mkdir(distDir, { recursive: true });

// <!-- executable-example: common-options -->
const options = await importExample('common-options');
assert.equal(options.rawMode, undefined, 'initialize must receive the raw constructor options');
assert.equal(options.example.getOption('mode'), 'default', 'getOption must read class defaults');
assert.equal(options.example.getOption('enabled'), false, 'explicit false must override the instance value');
assert.equal(options.example.service, options.example.getOption('service'), 'mergeOptions must copy selected options');
assert.equal(options.example.extra, undefined, 'mergeOptions must not copy unselected options');

// <!-- executable-example: common-owner-bindings -->
const bindings = await importExample('common-owner-bindings');
assert.deepEqual(bindings.owner.messages, ['ready'], 'the owner must receive its bound event once');
assert.equal(bindings.ownerReply, 'ready', 'the request must use the owner as reply context');
assert.deepEqual(bindings.unrelatedMessages, ['ready', 'after'], 'owner cleanup must preserve unrelated listeners');
assert.equal(bindings.ownerReplyAfterCleanup, undefined, 'owner cleanup must remove the owner reply');
assert.equal(bindings.unrelatedReplyAfterCleanup, 'other', 'owner cleanup must preserve unrelated replies');

bindings.Radio.reset();
