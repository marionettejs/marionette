import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const temporary = mkdtempSync(join(tmpdir(), 'html-packed-browser-'));
try {
  const archive = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], {encoding: 'utf8'}))[0];
  const destination = join(temporary, 'package');
  mkdirSync(destination);
  execFileSync('tar', ['-xzf', join(temporary, archive.filename), '--strip-components=1', '-C', destination]);
  const evidence = resolve(process.env.EVIDENCE_DIR ?? 'evidence');
  for (const condition of ['default', 'development']) {
    execFileSync(process.execPath, ['scripts/test-browser.mjs'], {stdio: 'inherit', env: {
      ...process.env, HTML_PACKED_ROOT: destination, HTML_CONDITION: condition,
      EVIDENCE_DIR: join(evidence, `packed-${condition}`),
    }});
  }
  mkdirSync(evidence, {recursive: true});
  writeFileSync(join(evidence, 'packed-browser.json'), JSON.stringify({
    tarball: archive.filename, integrity: archive.integrity,
    conditions: ['default', 'development'], engines: ['chromium', 'firefox', 'webkit'],
    rendererSource: 'extracted archive only; test harness and browser dependencies remain external',
  }, null, 2) + '\n');
} finally {
  rmSync(temporary, {recursive: true, force: true});
}
