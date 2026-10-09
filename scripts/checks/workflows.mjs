import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseDocument } from 'yaml';

const repository = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: {
  root: { type: 'string', default: repository },
  'yaml-only': { type: 'boolean', default: false },
} });
const root = resolve(values.root);
const workflowDirectory = resolve(root, '.github/workflows');
const files = (await readdir(workflowDirectory)).filter(file => /\.ya?ml$/.test(file)).sort();
if (!files.length) { throw new Error('No workflow files found.'); }
for (const file of files) {
  const document = parseDocument(await readFile(resolve(workflowDirectory, file), 'utf8'), { uniqueKeys: true });
  if (document.errors.length) {
    throw new Error(`${file}: ${document.errors.map(error => error.message).join('\n')}`);
  }
}
if (!values['yaml-only']) {
  const profile = JSON.parse(await readFile(resolve(repository, 'config/actionlint.json'), 'utf8'));
  const asset = profile.assets[`${process.platform}-${process.arch}`];
  if (!asset) { throw new Error(`No pinned actionlint for ${process.platform}-${process.arch}.`); }
  const cache = resolve(repository, 'test/tmp/tools');
  await mkdir(cache, { recursive: true });
  const archive = resolve(cache, asset.file);
  let bytes = await readFile(archive).catch(error => {
    if (error.code === 'ENOENT') { return null; }
    throw error;
  });
  if (!bytes) {
    const response = await fetch(`https://github.com/rhysd/actionlint/releases/download/v${profile.version}/${asset.file}`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) { throw new Error(`actionlint download failed: HTTP ${response.status}`); }
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
    throw new Error('Pinned actionlint archive checksum mismatch. Remove the cached archive before retrying.');
  }
  await writeFile(archive, bytes);
  const directory = await mkdtemp(join(tmpdir(), 'marionette-actionlint-'));
  try {
    const binary = process.platform === 'win32' ? 'actionlint.exe' : 'actionlint';
    const extract = spawnSync('tar', ['-xf', archive, '-C', directory, binary], { encoding: 'utf8' });
    if (extract.error || extract.status !== 0) { throw new Error(extract.error?.message || extract.stderr); }
    const result = spawnSync(resolve(directory, binary), ['-color', '-shellcheck=', '-pyflakes=',
      ...files.map(file => resolve(workflowDirectory, file))], { cwd: root, stdio: 'inherit', timeout: 60000 });
    if (result.error || result.status !== 0) { throw new Error(`actionlint failed: ${result.error?.message || result.status}`); }
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
}
console.log(`Validated ${files.length} workflow YAML files${values['yaml-only'] ? '' : ' and pinned actionlint checks'}.`);
