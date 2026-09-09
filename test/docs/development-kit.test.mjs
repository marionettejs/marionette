import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyDevelopmentKit } from '../../scripts/docs/development-kit.mjs';

const hash = value => createHash('sha512').update(value).digest('hex');
for (const [name, mutate, expected] of [
  ['unchanged kit', async() => {}, null],
  ['missing report', async context => { context.report.file = undefined; }, /Missing development starter report/],
  ['changed archive', async context => { await writeFile(join(context.directory, 'development-starter.tar.gz'), 'changed'); }, /archive checksum mismatch/],
  ['changed report', async context => { context.report.sha512 = 'changed'; }, /checksum mismatch/],
  ['different source', async context => { context.commit = 'different'; }, /source or inventory mismatch/],
  ['changed file', async context => { await writeFile(join(context.directory, 'starter/package-lock.json'), 'changed'); }, /file mismatch/],
  ['extra file', async context => { await writeFile(join(context.directory, 'starter/extra.json'), '{}'); }, /file inventory mismatch/],
  ['removed file', async context => { await rm(join(context.directory, 'starter/package-lock.json')); }, /file inventory mismatch/],
]) {
  test(`portable starter verification checks ${name}`, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'marionette-kit-check-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await mkdir(join(directory, 'starter'));
    await writeFile(join(directory, 'starter/package-lock.json'), '{}');
    await writeFile(join(directory, 'development-starter.tar.gz'), 'archive');
    const bytes = JSON.stringify({ sourceCommit: 'selected', files: { 'package-lock.json': hash('{}') } });
    await writeFile(join(directory, 'development-starter.json'), bytes);
    const context = { directory, commit: 'selected', report: { file: 'development-starter.json', sha512: hash(bytes), archive: { file: 'development-starter.tar.gz', sha512: hash('archive') } } };
    await mutate(context);
    const check = verifyDevelopmentKit(directory, context.report, context.commit);
    if (expected) { await assert.rejects(check, expected); } else { await check; assert.equal(await readFile(join(directory, 'starter/package-lock.json'), 'utf8'), '{}'); }
  });
}
