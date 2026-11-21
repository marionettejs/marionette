import { spawnSync } from 'node:child_process';

function tar(args, bytes, cwd) {
  // Archive bytes go through stdin: GNU tar treats drive-letter paths as remote
  // hosts. cwd also keeps extraction directories out of tar's path parser.
  const result = spawnSync('tar', args, { input: bytes, cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.error) { throw result.error; }
  if (result.status !== 0) {
    process.stderr.write(result.stderr || '');
    throw new Error(`tar exited with status ${result.status}.`);
  }
  return result.stdout;
}

export function readTarFile(bytes, file, { gzip = false } = {}) {
  return tar([gzip ? '-xzOf' : '-xOf', '-', file], bytes);
}

export function extractTar(bytes, directory) {
  tar(['-xf', '-'], bytes, directory);
}
