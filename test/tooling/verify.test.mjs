import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

for (const full of [false, true]) {
  for (const supplied of [false, true]) {
    test(`verify full=${full} supplied renderer=${supplied} orders explicit preparation`, () => {
      const dir = mkdtempSync(resolve(tmpdir(), 'mnjs-verify-'));
      try {
        const log = resolve(dir, 'commands.txt');
        const npm = resolve(dir, 'npm.mjs');
        writeFileSync(npm, `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(log)}, process.argv[3] + '\\n');\n`);
        const env = { ...process.env, npm_execpath: npm };
        if (supplied) { env.MNJS_HTML_TARBALL = resolve(dir, 'supplied.tgz'); }
        else { delete env.MNJS_HTML_TARBALL; }
        execFileSync(process.execPath, [resolve('scripts/checks/verify.mjs'), ...(full ? ['--full'] : [])], { env });
        const commands = readFileSync(log, 'utf8').trim().split('\n');
        assert(commands.includes('test:router-tarball'));
        assert.equal(commands.includes('docs:prepare-html'), !supplied);
        if (!supplied) {
          assert.equal(commands[commands.indexOf('test:router-tarball') - 1], 'docs:prepare-html');
        }
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
  }
}
