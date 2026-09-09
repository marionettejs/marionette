import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { collectTestTitles, generateInventory, packageRoots, publicEntrypoints, validateSemantics } from '../../scripts/api-contracts/inventory.mjs';

const repository = resolve(import.meta.dirname, '../..');
const temporary = mkdtempSync(resolve(tmpdir(), 'marionette-api-contracts-'));
after(() => rmSync(temporary, { recursive: true, force: true }));
function write(file, value) {
  const target = resolve(temporary, file);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
}
const entryNames = ['marionette', '@mnjs/utils', '@mnjs/radio', '@mnjs/data', '@mnjs/adapters'];
for (const [index, directory] of packageRoots.entries()) {
  write(`${directory}/package.json`.replace(/^\//, ''), { name: entryNames[index], exports: {
    '.': { import: { types: './dist/types/esm/index.d.ts', default: './dist/index.js' },
      require: { types: './dist/types/cjs/index.d.ts', default: './dist/index.cjs' } },
    './package.json': './package.json',
  } });
  write(`${directory}/src/index.ts`.replace(/^\//, ''), `export interface Options { label?: string; }
export class Owner {
  private _secret = 1;
  initialize(options?: Options): void { void options; }
  render(): this { return this; }
  onReady?(): void;
}
export { Owner as Alias };
export type { Owner as OwnerType };
`);
}
write('tsconfig.json', { compilerOptions: { target: 'ES2024', strict: true }, include: ['src/**/*.ts', 'packages/*/src/**/*.ts'] });
write('config/diagnostics/catalog.json', { diagnostics: [{ code: 'MN0003', status: 'active' }, { code: 'MN0001', status: 'retired' }] });
write('docs/contract.md', '# Contract\n\nObservable rendering.\n');
write('test/unit/contract.spec.js', 'import { it } from \'vitest\';\nit(\'renders the public output\', () => { if (!true) throw new Error(\'failed\'); });\n');
const base = { id: 'owners', entrypoints: entryNames, exports: ['Owner', 'Alias'], result: 'Owner instance.',
  timing: 'Synchronous.', ownership: 'Caller owns the instance.', mutation: 'render returns its receiver.', repetition: 'Repeatable.',
  destruction: 'No destroy operation.', diagnostics: ['MN0003'], docs: [{ file: 'docs/contract.md', heading: 'Contract' }],
  tests: [{ file: 'test/unit/contract.spec.js', title: 'renders the public output' }] };
const semantics = { contracts: [base, { ...base, id: 'types', kind: 'type', exports: ['*'] }] };

test('inventories aliases, optional callbacks, constructor methods, options and type-only exports from the compiler', () => {
  const inventory = generateInventory(temporary, semantics);
  assert.equal(inventory.entrypoints.length, 5);
  const exports = inventory.entrypoints[0].exports;
  const owner = exports.find(entry => entry.name === 'Owner');
  assert.deepEqual(owner.callableInstanceMembers, ['initialize', 'onReady', 'render']);
  assert.equal(owner.instance._secret, undefined);
  assert.equal(exports.find(entry => entry.name === 'OwnerType').kind, 'type');
  assert.equal(exports.find(entry => entry.name === 'Alias').kind, 'value');
  assert.match(exports.find(entry => entry.name === 'Options').members.label, /string/);
  assert.equal(owner.instance.render, '() => Owner');
});

test('source, signature, event payload and assertion edits change the checked inventory', () => {
  const before = generateInventory(temporary, semantics);
  const file = 'src/index.ts';
  const original = readFileSync(resolve(temporary, file), 'utf8');
  write(file, original.replace('render(): this { return this; }', 'render(value: string): this { this.trigger("render", value); return this; }\ntrigger(name: string, value: string): void { void name; void value; }'));
  const changed = generateInventory(temporary, semantics);
  assert.notDeepEqual(changed.sources, before.sources);
  assert.notDeepEqual(changed.entrypoints, before.entrypoints);
  assert.deepEqual(changed.eventSites[0].arguments, ['value']);
  const fixture = readFileSync(resolve(temporary, 'test/unit/contract.spec.js'), 'utf8');
  write('test/unit/contract.spec.js', fixture.replace('!true', '!false'));
  assert.notDeepEqual(generateInventory(temporary, semantics).evidence, changed.evidence);
  write(file, original);
  write('test/unit/contract.spec.js', fixture);
});

test('fails on unaccounted exports, stale members and unused semantic groups', () => {
  assert.throws(() => generateInventory(temporary, { contracts: [{ ...base, exports: ['Alias'] }, semantics.contracts[1]] }), /Unmapped public export/);
  assert.throws(() => generateInventory(temporary, { contracts: [{ ...base, members: ['missing'] }, semantics.contracts[1]] }), /No matching members/);
  assert.throws(() => generateInventory(temporary, { contracts: [{ ...base, members: ['render', 'missing'] }, semantics.contracts[1]] }), /Unknown semantic member/);
  assert.throws(() => generateInventory(temporary, { contracts: [...semantics.contracts, { ...base, id: 'unused', exports: ['Absent'] }] }), /Unused contract/);
});

test('rejects absent or ambiguous exact tests, removed headings, incomplete semantics and retired diagnostics', () => {
  const check = override => validateSemantics(temporary, { contracts: [{ ...base, ...override }] }, publicEntrypoints(temporary));
  assert.throws(() => check({ tests: [{ ...base.tests[0], title: 'absent' }] }), /Missing or ambiguous public test/);
  assert.throws(() => check({ docs: [{ ...base.docs[0], heading: 'Absent' }] }), /Missing documentation heading/);
  assert.throws(() => check({ timing: '' }), /Missing timing/);
  assert.throws(() => check({ diagnostics: ['MN0001'] }), /Unknown or retired diagnostic/);
  assert.throws(() => check({ tests: [] }), /Incomplete references/);
  assert.throws(() => validateSemantics(temporary, { contracts: [base, base] }, publicEntrypoints(temporary)), /Duplicate or missing contract id/);
});

test('finds actual test AST nodes and rejects prose markers and duplicate titles', () => {
  const titles = collectTestTitles('// it("comment", () => {});\nconst marker = "test(mentioned)";\nit("real", () => {}); test("real", () => {});');
  assert.equal(titles.has('comment'), false);
  assert.equal(titles.size, 1);
  assert.equal(titles.get('real').length, 2);
  assert.equal(collectTestTitles('it(\'options\', { timeout: 1000 }, async () => {});').get('options').length, 1);
});

test('registers shared behavioral cases only with their importing executable runner', () => {
  write('test/contracts/shared.js', 'export const cases = [{ name: "shared outcome", run() { if (!true) throw Error(); } }];');
  write('test/unit/shared.spec.js', 'import { cases } from "../contracts/shared.js";\nfor (const {name, run} of cases) { it(name, run); }');
  const testRef = { file: 'test/contracts/shared.js', title: 'shared outcome', runner: 'test/unit/shared.spec.js' };
  assert.doesNotThrow(() => validateSemantics(temporary, { contracts: [{ ...base, tests: [testRef] }] }, publicEntrypoints(temporary)));
  write('test/unit/shared.spec.js', 'import { cases } from "../contracts/shared.js";\n// it(name, run)\n');
  assert.throws(() => validateSemantics(temporary, { contracts: [{ ...base, tests: [testRef] }] }, publicEntrypoints(temporary)), /Missing shared-case registration/);
});

test('classifies the explicit ESLint export as development tooling without relaxing runtime declaration requirements', () => {
  const path = resolve(temporary, 'package.json');
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.exports['./eslint'] = { import: './dist/eslint/index.js', require: './dist/eslint/index.cjs' };
  write('package.json', pkg);
  const inventory = generateInventory(temporary, semantics);
  assert.equal(inventory.toolingEntrypoints[0].name, 'marionette/eslint');
  assert.equal(inventory.entrypoints.length, 5);
  pkg.exports['./unknown-runtime'] = './dist/new.js';
  write('package.json', pkg);
  assert.throws(() => publicEntrypoints(temporary), /Missing public declarations/);
  delete pkg.exports['./unknown-runtime'];
  delete pkg.exports['./eslint'];
  write('package.json', pkg);
});

test('the committed real inventory matches and keeps metadata out of production imports', () => {
  const realSemantics = JSON.parse(readFileSync(resolve(repository, 'config/api-contracts/semantics.json'), 'utf8'));
  const generated = generateInventory(repository, realSemantics);
  assert.deepEqual(generated, JSON.parse(readFileSync(resolve(repository, 'config/api-contracts/inventory.json'), 'utf8')));
  for (const file of Object.keys(generated.sources)) {
    assert.doesNotMatch(readFileSync(resolve(repository, file), 'utf8'), /(?:from\s*|import\s*\()['"](?:[^'"\n]*\/)?(?:api-contracts|eslint)\//);
  }
  for (const entry of generated.entrypoints) {
    assert.doesNotMatch(JSON.stringify(entry.conditions), /(?:api-contracts|eslint)/);
  }
  const resources = JSON.parse(readFileSync(resolve(repository, 'docs-site/resources.json'), 'utf8'));
  for (const file of ['inventory.json', 'semantics.json']) {
    assert.ok(resources.includes(`config/api-contracts/${file}`));
  }
  assert.ok(resources.includes('scripts/api-contracts/README.md'));
});
