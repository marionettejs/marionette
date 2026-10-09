import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const consumer = resolve(process.argv[2] || '');
assert(process.argv[2], 'Pass an isolated consumer with installed Marionette, ESLint, and TypeScript');
const packageRoot = join(consumer, 'node_modules/marionette');
const markdown = readFileSync(join(packageRoot, 'docs/tooling.md'), 'utf8');
const fences = [...markdown.matchAll(/```(\w+)\n([\s\S]*?)\n```/g)].map(([, language, source]) => ({ language, source }));
const examples = language => fences.filter(fence => fence.language === language).map(fence => fence.source);
const [config, interaction] = examples('js');
const [tsconfig] = examples('json');
const [screen] = examples('ts');
assert.equal(examples('js').length, 2);
assert.equal(examples('json').length, 1);
assert.equal(examples('ts').length, 1);
const commands = examples('sh');
assert.equal(commands.length, 4);
assert.equal(commands[0], 'npm install --ignore-scripts --save-dev --save-exact eslint@10.11.0 typescript@6.0.3');
for (const [name, version] of [['eslint', '10.11.0'], ['typescript', '6.0.3']]) {
  assert.equal(JSON.parse(readFileSync(join(consumer, 'node_modules', name, 'package.json'))).version, version);
}
const directory = join(consumer, 'consumer-tooling');
mkdirSync(directory, { recursive: true });
const write = (file, source) => writeFileSync(join(directory, file), `${source}\n`);
write('eslint.config.mjs', config);
write('interaction.js', interaction);
write('tsconfig.json', tsconfig);
write('screen.ts', screen);
const run = (executable, args, cwd = directory) => {
  const result = spawnSync(executable, args, {
    cwd, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths' },
  });
  if (result.error) { throw result.error; }
  return { status: result.status, output: result.stdout + result.stderr };
};
const recipe = (command, expected, binary) => {
  assert.equal(command, expected);
  return run(process.execPath, [join(consumer, 'node_modules', binary), ...command.split(' ').slice(2)]);
};
const lint = () => recipe(commands[1], 'npx eslint . --max-warnings=0', 'eslint/bin/eslint.js');
const types = () => recipe(commands[2], 'npx tsc -p tsconfig.json', 'typescript/bin/tsc');
const validLint = lint();
const validTypes = types();
assert.equal(validLint.status, 0, validLint.output);
assert.equal(validTypes.status, 0, validTypes.output);
write('invalid.js', 'import { View } from \'marionette\';\nconst view = new View();\nview._isRendered;');
const invalidLint = lint();
assert.equal(invalidLint.status, 1, invalidLint.output);
assert.match(invalidLint.output, /marionette\/no-private-framework-members/);
rmSync(join(directory, 'invalid.js'));
write('screen.ts', screen.replace('region.show(view)', 'region.show(\'screen\')'));
const invalidTypes = types();
assert.equal(invalidTypes.status, 2, invalidTypes.output);
assert.match(invalidTypes.output, /TS2345/);
write('screen.ts', screen);
assert.equal(lint().status, 0);
assert.equal(types().status, 0);
assert.equal(commands[3], 'node node_modules/marionette/skills/marionette/scripts/docs.mjs --diagnostic MN0003');
const diagnostic = run(process.execPath, commands[3].split(' ').slice(1), consumer);
assert.equal(diagnostic.status, 0, diagnostic.output);
assert.equal(JSON.parse(diagnostic.output).diagnostic.code, 'MN0003');
const report = { passed: true, checks: ['documented lint configuration', 'public View interaction accepted',
  'private framework access rejected', 'installed declarations accepted', 'invalid Region argument rejected',
  'restored valid examples accepted', 'installed diagnostic lookup'],
limits: 'Checks package tooling and recipes, not browser behavior or architectural effectiveness.' };
write('report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
