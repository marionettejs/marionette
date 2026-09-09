import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildDevelopmentKit, verifyDevelopmentKit } from '../../scripts/docs/development-kit.mjs';

const hash = value => createHash('sha512').update(value).digest('hex');
for (const [name, mutate, expected] of [
  ['unchanged kit', async() => {}, null],
  ['missing report', async context => { context.report.file = undefined; }, /Missing development starter report/],
  ['changed archive', async context => { await writeFile(join(context.directory, 'development-starter.tar.gz'), 'changed'); }, /archive checksum mismatch/],
  ['changed report', async context => { context.report.sha512 = 'changed'; }, /checksum mismatch/],
  ['different source', async context => { context.commit = 'different'; }, /source or inventory mismatch/],
  ['changed file', async context => { await writeFile(join(context.directory, 'starter/package-lock.json'), 'changed'); }, /file mismatch/],
  ['extra file', async context => { await writeFile(join(context.directory, 'starter/extra.json'), '{}'); }, /file inventory mismatch/],
  ['linked file', async context => {
    const target = join(context.directory, 'outside-lock.json');
    await writeFile(target, '{}');
    const link = join(context.directory, 'starter/package-lock.json');
    await rm(link); await symlink(target, link);
  }, /regular file/],
  ['linked starter', async context => {
    const target = join(context.directory, 'outside-starter');
    await rename(join(context.directory, 'starter'), target);
    await symlink(target, join(context.directory, 'starter'), 'junction');
  }, /real directory/],
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

for (const [name, integrity, lock, expected] of [
  ['missing integrity and lock entry', undefined, {}, /does not lock/],
  ['empty integrity', '', { 'node_modules/marionette': { integrity: '' } }, /does not lock/],
  ['missing lock entry', 'sha512-selected', {}, /does not lock/],
  ['different locked integrity', 'sha512-selected', { 'node_modules/marionette': { integrity: 'sha512-other' } }, /does not lock/],
  ['changed external dependency', 'sha512-selected', { 'node_modules/locked-tool': { version: '2.0.0' } }, /external dependency graph/],
]) {
  test(`portable starter construction rejects ${name}`, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'marionette-kit-input-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const source = join(directory, 'source');
    const artifactDir = join(directory, 'artifact');
    await mkdir(source); await mkdir(artifactDir);
    await writeFile(join(source, 'package.json'), JSON.stringify({ name: 'starter', private: true }));
    const external = { 'node_modules/locked-tool': { version: '1.0.0' } };
    await writeFile(join(source, 'package-lock.json'), JSON.stringify({ packages: external }));
    const npmCli = join(directory, 'npm.mjs');
    await writeFile(npmCli, `import { writeFileSync } from 'node:fs';
writeFileSync('package-lock.json', ${JSON.stringify(JSON.stringify({ packages: { ...external, ...lock } }))});`);
    await assert.rejects(buildDevelopmentKit({ source, toolingLock: join(source, 'package-lock.json'), artifactDir, sourceCommit: 'selected', npmCli,
      packages: [{ name: 'marionette', tarball: { file: 'candidate.tgz', integrity } }]
    }), expected);
  });
}
