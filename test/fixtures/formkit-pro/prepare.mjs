import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const stack = process.argv[2] ?? 'native';
if (!['native', 'vue', 'react'].includes(stack)) { throw new Error('Choose native, vue or react.'); }
const npm = process.env.npm_execpath;
if (!npm) { throw new Error('Run via npm exec --call with the installed node and this script.'); }
const consumer = mkdtempSync(join(tmpdir(), `mnjs-pro-${stack}-`));
const output = join(root, 'test/tmp/formkit-pro', stack);
mkdirSync(output, { recursive: true });
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const env = { ...process.env, NODE_PATH: '', ['npm_config_cache']: join(consumer, '.npm-cache') };
function run(args, cwd = consumer) {
  return execFileSync(process.execPath, [npm, ...args], { cwd, env, encoding: 'utf8', timeout: 180000 });
}
const dependencies = { '@formkit/core': '2.1.2', '@formkit/themes': '2.1.2', '@formkit/pro': '0.130.3' };
const receipt = {
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
  stack, node: process.version, npm: run(['--version']).trim(), consumer, artifacts: [],
};
if (stack === 'native') {
  const artifacts = join(consumer, 'artifacts'); mkdirSync(artifacts);
  for (const directory of ['.package', 'packages/utils', 'packages/radio', 'packages/formkit']) {
    const packed = JSON.parse(run(['pack', resolve(root, directory), '--ignore-scripts', '--json', '--pack-destination', artifacts], root))[0];
    const path = join(artifacts, packed.filename);
    dependencies[packed.name] = `file:${path}`;
    receipt.artifacts.push({ name: packed.name, version: packed.version, sha256: hash(path) });
  }
  Object.assign(dependencies, { '@formkit/inputs': '2.1.2', '@formkit/utils': '2.1.2' });
} else if (stack === 'vue') {
  Object.assign(dependencies, { '@formkit/vue': '2.1.2', vue: '3.5.44' });
} else {
  Object.assign(dependencies, { '@formkit/react': '2.1.2', react: '19.2.0', 'react-dom': '19.2.0' });
}
const port = { native: 5190, vue: 5191, react: 5192 }[stack];
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, name: `formkit-pro-${stack}-proof`, type: 'module',
  scripts: { dev: `vite --host 127.0.0.1 --port ${port} --strictPort`, build: 'vite build' }, dependencies,
  devDependencies: { vite: '8.3.0' } }, null, 2));
for (const file of ['index.html', 'shared.js']) { copyFileSync(join(import.meta.dirname, 'consumer', file), join(consumer, file)); }
copyFileSync(join(import.meta.dirname, 'consumer', `${stack}.js`), join(consumer, 'main.js'));
writeFileSync(join(output, 'install.log'), run(['install', '--ignore-scripts']));
const lockPath = join(consumer, 'package-lock.json');
receipt.lockSha256 = hash(lockPath);
writeFileSync(join(output, 'locked-install.log'), run(['ci', '--ignore-scripts']));
if (hash(lockPath) !== receipt.lockSha256) { throw new Error('Consumer lock changed during npm ci.'); }
const lock = JSON.parse(readFileSync(lockPath));
receipt.versions = Object.fromEntries(Object.entries(lock.packages).filter(([path]) => /node_modules\/(?:@formkit\/|vue$|react$|react-dom$|vite$)/.test(path))
  .map(([path, value]) => [path, value.version]));
receipt.vuePackages = Object.keys(lock.packages).filter(path => /(?:^|\/)node_modules\/(?:vue|@vue\/[^/]+|@formkit\/vue)$/.test(path));
if (stack !== 'vue' && receipt.vuePackages.length) { throw new Error(`Unexpected Vue installation in ${stack}.`); }
writeFileSync(join(output, 'import.log'), execFileSync(process.execPath, ['--input-type=module', '-e',
  'import {createRequire} from \'node:module\';await import(\'@formkit/pro\');createRequire(import.meta.url)(\'@formkit/pro\');console.log(\'Pro ESM and CJS imports passed\');'], { cwd: consumer, env, encoding: 'utf8' }));
writeFileSync(join(output, 'build.log'), run(['run', 'build']));
copyFileSync(lockPath, join(output, 'package-lock.json'));
writeFileSync(join(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
writeFileSync(join(consumer, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Consumer: ${consumer}\nStart privately: npm --prefix ${consumer} run dev\nURL: http://localhost:${port}/?mode=pro (or mode=core)\nReceipt: ${join(output, 'receipt.json')}`);
