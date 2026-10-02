import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createProductionServer } from './production-package.mjs';

test('production hosting serves only recognized entry/assets and revalidates HTML', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'marionette-hosting-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Initial</title>');
  await writeFile(join(directory, 'assets/main-123.js'), 'console.log("bundle");');
  const hosting = await createProductionServer({ directory, records: '[]' });
  t.after(() => hosting.close());
  const redirect = await fetch(`${hosting.origin}/records`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/records/');
  const entry = await fetch(`${hosting.origin}/records/`);
  assert.equal(entry.status, 200);
  assert.equal(entry.headers.get('cache-control'), 'no-cache');
  const etag = entry.headers.get('etag');
  assert.equal((await fetch(`${hosting.origin}/records/`, { headers: { 'if-none-match': etag } })).status, 304);
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Updated</title>');
  const updated = await fetch(`${hosting.origin}/records/`, { headers: { 'if-none-match': etag } });
  assert.equal(updated.status, 200);
  assert.notEqual(updated.headers.get('etag'), etag);
  assert.match(await updated.text(), /Updated/);
  const asset = await fetch(`${hosting.origin}/records/assets/main-123.js`);
  assert.equal(asset.headers.get('content-type'), 'text/javascript');
  assert.match(asset.headers.get('cache-control'), /immutable/);
  const next = join(directory, 'next');
  await mkdir(join(next, 'assets'), { recursive: true });
  await writeFile(join(next, 'index.html'), '<!doctype html><title>Next build</title>');
  await writeFile(join(next, 'assets/main-456.js'), 'console.log("updated bundle");');
  hosting.control.retainedDirectories = [directory];
  hosting.control.directory = next;
  assert.match(await (await fetch(`${hosting.origin}/records/`)).text(), /Next build/);
  assert.equal((await fetch(`${hosting.origin}/records/assets/main-456.js`)).status, 200);
  const previous = await fetch(`${hosting.origin}/records/assets/main-123.js`);
  assert.equal(previous.status, 200);
  assert.equal(await previous.text(), 'console.log("bundle");');
  for (const path of ['/records/assets/missing.js', '/api/missing.json', '/records/unknown', '/records/assets/../index.html']) {
    const response = await fetch(`${hosting.origin}${path}`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'Not found');
  }
});

test('production hosting preserves API failure and controlled pending transport', { timeout: 5_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'marionette-hosting-api-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const hosting = await createProductionServer({ directory, records: '[{"id":"one"}]' });
  t.after(() => hosting.close());
  hosting.control.mode = 'failure';
  const unavailable = await fetch(`${hosting.origin}/api/records.json`);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('content-type'), 'application/json');
  assert.equal(unavailable.headers.get('cache-control'), 'no-store');
  hosting.control.mode = 'pending';
  const pending = fetch(`${hosting.origin}/api/records.json`);
  while (!hosting.control.pending.size) { await new Promise(done => setImmediate(done)); }
  hosting.settlePending();
  assert.deepEqual(await (await pending).json(), [{ id: 'one' }]);
  assert.equal(hosting.control.pending.size, 0);
});
