import { spawnSync } from 'node:child_process';

// CI explicitly builds once in its producer. Dependency install scripts still run.
if (process.env.MNJS_SKIP_PREPARE !== '1') {
  for (const script of ['build', 'test:dist']) {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', script], { stdio: 'inherit' });
    if (result.error) { throw result.error; }
    if (result.status !== 0) { process.exit(result.status || 1); }
  }
}
