import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReferenceServer, startReferenceApp } from '../../scripts/agent-benchmark/serve.mjs';

async function fixture(directory) {
  const publicRoot = join(directory, 'public');
  const modules = join(directory, 'modules');
  for (const path of ['app', 'tasks/example/reference', 'tasks/example/acceptance']) { await mkdir(join(publicRoot, path), { recursive: true }); }
  await mkdir(modules, { recursive: true });
  await writeFile(join(publicRoot, 'app/index.html'), '<!-- IMPORT_MAP -->');
  await writeFile(join(publicRoot, 'corpus.json'), 'withheld');
  await writeFile(join(publicRoot, 'tasks/example/acceptance/secret.mjs'), 'withheld');
  await writeFile(join(publicRoot, 'tasks/example/reference/solution.mjs'), 'reference');
  await writeFile(join(modules, 'entry.js'), 'module');
  return { publicRoot, modules, imports: { example: '/modules/entry.js' } };
}

test('HTTP serving contains normalized paths and symbolic links within each allowed tree', async() => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-server-'));
  let server;
  try {
    const resources = await fixture(directory);
    await writeFile(join(directory, 'outside'), 'private');
    await symlink(join(directory, 'outside'), join(resources.publicRoot, 'app/external'));
    await symlink(join(resources.publicRoot, 'corpus.json'), join(resources.publicRoot, 'app/hidden'));
    server = await createReferenceServer(resources);
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/corpus.json', '/tasks/example/acceptance/secret.mjs',
      '/tasks/example/reference/%2e%2e%2facceptance%2fsecret.mjs', '/app/%2e%2e%2fcorpus.json',
      '/app/%2e%2e%5ccorpus.json', '/app/external', '/app/hidden']) {
      assert.equal((await fetch(`${origin}${path}`)).status, 404, path);
    }
    assert.equal(await (await fetch(`${origin}/tasks/example/reference/solution.mjs`)).text(), 'reference');
    assert.equal(await (await fetch(`${origin}/modules/entry.js`)).text(), 'module');
  } finally {
    if (server) { await new Promise(done => server.close(done)); }
    await rm(directory, { recursive: true, force: true });
  }
});

test('artifact import-map values cannot terminate the script element', async() => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-import-map-'));
  let server;
  try {
    const resources = await fixture(directory);
    resources.imports.example = '/modules/</script><script>unexpected()</script>';
    server = await createReferenceServer(resources);
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    const html = await (await fetch(`http://127.0.0.1:${server.address().port}/`)).text();
    assert.equal((html.match(/<\/script>/g) || []).length, 1);
    const json = html.match(/^<script type="importmap">([\s\S]*)<\/script>$/)[1];
    assert.deepEqual(JSON.parse(json), { imports: resources.imports });
  } finally {
    if (server) { await new Promise(done => server.close(done)); }
    await rm(directory, { recursive: true, force: true });
  }
});

test('failed preparation and occupied ports remove only the owned temporary directory', async() => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-startup-'));
  let running;
  try {
    await assert.rejects(startReferenceApp({ temporaryRoot: directory, prepare: async({ directory: owned }) => {
      await writeFile(join(owned, 'partial'), 'temporary');
      throw new Error('preparation failed');
    } }), /preparation failed/);
    assert.deepEqual(await readdir(directory), []);
    running = await startReferenceApp({ temporaryRoot: directory, port: 0, prepare: ({ directory: owned }) => fixture(owned) });
    const before = await readdir(directory);
    await assert.rejects(startReferenceApp({ temporaryRoot: directory, port: running.server.address().port,
      prepare: ({ directory: owned }) => fixture(owned) }), { code: 'EADDRINUSE' });
    assert.deepEqual(await readdir(directory), before);
    await running.close();
    await running.close();
    assert.deepEqual(await readdir(directory), []);
  } finally {
    if (running) { await running.close(); }
    await rm(directory, { recursive: true, force: true });
  }
});
