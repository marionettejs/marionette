import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isEnabled, setEnabled } from 'marionette';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/features.md');
const marker = '<!-- executable-example: feature-flags-bootstrap -->';
const markdown = await readFile(docsPath, 'utf8');

assert.equal(markdown.split(marker).length - 1, 1, 'expected one executable example marker');

const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

assert.ok(codeFence, 'expected a JavaScript fence immediately after the marker');

const distDir = resolve(__dirname, 'dist');
const examplePath = resolve(distDir, 'example.mjs');

await mkdir(distDir, { recursive: true });
await writeFile(examplePath, codeFence[1], 'utf8');

const builtInNames = [
  'childViewEventPrefix',
  'triggersPreventDefault',
  'triggersStopPropagation',
];
const initialStates = Object.fromEntries(builtInNames.map(name => [name, isEnabled(name)]));
const customName = 'docsFeatureFlagsFixture';
const initialCustomState = isEnabled(customName);

try {
  const example = await import(pathToFileURL(examplePath));

  assert.deepEqual(example.featureStates, {
    childViewEventPrefix: true,
    triggersPreventDefault: false,
    triggersStopPropagation: false,
  });
  assert.equal(isEnabled('childViewEventPrefix'), true);
  assert.equal(isEnabled('triggersPreventDefault'), false);
  assert.equal(isEnabled('triggersStopPropagation'), false);

  const exactState = { owner: 'application' };
  assert.equal(initialCustomState, false, 'the fixture custom name must start disabled');
  assert.equal(setEnabled(customName, exactState), exactState);
  assert.equal(isEnabled(customName), true, 'custom string flags remain compatible');
  assert.equal(isEnabled('missingFeature'), false);
  assert.equal(isEnabled(null), false);
  assert.equal(isEnabled('  '), false);
  assert.throws(() => setEnabled('  ', true), error => error.code === 'MN0027');
  assert.throws(() => setEnabled(123, true), error => error.code === 'MN0027');
} finally {
  for (const name of builtInNames) {
    setEnabled(name, initialStates[name]);
  }
  setEnabled(customName, initialCustomState);
}

assert.deepEqual(
  Object.fromEntries(builtInNames.map(name => [name, isEnabled(name)])),
  initialStates,
  'the fixture must restore the process-global built-in flags',
);
