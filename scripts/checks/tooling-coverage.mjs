import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const repository = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: {
  root: { type: 'string', default: repository },
  summary: { type: 'string', default: 'coverage/tooling/coverage-summary.json' },
} });
const root = resolve(values.root);
const policy = JSON.parse(readFileSync(resolve(repository, 'config/release-coverage.json'), 'utf8'));
const summary = JSON.parse(readFileSync(resolve(root, values.summary), 'utf8'));
const files = globSync(policy.include, { cwd: root }).map(file => resolve(root, file));
if (!files.length) { throw new Error('No release source files found for coverage verification.'); }
const totals = Object.fromEntries(Object.keys(policy.thresholds).map(metric => [metric, { covered: 0, total: 0 }]));
for (const file of files) {
  const coverage = summary[file];
  if (!coverage) { throw new Error(`Release source missing from coverage report: ${file}`); }
  for (const [metric, total] of Object.entries(totals)) {
    const entry = coverage[metric];
    if (!Number.isInteger(entry?.total) || !Number.isInteger(entry?.covered) ||
        entry.total < 0 || entry.covered < 0 || entry.covered > entry.total) {
      throw new Error(`Invalid ${metric} coverage for ${file}`);
    }
    total.covered += entry.covered;
    total.total += entry.total;
  }
}
if (!totals.lines.total) { throw new Error('Release coverage report has no executable lines.'); }
for (const [metric, { covered, total }] of Object.entries(totals)) {
  const actual = total ? covered / total * 100 : 100;
  if (actual < policy.thresholds[metric]) {
    throw new Error(`Release ${metric} coverage ${actual.toFixed(2)}% is below ${policy.thresholds[metric]}%.`);
  }
  console.log(`Release ${metric}: ${actual.toFixed(2)}% (${covered}/${total})`);
}
