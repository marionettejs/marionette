import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';

const markdown = await readFile(new URL('../../../docs/application-effects.md', import.meta.url), 'utf8');
const code = markdown.match(/<!-- executable-example: application-preparation-commit -->\n```javascript\n([\s\S]*?)\n```/);
assert.ok(code);
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
const example = new URL('./dist/preparation.mjs', import.meta.url);
await writeFile(example, code[1]);
const { createPreparedFeature } = await import(example);

await test('preparation commit follows the originating operation', async t => {
  await t.test('commits a value only after successful validation', async() => {
    const validation = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const committed = [];
    const app = createPreparedFeature({
      load: async() => 'ready',
      validate(value) { entered.resolve(value); return validation.promise; },
      commit(value) { committed.push(value); }
    });
    try {
      const starting = app.start();
      assert.equal(await entered.promise, 'ready');
      assert.deepEqual(committed, []);
      validation.resolve();
      assert.equal(await starting, true);
      assert.deepEqual(committed, ['ready']);
    } finally { validation.resolve(); await app.destroy(); }
  });

  await t.test('does not validate or commit a late load after cancellation', async() => {
    const loading = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const settled = Promise.withResolvers();
    const validated = [];
    const committed = [];
    const app = createPreparedFeature({
      async load() {
        entered.resolve();
        try { return await loading.promise; } finally { settled.resolve(); }
      },
      async validate(value) { validated.push(value); },
      commit(value) { committed.push(value); }
    });
    try {
      const starting = app.start();
      await entered.promise;
      assert.equal(await app.stop(), true);
      assert.equal(await starting, false);
      loading.resolve('late');
      await settled.promise;
      // Let the documented preparation continuation consume the settled load.
      await Promise.resolve();
      assert.deepEqual(validated, []);
      assert.deepEqual(committed, []);
    } finally { loading.resolve('cleanup'); await app.destroy(); }
  });

  await t.test('does not commit old validation after a newer successful start', async() => {
    const validation = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const settled = Promise.withResolvers();
    const committed = [];
    let request = 0;
    const app = createPreparedFeature({
      load: async() => ++request,
      async validate(value) {
        if (value !== 1) { return; }
        entered.resolve();
        try { await validation.promise; } finally { settled.resolve(); }
      },
      commit(value) { committed.push(value); }
    });
    try {
      const oldStart = app.start();
      await entered.promise;
      assert.equal(await app.stop(), true);
      assert.equal(await oldStart, false);
      assert.equal(await app.start(), true);
      assert.deepEqual(committed, [2]);
      validation.resolve();
      await settled.promise;
      await Promise.resolve();
      assert.equal(app.isRunning(), true);
      assert.deepEqual(committed, [2]);
    } finally { validation.resolve(); await app.destroy(); }
  });
});
