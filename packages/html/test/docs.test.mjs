import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const guide = readFileSync(new URL('../guide.md', import.meta.url), 'utf8');
const examples = [...guide.matchAll(/```js\n([\s\S]*?)```/g)].map(match => match[1]);
const conditions = process.execArgv.filter(arg => arg.startsWith('--conditions='));
const checks = [
  `assert.equal(input, reusedInput);
assert.equal(input.value, 'Ada');
assert.equal(input.disabled, true);
assert.equal(container.querySelector('p'), null);
assert.equal(container.textContent, '');`,
  `assert.equal(counter.count, 1);
assert.equal(counter.isDestroyed(), true);
assert.equal(host.childElementCount, 0);`,
  `assert.equal(firstRow, movedRow);
assert.equal(movedRow.querySelector('input').value, 'Updated');
assert.equal(list.querySelector('li'), null);`
];

test('package reference has the expected executable examples', () => {
  assert.equal(examples.length, checks.length);
});
for (const [index, source] of examples.entries()) {
  test(`package reference example ${index + 1}`, () => {
    execFileSync(process.execPath, [...conditions, '--input-type=module'], {
      cwd: root,
      input: `import assert from 'node:assert/strict';
import {dom} from ${JSON.stringify(new URL('./setup.mjs', import.meta.url).href)};
${source}
${checks[index]}
dom.window.close();`,
      encoding: 'utf8',
      timeout: 30_000,
    });
  });
}
