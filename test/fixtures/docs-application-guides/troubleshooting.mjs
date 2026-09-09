import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const markdown = await readFile(resolve(import.meta.dirname, '../../../docs/troubleshooting.md'), 'utf8');
const examples = [...markdown.matchAll(/<!-- troubleshooting-example: (MN\d{4}) -->\s*```javascript\n([\s\S]*?)\n```/g)];
assert.deepEqual(examples.map(example => example[1]), ['MN0020', 'MN0003', 'MN0023', 'MN0007']);
const expected = { MN0020: 'Ready', MN0003: true, MN0023: 'Save', MN0007: 'New' };
const dom = new JSDOM('<main></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try {
  const directory = resolve(import.meta.dirname, 'dist');
  await mkdir(directory, { recursive: true });
  for (const [, code, source] of examples) {
    const file = resolve(directory, `${code}.mjs`);
    await writeFile(file, source);
    const example = await import(pathToFileURL(file));
    try {
      assert.throws(example.fail, error => error.code === code);
      assert.equal(example.fix(), expected[code]);
    } finally { example.cleanup(); }
  }
} finally {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
