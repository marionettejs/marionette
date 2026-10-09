import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repositoryRoot } from './harness.mjs';

const directory = await mkdtemp(join(tmpdir(), 'marionette-agent-cache-'));
try {
  const lock = await readFile(join(repositoryRoot, 'benchmarks/agent/support/dependency-lock.json'), 'utf8');
  const metadata = JSON.parse(lock).packages[''];
  await writeFile(join(directory, 'package.json'), JSON.stringify({ ...metadata, private: true }));
  await writeFile(join(directory, 'package-lock.json'), lock);
  const result = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit', shell: false });
  if (result.error) { throw result.error; }
  if (result.status !== 0) { process.exitCode = result.status || 1; }
} finally { await rm(directory, { recursive: true, force: true }); }
