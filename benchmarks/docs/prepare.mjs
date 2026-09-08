import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.argv[2] && resolve(process.argv[2]);
if (!output) {throw new Error('Usage: node benchmarks/docs/prepare.mjs /absolute/new/trial-directory');}
await readFile(resolve(root, 'dist/agent-skill/SKILL.md'));
await mkdir(output); // Refuse to overwrite an existing attempt.
const packs = resolve(output, 'packages');
await mkdir(packs);
const npm = (args, cwd) => execFileSync('npm', args, {
  cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  env: { ...process.env, npm_config_fund: 'false', npm_config_audit: 'false' },
});
const dependencies = { jsdom: '30.0.1' };
for (const location of ['.', 'packages/utils', 'packages/radio', 'packages/data']) {
  const cwd = resolve(root, location);
  const { name } = JSON.parse(await readFile(resolve(cwd, 'package.json'), 'utf8'));
  const [packed] = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', packs], cwd));
  dependencies[name] = `file:${resolve(packs, packed.filename)}`;
}
const tasks = ['latest-navigation', 'editable-list', 'widget-lifetime'];
for (const task of tasks) {
  const workspace = resolve(output, task);
  await mkdir(workspace);
  await writeFile(resolve(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }, null, 2) + '\n');
  npm(['install', '--ignore-scripts', '--no-package-lock'], workspace);
  await cp(resolve(root, `benchmarks/docs/tasks/${task}.md`), resolve(workspace, 'TASK.md'));
  await cp(resolve(workspace, 'node_modules/marionette/dist/agent-skill'), resolve(workspace, '.agents/skills/marionette'), { recursive: true });
}
const manifest = JSON.parse(await readFile(resolve(root, 'dist/docs/manifest.json'), 'utf8'));
await writeFile(resolve(output, 'provenance.json'), JSON.stringify({
  packageVersion: manifest.packageVersion, sourceRevision: manifest.sourceRevision,
  sourceDirty: manifest.sourceDirty, contentSha256: manifest.contentSha256, tasks,
  instructions: 'Acceptance tests are withheld until each implementation attempt finishes.',
}, null, 2) + '\n');
console.log(`Prepared ${tasks.length} fresh installed-package workspaces in ${output}`);
