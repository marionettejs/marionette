import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const consumer = process.argv[2];
if (!consumer) { throw new Error('Pass the installed consumer directory'); }
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://desk.example/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
const retained = document.body.appendChild(document.createElement('section'));
retained.textContent = 'Outside the example';
try {
  if (process.argv[3] !== '--catalog-only') {
    const { verifyConsumer } = await import(pathToFileURL(join(resolve(consumer), 'desk/verify.mjs')));
    await verifyConsumer();
    assert.deepEqual([...document.body.children], [retained], 'Desk verification must remove only its fixture-owned hosts');
  }
  const { verifyCatalog } = await import(pathToFileURL(join(resolve(consumer), 'catalog/verify.mjs')));
  await verifyCatalog();
  assert.deepEqual([...document.body.children], [retained], 'Catalog verification must preserve caller-owned DOM');
} finally { dom.window.close(); }
