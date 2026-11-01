import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Run only in the temporary installed consumer. Never move repository dependencies.
assert(realpathSync(process.cwd()).startsWith(join(realpathSync(tmpdir()), 'mnjs-test-consumer-')));
const hidden = mkdtempSync(join(tmpdir(), 'mnjs-test-hidden-peers-'));
const moved = [];
try {
  for (const name of ['cypress', '@cypress/mount-utils', 'vitest', '@testing-library/dom']) {
    if (name === '@testing-library/dom') {
      execFileSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { createRequire } from 'node:module';
        import { withQueries } from '@mnjs/test/testing-library';
        const require = createRequire(import.meta.url);
        assert.equal(typeof withQueries, 'function');
        assert.equal(typeof require('@mnjs/test/testing-library').withQueries, 'function');
        assert.equal(typeof globalThis.document, 'undefined');
        assert.equal(typeof globalThis.Cypress, 'undefined');
        console.log('Testing Library ESM/CommonJS imports need neither a DOM nor optional runners.');
      `], { stdio: 'inherit' });
    }
    const source = resolve('node_modules', name);
    const target = join(hidden, name);
    mkdirSync(dirname(target), { recursive: true });
    renameSync(source, target);
    moved.push([source, target]);
  }
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import * as core from '@mnjs/test';
    import { createGallery } from '@mnjs/test/playwright';
    const require = createRequire(import.meta.url);
    assert.equal(typeof createGallery, 'function');
    assert.equal(typeof require('@mnjs/test/playwright').createGallery, 'function');
    assert.deepEqual(Object.keys(require('@mnjs/test')).sort(), Object.keys(core).sort());
    await core.createTestScope().cleanup();
    await assert.rejects(import('@mnjs/test/testing-library'), error =>
      error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('@testing-library/dom'));
    assert.throws(() => require('@mnjs/test/testing-library'), { code: 'MODULE_NOT_FOUND' });
    assert.equal(typeof globalThis.Cypress, 'undefined');
    console.log('Neutral and gallery ESM/CommonJS imports work with optional runners and Testing Library absent.');
  `], { stdio: 'inherit' });
  const source = resolve('node_modules/marionette');
  const target = join(hidden, 'marionette');
  renameSync(source, target);
  moved.push([source, target]);
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { createTestScope } from '@mnjs/test/scope';
    const require = createRequire(import.meta.url);
    assert.throws(() => require.resolve('marionette'), { code: 'MODULE_NOT_FOUND' });
    assert.equal(typeof globalThis.document, 'undefined');
    assert.equal(typeof globalThis.Cypress, 'undefined');
    await createTestScope().cleanup();
    await require('@mnjs/test/scope').createTestScope().cleanup();
    console.log('Scope-only ESM/CommonJS imports need neither Marionette, a DOM nor optional runners.');
  `], { stdio: 'inherit' });
  writeFileSync('scope-only-tsconfig.json', JSON.stringify({ compilerOptions: {
    target: 'ES2024', lib: ['ES2024'], module: 'NodeNext', strict: true, noEmit: true, types: [], skipLibCheck: false
  }, include: ['scope-consumer.mts', 'scope-consumer.cts'] }));
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'scope-only-tsconfig.json'], { stdio: 'inherit' });

} finally {
  for (const [source, target] of moved.reverse()) { renameSync(target, source); }
  rmSync(hidden, { recursive: true, force: true });
}
