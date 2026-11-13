import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, matchesGlob, resolve } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';

const checker = resolve(import.meta.dirname, '../../scripts/checks/workflows.mjs');

test('publication jobs require the canonical immutable identity and preflight receives the actual identity', async() => {
  const workflow = parse(await readFile(resolve(import.meta.dirname, '../../.github/workflows/release.yml'), 'utf8'));
  for (const name of ['publication-targets', 'publish']) {
    const guards = workflow.jobs[name].if.trim().split(/\s*&&\s*/);
    assert.deepEqual(guards, [
      'github.event_name == \'workflow_dispatch\'', 'github.repository == \'marionettejs/marionette\'',
      'github.repository_id == \'2965621\'', 'github.ref == \'refs/heads/master\'',
      'inputs.publish == true', 'needs.preflight.outputs.mode == \'publish\'',
    ], `${name} must enforce the complete publication authorization condition`);
  }
  const preflight = workflow.jobs.preflight.steps.find(step => step.id === 'preflight');
  assert.match(preflight.run, /--repository-id "\$\{GITHUB_REPOSITORY_ID\}"/);
});

for (const [name, source, status, message] of [
  ['valid workflow', 'name: Test\non: push\njobs: {}\n', 0, /Validated 1 workflow/],
  ['duplicate mapping keys', 'name: Test\njobs: {}\njobs: {}\n', 1, /Map keys must be unique/],
  ['invalid YAML', 'jobs: [\n', 1, /Flow sequence/],
  ['empty workflow inventory', null, 1, /No workflow files found/],
]) {
  test(`workflow CLI rejects configuration drift: ${name}`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'marionette-workflows-'));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    await mkdir(resolve(root, '.github/workflows'), { recursive: true });
    if (source !== null) { await writeFile(resolve(root, '.github/workflows/ci.yml'), source); }
    const result = spawnSync(process.execPath, [checker, '--root', root, '--yaml-only'], { encoding: 'utf8' });
    assert.equal(result.status, status, result.stderr);
    assert.match(result.stdout + result.stderr, message);
  });
}

test('release filter examples include infrastructure and exclude ordinary edits', async() => {
  const workflow = parse(await readFile(resolve(import.meta.dirname, '../../.github/workflows/release.yml'), 'utf8'));
  const paths = workflow.on.pull_request.paths;
  // This sample-path check uses Node's glob dialect, not GitHub's routing engine.
  // It assumes the current simple positive * and ** filters agree for these files.
  // Reassess the matcher before adding negation, ordered exclusions, directory-only
  // filters, or other glob syntax; passing here does not prove GitHub event routing.
  for (const path of [
    '.github/actions/restore-candidate/action.yml', 'tools/eslint/index.mjs', 'tools/eslint/index.d.cts', 'scripts/performance/bundle-size.mjs',
    'scripts/diagnostics/check-catalog.mjs', 'scripts/api-contracts/check.mjs',
    'package.json', 'packages/data/package.json', 'packages/adapters/rollup.config.mjs',
    '.babelrc', '.npmrc', 'test/fixtures/sample/.npmignore', 'build/.gitignore',
  ]) {
    assert.ok(paths.some(pattern => matchesGlob(path, pattern)), `${path} needs release certification`);
  }
  for (const path of ['src/modules/view.ts', 'packages/data/src/model.ts', 'test/unit/view.spec.js', 'docs/readme.md']) {
    assert.ok(!paths.some(pattern => matchesGlob(path, pattern)), `${path} should use regular CI`);
  }
});


