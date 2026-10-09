import { rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
rmSync('.package', { recursive: true, force: true });
