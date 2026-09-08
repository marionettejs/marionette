import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { copyCoverageFixture } from './coverage-fixture.mjs';

test('coverage fixture mappings preserve every original UTF-16 source position', t => {
  const directory = mkdtempSync(join(tmpdir(), 'tooling-coverage-map-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const original = join(directory, 'original.mjs');
  const copied = join(directory, 'copied.mjs');
  const text = 'const name = \'🧪\';\nconsole.log(name ? \'passed\' : \'failed\');\n';
  writeFileSync(original, text);
  const coverage = process.env.NODE_V8_COVERAGE;
  process.env.NODE_V8_COVERAGE = join(directory, 'coverage');
  try { copyCoverageFixture(original, copied); } finally {
    if (coverage === undefined) { delete process.env.NODE_V8_COVERAGE; } else { process.env.NODE_V8_COVERAGE = coverage; }
  }
  const result = readFileSync(copied, 'utf8');
  assert.ok(result.startsWith(text));
  assert.equal(readFileSync(original, 'utf8'), text);
  const encoded = result.split('base64,')[1].trim();
  const payload = JSON.parse(Buffer.from(encoded, 'base64'));
  assert.deepEqual(payload.sourcesContent, [text]);
  const map = new SourceMap(payload);
  for (const [line, content] of text.split('\n').entries()) {
    for (let column = 0; column <= content.length; column++) {
      const entry = map.findEntry(line, column);
      assert.equal(entry.originalSource, pathToFileURL(original).href);
      assert.equal(entry.originalLine, line);
      assert.equal(entry.originalColumn, column);
    }
  }
  const executed = spawnSync(process.execPath, [copied], { encoding: 'utf8' });
  assert.equal(executed.status, 0, executed.stderr);
  assert.equal(executed.stdout, 'passed\n');
});