test('npm publication dry runs exercise absent versions and leave occupied versions to the target report', async() => {
  const workflow = parse(await readFile(resolve(import.meta.dirname, '../../.github/workflows/release.yml'), 'utf8'));
  const steps = workflow.jobs['promotion-dry-run'].steps;
  const inspection = steps.find(step => step.id === 'dry_run_targets');
  assert.match(inspection.run, /release:targets -- --mode dry-run/);
  const publications = steps.filter(step => step.run?.startsWith('npm publish'));
  assert.equal(publications.length, 5);
  for (const id of ['utils', 'radio', 'core', 'data', 'adapters']) {
    const step = publications.find(candidate => candidate.run.includes(`outputs.${id}_tarball`));
    assert.equal(step.if, `steps.dry_run_targets.outputs.${id}_npm_state == 'available'`);
    assert.ok(steps.indexOf(inspection) < steps.indexOf(step));
    assert.match(step.run, /--dry-run/);
    assert.match(step.run, /--ignore-scripts/);
  }
});


test('required Node LTS release checks consume immutable inputs before certification without rebuilding', async() => {
  const workflow = parse(await readFile(resolve(import.meta.dirname, '../../.github/workflows/release.yml'), 'utf8'));
  const consumer = workflow.jobs['consumer-lts'];
  assert.equal(consumer['continue-on-error'], undefined);
  assert.deepEqual(consumer.needs, ['preflight', 'build']);
  const steps = consumer.steps;
  const download = steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
  assert.equal(download.with.name, 'release-candidate-${{ env.SOURCE_SHA }}');
  const verify = steps.find(step => step.run?.includes('release:verify'));
  assert.doesNotMatch(verify.run, /--require-validation/);
  assert.match(verify.run, /--source-commit/);
  const setup = steps.find(step => step.with?.['node-version']);
  assert(steps.indexOf(download) < steps.indexOf(verify));
  assert(steps.indexOf(verify) < steps.indexOf(setup));
  for (const command of ['test:fixtures', 'check:docs-installed']) {
    const step = steps.find(candidate => candidate.run?.includes(command));
    assert.match(step.run, /--artifact-dir release/);
    assert.equal(step.env.npm_config_engine_strict, 'true');
    assert(steps.indexOf(setup) < steps.indexOf(step));
  }
  assert(!steps.some(step => /npm ci|npm run build|release:artifact/.test(step.run || '')));
  assert(workflow.jobs.certification.needs.includes('consumer-lts'));
  assert(workflow.jobs['promotion-dry-run'].needs.includes('certification'));
});

test('CI builds once and source checks remain independent of candidate artifacts', async() => {
  const workflow = parse(await readFile(resolve(import.meta.dirname, '../../.github/workflows/ci.yml'), 'utf8'));
  assert(workflow.jobs.candidate);
  assert.equal(workflow.on.candidate, undefined);
  assert.equal(workflow.env.MNJS_SKIP_PREPARE, '1');
  assert.equal(workflow.jobs['source-checks'].needs, undefined);
  assert(!workflow.jobs['source-checks'].steps.some(step => step.run?.includes('check:diagnostics')));
  assert(workflow.jobs.core.steps.some(step => step.run === 'npm run check:diagnostics'));
  assert.equal(workflow.jobs['router-browser-candidate'].needs, 'candidate');
  assert.match(workflow.jobs['router-browser-candidate'].steps.find(step => step.id === 'candidate').run, /--build-sha256/);
  const commands = workflow.jobs.candidate.steps.filter(step => step.run).map(step => step.run).join('\n');
  assert.equal(commands.match(/npm run release:artifact/g).length, 1);
  assert(!commands.includes('npm run build'));
  for (const name of ['core', 'tooling', 'browsers', 'agent-reference', 'linux-package-smoke', 'package-smoke', 'windows-package-smoke', 'node-lts', 'performance-timing']) {
    const job = workflow.jobs[name];
    assert.equal(job.needs, 'candidate', name);
    assert(job.steps.some(step => step.uses === './.github/actions/restore-candidate'), name);
    assert(!job.steps.some(step => step.run === 'npm run build'), name);
  }
  for (const name of ['linux-package-smoke', 'package-smoke', 'windows-package-smoke', 'node-lts']) {
    for (const step of workflow.jobs[name].steps.filter(item => /test:fixtures|smoke.sh/.test(item.run || ''))) {
      assert(step.run.includes('--artifact-dir test/tmp/candidate'), name);
    }
  }
  for (const name of ['router-browser-candidate', 'router-browsers']) {
    assert(!workflow.jobs[name].steps.some(step => /npm run build(?:\s|$)/.test(step.run || '')));
  }
});

