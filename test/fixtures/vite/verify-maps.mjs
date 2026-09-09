import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { SourceMap } from 'node:module';

const assets = await readdir('dist/assets');
const maps = await Promise.all(assets.filter(file => file.endsWith('.js.map'))
  .map(async file => JSON.parse(await readFile(`dist/assets/${file}`, 'utf8'))));
assert.ok(maps.length, 'the consumer emits a source map');
const sources = maps.flatMap(map => map.sources);
assert.ok(sources.some(source => source.endsWith('/src/modules/view.ts')), `Vite resolves core maps to authored TypeScript: ${sources.join(', ')}`);
assert.ok(maps.some(map => map.sourcesContent.some(source => source?.includes('export interface ViewConfiguration'))), 'authored source is embedded for debugging without a checkout');

for (const [name, entry] of [['marionette', 'marionette'], ['@mnjs/utils', 'index'], ['@mnjs/radio', 'index'], ['@mnjs/data', 'index'],
  ...['backbone', 'xstate', 'dom/jquery', 'dom/morphdom', 'dom/lit-html'].map(subpath => ['@mnjs/adapters', subpath])]) {
  for (const extension of ['js', 'cjs']) {
    const code = await readFile(`node_modules/${name}/dist/${entry}.${extension}`, 'utf8');
    assert.ok(code.includes(`sourceMappingURL=${entry.split('/').at(-1)}.${extension}.map`));
    const map = JSON.parse(await readFile(`node_modules/${name}/dist/${entry}.${extension}.map`, 'utf8'));
    assert.ok(map.sources.some(source => source.endsWith('.ts')));
    assert.ok(map.sourcesContent.every(source => typeof source === 'string'));
    assert.ok(new SourceMap(map).payload.mappings.length);
  }
}

for (const setup of ['import { Radio } from \'@mnjs/radio\';', 'const { Radio } = require(\'@mnjs/radio\');']) {
  const moduleType = setup.startsWith('import') ? 'module' : 'commonjs';
  const stack = execFileSync(process.execPath, ['--enable-source-maps', `--input-type=${moduleType}`, '-e',
    `${setup} try { Radio.channel(''); } catch (error) { console.log(error.stack); }`], { encoding: 'utf8' });
  assert.match(stack, /src[/\\]radio\.ts:\d+:\d+/, `${moduleType} error frames resolve to authored TypeScript`);
}
