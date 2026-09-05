import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

rmSync('test/tmp/typed-core', { recursive: true, force: true });
for (const config of ['tsconfig.declarations.json', 'tsconfig.consumer.json']) {
  execFileSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '-p', `test/types/${config}`,
  ], { stdio: 'inherit' });
}