test('release uploads immutable inputs before independent validation and joins every required lane', async() => {
  const workflow = parse(await readFile(resolve(import.meta.dirname, '../../.github/workflows/release.yml'), 'utf8'));
  assert.equal(workflow.env.MNJS_SKIP_PREPARE, '1');
  assert(!workflow.jobs.build.steps.some(step => /release:validate/.test(step.run || '')));
  const groups = workflow.jobs['candidate-checks'].strategy.matrix.group;
  const { candidateGroups, candidateChecks } = await import('../../scripts/release/validation.mjs');
  assert.deepEqual(groups.toSorted(), Object.keys(candidateGroups).toSorted());
  assert.deepEqual(Object.values(candidateGroups).flat().toSorted(), candidateChecks.map(entry => entry.id).toSorted());
  const certification = workflow.jobs.certification;
  assert.deepEqual(certification.needs, ['preflight', 'build', 'candidate-checks', 'package-smoke', 'consumer-lts']);
  assert.equal(certification.if, 'always() && needs.preflight.outputs.mode == \'dry-run\'');
  assert.match(certification.steps[0].run, /all\(\.\[\]; \.result == "success"\)/);
  assert(certification.steps.some(step => step.run?.endsWith('--join')));
  assert(certification.steps.some(step => step.with?.name === 'certified-candidate-${{ env.SOURCE_SHA }}'));
  for (const name of ['candidate-checks', 'package-smoke', 'consumer-lts']) {
    assert.deepEqual(workflow.jobs[name].needs, ['preflight', 'build']);
    assert.equal(workflow.jobs[name]['continue-on-error'], undefined);
  }
  for (const name of ['promotion-dry-run', 'certified_artifact', 'publication-targets', 'publish']) {
    const job = workflow.jobs[name];
    const candidateDownload = job.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
    assert.equal(candidateDownload.with.name, 'certified-candidate-${{ env.SOURCE_SHA }}');
    assert(job.steps.some(step => step.run?.includes('--require-validation')));
    assert(!job.steps.some(step => /npm ci|npm run build|release:artifact/.test(step.run || '')));
    for (const step of job.steps.filter(item => item.run?.startsWith('npm publish'))) {
      assert(step.run.includes('--ignore-scripts'));
      assert(step.run.includes('./release/'));
    }
  }
});

test('documentation builds and packs once for the local check and all six consumer lanes', async() => {
  const workflow = parse(await readFile(resolve(import.meta.dirname, '../../.github/workflows/docs-pages.yml'), 'utf8'));
  assert.equal(workflow.env.MNJS_SKIP_PREPARE, '1');
  const build = workflow.jobs.build;
  assert.equal(build.steps.filter(step => step.run?.includes('release:artifact')).length, 1);
  assert(!build.steps.some(step => /npm pack/.test(step.run || '')));
  const check = workflow.jobs.documentation.steps.find(step => step.run?.includes('npm run docs:check'));
  assert.equal(workflow.jobs.documentation.needs, 'build');
  assert(!build.steps.some(step => /docs:check/.test(step.run || '')));
  assert.deepEqual(workflow.jobs.deploy.needs, ['documentation', 'consumer-lts']);
  assert.equal(check.env.MARIONETTE_ARTIFACT_DIR, '${{ github.workspace }}/test/tmp/candidate');
  assert.equal(workflow.jobs['consumer-lts'].strategy.matrix.node.length, 6);
  const steps = workflow.jobs['consumer-lts'].steps;
  assert(steps.findIndex(step => step.run?.includes('release:verify')) < steps.findIndex(step => step.name === 'Setup consumer Node'));
});
