import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/radio.md');
const marker = '<!-- executable-example: radio-owner-lifecycle -->';
const markdown = await readFile(docsPath, 'utf8');

assert.equal(markdown.split(marker).length - 1, 1, 'expected one executable example marker');

const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

assert.ok(codeFence, 'expected a JavaScript fence immediately after the marker');

const distDir = resolve(__dirname, 'dist');
const examplePath = resolve(distDir, 'example.mjs');

await mkdir(distDir, { recursive: true });
await writeFile(examplePath, codeFence[1], 'utf8');

const example = await import(pathToFileURL(examplePath));
const { Radio } = await import('marionette');
const {
  Notifications,
  channel,
  notifications,
} = example;

try {
  const message = notifications.messages[0];
  const count = channel.request('message:count');

  assert.equal(notifications.getChannel(), channel, 'the owner must use the named channel');
  assert.equal(Radio.channel('notifications'), channel, 'the named channel must be shared');
  assert.equal(count, 1, 'the request must observe the delivered message');
  assert.deepEqual(notifications.messages, [message], 'the event must reach its owner once');
  assert.ok(notifications instanceof Notifications, 'the example must export its owner class');

  notifications.destroy();
  channel.trigger('message:received', { text: 'Ignored' });

  assert.deepEqual(notifications.messages, [message], 'destroy must remove the owner event binding');
  assert.equal(channel.request('message:count'), undefined, 'destroy must remove the owner reply');

  let unrelatedCount = 0;
  channel.on('unrelated', () => {
    unrelatedCount += 1;
  });

  assert.throws(() => Radio.reset('missing'), error => error.code === 'MN0021');
  for (const name of ['', null, false, 0, undefined]) {
    assert.throws(() => Radio.reset(name), error => error.code === 'MN0017');
  }

  channel.trigger('unrelated');
  assert.equal(unrelatedCount, 1, 'invalid reset calls must not change existing channels');

  Radio.reset('notifications');
  assert.equal(Radio.channel('notifications'), channel, 'named reset must preserve channel identity');
  channel.trigger('unrelated');
  assert.equal(unrelatedCount, 1, 'named reset must clear channel handlers');
} finally {
  Radio.reset();
}
