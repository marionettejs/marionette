import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Run only in the temporary installed consumer. Never move repository dependencies.
assert(realpathSync(process.cwd()).startsWith(join(realpathSync(tmpdir()), 'mnjs-test-consumer-')));
const hidden = mkdtempSync(join(tmpdir(), 'mnjs-test-hidden-peers-'));
const moved = [];
try {
  for (const name of ['cypress', '@cypress/mount-utils', 'vitest']) {
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
    assert.equal(typeof globalThis.Cypress, 'undefined');
    console.log('Neutral and gallery ESM/CommonJS imports work with all optional runners absent.');
  `], { stdio: 'inherit' });
} finally {
  for (const [source, target] of moved.reverse()) { renameSync(target, source); }
  rmSync(hidden, { recursive: true, force: true });
}
