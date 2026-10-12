import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const consumer = mkdtempSync(join(tmpdir(), 'mnjs-formkit-consumer-'));
const npm = process.env.npm_execpath;
if (!npm) { throw new Error('Run FormKit artifact verification through npm.'); }
const output = join(root, 'test/tmp/formkit-package');
mkdirSync(output, { recursive: true });
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = {
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).trim()),
  node: process.version, passed: false, artifacts: [], stages: [],
  sources: readdirSync(join(root, 'packages/formkit/src')).filter(name => name.endsWith('.ts')).sort()
    .map(name => ({ path: `packages/formkit/src/${name}`, sha256: hash(join(root, 'packages/formkit/src', name)) })),
  fixtures: ['test/fixtures/formkit-package/run.mjs', 'test/fixtures/formkit-package/verify.mjs',
    'test/types/formkit.mts', 'test/types/formkit.cts', 'test/types/formkit-rows.mts', 'test/types/formkit-rows.cts']
    .map(path => ({ path, sha256: hash(join(root, path)) })),
};
const env = { ...process.env, ['npm_config_cache']: join(consumer, 'cache'),
  NODE_PATH: '', NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --no-global-search-paths`,
  PATH: (process.env.PATH || '').split(delimiter).filter(path => !path.includes('node_modules')).join(delimiter) };
function run(name, command, args, cwd = consumer) {
  const stage = { name, passed: false };
  report.stages.push(stage);
  try {
    const result = execFileSync(command, args, { cwd, encoding: 'utf8', env,
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    writeFileSync(join(output, `${name}.log`), result);
    stage.passed = true;
    return result;
  } catch (error) {
    writeFileSync(join(output, `${name}.log`), `${error.stdout ?? ''}\n${error.stderr ?? ''}`);
    throw error;
  }
}
function runNpm(name, args, cwd) {
  return run(name, process.execPath, [npm, ...args], cwd);
}
try {
  for (let ancestor = dirname(realpathSync(consumer)); ; ancestor = dirname(ancestor)) {
    if (existsSync(join(ancestor, 'node_modules'))) { throw new Error(`Consumer ancestor contains node_modules: ${ancestor}`); }
    if (dirname(ancestor) === ancestor) { break; }
  }
  const artifacts = join(output, 'artifacts');
  mkdirSync(artifacts, { recursive: true });
  const directories = ['.package', 'packages/utils', 'packages/radio', 'packages/formkit'];
  const packed = directories.map(directory => {
    const result = JSON.parse(runNpm(`pack-${directory.replaceAll('/', '-').replaceAll('.', 'core')}`,
      ['pack', resolve(root, directory), '--ignore-scripts', '--json', '--pack-destination', artifacts], root))[0];
    return { ...result, path: join(artifacts, result.filename) };
  });
  report.artifacts = packed.map(({ name, version, path, files }) => ({ name, version, path, sha256: hash(path), files }));
  const formkit = packed.find(artifact => artifact.name === '@mnjs/formkit');
  const guides = ['compatibility.md', 'readme.md', 'rows.md', 'schema-views.md', 'OWNERSHIP.md'];
  if (!guides.every(path => formkit.files.some(file => file.path === path)) ||
      formkit.files.some(file => /src\/|node_modules\/|pro\/|composition-prototype/.test(file.path))) {
    throw new Error('Unexpected FormKit package contents.');
  }
  const rootManifest = JSON.parse(readFileSync(join(root, 'package.json')));
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module',
    devDependencies: { jsdom: rootManifest.devDependencies.jsdom } }));
  runNpm('install', ['install', '--ignore-scripts', ...packed.map(artifact => artifact.path)], consumer);
  const lockFile = join(consumer, 'package-lock.json');
  report.lockSha256 = hash(lockFile);
  copyFileSync(lockFile, join(output, 'package-lock.json'));
  runNpm('locked-install', ['ci', '--ignore-scripts'], consumer);
  if (hash(lockFile) !== report.lockSha256) { throw new Error('Captured consumer lock changed during npm ci.'); }
  for (const guide of guides) {
    if (hash(join(consumer, 'node_modules/@mnjs/formkit', guide)) !== hash(join(root, 'packages/formkit', guide))) {
      throw new Error(`Installed FormKit guide differs from owned source: ${guide}`);
    }
  }
  report.versions = JSON.parse(run('versions', process.execPath, ['-e',
    'const a=require(\'node:assert/strict\');const v=n=>require(n+\'/package.json\').version;' +
    `a.equal(v('marionette'),${JSON.stringify(rootManifest.version)});a.equal(v('@formkit/core'),'2.1.2');` +
    'console.log(JSON.stringify({core:v(\'marionette\'),formkit:v(\'@mnjs/formkit\'),formkitCore:v(\'@formkit/core\')}));']));
  copyFileSync(join(import.meta.dirname, 'verify.mjs'), join(consumer, 'verify.mjs'));
  console.log(run('runtime-esm-cjs', process.execPath, ['verify.mjs']));
  for (const extension of ['mts', 'cts']) {
    for (const fixture of ['formkit', 'formkit-rows']) {
      copyFileSync(join(root, `test/types/${fixture}.${extension}`), join(consumer, `${fixture}.${extension}`));
    }
  }
  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2024', lib: ['ES2024', 'DOM'], module: 'NodeNext', moduleResolution: 'NodeNext',
    strict: true, noEmit: true, skipLibCheck: false, types: []
  }, include: ['formkit.mts', 'formkit.cts', 'formkit-rows.mts', 'formkit-rows.cts'] }));
  run('types', process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json')]);
  const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json')));
  for (const forbidden of ['vue', 'react', '@formkit/pro']) {
    if (lock.packages[`node_modules/${forbidden}`]) { throw new Error(`Unexpected dependency: ${forbidden}`); }
  }
  for (const path of Object.keys(lock.packages)) {
    if (/(?:^|\/)node_modules\/(?:vue|react|@formkit\/(?:vue|pro))(?:\/|$)/.test(path)) {
      throw new Error(`Unexpected transitive dependency: ${path}`);
    }
  }
  const installedRoot = join(consumer, 'node_modules/@mnjs/formkit');
  const installedManifest = JSON.parse(readFileSync(join(installedRoot, 'package.json')));
  const allowedImports = new Set([...Object.keys(installedManifest.dependencies), ...Object.keys(installedManifest.peerDependencies)]);
  for (const file of formkit.files.filter(entry => /\.(?:mjs|cjs|js)$/.test(entry.path))) {
    const code = readFileSync(join(installedRoot, file.path), 'utf8');
    for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        if (/(?:^|\/)(?:src|packages|node_modules)\//.test(specifier)) { throw new Error(`Source fallback import: ${specifier}`); }
      } else if (!allowedImports.has(specifier)) { throw new Error(`Undeclared installed import: ${specifier}`); }
    }
  }
  const rowsGuide = readFileSync(join(installedRoot, 'rows.md'), 'utf8');
  if (!rowsGuide.includes('RowView') || !rowsGuide.includes('@mnjs/formkit')) { throw new Error('Missing installed row authoring guide.'); }
  const schemaGuide = readFileSync(join(installedRoot, 'schema-views.md'), 'utf8');
  if (!schemaGuide.includes('SchemaView') || !schemaGuide.includes('createViewComponents')) { throw new Error('Missing installed schema composition guide.'); }
  report.passed = true;
  console.log('Installed tarball ESM/CJS, declarations, content and dependency boundaries passed.');
} finally {
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  rmSync(consumer, { recursive: true, force: true });
}
