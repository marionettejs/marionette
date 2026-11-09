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
  const { verifyConsumer } = await import(pathToFileURL(join(resolve(consumer), 'desk/verify.mjs')));
  await verifyConsumer();
  const { verifyMount } = await import(pathToFileURL(join(resolve(consumer), 'mount/verify.mjs')));
  await verifyMount();
} finally { dom.window.close(); }
