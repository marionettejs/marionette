import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve, relative, join} from 'node:path';

const summary = JSON.parse(readFileSync('coverage/runtime/coverage-summary.json'));
const baseline = JSON.parse(readFileSync('coverage-baseline.json'));
const sourceFiles = directory => readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
});
const expected = sourceFiles('src').sort();
assert.deepEqual(Object.keys(baseline.files).sort(), expected, 'Every authored source needs a reviewed coverage gate');
const actual = Object.fromEntries(Object.entries(summary).filter(([path]) => path !== 'total').map(([path, data]) => [relative(resolve('.'), path), data]));
assert.deepEqual(Object.keys(actual).sort(), expected, 'Coverage must include every authored source, including unexecuted files');
for (const path of expected) {
  for (const metric of ['lines', 'statements', 'functions', 'branches']) {
    const result = actual[path][metric];
    const uncovered = result.total - result.covered;
    assert.ok(uncovered <= baseline.files[path][metric], `${path} ${metric}: ${uncovered} uncovered exceeds reviewed ${baseline.files[path][metric]}`);
  }
}
console.log(`Coverage gates passed for all ${expected.length} authored source files; no increased uncovered counts.`);
