import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

// Build the current checkout first via the root test:html:current-core script.
const root = resolve('../..');
const temporary = mkdtempSync(join(tmpdir(), 'html-current-core-'));
try {
  const receipt = {sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    dirtyStatus: execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}),
    trackedDiffSha256: createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--binary'], {cwd: root})).digest('hex'),
    packages: []};
  for (const [name, directory] of [['marionette', '.package'], ['@mnjs/utils', 'packages/utils'], ['@mnjs/radio', 'packages/radio'], ['@mnjs/html', 'packages/html']]) {
    const packed = JSON.parse(execFileSync('npm', ['pack', resolve(root, directory), '--ignore-scripts', '--json', '--pack-destination', temporary], {encoding: 'utf8'}))[0];
    assert.equal(packed.name, name, 'Unexpected packed package identity');
    const destination = join(temporary, 'node_modules', name);
    mkdirSync(destination, {recursive: true});
    execFileSync('tar', ['-xzf', join(temporary, packed.filename), '--strip-components=1', '-C', destination]);
    receipt.packages.push({name, version: packed.version, integrity: packed.integrity});
  }
  // Only the DOM test host is external. Renderer/core/utils/radio are real packed files.
  symlinkSync(resolve('node_modules/jsdom'), join(temporary, 'node_modules/jsdom'), 'dir');
  writeFileSync(join(temporary, 'package.json'), '{"type":"module"}\n');
  mkdirSync(join(temporary, 'test'));
  for (const file of ['setup.mjs', 'lifecycle.test.mjs']) cpSync(join('test', file), join(temporary, 'test', file));
  writeFileSync(join(temporary, 'verify.mjs'), `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for (const name of ['marionette','@mnjs/utils','@mnjs/radio','@mnjs/html']) {
  const base = new URL('./node_modules/' + name + '/', import.meta.url);
  assert.ok(import.meta.resolve(name).startsWith(base.href), 'nonpacked resolution: ' + name);
  const manifest = JSON.parse(readFileSync(new URL('package.json', base)));
  console.log(name + '@' + manifest.version + ' => ' + import.meta.resolve(name));
}
`);
  for (const condition of [[], ['--conditions=development']]) {
    execFileSync(process.execPath, [...condition, join(temporary, 'verify.mjs')], {cwd: temporary, stdio: 'inherit'});
    execFileSync(process.execPath, [...condition, '--test', 'test/lifecycle.test.mjs'], {cwd: temporary, stdio: 'inherit'});
  }
  assert.equal(receipt.packages.length, 4);
  mkdirSync('evidence', {recursive: true});
  writeFileSync('evidence/current-core.json', JSON.stringify(receipt, null, 2) + '\n');
} finally {
  rmSync(temporary, {recursive: true, force: true});
}
