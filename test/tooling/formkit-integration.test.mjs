import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const workflow = parse(await readFile(new URL('.github/workflows/ci.yml', root), 'utf8'));

test('root FormKit verification executes the actual packed-consumer harness', () => {
  assert.equal(manifest.scripts['test:formkit'], 'npm --prefix packages/formkit run check:package');
  assert.equal(manifest.workspaces.filter(path => path === 'packages/formkit').length, 1);
  assert(manifest.scripts.build.includes('npm run build:formkit'));
});

test('FormKit packed verification and production lint belong to required CI lanes', () => {
  assert(workflow.jobs.test.needs.includes('core'));
  const packed = workflow.jobs.core.steps.find(step => step.run?.split('\n').includes('npm run test:formkit'));
  assert(packed, 'The core job must invoke the packed-consumer command');
  assert.equal(packed.if, undefined);
  assert.equal(packed['continue-on-error'], undefined);
  assert(packed.run.indexOf('npm run build:formkit') < packed.run.indexOf('npm run test:formkit'));
  assert(packed.run.includes('npm run coverage:formkit'));
  assert.equal(workflow.jobs.core['continue-on-error'], undefined);
  assert(packed.run.includes('npm run lint:formkit'), 'Active production lint must run in the required core job');
  assert(packed.run.indexOf('npm run lint:formkit') < packed.run.indexOf('npm run test:formkit'));
});


test('generated FormKit artifacts are ignored while active runtime remains linted', async() => {
  const eslint = new ESLint({ cwd: fileURLToPath(root) });
  assert.equal(await eslint.isPathIgnored(fileURLToPath(new URL('packages/formkit/coverage/example.js', root))), true);
  assert.equal(await eslint.isPathIgnored(fileURLToPath(new URL('packages/formkit/test/tmp/consumer.mjs', root))), true);
  assert.equal(await eslint.isPathIgnored(fileURLToPath(new URL('experiments/formkit-react-patterns/core/index.mjs', root))), false);
  assert.equal(await eslint.isPathIgnored(fileURLToPath(new URL('packages/formkit/src/index.mjs', root))), false);
});

for (const full of [false, true]) {
  test(`FormKit verification runs packed consumers and the selected unit/coverage gate: full=${full}`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'mnjs-formkit-verify-'));
    try {
      const log = join(directory, 'commands');
      const npm = join(directory, 'npm.mjs');
      writeFileSync(npm, 'import { appendFileSync } from \'node:fs\';appendFileSync(process.env.FORMKIT_VERIFY_LOG,process.argv[3]+\'\\n\');\n');
      const env = { ...process.env, npm_execpath: npm, FORMKIT_VERIFY_LOG: log };
      execFileSync(process.execPath, [fileURLToPath(new URL('scripts/checks/verify.mjs', root)), ...(full ? ['--full'] : [])], { env });
      const commands = readFileSync(log, 'utf8').trim().split('\n');
      assert(commands.indexOf('test:formkit') > commands.indexOf('build'));
      assert.equal(commands.includes('coverage:formkit'), full);
      assert.equal(commands.includes('test:formkit:unit'), !full);
    } finally {rmSync(directory, { recursive: true, force: true });}
  });
}
