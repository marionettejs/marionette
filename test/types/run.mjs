import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const rootDir = new URL('../../', import.meta.url);

rmSync(new URL('test/tmp/typed-core', rootDir), { recursive: true, force: true });
for (const config of ['tsconfig.declarations.json', 'tsconfig.consumer.json']) {
  execFileSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '-p', `test/types/${config}`,
  ], { cwd: rootDir, stdio: 'inherit' });
}
