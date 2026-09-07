import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire, findPackageJSON } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

// Copy only the selected provider alongside the installed tarball contents.
// An external directory prevents resolution through the repository's dependencies.
for (const provider of ['morphdom', 'lit-html']) {
  const directory = mkdtempSync(join(tmpdir(), 'marionette-provider-fixture-'));
  try {
    for (const name of ['marionette', '@marionette/utils', '@marionette/radio', '@marionette/adapters', provider]) {
      const packageFile = findPackageJSON(name, import.meta.url);
      cpSync(dirname(packageFile), join(directory, 'node_modules', name), { recursive: true });
    }
    cpSync(new URL('./runtime.mjs', import.meta.url), join(directory, 'runtime.mjs'));
    for (const format of ['esm', 'cjs']) {
      execFileSync(process.execPath, [join(directory, 'runtime.mjs'), provider, format,
        require.resolve('jsdom')], { stdio: 'inherit' });
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
