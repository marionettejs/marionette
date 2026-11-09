import { JSDOM } from 'jsdom';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const consumer = process.argv[2];
if (!consumer) { throw new Error('Pass the installed consumer directory'); }
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://desk.example/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
try {
  if (process.argv[3] !== '--catalog-only') {
    const { verifyConsumer } = await import(pathToFileURL(join(resolve(consumer), 'desk/verify.mjs')));
    await verifyConsumer();
  }
  const { verifyCatalog } = await import(pathToFileURL(join(resolve(consumer), 'catalog/verify.mjs')));
  await verifyCatalog();
} finally { dom.window.close(); }
