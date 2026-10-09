import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const root = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: { full: { type: 'boolean', default: false } } });
const scripts = [
  'check:release-profile', 'check:browser-profile', 'check:diagnostics', 'check:api-contracts', 'check:public-tests',
  'check:workflows', 'build', 'lint:ci', values.full ? 'coverage' : 'test:unit',
];
if (values.full) { scripts.push('test:source', 'coverage:tooling', 'docs:check', 'test:dist', 'test:browser', 'test:browser-performance', 'test:fixtures', 'agent:cache', 'test:agent-app', 'agent:reference', 'agent:fixtures'); }
if (!process.env.npm_execpath) { throw new Error('Run verification through npm run verify.'); }
for (const script of scripts) {
  console.log(`\nVerifying ${script}`);
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', script], {
    cwd: root, stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    console.error(`Verification failed at ${script}: ${result.error?.message || result.status}`);
    process.exit(result.status || 1);
  }
}
