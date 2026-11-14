import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { htmlCandidate } from '../../test/docs/html-candidate.mjs';
import { readArguments } from './arguments.mjs';

// This archive is a same-run build transfer, never a publication artifact or a
// cache. The expected hash must come from the producing job's output.
const root = resolve(import.meta.dirname, '../..');
const args = readArguments({
  mode: { type: 'string' },
  directory: { type: 'string', default: 'test/tmp/build-outputs' },
  sha256: { type: 'string' },
});
assert(['capture', 'restore'].includes(args.mode), 'Choose --mode capture or restore');
const paths = ['dist', '.package', 'src/version.js', 'packages/html/artifacts', ...['utils', 'radio', 'data', 'adapters', 'test', 'router'].map(name => `packages/${name}/dist`)];
const directory = resolve(root, args.directory);
const run = (command, parameters, cwd = root) => execFileSync(command, parameters, { cwd, encoding: 'utf8' }).trim();
assert(process.env.npm_execpath, 'Run through npm run release:outputs');
const identity = {
  sourceCommit: run('git', ['rev-parse', 'HEAD']),
  node: process.versions.node,
  npm: run(process.execPath, [process.env.npm_execpath, '--version']),
  lockSha256: createHash('sha256').update(await readFile(resolve(root, 'package-lock.json'))).digest('hex'),
  paths,
};
const profile = JSON.parse(await readFile(resolve(root, 'config/release-profile.json')));
assert.equal(identity.node, profile.source.node, 'Use the pinned source Node');
assert.equal(identity.npm, profile.source.npm, 'Use the pinned source npm');
const archive = join(directory, 'build-outputs.tar');
const temporary = await mkdtemp(join(tmpdir(), 'marionette-build-outputs-'));
try {
  if (args.mode === 'capture') {
    await mkdir(directory, { recursive: true });
    await writeFile(join(temporary, 'identity.json'), JSON.stringify(identity));
    run('tar', ['-cf', archive, '-C', temporary, 'identity.json', '-C', root, ...paths]);
    const sha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
    if (process.env.GITHUB_OUTPUT) { await writeFile(process.env.GITHUB_OUTPUT, `sha256=${sha256}\n`, { flag: 'a' }); }
    console.log(sha256);
  } else {
    assert.match(args.sha256 || '', /^[a-f0-9]{64}$/, 'Supply the producer job output as --sha256');
    assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'), args.sha256, 'Build output checksum mismatch');
    // Check the authenticated identity before touching any checkout output.
    const received = JSON.parse(run('tar', ['-xOf', archive, 'identity.json']));
    assert.deepEqual(received, identity, 'Build outputs require the exact source SHA, lockfile and toolchain');
    run('tar', ['-xf', archive, '-C', temporary]);
    for (const path of paths) {
      await rm(resolve(root, path), { recursive: true, force: true });
      await mkdir(dirname(resolve(root, path)), { recursive: true });
      await cp(join(temporary, path), resolve(root, path), { recursive: true });
    }
    if (process.env.GITHUB_ENV) {
      delete process.env.MNJS_HTML_TARBALL;
      await writeFile(process.env.GITHUB_ENV, `MNJS_HTML_TARBALL=${htmlCandidate().path}\n`, { flag: 'a' });
    }
    console.log(`Restored compiled outputs for ${identity.sourceCommit}.`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
