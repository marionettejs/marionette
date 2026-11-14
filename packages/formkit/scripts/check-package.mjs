import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, parse, resolve, sep } from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
for (const [name, target] of Object.entries(manifest.exports)) {
  const paths = typeof target === 'string' ? [target] : [target.import?.types, target.import?.default, target.require?.types, target.require?.default];
  for (const path of paths.filter(Boolean)) {assert.ok(existsSync(join(root, path)), `Build before package verification: missing ${name} -> ${path}`);}
}
await mkdir(join(root, 'test/tmp'), { recursive: true });
const temporary = await mkdtemp(join(root, 'test/tmp/packed-'));
const output = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: root, encoding: 'utf8' });
const [packed] = JSON.parse(output);
assert.ok(packed.files.length);
for (const { path } of packed.files) {
  assert.ok(!/^(?:src|types|test|scripts|experiments|node_modules)\//.test(path), `Unexpected published development file: ${path}`);
  assert.ok(!/@formkit\/pro|(?:^|\/)\.env(?:\.|$)/.test(path), `Unexpected private artifact: ${path}`);
}
const consumer = join(temporary, 'consumer');
const installed = join(consumer, 'node_modules/@mnjs/formkit');
await mkdir(installed, { recursive: true });
execFileSync('tar', ['-xzf', join(temporary, packed.filename), '--directory', installed, '--strip-components=1']);
const declared = new Set([...Object.keys(manifest.dependencies), ...Object.keys(manifest.peerDependencies)]);
for (const { path } of packed.files) {
  if (!/\.(?:js|cjs)$/.test(path)) {continue;}
  const file = join(installed, path);
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const specifiers = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {specifiers.push(node.moduleSpecifier.text);}
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {specifiers.push(node.arguments[0].text);}
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const specifier of specifiers) {
    if (specifier.startsWith('.')) {
      const target = resolve(dirname(file), specifier);
      assert.ok(target.startsWith(installed + sep) && existsSync(target), `Artifact import escapes or is missing: ${path} -> ${specifier}`);
    } else {
      const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      assert.ok(declared.has(name), `Undeclared artifact dependency: ${path} -> ${specifier}`);
    }
  }
}

// Reuse locally installed open-source dependencies without registry access.
async function dependencyRoot(name) {
  let path = dirname(require.resolve(name));
  for (;;) {
    try { if (JSON.parse(await readFile(join(path, 'package.json'), 'utf8')).name === name) {return path;} } catch (error) { if (error.code !== 'ENOENT') {throw error;} }
    const parent = dirname(path); if (parent === path || path === parse(path).root) {throw new Error(`Cannot locate installed dependency ${name}`);}
    path = parent;
  }
}
for (const name of [...Object.keys(manifest.dependencies), 'marionette', 'jsdom']) {
  const destination = join(consumer, 'node_modules', name);
  await mkdir(dirname(destination), { recursive: true });
  await symlink(await dependencyRoot(name), destination, 'dir');
}
await writeFile(join(consumer, 'package.json'), '{"name":"formkit-packed-consumer","private":true,"type":"module"}\n');
const fixture = await readFile(join(root, 'test/fixtures/packed-consumer.mjs'), 'utf8');
await writeFile(join(consumer, 'consumer.mjs'), fixture);
const behavior = execFileSync(process.execPath, ['consumer.mjs'], { cwd: consumer, encoding: 'utf8' });
for (const file of ['esm.mts', 'cjs.cts', 'tsconfig.json']) {
  await writeFile(join(consumer, file), await readFile(join(root, 'test/types', file)));
}
execFileSync(process.execPath, [join(await dependencyRoot('typescript'), 'bin/tsc'), '-p', 'tsconfig.json'], { cwd: consumer, stdio: 'inherit' });
const report = {
  passed: true, package: manifest.name, version: manifest.version,
  tarball: join(temporary, packed.filename), integrity: packed.integrity,
  files: packed.files.map(({ path }) => path),
  behavior: JSON.parse(behavior.trim()), artifactImportGraph: 'contained relative imports and declared external dependencies', typeConsumers: ['NodeNext ESM .mts', 'NodeNext CommonJS .cts'],
  notes: ['Tarball installed by extraction into an isolated consumer; external dependencies reused read-only.', 'No registry publication or installation was performed.']
};
await writeFile(join(root, 'test/tmp/package-result.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
