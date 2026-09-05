import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const esm = 'dist/types/esm';
const cjs = 'dist/types/cjs';

rmSync(esm, { recursive: true, force: true });
rmSync(cjs, { recursive: true, force: true });

execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.declarations.json'], {
  stdio: 'inherit',
});
cpSync('src/version.d.ts', join(esm, 'version.d.ts'));

// TypeScript preserves source extensions in declarations. Published imports use
// the corresponding JavaScript paths in each module scope.
for (const entry of readdirSync(esm, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.d.ts')) { continue; }
  const path = join(entry.parentPath, entry.name);
  let contents = readFileSync(path, 'utf8');
  const imports = ts.preProcessFile(contents).importedFiles;
  for (const imported of imports.reverse()) {
    if (!imported.fileName.startsWith('.') || !imported.fileName.endsWith('.ts')) { continue; }
    const start = imported.pos + 1;
    if (contents.slice(start, start + imported.fileName.length) !== imported.fileName) {
      throw new Error(`Cannot locate declaration import in ${path}`);
    }
    contents = contents.slice(0, start) + imported.fileName.slice(0, -3) + '.js' +
      contents.slice(start + imported.fileName.length);
  }
  writeFileSync(path, contents);
}

mkdirSync(cjs, { recursive: true });
cpSync(esm, cjs, { recursive: true });
writeFileSync(join(cjs, 'package.json'), '{"type":"commonjs"}\n');
